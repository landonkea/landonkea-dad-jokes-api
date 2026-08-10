// Import the React library, needed to use React features like JSX and components
import React from "react";
// Import ReactDOM's createRoot API, this is the modern way to mount a React app (React 18+)
import ReactDOM from "react-dom/client";
// Import the App component, our main/root component that contains the entire app
import App from "./App";
// Import the ErrorBoundary component, catches JavaScript errors so the whole app doesn't crash
import { ErrorBoundary } from "./components/ErrorBoundary";
// Import our global CSS styles, colors, fonts, layout rules that apply to the whole app
import "./styles/global.css";

// Find the HTML element with id="root" (defined in index.html) and attach React to it.
// The "!" tells TypeScript "trust me, this element exists, don't worry about null."
// .createRoot() creates a React root, then .render() puts our component tree inside it.
ReactDOM.createRoot(document.getElementById("root")!).render(
  // React.StrictMode enables extra checks and warnings during development (helps catch bugs early)
  <React.StrictMode>
    {/* ErrorBoundary wraps the entire app so any crash shows a friendly error page instead of a blank screen */}
    <ErrorBoundary>
      {/* <App /> renders our main App component, this is the entry point for all our UI */}
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
