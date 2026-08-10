// Import React and two hooks: useEffect for reacting to the trigger prop, useState for storing confetti pieces
import React, { useEffect, useState } from "react";

// An array of bright, festive colors that confetti pieces can randomly be assigned.
const CONFETTI_COLORS = ["#ff2e63", "#08d9d6", "#f9ed69", "#a8e6cf", "#ff6b9d", "#fff"];

// Define the props that the Confetti component accepts
interface ConfettiProps {
  trigger: boolean;    // When this changes from false to true, the confetti animation fires
  onComplete: () => void;  // A callback function called when the animation ends, so the parent can reset trigger to false
}

// Helper function that generates an array of confetti piece objects with random properties.
// Each piece has a random color, position, size, speed, delay, and shape.
function makePieces(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,                                              // Unique number to use as React key
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)], // A random color from the list
    left: 20 + Math.random() * 60,                      // Horizontal position (20%-80% so confetti stays centered on screen)
    size: 6 + Math.random() * 8,                        // Piece size in pixels (6-14px)
    duration: 1.5 + Math.random() * 1.5,                // How long the fall animation takes (1.5-3 seconds)
    delay: Math.random() * 0.4,                         // Stagger the start by up to 0.4 seconds for a natural look
    shape: Math.random() > 0.5 ? "circle" : "square",  // Randomly choose circle or square shape (50/50 chance)
  }));
}

// The Confetti component creates a celebratory particle explosion effect.
// It renders nothing until "trigger" becomes true, then shows 60 falling confetti pieces.
export const Confetti: React.FC<ConfettiProps> = ({ trigger, onComplete }) => {
  // Store the array of confetti pieces. Starts empty (no confetti visible).
  const [pieces, setPieces] = useState<ReturnType<typeof makePieces>>([]);

  // This effect runs whenever the "trigger" prop changes.
  useEffect(() => {
    // If trigger is false, do nothing, no confetti to show
    if (!trigger) return;
    // Generate 60 confetti pieces with random properties and store them in state
    setPieces(makePieces(60));
    // Set a timer to clean up the confetti after 3.5 seconds (long enough for all pieces to finish falling)
    const timer = setTimeout(() => {
      onComplete();  // Tell the parent that the animation is done (so it can set trigger back to false)
      setPieces([]); // Clear the confetti pieces from state, removing them from the DOM
    }, 3500); // 3500 milliseconds = 3.5 seconds
    // Cleanup function: if the effect re-runs (e.g., trigger changes again), cancel the previous timer
    return () => clearTimeout(timer);
  }, [trigger, onComplete]); // Re-run this effect when trigger or onComplete changes

  // If there are no confetti pieces, render nothing (component is invisible)
  if (pieces.length === 0) return null;

  // Render the confetti overlay with all the falling pieces
  return (
    <div className="confetti-container">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,                  // Horizontal starting position on the screen
            width: p.size,                       // Width in pixels
            height: p.size,                      // Height in pixels (same as width = square or circle)
            background: p.color,                 // The randomly assigned color
            // If shape is "circle", use border-radius 50% (makes it round). Otherwise 2px (nearly square).
            borderRadius: p.shape === "circle" ? "50%" : "2px",
            animationDuration: `${p.duration}s`,  // How fast this piece falls (longer = slower)
            animationDelay: `${p.delay}s`,        // Stagger the start so they don't all fall at once
          }}
        />
      ))}
    </div>
  );
};
