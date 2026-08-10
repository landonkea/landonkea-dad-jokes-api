// Vitest setup file, run once before the test suite executes.
//
// config/env.ts calls process.exit(1) at import time if DB_USER or DB_NAME are missing,
// that's the right behavior for the real server (fail fast on misconfiguration), but it's
// hostile to unit tests that import something which transitively pulls in config/env.ts
// (e.g. middleware/adminAuth.ts) without needing a real database at all.
//
// We load .env (same as index.ts does) so a real local setup still exercises real values,
// then fall back to harmless placeholders for anything still missing. dotenv.config() never
// overwrites a variable that's already set (e.g. by CI), so this is safe in both places.
import dotenv from "dotenv";

dotenv.config();

process.env.DB_USER = process.env.DB_USER || "test_user";
process.env.DB_NAME = process.env.DB_NAME || "test_db";
