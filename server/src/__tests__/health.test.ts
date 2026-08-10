// Import testing utilities from Vitest (the test framework this project uses).
// "describe" groups related tests together (like chapters in a book).
// "it" defines a single test case (one specific thing to verify).
// "expect" is used to make assertions, it checks that something is true.
import { describe, it, expect } from 'vitest';

// "describe" creates a test suite called "Health check".
// All tests inside this block are related to verifying the app's basic health.
describe('Health check', () => {
  // "it" defines one individual test.
  // The string "should return true for a basic math check" is the test's name.
  // This is a "sanity check", if 1+1 isn't 2, something is deeply wrong!
  it('should return true for a basic math check', () => {
    // "expect(1 + 1)" creates an assertion about the expression 1 + 1.
    // ".toBe(2)" checks that the result equals 2 exactly.
    // If it doesn't match, the test fails and Vitest reports it.
    expect(1 + 1).toBe(2);
  });

  // This test verifies that a joke object has all the required fields.
  // It's not testing the actual database, it's testing that our data structure is correct.
  it('should verify joke data structure matches expected shape', () => {
    // Create a sample joke object that matches the shape we expect from the database.
    // This is called a "mock", a fake piece of data used for testing.
    const joke = {
      // Each field mirrors what a real joke looks like in our database.
      id: 1,
      setup: 'Test setup',
      punchline: 'Test punchline',
      category: 'classic',
      groan_level: 5,
      upvotes: 0,
      downvotes: 0,
      author: 'Test Dad',
      // "new Date()" creates a Date object with the current date/time.
      // This matches the "created_at" field in our database.
      created_at: new Date(),
    };
    // Check that the joke object has an "id" property.
    // "toHaveProperty" verifies the key exists on the object.
    expect(joke).toHaveProperty('id');
    // Check that the joke object has a "setup" property.
    expect(joke).toHaveProperty('setup');
    // Check that the joke object has a "punchline" property.
    expect(joke).toHaveProperty('punchline');
    // Check that groan_level is at least 1 (our database enforces this with a CHECK constraint).
    expect(joke.groan_level).toBeGreaterThanOrEqual(1);
    // Check that groan_level is at most 10 (the upper bound of our scale).
    expect(joke.groan_level).toBeLessThanOrEqual(10);
  });
});
