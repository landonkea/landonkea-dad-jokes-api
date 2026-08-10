// Tracks which joke IDs this browser has already voted on, persisted in localStorage so
// the "already voted" state survives page reloads (not just component re-renders).
//
// This is a client-side convenience layer only, it stops an honest user from
// accidentally double-clicking or re-voting after a refresh. It is NOT a security
// boundary (anyone can clear localStorage or call the API directly), which is exactly
// why the server also enforces its own IP-based dedup in POST /api/jokes/vote.

const STORAGE_KEY = "dad-jokes:voted";

// localStorage isn't available during SSR or in some test environments, guard every
// access so this module degrades gracefully (falls back to "nothing voted yet") instead
// of throwing.
function safeGetStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    // Some browsers throw when localStorage is disabled (e.g. private mode + strict settings).
    return null;
  }
}

function readVotedIds(): Record<number, "up" | "down"> {
  const storage = safeGetStorage();
  if (!storage) return {};
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    // Corrupt/unparseable data shouldn't crash the app, just treat it as "nothing voted".
    return {};
  }
}

function writeVotedIds(votes: Record<number, "up" | "down">): void {
  const storage = safeGetStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(votes));
  } catch {
    // Storage full or disabled, silently ignore, voting still works for this session.
  }
}

// Returns the vote type ("up"/"down") already cast for this joke, or null if none.
export function getVoteFor(jokeId: number): "up" | "down" | null {
  return readVotedIds()[jokeId] ?? null;
}

// Convenience boolean form of getVoteFor.
export function hasVoted(jokeId: number): boolean {
  return getVoteFor(jokeId) !== null;
}

// Records that this browser voted on a joke, so future hasVoted()/getVoteFor() calls
// for that joke ID reflect it, including after a page reload.
export function markVoted(jokeId: number, voteType: "up" | "down"): void {
  const votes = readVotedIds();
  votes[jokeId] = voteType;
  writeVotedIds(votes);
}
