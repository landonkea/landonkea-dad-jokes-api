// Import defineConfig from vitest/config, same helper pattern as vite.config.ts, but for test settings
import { defineConfig } from 'vitest/config';
// Import the React plugin so Vitest can understand JSX syntax in our test files
import react from '@vitejs/plugin-react';

// Export a configuration object that Vitest reads when we run "npm run test:run"
export default defineConfig({
  // Enable the React plugin so .tsx test files compile correctly
  plugins: [react()],
  // The "test" section contains all Vitest-specific settings
  test: {
    // globals: true lets us use describe/it/expect WITHOUT importing them in every test file
    globals: true,
    // environment: "jsdom" simulates a real browser DOM (document, window, etc.) inside Node.js
    // This is needed because React components render to the DOM, and jsdom provides that
    environment: 'jsdom',
    // setupFiles runs this file before every test suite, it imports custom matchers like toBeInTheDocument
    setupFiles: './src/test/setup.ts',
    // css: true tells Vitest to process CSS imports instead of ignoring them (prevents errors)
    css: true,
  },
});
