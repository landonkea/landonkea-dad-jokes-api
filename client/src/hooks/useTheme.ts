// Import useState for storing the current theme, and useEffect for applying it to the page
import { useState, useEffect } from "react";

// Define a TypeScript type that can only be "dark" or "light", prevents typos like "Dark" or "theme"
type Theme = "dark" | "light";

// Define the useTheme custom hook, manages the dark/light theme state and persists it to localStorage
export function useTheme() {
  // useState's callback form (passing a function) runs only once on first render.
  // It checks localStorage for a saved theme preference. If none exists, defaults to "dark".
  const [theme, setTheme] = useState<Theme>(() => {
    // Try to read the saved theme from the browser's localStorage (persists across page reloads)
    const saved = localStorage.getItem("dad-jokes-theme");
    // Cast it to Theme type. If nothing was saved, fall back to "dark" using || operator
    return (saved as Theme) || "dark";
  });

  // useEffect runs every time "theme" changes. It updates two things:
  useEffect(() => {
    // Set a data-theme attribute on the <html> element, CSS uses this to switch color schemes
    document.documentElement.setAttribute("data-theme", theme);
    // Save the theme choice to localStorage so it remembers after the user closes the browser
    localStorage.setItem("dad-jokes-theme", theme);
  }, [theme]); // Only re-run when theme changes

  // toggleTheme flips between "dark" and "light" using a ternary operator
  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  // Return the current theme and the toggle function so components can use them
  return { theme, toggleTheme };
}
