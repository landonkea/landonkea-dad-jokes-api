// Import React, useState for managing component state (voted, punchline visibility, toast, etc.),
// and useEffect to re-sync the "voted" state whenever a new random joke loads.
import React, { useEffect, useState } from "react";
// Import our custom hook that handles fetching and refreshing a random joke
import { useRandomJoke } from "../hooks/useRandomJoke";
// Import the API function that sends vote data to the server
import { voteJoke } from "../hooks/useJokes";
// Import the localStorage-backed "already voted" tracker, so a joke you've voted on
// before (it can come up again since /random picks randomly) stays disabled even
// after a page reload, and so the vote gets recorded for JokeList to see too.
import { getVoteFor, markVoted } from "../utils/votedJokes";
// Import the Confetti component for the celebratory particle effect when upvoting
import { Confetti } from "./Confetti";
// Import the Toast component for showing brief popup notifications
import { Toast } from "./Toast";
// Import the skeleton placeholder that shows while the joke is loading
import { JokeCardSkeleton } from "./Skeleton";

// Define reaction message buckets based on groan level.
// Each bucket has a minimum groan level and an array of funny reaction strings to randomly pick from.
// Higher groan levels get more dramatic reactions.
const REACTIONS = [
  // Groan level 9-10: extreme reactions, the joke was so bad it "ended" them
  { min: 9, texts: ["💀 That joke just ended me.", "🫠 I'm liquefied from that groan.", "⚰️ Call a priest, that joke was demonic."] },
  // Groan level 7-8: strong reactions, neighbors heard the groan
  { min: 7, texts: ["😤 My neighbors heard that groan.", "🙄 I rolled my eyes so hard they did a 360.", "🫡 Respect. That was painfully good."] },
  // Groan level 5-6: moderate reactions, respectable groans
  { min: 5, texts: ["😐 A solid 'dad nod' of approval.", "😤 A respectable groan. Father would be proud.", "🫢 I smiled. Don't tell anyone."] },
  // Groan level 0-4: mild reactions, surprisingly funny or barely a chuckle
  { min: 0, texts: ["😂 Wait... that was actually funny?", "🤨 Are you sure you're a dad?", "✨ A rare gem in a sea of groans."] },
];

// Helper function that picks a random reaction message based on the joke's groan level.
function getReaction(level: number): string {
  // Find the first bucket where the joke's groan level meets the minimum threshold.
  // The "!" asserts to TypeScript that we will always find a match (level 0+ always matches the last bucket).
  const bucket = REACTIONS.find((r) => level >= r.min)!;
  // Pick a random reaction string from that bucket's texts array.
  // Math.random() gives a number 0-1, multiply by array length, floor it to get a valid index.
  return bucket.texts[Math.floor(Math.random() * bucket.texts.length)];
}

// The JokeCard component displays a single random joke with voting, punchline reveal, and fun effects.
export const JokeCard: React.FC = () => {
  // Use our custom hook to get the current random joke, loading/error states, and a refresh function
  const { joke, loading, error, refresh } = useRandomJoke();
  // Track whether the user has voted on this joke: "up", "down", or null (no vote yet)
  const [voted, setVoted] = useState<"up" | "down" | null>(null);
  // Track whether the punchline is visible. Starts hidden so the user can build anticipation.
  const [showPunchline, setShowPunchline] = useState(false);
  // Track whether a vote request is currently being sent to the server (to prevent double-clicking)
  const [voteLoading, setVoteLoading] = useState(false);
  // Track whether the confetti animation should be playing right now
  const [confettiTrigger, setConfettiTrigger] = useState(false);
  // The text message currently shown in the toast notification
  const [toastMsg, setToastMsg] = useState("");
  // Whether the toast notification is currently visible on screen
  const [toastVisible, setToastVisible] = useState(false);
  // The color/style type of the toast: "success" (green), "error" (red), or "info" (blue)
  const [toastType, setToastType] = useState<"success" | "error" | "info">("info");

  // Whenever a (possibly new) random joke loads, check whether this browser already
  // voted on it before (it's a small joke pool, /random can easily repeat one you've
  // seen). If so, restore the disabled/voted button state instead of letting the user
  // vote again.
  useEffect(() => {
    if (joke) {
      setVoted(getVoteFor(joke.id));
    }
  }, [joke]);

  // Helper function to show a toast notification with a message and type.
  // It sets the message, makes the toast visible, then hides it after 2.5 seconds.
  const showToast = (msg: string, type: "success" | "error" | "info" = "info") => {
    setToastMsg(msg);          // Set the message text
    setToastType(type);        // Set the visual style (success/error/info)
    setToastVisible(true);     // Make the toast appear on screen
    // After 2500 milliseconds (2.5 seconds), hide the toast by setting visible to false
    setTimeout(() => setToastVisible(false), 2500);
  };

  // Handle when the user clicks the upvote or downvote button.
  // This is async because it needs to wait for the server to process the vote.
  const handleVote = async (voteType: "up" | "down") => {
    // Don't do anything if: no joke loaded, user already voted, or a vote request is in progress
    if (!joke || voted || voteLoading) return;
    // Show the loading state so the user knows something is happening
    setVoteLoading(true);
    try {
      // Send the vote to the server and get back the updated joke with new vote counts
      await voteJoke(joke.id, voteType);
      // Persist the vote in localStorage (survives reloads, shared with JokeList) and
      // record it locally so we can disable the vote buttons.
      markVoted(joke.id, voteType);
      setVoted(voteType);
      if (voteType === "up") {
        // If they upvoted, trigger the confetti celebration animation
        setConfettiTrigger(true);
        // Show a success toast congratulating them on their good taste
        showToast("🎉 You have good taste in dad jokes!", "success");
      } else {
        // If they downvoted, show a playful "that was harsh" error toast
        showToast("👎 Harsh. Even bad jokes have feelings.", "error");
      }
    } catch (err) {
      // If the vote request failed (e.g., server error), show an error toast
      showToast("Vote failed. The joke server is crying.", "error");
    } finally {
      // Whether the vote succeeded or failed, turn off the loading state
      setVoteLoading(false);
    }
  };

  // Handle when the user clicks the "Another One" button to load a new random joke.
  const handleNewJoke = () => {
    setVoted(null);        // Reset the vote so the buttons become clickable again
    setShowPunchline(false); // Hide the punchline again for the new joke
    refresh();              // Fetch a new random joke from the server
  };

  // Handle when the user clicks the "Reveal the Punchline" button.
  const handleReveal = () => {
    // Make the punchline text visible
    setShowPunchline(true);
    // If the joke's groan level is 8 or higher, trigger confetti after a short delay for dramatic effect
    if (joke && joke.groan_level >= 8) {
      // 400ms delay so the punchline appears first, then the confetti fires
      setTimeout(() => setConfettiTrigger(true), 400);
    }
  };

  // While the joke is being fetched from the server, show the skeleton placeholder
  if (loading) {
    return <JokeCardSkeleton />;
  }

  // If an error occurred while fetching, show an error message with a retry button
  if (error) {
    return (
      <div className="joke-card joke-error">
        <p>😱 {error}</p>
        <p className="joke-error-sub">
          The joke server is probably on a dad break. You know how they are, 30
          minutes in the garage and suddenly they've invented a new tool.
        </p>
        <button onClick={handleNewJoke} className="btn btn-primary">
          Try Again (I believe in you)
        </button>
      </div>
    );
  }

  // If somehow there's no joke and no error and no loading, render nothing
  if (!joke) return null;

  // Main joke card rendering, shown when we have a loaded joke with no errors
  return (
    <div className="joke-card" key={joke.id}>
      {/* Confetti overlay, only visible when confettiTrigger is true */}
      <Confetti trigger={confettiTrigger} onComplete={() => setConfettiTrigger(false)} />
      {/* Toast notification popup, only visible when toastVisible is true */}
      <Toast message={toastMsg} type={toastType} visible={toastVisible} />
      {/* Badge showing which category this joke belongs to */}
      <div className="joke-category-badge">{joke.category}</div>
      {/* Groan meter showing repeated emoji faces proportional to the groan level */}
      <div className="joke-groan-meter">
        <span>Groan Level: </span>
        {/* Create an array of "😫" emojis, one per groan level point, joined into a string */}
        <span className="groan-eyes">
          {Array.from({ length: joke.groan_level }, (_, _i) => "😫").join("")}
        </span>
        <span className="groan-number">{joke.groan_level}/10</span>
      </div>
      {/* The setup line of the joke (always visible) */}
      <div className="joke-setup">
        <span className="joke-label">Setup:</span>
        <p>{joke.setup}</p>
      </div>
      {/* If punchline is hidden, show the reveal button. If visible, show the punchline text. */}
      {!showPunchline ? (
        <button className="btn btn-punchline" onClick={handleReveal}>
          🥁 Reveal the Punchline 🥁
        </button>
      ) : (
        <div className="joke-punchline reveal">
          <span className="joke-label">Punchline:</span>
          <p className="punchline-text">{joke.punchline}</p>
          {/* Show a funny reaction message based on the joke's groan level */}
          <p className="joke-reaction">{getReaction(joke.groan_level)}</p>
        </div>
      )}
      {/* Footer row with vote buttons and author attribution */}
      <div className="joke-footer">
        <div className="joke-votes">
          {/* Upvote button, adds 1 locally if user voted up, disabled after voting */}
          <button
            className={`vote-btn upvote ${voted === "up" ? "voted" : ""}`}
            onClick={() => handleVote("up")}
            disabled={!!voted || voteLoading}
          >
            👍 {joke.upvotes + (voted === "up" ? 1 : 0)}
          </button>
          {/* Downvote button, adds 1 locally if user voted down, disabled after voting */}
          <button
            className={`vote-btn downvote ${voted === "down" ? "voted" : ""}`}
            onClick={() => handleVote("down")}
            disabled={!!voted || voteLoading}
          >
            👎 {joke.downvotes + (voted === "down" ? 1 : 0)}
          </button>
        </div>
        {/* Author name shown at the right side of the footer */}
        <span className="joke-author">,{joke.author}</span>
      </div>
      {/* Button to load the next random joke */}
      <button onClick={handleNewJoke} className="btn btn-secondary">
        🔄 Another One (Dj Khaled voice)
      </button>
    </div>
  );
};
