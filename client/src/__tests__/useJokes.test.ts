// Unit tests for hooks/useJokes.ts, the module that talks to the server. Each function is
// tested in isolation with global.fetch mocked, so these run without a real server or
// database (that end-to-end path is already covered by the server's supertest suite and
// by e2e/joke-voting.spec.ts). This is the literal example TESTING.md and the README's
// "What's Next" section used to describe as a future test: "does fetchRandomJoke return
// a joke?"
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchRandomJoke, fetchJokes, voteJoke, submitJoke, fetchStats } from "../hooks/useJokes";
import type { Joke } from "../hooks/useJokes";

const sampleJoke: Joke = {
  id: 1,
  setup: "Why did the scarecrow win an award?",
  punchline: "Because he was outstanding in his field.",
  category: "classic",
  groan_level: 5,
  upvotes: 3,
  downvotes: 1,
  created_at: "2026-01-01T00:00:00.000Z",
  author: "Test Dad",
  status: "approved",
};

// Builds a fake fetch Response good enough for our code's `await res.json()` call, that's
// the only Response method any of hooks/useJokes.ts actually uses.
function jsonResponse(body: unknown) {
  return { json: () => Promise.resolve(body) } as Response;
}

describe("useJokes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("fetchRandomJoke", () => {
    it("returns a joke when the API call succeeds", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ success: true, data: sampleJoke })));

      const joke = await fetchRandomJoke();

      expect(joke).toEqual(sampleJoke);
      expect(fetch).toHaveBeenCalledWith("/api/jokes/random");
    });

    it("throws the server's error message when the API reports failure", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(jsonResponse({ success: false, error: "No jokes in the database" }))
      );

      await expect(fetchRandomJoke()).rejects.toThrow("No jokes in the database");
    });

    it("throws a fallback message when the API reports failure with no error text", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ success: false })));

      await expect(fetchRandomJoke()).rejects.toThrow("Failed to fetch joke");
    });
  });

  describe("fetchJokes", () => {
    it("requests jokes with no query params when called with no arguments", async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: [sampleJoke] }));
      vi.stubGlobal("fetch", fetchMock);

      const jokes = await fetchJokes();

      expect(jokes).toEqual([sampleJoke]);
      expect(fetchMock).toHaveBeenCalledWith("/api/jokes?");
    });

    it("builds a query string from category, sort, and limit", async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: [] }));
      vi.stubGlobal("fetch", fetchMock);

      await fetchJokes({ category: "puns", sort: "groan", limit: 10 });

      const requestedUrl = fetchMock.mock.calls[0][0] as string;
      const params = new URLSearchParams(requestedUrl.split("?")[1]);
      expect(params.get("category")).toBe("puns");
      expect(params.get("sort")).toBe("groan");
      expect(params.get("limit")).toBe("10");
    });
  });

  describe("voteJoke", () => {
    it("posts the joke id and vote type, and returns the updated joke", async () => {
      const updatedJoke = { ...sampleJoke, upvotes: 4 };
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: updatedJoke }));
      vi.stubGlobal("fetch", fetchMock);

      const result = await voteJoke(1, "up");

      expect(result.upvotes).toBe(4);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/jokes/vote");
      expect(options.method).toBe("POST");
      expect(JSON.parse(options.body)).toEqual({ joke_id: 1, vote_type: "up" });
    });

    it("throws when the server rejects the vote (e.g. already voted)", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(jsonResponse({ success: false, error: "Already voted on this joke" }))
      );

      await expect(voteJoke(1, "up")).rejects.toThrow("Already voted on this joke");
    });
  });

  describe("submitJoke", () => {
    it("posts the joke payload and returns the created joke", async () => {
      const created = { ...sampleJoke, id: 99, status: "pending" as const };
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: created }));
      vi.stubGlobal("fetch", fetchMock);

      const result = await submitJoke({ setup: "New setup", punchline: "New punchline" });

      expect(result.id).toBe(99);
      expect(result.status).toBe("pending");
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/jokes");
      expect(JSON.parse(options.body)).toEqual({ setup: "New setup", punchline: "New punchline" });
    });
  });

  describe("fetchStats", () => {
    it("returns the stats object from the API", async () => {
      const stats = {
        total_jokes: 30,
        total_votes: 120,
        avg_groan_level: 6.5,
        most_upvoted: sampleJoke,
        category_counts: [{ category: "puns", count: 10 }],
        pending_count: 2,
      };
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ success: true, data: stats })));

      const result = await fetchStats();

      expect(result).toEqual(stats);
    });
  });
});
