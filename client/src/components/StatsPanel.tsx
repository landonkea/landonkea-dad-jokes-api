// Import React and two hooks: useEffect for fetching data on mount, useState for storing it
import React, { useEffect, useState } from "react";
// Import the API function that fetches overall joke statistics
import { fetchStats } from "../hooks/useJokes";

// Define the shape of the stats object so TypeScript knows what fields are available.
// This matches the structure returned by the /api/jokes/stats endpoint.
interface Stats {
  total_jokes: number;    // Total number of jokes in the database
  total_votes: number;    // Total number of votes cast across all jokes
  avg_groan_level: number; // Average groan level rating across all jokes
  most_upvoted: {         // The single most popular joke by upvotes
    setup: string;
    punchline: string;
    upvotes: number;
  } | null;               // null if no jokes have been voted on yet
  category_counts: { category: string; count: number }[];  // Array of how many jokes are in each category
  pending_count: number;  // How many submissions are currently awaiting moderation
}



// The StatsPanel component fetches and displays dashboard-style statistics about all the jokes.
export const StatsPanel: React.FC = () => {
  // stats holds the statistics data from the server. null means we haven't fetched it yet.
  const [stats, setStats] = useState<Stats | null>(null);

  // Fetch the stats from the server when the component first mounts.
  // The empty dependency array [] means this runs exactly once.
  useEffect(() => {
    fetchStats()
      .then(setStats)       // On success, store the stats object in state
      .catch(console.error); // On failure, log the error to the browser console
  }, []); // No dependencies: run once on mount

  // If stats haven't loaded yet (still null), show a loading spinner
  if (!stats) {
    return (
      <div className="stats-panel">
        <div className="joke-loading">
          <div className="spinner" />
          <p>Crunching the groan numbers...</p>
        </div>
      </div>
    );
  }

  // Once stats are loaded, render the full dashboard
  return (
    <div className="stats-panel">
      <h3 className="stats-title">The Groan Analytics</h3>
      <div className="stats-grid">
        {[
          { value: stats.total_jokes, label: "Total Jokes", emoji: "🃏" },    // Card 1: joke count
          { value: stats.total_votes || 0, label: "Total Votes", emoji: "🗳️" }, // Card 2: vote count (0 if undefined)
          { value: stats.avg_groan_level || 0, label: "Avg Groan", emoji: "😫" }, // Card 3: average groan level
          { value: stats.category_counts.length, label: "Categories", emoji: "📂" }, // Card 4: number of categories
          { value: stats.pending_count || 0, label: "Awaiting Review", emoji: "🕵️" }, // Card 5: moderation queue size
        ].map((s, i) => (
          <div className="stat-card" key={i}>
            <span className="stat-number">{s.value}</span>
            <span className="stat-label">{s.label}</span>
            <span className="stat-emoji">{s.emoji}</span>
          </div>
        ))}
      </div>
      {/* Show the most upvoted joke section only if there is one */}
      {stats.most_upvoted && (
        <div className="most-upvoted">
          <h4>🏆 Most Popular Dad Joke</h4>
          <p className="most-upvoted-setup">{stats.most_upvoted.setup}</p>
          <p className="most-upvoted-punchline">
            &ldquo;{stats.most_upvoted.punchline}&rdquo;
          </p>
          <span className="most-upvoted-votes">
            👍 {stats.most_upvoted.upvotes} upvotes, the people have spoken
          </span>
        </div>
      )}
      {/* Show the category breakdown bar chart only if there are categories */}
      {stats.category_counts.length > 0 && (
        <div className="category-breakdown">
          <h4>📈 Category Breakdown</h4>
          <div className="category-bars">
            {stats.category_counts.map((cat) => {
              // Find the highest joke count among all categories so we can scale bars proportionally
              const maxCount = Math.max(...stats.category_counts.map((c) => c.count));
              // Calculate the width of this category's bar as a percentage of the max
              // e.g., if max is 20 and this category has 10 jokes, the bar is 50% wide
              const width = (cat.count / maxCount) * 100;
              return (
                <div key={cat.category} className="category-bar-row">
                  <span className="category-bar-label">{cat.category}</span>
                  <div className="category-bar-track">
                    <div
                      className="category-bar-fill"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <span className="category-bar-count">{cat.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
