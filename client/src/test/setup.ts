// Import @testing-library/jest-dom, adds custom DOM matchers like toBeInTheDocument() and toHaveClass()
// This file runs automatically before every test (configured in vitest.config.ts via setupFiles)
import '@testing-library/jest-dom';

// Mock localStorage for jsdom test environment (jsdom doesn't provide localStorage by default)
// This prevents "Cannot read properties of undefined (reading 'getItem')" errors in hooks that use localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}; // Internal storage object to hold key-value pairs
  return {
    getItem: (key: string) => store[key] ?? null, // Returns value or null if key doesn't exist
    setItem: (key: string, value: string) => { store[key] = value; }, // Stores a key-value pair
    removeItem: (key: string) => { delete store[key]; }, // Removes a key-value pair
    clear: () => { store = {}; }, // Clears all stored items
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock }); // Attaches the mock to the window object
