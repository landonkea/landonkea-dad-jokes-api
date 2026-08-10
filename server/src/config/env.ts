// This file validates that all required environment variables are set before the app starts.
// It "fails fast", meaning if something is misconfigured, we find out immediately
// instead of discovering it later with a mysterious crash.

// "required" is an array of environment variable names that MUST exist.
// "as const" tells TypeScript to treat this as a fixed, unchangeable list (not a mutable array).
// If DB_USER or DB_NAME is missing from the .env file, the server won't start at all.
const required = ["DB_USER", "DB_NAME"] as const;

// Loop through every required variable name using "for...of", this goes through the list one by one.
// "key" is the current variable name we're checking (first "DB_USER", then "DB_NAME").
for (const key of required) {
  // Check if this environment variable is missing or empty.
  // "process.env[key]" looks up the variable by name. If it's undefined or an empty string, that's falsy.
  if (!process.env[key]) {
    // Print a clear error message telling the developer exactly which variable is missing.
    // The backtick syntax lets us embed the variable name inside the string using ${key}.
    console.error(`Missing required environment variable: ${key}`);
    // Give the developer a hint about where to fix the problem.
    console.error("Check your .env file or environment configuration.");
    // Exit the entire Node.js process with exit code 1 (which means "failure").
    // This stops the server from starting with a broken configuration.
    process.exit(1);
  }
}

// Export a "config" object that other files can import to get all their configuration values.
// This centralizes all environment variable access in one place, a good practice.
export const config = {
  // The PostgreSQL username. The "!" after process.env.DB_USER is a TypeScript "non-null assertion."
  // It tells TypeScript "I promise this value exists", which is safe because we checked above.
  dbUser: process.env.DB_USER!,
  // The PostgreSQL database name. Same non-null assertion applies here.
  dbName: process.env.DB_NAME!,
  // The database host (server address). Uses "||" to fall back to "localhost" if not set.
  // This means in development you don't need to set DB_HOST, it defaults to your own machine.
  dbHost: process.env.DB_HOST || "localhost",
  // The database port. "parseInt" converts the string "5432" into the number 5432.
  // Falls back to 5432 (PostgreSQL's default port) if not specified.
  dbPort: parseInt(process.env.DB_PORT || "5432"),
  // The database password. Not in "required" above because local setups
  // (e.g. trust-auth Postgres on your own machine) often don't need one.
  // Falls back to "undefined" if not set, which lets "pg" use its own
  // fallback behavior instead of trying to authenticate with the literal
  // string "undefined".
  dbPassword: process.env.DB_PASSWORD || undefined,
  // The port this Express server listens on. Falls back to 3001 if not specified.
  // 3001 is a common choice for backend servers (3000 is often used for frontend dev servers).
  port: parseInt(process.env.PORT || "3001"),
  // The shared-secret token required to perform admin-only actions (like deleting a joke).
  // Not in "required" above, if it's left unset, admin routes fail closed (see adminAuth
  // middleware) rather than crashing the whole server on startup.
  adminToken: process.env.ADMIN_TOKEN || undefined,
// "as const" makes all properties readonly, you can't accidentally change them later.
} as const;
