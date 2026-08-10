// Import React so we can use JSX syntax to write HTML-like code in JavaScript
import React from "react";

// Define the Header component as a React Functional Component.
// It takes no props (empty parentheses) because it only displays static content.
export const Header: React.FC = () => {
  // Return JSX, this is what the component renders to the screen.
  return (
    <header className="header">
      <div className="header-content">
        <h1 className="header-title">
          <span className="emoji">😂</span>
          {" Dad Jokes API "}
          <span className="emoji">🤣</span>
        </h1>
        <p className="header-subtitle">
          Where every punchline is a groan-worthy masterpiece
        </p>
        <p className="header-warning">
          ⚠️ Warning: Prolonged exposure may cause involuntary puns, eye rolls, and
          telling your kids "I'm not funny, you just have low standards"
        </p>
      </div>
    </header>
  );
};
