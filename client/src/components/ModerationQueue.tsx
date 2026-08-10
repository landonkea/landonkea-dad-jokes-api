// Import React and the hooks we need: useState for local state, useEffect for fetching
// data when the token or page changes, useCallback to memoize the fetch function.
import React, { useCallback, useEffect, useState } from "react";
// Import the moderation API functions and the Joke/pagination types.
import { fetchPendingJokes, approveJoke, rejectJoke, Joke, PendingJokesPage } from "../hooks/useJokes";

// The localStorage key the admin token is cached under, so a moderator doesn't have
// to retype it every time they reload the page. This is convenience, not security,
// the actual gate is the server checking x-admin-token on every request.
const ADMIN_TOKEN_STORAGE_KEY = "dadJokesAdminToken";

// The ModerationQueue component is an admin-only panel: it takes an admin token,
// lists jokes awaiting moderation, and lets the admin approve or reject each one.
// There's no separate "login" concept, the token itself IS the credential, the
// same shared-secret model the existing DELETE /:id admin gate already uses.
export const ModerationQueue: React.FC = () => {
  // The admin token as currently typed into the input (controlled field value).
  // Seeded from localStorage so it survives reloads.
  const [token, setToken] = useState(() => localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || "");
  // The token actually used for fetching. Deliberately separate from "token" above:
  // it only updates when the form is submitted, so typing/editing the field doesn't
  // fire a request on every keystroke, the queue only (re)loads on an explicit
  // "Load Queue" submit or a page change.
  const [activeToken, setActiveToken] = useState(() => localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || "");
  // The jokes currently in the moderation queue for the current page.
  const [jokes, setJokes] = useState<Joke[]>([]);
  // Pagination metadata for the queue (total pending, total pages, etc.)
  const [pagination, setPagination] = useState<PendingJokesPage["pagination"] | null>(null);
  // The current 1-indexed page of the queue being viewed.
  const [page, setPage] = useState(1);
  // Whether a fetch or approve/reject action is currently in flight.
  const [loading, setLoading] = useState(false);
  // An error message from the last failed request, or null if nothing's wrong.
  const [error, setError] = useState<string | null>(null);
  // Tracks which joke id (if any) currently has an approve/reject action in flight,
  // so we can disable just that row's buttons instead of the whole queue.
  const [actingOnId, setActingOnId] = useState<number | null>(null);

  // Fetch the current page of the moderation queue using the active token.
  // Wrapped in useCallback so the identity only changes when activeToken or page
  // change, keeping the useEffect below from re-fetching on every render.
  const loadQueue = useCallback(async () => {
    if (!activeToken.trim()) {
      // No token submitted yet, nothing to fetch, and no error to show either.
      setJokes([]);
      setPagination(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await fetchPendingJokes(activeToken.trim(), page, 20);
      setJokes(result.jokes);
      setPagination(result.pagination);
    } catch (err) {
      setError((err as Error).message);
      setJokes([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, [activeToken, page]);

  // Re-fetch whenever the active token or page changes, NOT on every keystroke in
  // the input, since that's tracked separately by "token" above.
  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  // Called when the admin submits the token form. Persists it to localStorage,
  // promotes it to "activeToken" (triggering the fetch above), and jumps back to
  // page 1 (a stale page number from a previous token/queue state is meaningless).
  const handleTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = token.trim();
    localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, trimmed);
    setPage(1);
    setActiveToken(trimmed);
  };

  // Shared handler for both approve and reject, takes the action function so we
  // don't duplicate the loading/error/optimistic-removal logic twice.
  const handleAction = async (id: number, action: (id: number, token: string) => Promise<Joke>) => {
    setActingOnId(id);
    setError(null);
    try {
      await action(id, activeToken.trim());
      // Remove the joke from the local list immediately rather than waiting on a
      // full re-fetch, it's no longer pending, so it shouldn't be in this queue.
      setJokes((prev) => prev.filter((j) => j.id !== id));
      setPagination((prev) => (prev ? { ...prev, total: Math.max(prev.total - 1, 0) } : prev));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActingOnId(null);
    }
  };

  return (
    <div className="moderation-queue">
      <h3 className="stats-title">Moderation Queue</h3>
      <p className="submitter-subtitle">
        Every joke someone submits lands here first. Approve the ones worth the groan;
        reject the rest before they hit the public list.
      </p>

      {/* Admin token entry, same shared-secret model as the existing delete gate. */}
      <form onSubmit={handleTokenSubmit} className="moderation-token-form">
        <div className="form-group">
          <label htmlFor="admin-token">Admin Token</label>
          <input
            id="admin-token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="x-admin-token"
            autoComplete="off"
          />
        </div>
        <button type="submit" className="btn btn-secondary" disabled={!token.trim() || loading}>
          {loading ? "Loading..." : "Load Queue"}
        </button>
      </form>

      {error && (
        <div className="submitter-result error" role="alert">
          😫 {error}
        </div>
      )}

      {!activeToken.trim() && !error && (
        <p className="joke-list-empty">Enter the admin token above to review pending submissions.</p>
      )}

      {activeToken.trim() && !loading && !error && jokes.length === 0 && (
        <p className="joke-list-empty">🎉 Nothing pending. The queue is all caught up.</p>
      )}

      {jokes.length > 0 && (
        <div className="joke-list">
          {jokes.map((joke) => (
            <div key={joke.id} className="joke-list-item moderation-item">
              <div className="joke-list-item-body moderation-item-body">
                <p className="joke-list-punchline">{joke.setup}</p>
                <p className="joke-list-punchline">💬 {joke.punchline}</p>
                <div className="joke-list-meta">
                  <span className="joke-list-category">{joke.category}</span>
                  <span className="joke-list-groan">Groan: {joke.groan_level}/10</span>
                  <span className="joke-list-author">,{joke.author}</span>
                </div>
                <div className="moderation-actions">
                  <button
                    className="btn btn-secondary moderation-approve"
                    disabled={actingOnId === joke.id}
                    onClick={() => handleAction(joke.id, approveJoke)}
                  >
                    ✅ Approve
                  </button>
                  <button
                    className="btn btn-secondary moderation-reject"
                    disabled={actingOnId === joke.id}
                    onClick={() => handleAction(joke.id, rejectJoke)}
                  >
                    ❌ Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

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
            Page {pagination.page} of {pagination.total_pages} ({pagination.total} pending)
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
