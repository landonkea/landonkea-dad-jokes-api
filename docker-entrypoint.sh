#!/bin/sh
# =============================================================================
# docker-entrypoint.sh, Container startup sequence for the "app" service
# =============================================================================
# WHAT: Runs before the Express server starts. Ensures the database schema
#       exists, seeds sample data on a brand-new/empty database, then hands
#       off to the server itself.
# WHY:  Without this, "docker compose up" boots the app against a Postgres
#       container that has no "jokes"/"votes" tables yet, and every route
#       that touches the database 500s with "relation \"jokes\" does not
#       exist". Running init (and a first-time seed) as part of container
#       startup means the stack is actually usable right after
#       "docker compose up --build", no manual "docker compose exec"
#       step required.
# HOW:  Retries db/init.js a few times (Postgres may not be accepting
#       connections the instant its container starts, since depends_on only
#       waits for the container to start, not for Postgres itself to be
#       ready), then runs the idempotent seed-if-empty check, then execs the
#       server so it becomes PID 1 and receives signals correctly.
# =============================================================================
set -e

echo "Waiting for database and ensuring schema exists..."
attempt=1
max_attempts=10
until node server/dist/db/init.js; do
  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "Database did not become ready after $max_attempts attempts. Giving up."
    exit 1
  fi
  echo "Database not ready yet (attempt $attempt/$max_attempts), retrying in 2s..."
  attempt=$((attempt + 1))
  sleep 2
done

echo "Seeding sample data if the database is empty..."
node server/dist/db/seedIfEmpty.js

echo "Starting server..."
# "exec" replaces this shell process with the node process instead of running it as a
# child, so node becomes PID 1 and correctly receives SIGTERM/SIGINT from Docker
# (e.g. "docker compose down") for a clean shutdown.
exec node server/dist/index.js
