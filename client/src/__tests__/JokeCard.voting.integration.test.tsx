// Integration test for JokeCard + useRandomJoke + voteJoke working together: this is the
// exact scenario the README's "What's Next" section named as its integration-test example,
// "does voting update the count?" The server side of that same behavior (upvotes actually
// incrementing in Postgres) is covered by "increments upvotes on an 'up' vote" in
// server/src/__tests__/jokesRoutes.integration.test.ts. This test covers the other half:
// clicking the button in JokeCard results in the on-screen count going up, the button
// becoming disabled, and localStorage remembering the vote, wiring several real modules
// together (JokeCard, useRandomJoke, voteJoke, votedJokes) rather than one function alone.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { JokeCard } from "../components/JokeCard";
import { hasVoted } from "../utils/votedJokes";

function joke(overrides: Partial<{ upvotes: number; downvotes: number }> = {}) {
  return {
    id: 1,
    setup: "Why did the scarecrow win an award?",
    punchline: "Because he was outstanding in his field.",
    category: "classic",
    groan_level: 5,
    upvotes: overrides.upvotes ?? 10,
    downvotes: overrides.downvotes ?? 2,
    created_at: new Date().toISOString(),
    author: "Test Dad",
    status: "approved" as const,
  };
}

describe("JokeCard voting (integration)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("increments the displayed upvote count and disables voting after an upvote", async () => {
    const fetchMock = vi
      .fn()
      // useRandomJoke's initial GET /api/jokes/random on mount
      .mockResolvedValueOnce({ json: async () => ({ success: true, data: joke({ upvotes: 10 }) }) })
      // The POST /api/jokes/vote triggered by clicking the upvote button
      .mockResolvedValueOnce({ json: async () => ({ success: true, data: joke({ upvotes: 11 }) }) });
    vi.stubGlobal("fetch", fetchMock);

    render(<JokeCard />);

    // Wait for the initial random joke to load before the count starts at 10.
    const upvoteButton = await screen.findByRole("button", { name: /👍 10/ });

    fireEvent.click(upvoteButton);

    // After the vote resolves, the button's own label should read the incremented count...
    await waitFor(() => expect(screen.getByRole("button", { name: /👍 11/ })).toBeInTheDocument());
    // ...and it should now be disabled, so a second click can't double-vote.
    expect(screen.getByRole("button", { name: /👍 11/ })).toBeDisabled();
    // The vote was sent to the real API function with the right joke id and type.
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/jokes/vote",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ joke_id: 1, vote_type: "up" }) })
    );
    // votedJokes persisted the vote, so a reload would keep this joke disabled too.
    expect(hasVoted(1)).toBe(true);
  });

  it("does not change the count when the vote request fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ json: async () => ({ success: true, data: joke({ upvotes: 5 }) }) })
      .mockResolvedValueOnce({ json: async () => ({ success: false, error: "Already voted on this joke" }) });
    vi.stubGlobal("fetch", fetchMock);

    render(<JokeCard />);

    const upvoteButton = await screen.findByRole("button", { name: /👍 5/ });
    fireEvent.click(upvoteButton);

    // The vote failed server-side, so the count stays at 5 and the button stays enabled
    // (voted state was never set) so the user can retry.
    await waitFor(() => expect(screen.getByText(/Vote failed/i)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /👍 5/ })).not.toBeDisabled();
    expect(hasVoted(1)).toBe(false);
  });
});
