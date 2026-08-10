// Tests for utils/votedJokes.ts, the localStorage-backed "already voted" tracker used
// by both JokeCard and JokeList to prevent voting twice on the same joke, including
// across page reloads. The client/src/test/setup.ts file provides a working localStorage
// mock for jsdom, so these run without any DOM rendering.
import { describe, it, expect, beforeEach } from "vitest";
import { getVoteFor, hasVoted, markVoted } from "../utils/votedJokes";

describe("votedJokes", () => {
  beforeEach(() => {
    // Each test should start from a clean slate, clear whatever the mock localStorage held.
    window.localStorage.clear();
  });

  it("reports no vote for a joke that's never been voted on", () => {
    expect(hasVoted(1)).toBe(false);
    expect(getVoteFor(1)).toBeNull();
  });

  it("remembers an upvote after markVoted", () => {
    markVoted(42, "up");
    expect(hasVoted(42)).toBe(true);
    expect(getVoteFor(42)).toBe("up");
  });

  it("remembers a downvote after markVoted", () => {
    markVoted(7, "down");
    expect(getVoteFor(7)).toBe("down");
  });

  it("tracks multiple jokes independently", () => {
    markVoted(1, "up");
    markVoted(2, "down");
    expect(getVoteFor(1)).toBe("up");
    expect(getVoteFor(2)).toBe("down");
    expect(getVoteFor(3)).toBeNull();
  });

  it("persists across separate calls (simulating a page reload)", () => {
    markVoted(99, "up");
    // A fresh call sequence, as if the page had reloaded and re-imported the module state
    // fresh, since votedJokes.ts reads from localStorage on every call rather than caching
    // in memory, this naturally verifies reload-durability.
    expect(getVoteFor(99)).toBe("up");
  });

  it("overwrites a previous vote if markVoted is called again for the same joke", () => {
    markVoted(5, "up");
    markVoted(5, "down");
    expect(getVoteFor(5)).toBe("down");
  });
});
