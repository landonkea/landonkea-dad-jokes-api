# Testing Guide

## Quick Start

```bash
# Run all client tests
cd client && npm test

# Run all server tests
cd server && npm test

# Run once (no watch mode)
npm run test:run
```

## Test Types

- **Unit Tests**: Test individual functions/components in isolation, e.g. `server/src/__tests__/pagination.test.ts` and `server/src/__tests__/sortOptions.test.ts` check the query-building helpers directly, without a network call in sight.
- **Integration Tests**: Test API endpoints + database together (`server/src/__tests__/jokesRoutes.integration.test.ts`), exercises every route in `routes/jokes.ts` (filtering, sorting, pagination, validation, vote dedup, admin-gated delete, and the admin-gated moderation queue: submissions landing as `pending`, `GET /pending`, `POST /:id/approve`, `POST /:id/reject`) against a real PostgreSQL database via supertest. Requires a reachable Postgres instance (see `DB_*` env vars); locally this targets a separate `dad_jokes_test` database so it's safe to `TRUNCATE` between tests. `client/src/__tests__/JokeCard.voting.integration.test.tsx` does the same thing on the frontend: click upvote, confirm the count and the disabled state change together.
- **TDD**: Write the failing test before the code that makes it pass, then implement just enough to go green. `server/src/__tests__/adminAuth.test.ts` is a clean example — each `it()` names one specific auth outcome (missing header, wrong token, no `ADMIN_TOKEN` configured, matching token) that existed as a spec before `requireAdminToken` handled it. When you add a route or a component behavior, write the `describe`/`it` block for it first.
- **BDD**: Tests read as plain-English behavior statements, not implementation trivia. Compare the `describe`/`it` names in `adminAuth.test.ts` or `ModerationQueue.test.tsx` against their bodies — a non-coder can read `"rejects with 401 when the header value doesn't match"` and know what's being promised, then check the assertions to see it kept. New tests should follow that pattern: `describe` the unit under test, `it` a specific observable behavior in a full sentence.

## File Locations

- Client tests: `client/src/__tests__/`
- Server tests: `server/src/__tests__/`

## CI/CD

Tests run automatically via GitHub Actions on every push to `main` or `dev`, and on pull requests to `main`. The CI pipeline:

1. Spins up a PostgreSQL 16 service container
2. Installs root, server, and client dependencies
3. Runs server tests with test database credentials
4. Runs client tests

See `.github/workflows/ci.yml` for the full configuration.
