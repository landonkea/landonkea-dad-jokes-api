// Import Vitest's test functions: describe groups tests, it defines a single test, expect makes assertions
import { describe, it, expect } from 'vitest';

// Import render (puts a component on the fake DOM) and screen (queries to find elements in it)
import { render, screen } from '@testing-library/react';
// Import the App component we're testing
import App from '../App';

// "describe" groups related tests together, this block is for all App tests
describe('App', () => {
  // "it" defines a single test case, this one checks that the app title renders
  it('renders the app title', () => {
    // Render the App component into the fake DOM provided by jsdom
    render(<App />);
    // screen.getAllByText finds all elements containing text matching the regex /Dad Jokes API/
    // .toBeGreaterThanOrEqual(1) asserts there's at least one match (the title appears in the Header and Marquee)
    expect(screen.getAllByText(/Dad Jokes API/).length).toBeGreaterThanOrEqual(1);
  });
});
