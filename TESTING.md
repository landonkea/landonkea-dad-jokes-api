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

- **Unit Tests**: Test individual functions/components in isolation
- **Integration Tests**: Test API endpoints + database together (`server/src/__tests__/jokesRoutes.integration.test.ts`), exercises every route in `routes/jokes.ts` (filtering, sorting, pagination, validation, vote dedup, admin-gated delete, and the admin-gated moderation queue: submissions landing as `pending`, `GET /pending`, `POST /:id/approve`, `POST /:id/reject`) against a real PostgreSQL database via supertest. Requires a reachable Postgres instance (see `DB_*` env vars); locally this targets a separate `dad_jokes_test` database so it's safe to `TRUNCATE` between tests.
- **TDD**: Write tests first, then code to pass them
- **BDD**: Tests in plain English Given/When/Then format

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
