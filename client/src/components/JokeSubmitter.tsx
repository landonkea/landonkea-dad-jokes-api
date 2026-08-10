// Import React and useState for managing the form's state
import React, { useState } from "react";
// Import the API function that sends a new joke to the server
import { submitJoke } from "../hooks/useJokes";
// Import the Toast component for showing success/error notifications
import { Toast } from "./Toast";

// Define the props that JokeSubmitter accepts
interface JokeSubmitterProps {
  // A callback function the parent provides, called after a joke is successfully submitted
  onJokeSubmitted: () => void;
}

// A mapping of groan level numbers to funny descriptive labels.
// Used next to the groan level slider so the user knows what each number means.
const GROAN_LABELS: Record<number, string> = {
  1: "😐 barely a chuckle",
  2: "🙂 mild amusement",
  3: "😏 a sly grin",
  4: "🤣 a solid snort",
  5: "😤 respectable groan",
  6: "😤😤 a double groan",
  7: "😫 eye roll + sigh",
  8: "💀 soul-leaving-the-body",
  9: "🫠 complete physical collapse",
  10: "☠️ transcendent groan, your dad would weep",
};

// The JokeSubmitter component renders a form for users to submit their own dad jokes
export const JokeSubmitter: React.FC<JokeSubmitterProps> = ({ onJokeSubmitted }) => {
  // Each piece of form data gets its own state variable
  const [setup, setSetup] = useState("");                        // The setup line text, starts empty
  const [punchline, setPunchline] = useState("");                // The punchline text, starts empty
  const [category, setCategory] = useState("classic");           // Selected category, defaults to "classic"
  const [groanLevel, setGroanLevel] = useState(5);               // Groan rating slider, defaults to middle (5)
  const [author, setAuthor] = useState("");                      // Author name, starts empty
  const [submitting, setSubmitting] = useState(false);           // Whether the form is currently submitting
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null); // Submission result message
  const [toastVisible, setToastVisible] = useState(false);       // Whether the success toast is showing

  // Handle the form submission when the user clicks the submit button
  const handleSubmit = async (e: React.FormEvent) => {
    // Prevent the browser's default form behavior (which would reload the page)
    e.preventDefault();
    // Don't submit if the setup or punchline fields are empty (after trimming whitespace)
    if (!setup.trim() || !punchline.trim()) return;

    setSubmitting(true);    // Show the submitting state on the button
    setResult(null);        // Clear any previous result message

    try {
      // Send the joke data to the server via POST request
      await submitJoke({
        setup: setup.trim(),              // Trim whitespace from the setup
        punchline: punchline.trim(),      // Trim whitespace from the punchline
        category,                          // The selected category string
        groan_level: groanLevel,           // The groan rating from the slider
        author: author.trim() || "Anonymous Dad", // Use entered name, or default if empty
      });
      // Store a success message to display below the form. The joke doesn't go
      // live immediately, it lands in the moderation queue (see ModerationQueue)
      // as "pending" until an admin approves it, so set expectations accordingly.
      setResult({
        success: true,
        message: "🎉 Joke submitted! It's awaiting review by the Groan Council before it goes live.",
      });
      // Show the success toast notification
      setToastVisible(true);
      // Auto-hide the toast after 3 seconds
      setTimeout(() => setToastVisible(false), 3000);
      // Reset all form fields back to their defaults
      setSetup("");
      setPunchline("");
      setAuthor("");
      setGroanLevel(5);
      // Tell the parent component to refresh the joke list
      onJokeSubmitted();
    } catch (err) {
      // If submission failed, show the error message from the server
      setResult({ success: false, message: (err as Error).message });
    } finally {
      // Turn off the submitting state whether it succeeded or failed
      setSubmitting(false);
    }
  };

  return (
    <div className="joke-submitter">
      {/* Success toast that appears when a joke is submitted */}
      <Toast
        message="🏅 Your joke has been enshrined in the Hall of Groans!"
        type="success"
        visible={toastVisible}
      />
      {/* Title for the submission form */}
      <h3 className="submitter-title">Submit Your Dad Joke</h3>
      {/* Fun subtitle encouraging the user to share */}
      <p className="submitter-subtitle">
        Share the pain. Let others groan at your humor. Remember: if your kids
        don't sigh, it's not a dad joke.
      </p>

      {/* The actual form element, onSubmit fires when the user clicks the submit button */}
      <form onSubmit={handleSubmit} className="submitter-form">
        {/* Setup field group, label + text input for the first part of the joke */}
        <div className="form-group">
          <label htmlFor="setup">Setup (The wind-up)</label>
          <input
            id="setup"
            type="text"
            value={setup}
            onChange={(e) => setSetup(e.target.value)}
            placeholder="I'm afraid for the calendar..."
            required
            maxLength={500}
          />
        </div>
        {/* Punchline field group, label + text input for the funny payoff line */}
        <div className="form-group">
          <label htmlFor="punchline">Punchline (The groan inducer)</label>
          <input
            id="punchline"
            type="text"
            value={punchline}
            onChange={(e) => setPunchline(e.target.value)}
            placeholder="Its days are numbered."
            required
            maxLength={500}
          />
        </div>
        {/* Row containing category dropdown and author name side by side */}
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="category">Category</label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="classic">Classic</option>
              <option value="puns">Puns</option>
              <option value="animals">Animals</option>
              <option value="food">Food</option>
              <option value="science">Science</option>
              <option value="math">Math</option>
              <option value="smart">Big Brain</option>
              <option value="work">Work</option>
              <option value="geography">Geography</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="author">Your Dad Name</label>
            <input
              id="author"
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Anonymous Dad"
              maxLength={100}
            />
          </div>
        </div>
        {/* Groan level slider with a label showing the current value and its funny description */}
        <div className="form-group">
          <label htmlFor="groan">
            Groan Level: {groanLevel}/10
            {/* Look up the funny label for the current groan level number */}
            <span className="groan-preview">, {GROAN_LABELS[groanLevel]}</span>
          </label>
          <input
            id="groan"
            type="range"
            min={1}
            max={10}
            value={groanLevel}
            onChange={(e) => setGroanLevel(parseInt(e.target.value))}
            className="groan-slider"
          />
        </div>
        {/* Submit button, disabled while submitting or if required fields are empty */}
        <button
          type="submit"
          className="btn btn-submit"
          disabled={submitting || !setup.trim() || !punchline.trim()}
        >
          {/* Show a funny loading message while submitting, otherwise show the normal label */}
          {submitting ? "Consulting the Dad Council..." : "🎤 Drop the Punchline"}
        </button>
        {/* If there's a result message (success or error), display it below the button */}
        {result && (
          <div className={`submitter-result ${result.success ? "success" : "error"}`}>
            {result.message}
          </div>
        )}
      </form>
    </div>
  );
};
