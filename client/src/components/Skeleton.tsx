// Import React so we can define a React component
import React from "react";

// Shows a shimmer placeholder while content loads
// Better UX than a spinner because it shows the shape of incoming content
export const JokeCardSkeleton: React.FC = () => (
  <div className="joke-card" style={{ animation: "none" }}>
    {/* Placeholder for the category badge, small rounded pill shape */}
    <div style={{
      height: "24px",                 // Short height like a small tag/badge
      width: "80px",                  // Narrow width for a short label
      background: "linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.08), rgba(255,255,255,0.04))", // Subtle shimmer gradient
      backgroundSize: "200% 100%",    // Makes the gradient twice as wide so it can animate left-to-right
      borderRadius: "20px",           // Fully rounded corners like a pill
      marginBottom: "16px",           // Space below before the next placeholder
      animation: "skeletonShimmer 1.5s infinite", // CSS animation defined in global.css that slides the shimmer
    }} />
    {/* Placeholder for the groan level label, medium width bar */}
    <div style={{
      height: "16px",                 // Slightly thinner than the badge
      width: "60%",                   // 60% of the card width
      background: "linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.08), rgba(255,255,255,0.04))", // Same shimmer effect
      backgroundSize: "200% 100%",    // Same gradient sizing
      borderRadius: "8px",           // Slightly rounded corners
      marginBottom: "24px",          // More space below for visual hierarchy
      animation: "skeletonShimmer 1.5s infinite 0.1s", // 0.1s delay staggers it after the first placeholder
    }} />
    {/* Placeholder for the setup text line 1, full width bar */}
    <div style={{
      height: "20px",                 // Taller, representing a line of text
      width: "100%",                  // Full width of the card
      background: "linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.08), rgba(255,255,255,0.04))", // Same shimmer effect
      backgroundSize: "200% 100%",
      borderRadius: "8px",
      marginBottom: "10px",
      animation: "skeletonShimmer 1.5s infinite 0.2s", // Staggered by 0.2s for a wave-like shimmer effect
    }} />
    {/* Placeholder for the setup text line 2, slightly shorter to look natural */}
    <div style={{
      height: "20px",
      width: "80%",                   // Shorter than line 1, real text rarely fills the entire line
      background: "linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.08), rgba(255,255,255,0.04))",
      backgroundSize: "200% 100%",
      borderRadius: "8px",
      marginBottom: "24px",
      animation: "skeletonShimmer 1.5s infinite 0.3s", // Staggered by 0.3s
    }} />
    {/* Placeholder for the "Reveal Punchline" button, tall rounded bar */}
    <div style={{
      height: "48px",                 // Tall enough to match a button's height
      width: "100%",                  // Full width
      background: "linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.08), rgba(255,255,255,0.04))",
      backgroundSize: "200% 100%",
      borderRadius: "14px",           // More rounded to match button styling
      animation: "skeletonShimmer 1.5s infinite 0.4s", // Last in the stagger sequence
    }} />
  </div>
);
