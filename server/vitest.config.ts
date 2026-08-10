// Import the Vitest configuration helper to define our test settings.
import { defineConfig } from 'vitest/config';

// Export the Vitest configuration so the test runner knows how to behave.
export default defineConfig({
  test: {
    // Enable global test functions (describe, it, expect) without needing to import them.
    // This matches Jest's behavior and keeps test files cleaner.
    globals: true,
    // Runs before the test suite executes. Ensures config/env.ts's required-var check
    // (DB_USER/DB_NAME) doesn't process.exit() a test run that never touches a real DB.
    setupFiles: ["./src/test/setup.ts"],
    // Explicitly exclude compiled output. Without this, a local "npm run build" (which
    // writes dist/__tests__/*.js right alongside dist/src) can leave stale CommonJS test
    // files that vitest picks up and fails to import ("Vitest cannot be imported in a
    // CommonJS module using require()"), duplicating and breaking otherwise-passing
    // src/__tests__ runs. CI never hits this (fresh checkout, no dist/ yet), but local
    // dev after a build does.
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
