// Import the Pool class from the "pg" library (node-postgres).
// A "Pool" is a collection of database connections that can be reused.
// Instead of opening a new connection for every query (slow!), we reuse existing ones (fast!).
import { Pool } from "pg";
// Import our validated config object to get database credentials.
import { config } from "../config/env";

// Create a new connection pool with our database credentials.
// A pool manages multiple connections behind the scenes, you just call pool.query()
// and the pool handles borrowing and returning connections automatically.
const pool = new Pool({
  // The PostgreSQL username to authenticate with.
  user: config.dbUser,
  // The name of the specific database to connect to on the PostgreSQL server.
  database: config.dbName,
  // The database host (server address), e.g. "localhost" locally or "db"
  // inside docker-compose, where it resolves to the postgres service via
  // Docker's internal DNS. Without this, "pg" defaults to "localhost",
  // which inside a container refers to the container itself, not the
  // separate "db" service, so the connection would fail.
  host: config.dbHost,
  // The port PostgreSQL is listening on (defaults to 5432).
  port: config.dbPort,
  // The password to authenticate with. Falls back to undefined if not set,
  // which lets "pg" fall back to its own defaults (e.g. trust auth, or the
  // PGPASSWORD env var) for local setups that don't require one.
  password: config.dbPassword,
});

// Register an error handler for the pool.
// If a database connection unexpectedly disconnects or throws an error,
// this handler logs it so the developer knows something went wrong.
// Without this, the server might silently crash on database errors.
pool.on("error", (err) => {
  // Log the unexpected error to the server console for debugging.
  console.error("Unexpected database error:", err);
});

// Export the pool as the default export so other files can import it.
// Any file that needs to query the database will do: import pool from "../db/pool"
// and then use pool.query("SELECT ...") to run SQL queries.
export default pool;
