// Import the Component base class, ErrorInfo for error details, and ReactNode for the children type
import { Component, ErrorInfo, ReactNode } from "react";

// Define the props (inputs) that ErrorBoundary accepts from its parent
interface Props {
  children: ReactNode;    // The child components this boundary wraps (usually <App /> or a section of UI)
  fallback?: ReactNode;   // Optional custom error UI to show instead of the default error screen
}

// Define the internal state that ErrorBoundary tracks
interface State {
  hasError: boolean;      // Whether an error has been caught, starts false
  error: Error | null;    // The actual Error object if one was caught, starts null
}

// Catches JavaScript errors anywhere in the child component tree
// Without this, a single error crashes the entire app
export class ErrorBoundary extends Component<Props, State> {
  // The constructor runs once when the component is first created
  constructor(props: Props) {
    // Always call super(props) first in a class component constructor
    super(props);
    // Initialize state with no error, nothing has gone wrong yet
    this.state = { hasError: false, error: null };
  }

  // React calls this static method automatically when a child throws an error.
  // It returns the new state that should be set (hasError: true plus the error object).
  static getDerivedStateFromError(error: Error): State {
    // Tell React "an error happened" and store the error for display
    return { hasError: true, error };
  }

  // React calls this after an error is caught. Use it for logging/reporting.
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error and the component stack trace to the browser console for debugging
    console.error("Error caught by boundary:", error, errorInfo);
  }

  // The render method decides what to display: error UI or normal children
  render() {
    // If an error was caught, show the error UI instead of the normal app
    if (this.state.hasError) {
      return (
        // Use the custom fallback if the parent provided one, otherwise use our default error page
        this.props.fallback || (
          <div style={{
            padding: "40px",                   // Inner spacing around the error message
            textAlign: "center",               // Center the text horizontally
            background: "#1a1a2e",             // Dark background color
            color: "#eee",                     // Light text color for contrast
            minHeight: "100vh",                // Fill the entire viewport height
            fontFamily: "system-ui, sans-serif", // Clean, modern font stack
          }}>
            {/* The main error heading */}
            <h1>💀 Something broke</h1>
            {/* A humorous sub-message explaining what happened */}
            <p style={{ color: "#aab", margin: "16px 0" }}>
              Even our error handler is groaning. Try refreshing the page.
            </p>
            {/* A button that reloads the page to recover from the error */}
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "12px 24px",          // Inner spacing for the button
                background: "#e94560",          // Red accent color
                color: "white",                 // White text
                border: "none",                 // No border
                borderRadius: "10px",           // Rounded corners
                cursor: "pointer",             // Show hand cursor on hover
                fontSize: "1rem",              // Standard text size
                fontWeight: 600,               // Semi-bold text
              }}
            >
              🔄 Try Again
            </button>
          </div>
        )
      );
    }
    // No error: render the child components normally (the entire app)
    return this.props.children;
  }
}
