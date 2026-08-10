// Import React and two hooks: useEffect for running side effects (like fetching data), useState for storing data
import React, { useEffect, useState } from "react";
// Import the API functions for fetching a page of jokes and voting, plus the Joke/JokesPage types
import { fetchJokesPage, voteJoke, Joke, JokesPage } from "../hooks/useJokes";
// Import the localStorage-backed "already voted" tracker so vote buttons stay disabled
// for jokes this browser already voted on, even across page reloads.
import { getVoteFor, markVoted } from "../utils/votedJokes";

// Define the props (inputs) that JokeList accepts. Both are optional filters.
interface JokeListProps {
  category?: string;  // Optional category filter, if set, only show jokes in this category
  sort?: string;      // Optional sort order, if set, sort jokes by this criteria
  q?: string;          // Optional search term, if set, only show jokes matching setup/punchline
}

// The JokeList component displays a scrollable list of jokes that can be filtered and sorted.
export const JokeList: React.FC<JokeListProps> = ({ category, sort, q }) => {
  // jokes stores the array of joke objects fetched from the server. Starts empty.
  const [jokes, setJokes] = useState<Joke[]>([]);
  // loading is true while the initial fetch is in progress, so we can show a spinner.
  const [loading, setLoading] = useState(true);
  // error stores a message if something goes wrong with the fetch, or null if everything is fine.
  const [error, setError] = useState<string | null>(null);
  // expandedId tracks which joke's punchline is currently expanded (visible). null means none are expanded.
  // This creates an accordion-style UI where you click to reveal/hide punchlines.
  const [expandedId, setExpandedId] = useState<number | null>(null);
  // page is the current 1-indexed page of results being shown.
  const [page, setPage] = useState(1);
  // pagination stores the metadata the server sends back (total count, total pages, etc.)
  // so we know whether Prev/Next should be enabled.
  const [pagination, setPagination] = useState<JokesPage["pagination"] | null>(null);
  // votedIds tracks, for jokes currently on screen, which ones this browser already voted
  // on (and how). Seeded from localStorage so it survives page reloads, not just re-renders.
  const [votedIds, setVotedIds] = useState<Record<number, "up" | "down">>({});

  // Whenever the category, sort, or search filter changes, jump back to page 1, staying
  // on, say, page 3 of a filter that now has only 1 page of results would show an empty list.
  useEffect(() => {
    setPage(1);
  }, [category, sort, q]);

  // useEffect runs every time the category, sort, search term, or page changes.
  // It fetches the matching page of jokes from the server.
  useEffect(() => {
    // "cancelled" is a flag to prevent updating state if the component unmounts or the effect re-runs
    // before the fetch completes. Without this, you'd get a "can't update unmounted component" warning.
    let cancelled = false;
    // Show the loading spinner while the fetch is in progress
    setLoading(true);
    // Request 20 jokes per page, filtered/sorted/searched per the current props.
    fetchJokesPage({ category, sort, q, page, limit: 20 })
      .then(({ jokes: data, pagination: meta }) => {
        // Only update state if this effect hasn't been cancelled (component still mounted)
        if (!cancelled) {
          setJokes(data);       // Store the fetched jokes
          setPagination(meta);  // Store the pagination metadata (total, total_pages, ...)
          // Seed this page's "already voted" state from localStorage, the buttons should
          // come in already-disabled for jokes voted on in a previous visit.
          const seeded: Record<number, "up" | "down"> = {};
          for (const joke of data) {
            const existing = getVoteFor(joke.id);
            if (existing) seeded[joke.id] = existing;
          }
          setVotedIds(seeded);
          setLoading(false);    // Hide the loading spinner
        }
      })
      .catch((err) => {
        // Only update state if not cancelled
        if (!cancelled) {
          setError(err.message); // Store the error message to display to the user
          setLoading(false);     // Hide the loading spinner
        }
      });
    // The cleanup function runs before the effect re-runs or when the component unmounts.
    // Setting cancelled = true prevents the .then/.catch from updating state on an old fetch.
    return () => {
      cancelled = true;
    };
  }, [category, sort, q, page]); // Re-run this effect whenever category, sort, search term, or page changes

  // Handle when a user clicks the upvote or downvote button on a joke in the list.
  const handleVote = async (jokeId: number, voteType: "up" | "down") => {
    // Guard against voting again on a joke this browser already voted on. The server also
    // enforces this (409 on a duplicate vote), but checking client-side first avoids a
    // pointless round-trip and keeps the button visibly disabled the moment you vote.
    if (votedIds[jokeId]) return;
    try {
      // Send the vote to the server. The server returns the updated joke with new vote counts.
      const updated = await voteJoke(jokeId, voteType);
      // Replace the old joke with the updated one in our local state.
      // .map() loops through all jokes, and for the matching ID, swaps in the updated version.
      setJokes((prev) => prev.map((j) => (j.id === jokeId ? updated : j)));
      // Persist the vote (localStorage) and reflect it in this component's state so the
      // buttons for this joke disable immediately and stay disabled after a reload.
      markVoted(jokeId, voteType);
      setVotedIds((prev) => ({ ...prev, [jokeId]: voteType }));
    } catch (err) {
      // If the vote fails, log the error to the console for debugging (the list stays unchanged)
      console.error("Vote failed:", err);
    }
  };

  // If we're still loading jokes, show a loading state instead of the list
  if (loading)
    return (
      <div className="joke-list-loading">
        <div className="spinner" />
        <p>Flipping through the dad joke binder...</p>
      </div>
    );

  // If an error occurred, show the error message instead of the list
  if (error)
    return (
      <div className="joke-list-error">
        <p>😫 {error}</p>
        <p style={{ fontSize: "0.85rem", marginTop: "8px" }}>
          Even the joke list is having a bad day.
        </p>
      </div>
    );

  // Main rendering: the list of jokes (or an empty state message)
  return (
    <div className="joke-list">
      {/* Show an empty state message if no jokes match the current filters */}
      {jokes.length === 0 && (
        <p className="joke-list-empty">
          {q
            ? `No jokes match "${q}". Even the database is speechless. 🤐`
            : "No jokes found. Even the database is speechless. 🤐"}
        </p>
      )}
      {/* Loop through each joke and render a clickable accordion item */}
      {jokes.map((joke) => (
        <div key={joke.id} className="joke-list-item">
          {/* The header row, clicking it toggles the punchline open/closed */}
          <div className="joke-list-item-header" onClick={() => setExpandedId(expandedId === joke.id ? null : joke.id)}>
            <span className="joke-list-setup">{joke.setup}</span>
            {/* Arrow indicator: ▼ when expanded, ▶ when collapsed */}
            <span className="joke-list-expand">{expandedId === joke.id ? "▼" : "▶"}</span>
          </div>
          {/* Only render the expanded body if this joke's ID matches expandedId */}
          {expandedId === joke.id && (
            <div className="joke-list-item-body">
              <p className="joke-list-punchline">💬 {joke.punchline}</p>
              <div className="joke-list-meta">
                <span className="joke-list-category">{joke.category}</span>
                <span className="joke-list-groan">Groan: {joke.groan_level}/10</span>
                <div className="joke-list-votes">
                  <button
                    className={`vote-btn-sm ${votedIds[joke.id] === "up" ? "voted" : ""}`}
                    onClick={() => handleVote(joke.id, "up")}
                    disabled={!!votedIds[joke.id]}
                  >
                    👍 {joke.upvotes}
                  </button>
                  <button
                    className={`vote-btn-sm ${votedIds[joke.id] === "down" ? "voted" : ""}`}
                    onClick={() => handleVote(joke.id, "down")}
                    disabled={!!votedIds[joke.id]}
                  >
                    👎 {joke.downvotes}
                  </button>
                </div>
                <span className="joke-list-author">,{joke.author}</span>
              </div>
            </div>
          )}
        </div>
      ))}
      {/* Pager controls, only shown once we know how many pages there are, and hidden
          entirely when everything fits on a single page. */}
      {pagination && pagination.total_pages > 1 && (
        <div className="joke-list-pager">
          <button
            className="btn btn-secondary"
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            disabled={page <= 1}
          >
            ← Prev
          </button>
          <span className="joke-list-pager-status">
            Page {pagination.page} of {pagination.total_pages}
          </span>
          <button
            className="btn btn-secondary"
            onClick={() => setPage((p) => Math.min(p + 1, pagination.total_pages))}
            disabled={page >= pagination.total_pages}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};
