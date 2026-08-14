# Build Log

This is the resurrection document for the Dad Jokes API. Two things live here:

1. A real history of how this repo got built, taken straight from `git log`, not a guess at what "probably" happened.
2. A rebuild spec detailed enough that if every file in this repo vanished except this one, someone (or something) could recreate an equivalent, working project without needing to ask a human a single clarifying question.

If you're reading this because the repo actually got wiped: skip to [Full Rebuild Spec](#full-rebuild-spec) and start at Phase 0.

---

## Part 1: How This Repo Actually Got Built

Source: `git log --reverse --oneline` on this repo, 25 non-merge commits from the first commit (`ba24b4d`, July 25) through the most recent (`a2842f8`). Dependabot version-bump merges are real commits too, but they don't tell a story, so they're summarized rather than narrated one by one.

### Phase 1: Bootstrap (`ba24b4d`, `1b4b556`, `4200027`)

The very first commit did all of this in one shot: an Express + TypeScript backend talking to PostgreSQL, a React + TypeScript frontend on Vite, full CRUD for jokes, a voting system, category filtering, a stats dashboard, and a dark neon UI with confetti and floating particles. 9,526 lines added, 37 files, nothing held back for later. That's unusual for a "real" project (most start smaller), but it's what the log shows.

Two follow-up commits cleaned up: a JSX comment placement bug that broke `App.tsx` and `JokeSubmitter.tsx`, then a pass adding comments, a test setup, and the README.

### Phase 2: Production hardening (`d4ec479`, `1d83ec4`)

This is where the app stopped being a toy. One commit (merged from a `dev` branch) added: an error boundary on the client, `express-rate-limit` on the API, Zod input validation, a dark/light theme toggle, skeleton loading states, a first CI/CD workflow, a Dockerfile, and environment variable validation at server startup (`server/src/config/env.ts`, fails fast if `DB_USER` or `DB_NAME` is missing instead of crashing mysteriously later).

### Phase 3: Fixing what hardening broke (`b3b4792`, `f2c4817`, `8a44628`)

Comments and TypeScript error fixes, a test-failure fix, and a fix for invalid SQL comment syntax and missing semicolons in `db/init.ts`. The kind of commits that happen right after a big feature lands and you actually run the thing.

### Phase 4: Dependency hygiene (`d3228d8` + a run of Dependabot merges)

`d3228d8` added `tsc --noEmit` typecheck steps to CI and configured Dependabot for npm. What follows is a long run of Dependabot PRs and merges: TypeScript 5.9 → 7.0 (both server and client), Express + `@types/express` bump, `dotenv` 16 → 17, `express-rate-limit` 8.6.0 → 8.6.1, `@types/node` 20 → 26, React + `@types/react` + `@types/react-dom` bumps, `jsdom` 29 → 30, and `vite` 5 → 8 (which forced a matching `@vitejs/plugin-react` bump to stay compatible, plugin-react 4 doesn't work with Vite 8). Ten PRs total (`#1` through `#11`, no `#5` in the visible history).

One of those bumps, a `brace-expansion` transitive dependency, patched a real DoS vulnerability (`b28d09c`).

### Phase 5: Real features, not just scaffolding (`a835a8f`, `7190c60`, `2d86256`, `90fed24`, `4570070`, `ee73e9e`)

This stretch is where the app grew actual product behavior:

- **`a835a8f`**: fixed a bug in the "controversial" sort, added pagination, vote deduplication (an IP can't vote twice on the same joke, see the `votes.voter_ip` column and the check in `POST /api/jokes/vote`), admin-gated delete, and security headers (`helmet`).
- **`7190c60`**: fixed the Docker build (it was shipping without ever running `tsc`, so `server/dist/index.js` never existed) and fixed DB connection config that was silently ignoring `DB_HOST`/`DB_PORT`/`DB_PASSWORD`.
- **`2d86256`**: added real integration tests against a live Postgres database and enforced a fixed category taxonomy (`JOKE_CATEGORIES` in `server/src/validation/jokeSchema.ts`) instead of accepting any string, which had been silently fragmenting category counts.
- **`90fed24`**: fixed the Docker stack end-to-end, added a CI job that builds the image and smoke-tests it against a real Postgres service container, and started persisting a test-results artifact.
- **`4570070`**: added the moderation queue. Every joke submitted through `POST /api/jokes` now lands as `status: 'pending'` and is invisible to the public API until an admin approves it via `POST /api/jokes/:id/approve`. This closed a real gap: before this commit, any submission (including spam) went straight onto the live, votable list.
- **`ee73e9e`**: added Postgres trigram search (`pg_trgm` extension, GIN indexes on `setup` and `punchline`) so `GET /api/jokes?q=` supports both substring and typo-tolerant fuzzy matching, scoped to approved jokes only.

### Phase 6: CI reliability and process guardrails (`4ecce95`, `baf7048`, `f93d300`, `d80dec8`, `d743d00`)

- `4ecce95` fixed a real YAML footgun: inline `#` comments inside a folded block scalar (`>-`) in `ci.yml` aren't comments, they're literal text, and they were corrupting the Postgres service container's health-check flags.
- `baf7048` bumped CI's Node from 20 to 22 because jsdom 30 calls a Node internal (`webidl.util.markAsUncloneable`) that Node 20 doesn't have, crashing every client-side Vitest run.
- `f93d300` and `d743d00` added and then hardened a CI check (`.github/workflows/ai-attribution-check.yml`) that blocks commits containing AI tool attribution in the author/committer fields or commit body.
- `d80dec8` is an empty "trigger GitHub re-index" commit.

### Phase 7: Docs and polish (`7f123ea`, `fdd8d97`)

Added `docs/DESIGN.md` (Mermaid architecture, request flow, and moderation flow diagrams), then a pass removing em dashes from markdown files and source code.

### Phase 8: Test coverage (`a2842f8`, most recent)

Full unit, integration, and e2e coverage: Vitest + Supertest for the server (81 tests across 5 files: routing, pagination, sort order, admin-token auth, the full moderation lifecycle), Vitest + React Testing Library for the client (22 tests across 5 files, including an integration test that clicks the upvote button and checks the count and disabled state update together), and a Playwright e2e spec (`e2e/joke-voting.spec.ts`) that drives a real Chromium browser through the real UI against a real dev server and a freshly reseeded database.

### What the log does NOT show

No commit adds a `landonkea-` prefix rename, no commit references cloud hosting, no commit sets up a dev/staging/prod split. Those are new as of this document, see the rest of this build log and the sibling files it introduces (`FEATURE_IDEAS.md`, the `.env.dev`/`.env.staging`/`.env.prod` files, and `docker-compose.dev.yml`/`.staging.yml`/`.prod.yml`).

---

## Full Rebuild Spec

Everything below is written so an autonomous coding agent (or a patient human) can recreate a working equivalent of this repo from an empty directory, with no human answering questions along the way. Where the original commit history mattered (why a decision was made), that's noted so the rebuild doesn't repeat the same mistakes the real history had to fix.

Tooling used at time of writing: Node.js v26, npm 11. The `package.json` files pin dependencies with `^` ranges, so a rebuild done later will pull newer patch/minor versions, that's expected and matches how this repo actually grew (see Phase 4 above).

### Phase 0: Prerequisites

- Node.js 18+ (CI runs 22; local dev has been run on 20 and 26)
- PostgreSQL 16 (or `postgres:16-alpine` via Docker)
- Git

### Phase 1: Root scaffold

Create the project root with this exact structure:

```
dad-jokes-api/
├── package.json
├── .gitignore
├── server/
├── client/
├── database/          (empty placeholder directory, kept for future migration files)
├── docs/
├── scripts/
└── e2e/
```

Root `package.json`:

```json
{
  "name": "dad-jokes-api",
  "version": "1.0.0",
  "description": "The most giggle-worthy dad jokes platform. Because puns are a parent's weapon.",
  "private": true,
  "scripts": {
    "setup": "npm install && cd server && npm install && cd ../client && npm install",
    "db:init": "cd server && npx tsx -r dotenv/config src/db/init.ts",
    "db:seed": "cd server && npx tsx -r dotenv/config src/db/seed.ts",
    "server": "cd server && npm run dev",
    "client": "cd client && npm run dev",
    "start": "concurrently \"npm run server\" \"npm run client\"",
    "dev": "npm run start",
    "test:summary": "node scripts/generate-test-summary.js",
    "test:e2e": "playwright test"
  },
  "devDependencies": {
    "@playwright/test": "^1.62.1",
    "concurrently": "^8.2.2"
  }
}
```

`.gitignore` must exclude: `node_modules/`, `dist/`, `.env` (exact match, not `.env*`, the per-environment template files described in Phase 9 below are meant to be tracked), `*.log`, `.DS_Store`, `test-results/`, `playwright-report/`, `blob-report/`.

### Phase 2: Backend (`server/`)

`server/package.json`:

```json
{
  "name": "dad-jokes-server",
  "version": "1.0.0",
  "scripts": {
    "dev": "tsx watch -r dotenv/config src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest",
    "test:run": "vitest run"
  },
  "dependencies": {
    "compression": "^1.8.1",
    "cors": "^2.8.5",
    "dotenv": "^17.4.2",
    "express": "^5.2.1",
    "express-rate-limit": "^8.6.1",
    "helmet": "^8.3.0",
    "pg": "^8.12.0",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@types/compression": "^1.8.1",
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.6",
    "@types/node": "^26.1.2",
    "@types/pg": "^8.10.9",
    "@types/supertest": "^7.2.1",
    "supertest": "^7.2.2",
    "tsx": "^4.23.12",
    "typescript": "^7.0.2",
    "vitest": "^4.1.10"
  }
}
```

Build these files, in this order (each depends on the ones before it):

1. **`server/src/config/env.ts`**: validate `process.env.DB_USER` and `process.env.DB_NAME` are set, `process.exit(1)` with a clear message if not. Export a `config` object with `dbUser`, `dbName`, `dbHost` (default `"localhost"`), `dbPort` (default `5432`), `dbPassword` (default `undefined`), `port` (default `3001`), `adminToken` (default `undefined`).

2. **`server/src/types/index.ts`**: `Joke` interface (`id`, `setup`, `punchline`, `category`, `groan_level`, `upvotes`, `downvotes`, `created_at`, `author`, `status: "pending" | "approved" | "rejected"`), `JokeInput` (setup/punchline required, category/groan_level/author optional), `VotePayload` (`joke_id: number`, `vote_type: "up" | "down"`), `ApiResponse<T>` (`success: boolean`, `data?: T`, `error?: string`, `pagination?: { page, limit, offset, total, total_pages }`), `StatsResponse`.

3. **`server/src/validation/jokeSchema.ts`**: Zod schemas. `JOKE_CATEGORIES` as a fixed const tuple: `["classic", "puns", "animals", "food", "science", "math", "smart", "work", "geography"]`. This list must stay in sync with the client's category dropdown, the original history added this enum specifically because an unconstrained string category was fragmenting `/api/jokes/categories` counts. `jokeInputSchema`: setup (5-500 chars), punchline (2-500 chars), category (enum of `JOKE_CATEGORIES`, default `"classic"`), groan_level (int 1-10, default 5), author (max 100 chars, default `"Anonymous Dad"`). `voteInputSchema`: joke_id (positive int), vote_type (enum `"up" | "down"`).

4. **`server/src/db/schema.ts`**: export `SCHEMA_SQL`, a single SQL string containing (in order): `CREATE EXTENSION IF NOT EXISTS pg_trgm;`, `CREATE TABLE IF NOT EXISTS jokes (id SERIAL PRIMARY KEY, setup TEXT NOT NULL, punchline TEXT NOT NULL, category VARCHAR(50) DEFAULT 'classic', groan_level INTEGER DEFAULT 5 CHECK (groan_level BETWEEN 1 AND 10), upvotes INTEGER DEFAULT 0, downvotes INTEGER DEFAULT 0, author VARCHAR(100) DEFAULT 'Anonymous Dad', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`, `CREATE TABLE IF NOT EXISTS votes (id SERIAL PRIMARY KEY, joke_id INTEGER REFERENCES jokes(id) ON DELETE CASCADE, vote_type VARCHAR(4) NOT NULL CHECK (vote_type IN ('up','down')), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`, `ALTER TABLE votes ADD COLUMN IF NOT EXISTS voter_ip VARCHAR(45);`, `ALTER TABLE jokes ADD COLUMN IF NOT EXISTS status VARCHAR(10) NOT NULL DEFAULT 'approved' CHECK (status IN ('pending','approved','rejected'));` (default `'approved'`, not `'pending'`, this makes the migration safe against an existing table with data, grandfathering old rows in as already-approved), indexes on `category`, `groan_level`, `votes(joke_id)`, `votes(joke_id, voter_ip)`, `(upvotes - downvotes)`, `status`, and GIN trigram indexes on `setup` and `punchline` using `gin_trgm_ops` (kept as two separate indexes rather than one concatenated index, so a search that only matches one column can still use an index).

5. **`server/src/db/pool.ts`**: a `pg.Pool` built from `config`, exported as default.

6. **`server/src/db/init.ts`**: connects to the admin `postgres` database first (you can't create a database while connected to it), checks if `config.dbName` exists, creates it if not, then connects to it and runs `SCHEMA_SQL`. Must be runnable as a script (calls itself and `process.exit`s) so `docker-entrypoint.sh` (Phase 5) can retry it in a loop.

7. **`server/src/db/seed.ts`**: export `seedDB()`, which truncates `jokes`/`votes` and inserts 30 hand-written dad jokes spread across the 9 categories with varied `groan_level` and random-ish vote counts. Also runnable standalone via `npm run db:seed`.

8. **`server/src/db/seedIfEmpty.ts`**: idempotent variant, `SELECT COUNT(*) FROM jokes`, only calls `seedDB()` if the count is 0. This exists specifically so restarting an already-seeded Docker stack doesn't wipe out real votes by re-running seed's truncate-then-insert.

9. **`server/src/middleware/rateLimiter.ts`**: `apiLimiter` (100 req / 15 min per IP, mounted on all `/api` routes) and `voteLimiter` (30 req / 15 min per IP, stricter because voting writes to the DB), both via `express-rate-limit`, both with a friendly on-brand `message`.

10. **`server/src/middleware/adminAuth.ts`**: `requireAdminToken` middleware. If `config.adminToken` is unset, fail closed with 503 (never silently allow unauthenticated admin actions). Otherwise compare the `x-admin-token` header against `config.adminToken`, 401 on mismatch/missing.

11. **`server/src/middleware/errorHandler.ts`**: catch-all Express error handler, returns a JSON `{ success: false, error }` with 500, registered last in the middleware chain.

12. **`server/src/utils/pagination.ts`**: pure function `parsePagination(query)` → `{ limit, offset, page }`, bounded/sane defaults, unit-testable without a database.

13. **`server/src/utils/sortOptions.ts`**: pure function `getSortClause(sort?: string)` → a SQL `ORDER BY` fragment. Supports at least: newest (`created_at DESC`), top/score (`upvotes - downvotes DESC`), groan level, and "controversial" (a scoring formula that favors jokes with both high engagement and a close upvote/downvote split, this had a real bug fixed in commit `a835a8f`, so write a unit test asserting a joke with 50/50 votes ranks above a joke with 5/0 votes before trusting the formula).

14. **`server/src/routes/jokes.ts`**: mounted at `/api/jokes` in `app.ts`. Routes, in this exact declaration order (order matters, Express matches path patterns in registration order, so literal-path routes like `/pending` and `/vote` must be declared before the `/:id` catch-all, or `/:id` swallows them):
    - `GET /`: list, filtered to `status = 'approved'`. Query params: `category` (exact match), `q` (search, see below), `sort`, `page`/`limit`/`offset`. Returns `{ success, data, pagination }`.
    - `GET /random`: one random approved joke (`ORDER BY RANDOM() LIMIT 1`), 404 if the table is empty.
    - `GET /categories`: `category, COUNT(*)` grouped, approved only, sorted by count descending.
    - `GET /stats`: total_jokes, total_votes, avg_groan_level, most_upvoted joke, category_counts, and pending_count (count of `status = 'pending'` rows, not admin-gated, it's just a number, used to badge the moderation tab).
    - `GET /pending` (admin): paginated list of `status = 'pending'` jokes, oldest first.
    - `GET /:id`: single approved joke, 404 for missing or non-approved (don't leak which ids exist but aren't approved).
    - `POST /`: validate via `jokeInputSchema`, insert with `status = 'pending'` always (never directly approved, this is the moderation queue added in `4570070`).
    - `POST /vote` (rate-limited via `voteLimiter`): validate via `voteInputSchema`, 404 if the joke isn't approved, check `votes` table for an existing row with the same `joke_id` + IP and 409 if found, otherwise insert the vote and increment `upvotes`/`downvotes`.
    - `POST /:id/approve` (admin): `UPDATE ... WHERE id = $1 AND status = 'pending'`, distinguish "doesn't exist" (404) from "exists but wasn't pending" (409) by a follow-up lookup when the update affects 0 rows.
    - `POST /:id/reject` (admin): same shape as approve, sets `status = 'rejected'` and keeps the row (don't delete, the queue is a record of what was turned down).
    - `DELETE /:id` (admin): hard delete, returns the deleted row.

    Search (`?q=`) implementation: relies on `pg_trgm`. Add the search term to the `WHERE` clause as `ILIKE '%term%' OR similarity(...) > 0.2` on both `setup` and `punchline`, and when a search term is present, override the normal sort with `GREATEST(similarity(setup, $n), similarity(punchline, $n)) DESC`, best-match-first beats "most upvoted" when someone is searching.

15. **`server/src/app.ts`**: builds and exports the Express app (without calling `.listen()`, so integration tests can import the exact same app via `supertest`). Middleware order: `helmet()`, `cors()`, `compression()`, `express.json()`, `apiLimiter` on `/api`, mount `jokesRouter` at `/api/jokes`, `GET /api/health` (returns `{ status: "alive", message, uptime: process.uptime() }`), static-serve `client/dist` if it exists (production Docker image ships it there) with an SPA fallback for any non-API GET, then `errorHandler` registered last.

16. **`server/src/index.ts`**: imports `app` from `./app`, calls `app.listen(config.port, ...)`.

17. Tests in `server/src/__tests__/`: `health.test.ts`, `adminAuth.test.ts` (missing header / wrong token / unset `ADMIN_TOKEN` / matching token, one `it()` per outcome), `pagination.test.ts`, `sortOptions.test.ts` (unit, no DB), `jokesRoutes.integration.test.ts` (full route coverage against a real `dad_jokes_test` Postgres database via supertest). Use `vitest.config.ts` and a `src/test/setup.ts` that truncates test tables between runs.

### Phase 3: Frontend (`client/`)

`client/package.json` dependencies: `react` ^19.2.8, `react-dom` ^19.2.8. Dev dependencies: `@testing-library/jest-dom` ^7, `@testing-library/react` ^16.3.2, `@types/react`/`@types/react-dom` ^19, `@vitejs/plugin-react` ^6.0.4 (must match the Vite major version, plugin-react 4 breaks against Vite 8, this was a real fix in the Dependabot history), `jsdom` ^30, `typescript` ^7, `vite` ^8, `vitest` ^4.

Build, in order:

1. **`client/vite.config.ts`**: dev-server proxy so `/api` requests forward to `http://localhost:3001` (must match `server/.env`'s `PORT`).
2. **`client/src/hooks/useJokes.ts`**: `fetchRandomJoke`, `fetchJokes`, `voteJoke`, `submitJoke`, `fetchStats`, `fetchPendingJokes`, `approveJoke`, `rejectJoke`, thin fetch wrappers, one per API route.
3. **`client/src/hooks/useRandomJoke.ts`**: fetches on mount, tracks loading/error, exposes `refresh()`.
4. **`client/src/hooks/useTheme.ts`**: dark/light theme state persisted to `localStorage`.
5. **`client/src/utils/votedJokes.ts`**: tracks which joke ids the current browser has already voted on (client-side, `localStorage`-backed, the server-side dedup is by IP, this is a UX nicety on top so a button can show "already voted" immediately without a round trip).
6. **Components** (`client/src/components/`): `Header`, `JokeCard` (setup/punchline reveal, voting, confetti on upvote), `JokeList` (browsable, expandable), `CategoryPicker`, `JokeSubmitter` (form with a groan-level slider), `StatsPanel`, `ModerationQueue` (admin-token-gated, the "Moderate" tab, lists pending jokes with approve/reject buttons), `Particles` (floating emoji background), `Marquee` (scrolling joke ticker), `Confetti`, `Toast`, `ErrorBoundary`, `ThemeToggle`, `Skeleton` (shimmer loading placeholders).
7. **`client/src/App.tsx`**: five tabs (Random Joke, Browse, Submit, Stats, Moderate) mapped to the components above, plus `Particles` and `Marquee` rendered persistently in the background.
8. **`client/src/styles/global.css`**: dark neon theme, glassmorphism cards, animations, responsive layout. No CSS framework.
9. Tests in `client/src/__tests__/`: `App.test.tsx`, `JokeCard.voting.integration.test.tsx` (click upvote, assert count and disabled state update together), `ModerationQueue.test.tsx`, `useJokes.test.ts`, `votedJokes.test.ts`.

### Phase 4: Environment template

`server/.env.example` (committed; `server/.env` itself is real-secrets and gitignored):

```
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=dad_jokes
PORT=3001
ADMIN_TOKEN=changeme
```

Generate a real `ADMIN_TOKEN` for actual use with `openssl rand -hex 32`, never commit a real one.

### Phase 5: Docker

`Dockerfile`: three-stage build. `server-build` (Node 20-alpine, `npm ci` including devDependencies, `npm run build` to compile TypeScript to `server/dist`). `client-build` (separate clean stage, `npm ci`, `npm run build` to produce `client/dist`). `production` (fresh Node 20-alpine, `npm ci --only=production` for server deps only, copies compiled `server/dist` and `client/dist` from the earlier stages, never the source or devDependencies, plus `docker-entrypoint.sh`). This three-stage split exists because an earlier version of the build (fixed in `7190c60`) shipped without ever running `tsc`, so the container had no `server/dist/index.js` to run.

`docker-entrypoint.sh`: retries `node server/dist/db/init.js` up to 10 times with a 2-second backoff (Postgres's container starting doesn't mean Postgres is accepting connections yet), then runs `node server/dist/db/seedIfEmpty.js`, then `exec node server/dist/index.js` (using `exec`, not a plain call, so the Node process becomes PID 1 and receives `SIGTERM` correctly from `docker compose down`).

`docker-compose.yml`: two services, `db` (`postgres:16-alpine`, named volume `pgdata` for persistence) and `app` (built from the root `Dockerfile`, `DB_HOST=db` so it resolves via Docker's internal DNS instead of `localhost`, `depends_on: [db]`).

### Phase 6: CI

`.github/workflows/ci.yml`, two jobs:

- **`test`**: Postgres 16 service container (`dad_jokes_test`, health-checked with `pg_isready`). Write the `options:` health-check flags as plain space-separated text, not with inline `#` comments: a folded YAML block scalar treats `#` as literal text, not a comment marker, and that corruption once broke every CI run needing Postgres. Installs root/server/client deps, typechecks both with `tsc --noEmit`, runs server tests (with `ADMIN_TOKEN=test-admin-token` so the delete/approve/reject integration tests aren't blocked by the fail-closed admin middleware), runs client tests, generates and uploads a `test-results/` artifact (`if: always()`, so a red build still leaves a diagnosable artifact).
- **`docker`**: builds the production image from the root Dockerfile, runs it against a Postgres service container, polls `/api/health` until it responds, then curls `/api/health` and `/api/jokes` to confirm the full stack (container, DB init, schema, seed, server) actually works, not just that `docker build` succeeded.

`.github/workflows/ai-attribution-check.yml`: scans recent commits (author/committer name and email, and the commit body for `Co-Authored-By`/`Generated with` lines) and scans tracked files for the same patterns, against a list of AI tool names and no-reply email domains. Fails the build on any match.

`.github/dependabot.yml`: npm ecosystem, configured for root, `server/`, and `client/`.

### Phase 7: Docs and testing guide

`README.md`: architecture diagram, tech stack table, getting-started steps, full file-by-file explanation, API endpoint table, production features section, Docker/CI sections, common-issues troubleshooting, and a testing summary.

`TESTING.md`: quick-start commands, an explanation of unit vs. integration test boundaries in this repo, and the TDD/BDD conventions actually followed (write the failing `describe`/`it` first, name it as a plain-English behavior statement).

`docs/DESIGN.md`: Mermaid diagrams for the component tree, the request flow, and the moderation flow.

### Phase 8: e2e

`playwright.config.ts` at the root, `e2e/joke-voting.spec.ts`: drives a real Chromium browser against the real dev server and a freshly reseeded database. Reveal a punchline, cast an upvote, browse the seeded list.

### Phase 9: Multi-environment pipeline (dev/staging/prod)

Everything in this phase is config and CI, not a live deployment. No hosting account exists yet for any of the three environments, so "staging" and "prod" here mean "the pipeline is ready the moment a host is chosen," not "something is currently running."

1. **`.dockerignore`**: excludes `node_modules`, `dist`, `.git`, and every `.env*` file from the Docker build context. Needed once more than one Dockerfile stage exists, without it, a `COPY server/ ./server/` (or `client/`) picks up the host's own `node_modules`, including any native binaries (`esbuild`, `lightningcss`) built for the host's OS, and layers them into a Linux Alpine container where they won't run.

2. **`Dockerfile`, fourth stage, `development`**: added between `client-build` and `production` (so `production` stays last and a plain `docker build .` with no `--target` keeps defaulting to it, unchanged from before this phase). Installs root, server, and client dependencies (including devDependencies like `tsx` and `vite`), copies the repo in as a fallback, and runs `npm run dev`. Exists so `docker-compose.dev.yml` can bind-mount live source over it for hot reload instead of rebuilding an image on every edit.

3. **`.env.dev` / `.env.staging` / `.env.prod`** (root-level, tracked): same variable shape as `server/.env.example`. `.env.dev` uses the same shared `postgres`/`postgres` local-dev defaults the root `docker-compose.yml` already uses, since dev owns a disposable database container. `.env.staging` and `.env.prod` use `REPLACE_ME_*` placeholders for `DB_HOST`/`DB_USER`/`DB_PASSWORD`/`ADMIN_TOKEN` instead of working values, because no staging or production database exists yet to point at. Each `DB_NAME` is environment-scoped (`dad_jokes_dev`/`dad_jokes_staging`/`dad_jokes_prod`) so the three environments, if they ever share a Postgres server, don't collide.

4. **`docker-compose.dev.yml`**: builds the `development` stage, bind-mounts `./server` and `./client` over the image, adds anonymous volumes over each `node_modules` path (same reasoning as `.dockerignore`, so the bind mounts don't shadow the container's own installed dependencies with the host's), and runs its own `postgres:16-alpine` container. Pinned to Compose project name `dad-jokes-dev` via the top-level `name:` field so it can coexist with the root `docker-compose.yml` and the staging/prod files without container-name collisions.

5. **`docker-compose.staging.yml`** and **`docker-compose.prod.yml`**: both build the `production` stage (the same target, deliberately, staging is only meaningful if it runs what prod runs) and load `.env.staging` / `.env.prod` respectively. Neither defines a local `db` service: both are meant to connect to a real, separately hosted Postgres instance once one exists, not a disposable container. Running `up` against the current placeholder env values will fail to connect to a database, that's expected until a real host is chosen and the `REPLACE_ME_*` values are replaced.

6. **`.github/workflows/deploy-dev.yml`**: builds the `development` stage and tags it `dad-jokes-api:dev-<sha>` on push to `dev`. Exists because `ci.yml`'s existing `docker` job only ever builds `production`, so a break specific to the `development` stage's build instructions wouldn't be caught otherwise.

7. **`.github/workflows/deploy-staging.yml`**: builds `production`, tags it `dad-jokes-api:staging-<sha>`, boots it against a real Postgres service container, and curls `/api/health` and `/api/jokes` (same smoke-test shape as `ci.yml`'s `docker` job) on push to `staging`. Proves the artifact that would be promoted to staging actually works.

8. **`.github/workflows/deploy-prod.yml`**: same build-and-smoke-test shape as staging, tagged `dad-jokes-api:prod-<sha>`, on push to `main`. Runs under `environment: production` in GitHub Actions terms, which doesn't require anything to be configured today (GitHub creates the environment with no protection rules on first use) but is what a required-reviewers gate would attach to later from the repo's Settings without touching the workflow file.

None of the three deploy workflows pushes an image anywhere or calls out to a hosting provider. Each ends with a `TODO` comment marking exactly where a registry push and real deploy step would go once a host is chosen for that environment. This is intentional: build and smoke-test the artifact in CI now, wire up the actual deploy later.

### Verification

After all phases, a rebuild is considered successful when all of these pass with zero manual intervention:

```bash
npm run setup
npm run db:init
npm run db:seed
cd server && npm run test:run && cd ..
cd client && npm run test:run && cd ..
npm run test:e2e
docker compose up --build   # then curl http://localhost:3001/api/health
docker build --target development -t dad-jokes-api:dev-check .
docker build --target production -t dad-jokes-api:prod-check .
```
