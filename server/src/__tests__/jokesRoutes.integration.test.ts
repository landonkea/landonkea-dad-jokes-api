// Real integration tests for routes/jokes.ts, the query-builder logic (category/sort/limit
// branches, Zod validation, vote dedup, admin-gated delete) that TESTING.md flags as
// "coming soon". These hit a REAL PostgreSQL database (not a mock) through the actual
// Express app (src/app.ts), via supertest, so they exercise the whole request/response
// cycle exactly the way a real client would.
//
// Requires a reachable Postgres instance with the connection details from the environment
// (DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME, see src/test/setup.ts and .env). Locally
// this points at a "dad_jokes_test" database (kept separate from the real "dad_jokes" dev
// database so these tests can freely TRUNCATE tables). CI provisions the same database name
// via a Postgres service container (see .github/workflows/ci.yml).
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";

// ADMIN_TOKEN is read by config/env.ts at import time, so it must be set BEFORE anything
// imports app.ts (which imports the jokes router, which imports adminAuth, which imports
// config/env). Setting it here, before the dynamic import below, guarantees that order.
process.env.ADMIN_TOKEN = process.env.ADMIN_TOKEN || "test-admin-token";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

describe("Jokes API routes (integration)", () => {
  // Both app and pool are loaded dynamically, after the ADMIN_TOKEN assignment above,
  // so config/env.ts's module-level read of process.env.ADMIN_TOKEN sees the right value.
  let app: typeof import("../app").default;
  let pool: typeof import("../db/pool").default;

  beforeAll(async () => {
    const [{ default: appModule }, { default: poolModule }, { SCHEMA_SQL }] = await Promise.all([
      import("../app"),
      import("../db/pool"),
      import("../db/schema"),
    ]);
    app = appModule;
    pool = poolModule;

    // Stand up the real schema against the test database, the exact same SQL db/init.ts
    // runs in production, so there's no second "test schema" to drift out of sync.
    await pool.query(SCHEMA_SQL);
  });

  afterAll(async () => {
    await pool.end();
  });

  // Start every test with a clean slate: no jokes, no votes, ids reset to 1. This keeps
  // tests independent of each other and of whatever's already in the local dev database
  // (they run against a separate "dad_jokes_test" database, never the real one).
  beforeEach(async () => {
    await pool.query("TRUNCATE TABLE votes, jokes RESTART IDENTITY CASCADE");
  });

  // Small helper to insert a joke directly (bypassing the API) so tests that check
  // reads/filters/sorts don't also depend on POST / working correctly.
  async function insertJoke(overrides: Partial<{
    setup: string;
    punchline: string;
    category: string;
    groan_level: number;
    upvotes: number;
    downvotes: number;
    author: string;
    status: string;
  }> = {}): Promise<number> {
    const j = {
      setup: "Why did the scarecrow win an award?",
      punchline: "Because he was outstanding in his field.",
      category: "classic",
      groan_level: 5,
      upvotes: 0,
      downvotes: 0,
      author: "Test Dad",
      status: "approved",
      ...overrides,
    };
    const result = await pool.query(
      `INSERT INTO jokes (setup, punchline, category, groan_level, upvotes, downvotes, author, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [j.setup, j.punchline, j.category, j.groan_level, j.upvotes, j.downvotes, j.author, j.status]
    );
    return result.rows[0].id;
  }

  // ==========================================================
  // GET /api/jokes, filtering, sorting, pagination
  // ==========================================================
  describe("GET /api/jokes", () => {
    it("returns an empty list with correct pagination metadata when there are no jokes", async () => {
      const res = await request(app).get("/api/jokes");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
      expect(res.body.pagination).toEqual({
        page: 1,
        limit: 20,
        offset: 0,
        total: 0,
        total_pages: 1,
      });
    });

    it("returns all jokes when unfiltered", async () => {
      await insertJoke({ category: "puns" });
      await insertJoke({ category: "animals" });

      const res = await request(app).get("/api/jokes");
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination.total).toBe(2);
    });

    it("filters by category", async () => {
      await insertJoke({ category: "puns", setup: "Pun joke A" });
      await insertJoke({ category: "animals", setup: "Animal joke B" });
      await insertJoke({ category: "puns", setup: "Pun joke C" });

      const res = await request(app).get("/api/jokes?category=puns");
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data.every((j: { category: string }) => j.category === "puns")).toBe(true);
      // The COUNT query must use the same filter as the SELECT.
      expect(res.body.pagination.total).toBe(2);
    });

    it("returns an empty list (not an error) for a category with no jokes", async () => {
      await insertJoke({ category: "puns" });
      const res = await request(app).get("/api/jokes?category=geography");
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.pagination.total).toBe(0);
    });

    it("sorts by groan_level descending when sort=groan", async () => {
      await insertJoke({ setup: "Low groan", groan_level: 2 });
      await insertJoke({ setup: "High groan", groan_level: 9 });
      await insertJoke({ setup: "Mid groan", groan_level: 5 });

      const res = await request(app).get("/api/jokes?sort=groan");
      const groanLevels = res.body.data.map((j: { groan_level: number }) => j.groan_level);
      expect(groanLevels).toEqual([9, 5, 2]);
    });

    it("sorts oldest first when sort=oldest", async () => {
      const firstId = await insertJoke({ setup: "First joke" });
      const secondId = await insertJoke({ setup: "Second joke" });

      const res = await request(app).get("/api/jokes?sort=oldest");
      const ids = res.body.data.map((j: { id: number }) => j.id);
      expect(ids).toEqual([firstId, secondId]);
    });

    it("defaults to sorting by net score (upvotes - downvotes) descending", async () => {
      const lowScore = await insertJoke({ setup: "Low score", upvotes: 1, downvotes: 5 });
      const highScore = await insertJoke({ setup: "High score", upvotes: 10, downvotes: 0 });

      const res = await request(app).get("/api/jokes");
      const ids = res.body.data.map((j: { id: number }) => j.id);
      expect(ids).toEqual([highScore, lowScore]);
    });

    it("sorts by controversial (closest to a 50/50 split) when sort=controversial", async () => {
      const untouched = await insertJoke({ setup: "Untouched", upvotes: 0, downvotes: 0 });
      const contested = await insertJoke({ setup: "Contested", upvotes: 5, downvotes: 5 });
      const lopsided = await insertJoke({ setup: "Lopsided", upvotes: 99, downvotes: 1 });

      const res = await request(app).get("/api/jokes?sort=controversial");
      const ids = res.body.data.map((j: { id: number }) => j.id);
      // Most contested (50/50) first, then lopsided, then the untouched 0/0 joke last,
      // regression coverage for the ABS(diff) bug fixed in utils/sortOptions.ts.
      expect(ids).toEqual([contested, lopsided, untouched]);
    });

    it("paginates with page/limit and reports total_pages correctly", async () => {
      await insertJoke({ setup: "Joke 1" });
      await insertJoke({ setup: "Joke 2" });
      await insertJoke({ setup: "Joke 3" });

      const page1 = await request(app).get("/api/jokes?limit=2&page=1");
      expect(page1.body.data).toHaveLength(2);
      expect(page1.body.pagination).toMatchObject({ page: 1, limit: 2, offset: 0, total: 3, total_pages: 2 });

      const page2 = await request(app).get("/api/jokes?limit=2&page=2");
      expect(page2.body.data).toHaveLength(1);
      expect(page2.body.pagination).toMatchObject({ page: 2, limit: 2, offset: 2, total: 3, total_pages: 2 });
    });

    it("caps limit at MAX_LIMIT (100) even if a larger value is requested", async () => {
      const res = await request(app).get("/api/jokes?limit=99999");
      expect(res.body.pagination.limit).toBe(100);
    });

    it("an explicit offset overrides the offset implied by page", async () => {
      await insertJoke({ setup: "Joke 1" });
      await insertJoke({ setup: "Joke 2" });
      await insertJoke({ setup: "Joke 3" });

      const res = await request(app).get("/api/jokes?limit=1&page=1&offset=2");
      expect(res.body.pagination.offset).toBe(2);
      expect(res.body.data).toHaveLength(1);
    });
  });

  // ==========================================================
  // GET /api/jokes?q=, trigram/fuzzy search (see db/schema.ts pg_trgm indexes)
  // ==========================================================
  describe("GET /api/jokes?q= (search)", () => {
    it("matches an exact substring in the setup", async () => {
      const scarecrow = await insertJoke({
        setup: "Why did the scarecrow win an award?",
        punchline: "Because he was outstanding in his field.",
      });
      await insertJoke({ setup: "Why don't eggs tell jokes?", punchline: "They'd crack each other up." });

      const res = await request(app).get("/api/jokes?q=scarecrow");
      expect(res.status).toBe(200);
      expect(res.body.data.map((j: { id: number }) => j.id)).toEqual([scarecrow]);
    });

    it("matches an exact substring in the punchline", async () => {
      const eggJoke = await insertJoke({
        setup: "Why don't eggs tell jokes?",
        punchline: "They'd crack each other up.",
      });
      await insertJoke({ setup: "Why did the scarecrow win an award?", punchline: "Because he was outstanding in his field." });

      const res = await request(app).get("/api/jokes?q=crack");
      expect(res.status).toBe(200);
      expect(res.body.data.map((j: { id: number }) => j.id)).toEqual([eggJoke]);
    });

    it("is typo-tolerant via trigram similarity", async () => {
      const scarecrow = await insertJoke({
        setup: "Why did the scarecrow win an award?",
        punchline: "Because he was outstanding in his field.",
      });
      await insertJoke({ setup: "Why don't eggs tell jokes?", punchline: "They'd crack each other up." });

      // "scarcrow" (missing an "e") is a one-letter typo of "scarecrow", trigram
      // similarity should still surface it even though it's not an exact substring.
      const res = await request(app).get("/api/jokes?q=scarcrow");
      expect(res.status).toBe(200);
      expect(res.body.data.map((j: { id: number }) => j.id)).toContain(scarecrow);
    });

    it("returns an empty list (not an error) when nothing matches", async () => {
      await insertJoke({ setup: "Why did the scarecrow win an award?" });
      const res = await request(app).get("/api/jokes?q=xyznonsensequery");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
      expect(res.body.pagination.total).toBe(0);
    });

    it("only searches approved jokes, never pending or rejected ones", async () => {
      await insertJoke({ setup: "Pending scarecrow joke", status: "pending" });
      await insertJoke({ setup: "Rejected scarecrow joke", status: "rejected" });
      const approved = await insertJoke({ setup: "Approved scarecrow joke", status: "approved" });

      const res = await request(app).get("/api/jokes?q=scarecrow");
      expect(res.status).toBe(200);
      expect(res.body.data.map((j: { id: number }) => j.id)).toEqual([approved]);
      expect(res.body.pagination.total).toBe(1);
    });

    it("combines with the category filter", async () => {
      const matching = await insertJoke({ setup: "Scarecrow pun joke", category: "puns" });
      await insertJoke({ setup: "Scarecrow animal joke", category: "animals" });

      const res = await request(app).get("/api/jokes?q=scarecrow&category=puns");
      expect(res.status).toBe(200);
      expect(res.body.data.map((j: { id: number }) => j.id)).toEqual([matching]);
    });

    it("orders results by relevance, best match first", async () => {
      // "cat" is an exact, standalone-word match in the second joke's setup, and only a
      // substring of "category" in the first, the exact word match should score higher
      // and come first in the results.
      const weakMatch = await insertJoke({ setup: "Why did the category theory joke fail?", punchline: "Too abstract." });
      const strongMatch = await insertJoke({ setup: "Why did the cat sit on the computer?", punchline: "To keep an eye on the mouse." });

      const res = await request(app).get("/api/jokes?q=cat");
      const ids = res.body.data.map((j: { id: number }) => j.id);
      expect(ids).toContain(weakMatch);
      expect(ids).toContain(strongMatch);
      expect(ids.indexOf(strongMatch)).toBeLessThan(ids.indexOf(weakMatch));
    });

    it("paginates search results and keeps the same total across pages", async () => {
      for (let i = 0; i < 3; i++) {
        await insertJoke({ setup: `Scarecrow joke number ${i}`, punchline: "A punchline." });
      }
      await insertJoke({ setup: "Unrelated joke", punchline: "Nothing to do with the query." });

      const page1 = await request(app).get("/api/jokes?q=scarecrow&limit=2&page=1");
      expect(page1.body.data).toHaveLength(2);
      expect(page1.body.pagination).toMatchObject({ page: 1, limit: 2, total: 3, total_pages: 2 });

      const page2 = await request(app).get("/api/jokes?q=scarecrow&limit=2&page=2");
      expect(page2.body.data).toHaveLength(1);
      expect(page2.body.pagination).toMatchObject({ page: 2, limit: 2, total: 3, total_pages: 2 });

      // No overlap between the two pages.
      const page1Ids = page1.body.data.map((j: { id: number }) => j.id);
      const page2Ids = page2.body.data.map((j: { id: number }) => j.id);
      expect(page1Ids.some((id: number) => page2Ids.includes(id))).toBe(false);
    });

    it("treats a blank/whitespace-only q as no search filter", async () => {
      await insertJoke({ setup: "Joke A" });
      await insertJoke({ setup: "Joke B" });

      const res = await request(app).get("/api/jokes?q=%20%20");
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });
  });

  // ==========================================================
  // GET /api/jokes/random
  // ==========================================================
  describe("GET /api/jokes/random", () => {
    it("returns 404 when the database has no jokes", async () => {
      const res = await request(app).get("/api/jokes/random");
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("returns a single joke when jokes exist", async () => {
      await insertJoke();
      const res = await request(app).get("/api/jokes/random");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("setup");
      expect(res.body.data).toHaveProperty("punchline");
    });
  });

  // ==========================================================
  // GET /api/jokes/categories
  // ==========================================================
  describe("GET /api/jokes/categories", () => {
    it("groups jokes by category with counts, most popular category first", async () => {
      await insertJoke({ category: "puns" });
      await insertJoke({ category: "puns" });
      await insertJoke({ category: "animals" });

      const res = await request(app).get("/api/jokes/categories");
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([
        { category: "puns", count: "2" },
        { category: "animals", count: "1" },
      ]);
    });
  });

  // ==========================================================
  // GET /api/jokes/stats
  // ==========================================================
  describe("GET /api/jokes/stats", () => {
    it("returns null most_upvoted and zero totals for an empty database", async () => {
      const res = await request(app).get("/api/jokes/stats");
      expect(res.status).toBe(200);
      expect(res.body.data.most_upvoted).toBeNull();
      expect(res.body.data.total_jokes).toBe("0");
    });

    it("computes aggregate stats and identifies the most upvoted joke", async () => {
      await insertJoke({ setup: "Low", upvotes: 1, downvotes: 0, groan_level: 4 });
      const topId = await insertJoke({ setup: "Top", upvotes: 20, downvotes: 3, groan_level: 8 });

      const res = await request(app).get("/api/jokes/stats");
      expect(res.body.data.total_jokes).toBe("2");
      expect(res.body.data.avg_groan_level).toBe("6.0");
      expect(res.body.data.most_upvoted.id).toBe(topId);
      expect(res.body.data.category_counts).toEqual(
        expect.arrayContaining([expect.objectContaining({ category: "classic", count: "2" })])
      );
    });
  });

  // ==========================================================
  // GET /api/jokes/:id
  // ==========================================================
  describe("GET /api/jokes/:id", () => {
    it("returns the joke matching the given id", async () => {
      const id = await insertJoke({ setup: "Findable joke" });
      const res = await request(app).get(`/api/jokes/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(id);
      expect(res.body.data.setup).toBe("Findable joke");
    });

    it("returns 404 for an id that doesn't exist", async () => {
      const res = await request(app).get("/api/jokes/999999");
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // ==========================================================
  // POST /api/jokes, Zod validation + defaults
  // ==========================================================
  describe("POST /api/jokes", () => {
    it("creates a joke and applies defaults for omitted optional fields", async () => {
      const res = await request(app)
        .post("/api/jokes")
        .send({ setup: "A brand new setup", punchline: "A punchline" });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.category).toBe("classic");
      expect(res.body.data.groan_level).toBe(5);
      expect(res.body.data.author).toBe("Anonymous Dad");
      expect(res.body.data.upvotes).toBe(0);
    });

    it("creates the joke with status 'pending', awaiting moderation", async () => {
      const res = await request(app)
        .post("/api/jokes")
        .send({ setup: "A brand new setup", punchline: "A punchline" });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe("pending");
    });

    it("does not make the new joke visible in the public listing, random, or by-id endpoints", async () => {
      const created = await request(app)
        .post("/api/jokes")
        .send({ setup: "Invisible until approved", punchline: "A punchline" });
      const id = created.body.data.id;

      const list = await request(app).get("/api/jokes");
      expect(list.body.data.find((j: { id: number }) => j.id === id)).toBeUndefined();
      expect(list.body.pagination.total).toBe(0);

      const byId = await request(app).get(`/api/jokes/${id}`);
      expect(byId.status).toBe(404);

      // Random draws only from approved jokes, with nothing approved yet, it 404s.
      const random = await request(app).get("/api/jokes/random");
      expect(random.status).toBe(404);
    });

    it("accepts an explicit category from the fixed taxonomy", async () => {
      const res = await request(app)
        .post("/api/jokes")
        .send({ setup: "A science-y setup", punchline: "A punchline", category: "science" });

      expect(res.status).toBe(201);
      expect(res.body.data.category).toBe("science");
    });

    it("rejects a category outside the fixed taxonomy with 400", async () => {
      const res = await request(app)
        .post("/api/jokes")
        .send({ setup: "A setup here", punchline: "A punchline", category: "not-a-real-category" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);

      const stored = await pool.query("SELECT COUNT(*) FROM jokes");
      expect(stored.rows[0].count).toBe("0");
    });

    it("rejects a setup shorter than 5 characters with 400", async () => {
      const res = await request(app)
        .post("/api/jokes")
        .send({ setup: "Hi", punchline: "A valid punchline" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Setup");
    });

    it("rejects a groan_level outside 1-10 with 400", async () => {
      const res = await request(app)
        .post("/api/jokes")
        .send({ setup: "A valid setup here", punchline: "A punchline", groan_level: 15 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Groan level");
    });

    it("rejects a missing punchline with 400 and never touches the database", async () => {
      const res = await request(app)
        .post("/api/jokes")
        .send({ setup: "A valid setup with no punchline" });

      expect(res.status).toBe(400);
      const stored = await pool.query("SELECT COUNT(*) FROM jokes");
      expect(stored.rows[0].count).toBe("0");
    });
  });

  // ==========================================================
  // POST /api/jokes/vote, dedup by IP, validation
  // ==========================================================
  describe("POST /api/jokes/vote", () => {
    it("increments upvotes on an 'up' vote", async () => {
      const id = await insertJoke();
      const res = await request(app).post("/api/jokes/vote").send({ joke_id: id, vote_type: "up" });

      expect(res.status).toBe(200);
      expect(res.body.data.upvotes).toBe(1);
      expect(res.body.data.downvotes).toBe(0);
    });

    it("increments downvotes on a 'down' vote", async () => {
      const id = await insertJoke();
      const res = await request(app).post("/api/jokes/vote").send({ joke_id: id, vote_type: "down" });

      expect(res.status).toBe(200);
      expect(res.body.data.downvotes).toBe(1);
    });

    it("rejects a second vote from the same IP on the same joke with 409", async () => {
      const id = await insertJoke();
      const agent = request(app);

      const first = await agent.post("/api/jokes/vote").send({ joke_id: id, vote_type: "up" });
      expect(first.status).toBe(200);

      const second = await agent.post("/api/jokes/vote").send({ joke_id: id, vote_type: "up" });
      expect(second.status).toBe(409);

      // The vote count must NOT have incremented a second time.
      const joke = await pool.query("SELECT upvotes FROM jokes WHERE id = $1", [id]);
      expect(joke.rows[0].upvotes).toBe(1);
    });

    it("rejects an invalid vote_type with 400", async () => {
      const id = await insertJoke();
      const res = await request(app).post("/api/jokes/vote").send({ joke_id: id, vote_type: "sideways" });
      expect(res.status).toBe(400);
    });

    it("rejects a non-positive joke_id with 400", async () => {
      const res = await request(app).post("/api/jokes/vote").send({ joke_id: -1, vote_type: "up" });
      expect(res.status).toBe(400);
    });

    it("rejects voting on a joke that's still pending moderation with 404", async () => {
      const id = await insertJoke({ status: "pending" });
      const res = await request(app).post("/api/jokes/vote").send({ joke_id: id, vote_type: "up" });
      expect(res.status).toBe(404);
    });

    it("rejects voting on a joke that was rejected with 404", async () => {
      const id = await insertJoke({ status: "rejected" });
      const res = await request(app).post("/api/jokes/vote").send({ joke_id: id, vote_type: "up" });
      expect(res.status).toBe(404);
    });
  });

  // ==========================================================
  // Moderation queue: GET /pending, POST /:id/approve, POST /:id/reject
  // ==========================================================
  describe("Moderation queue (admin-gated)", () => {
    describe("GET /api/jokes/pending", () => {
      it("rejects with 401 when no x-admin-token header is provided", async () => {
        await insertJoke({ status: "pending" });
        const res = await request(app).get("/api/jokes/pending");
        expect(res.status).toBe(401);
      });

      it("lists only pending jokes, oldest first, and never approved/rejected ones", async () => {
        const approved = await insertJoke({ setup: "Already live", status: "approved" });
        const rejected = await insertJoke({ setup: "Already turned down", status: "rejected" });
        const firstPending = await insertJoke({ setup: "First submitted", status: "pending" });
        const secondPending = await insertJoke({ setup: "Second submitted", status: "pending" });

        const res = await request(app).get("/api/jokes/pending").set("x-admin-token", ADMIN_TOKEN!);
        expect(res.status).toBe(200);
        const ids = res.body.data.map((j: { id: number }) => j.id);
        expect(ids).toEqual([firstPending, secondPending]);
        expect(ids).not.toContain(approved);
        expect(ids).not.toContain(rejected);
        expect(res.body.pagination.total).toBe(2);
      });
    });

    describe("POST /api/jokes/:id/approve", () => {
      it("rejects with 401 when no x-admin-token header is provided", async () => {
        const id = await insertJoke({ status: "pending" });
        const res = await request(app).post(`/api/jokes/${id}/approve`);
        expect(res.status).toBe(401);
      });

      it("approves a pending joke, making it visible in the public listing", async () => {
        const id = await insertJoke({ setup: "Awaiting approval", status: "pending" });

        const approve = await request(app).post(`/api/jokes/${id}/approve`).set("x-admin-token", ADMIN_TOKEN!);
        expect(approve.status).toBe(200);
        expect(approve.body.data.status).toBe("approved");

        const list = await request(app).get("/api/jokes");
        expect(list.body.data.map((j: { id: number }) => j.id)).toContain(id);
      });

      it("returns 409 when the joke is already approved", async () => {
        const id = await insertJoke({ status: "approved" });
        const res = await request(app).post(`/api/jokes/${id}/approve`).set("x-admin-token", ADMIN_TOKEN!);
        expect(res.status).toBe(409);
      });

      it("returns 404 for an id that doesn't exist", async () => {
        const res = await request(app).post("/api/jokes/999999/approve").set("x-admin-token", ADMIN_TOKEN!);
        expect(res.status).toBe(404);
      });
    });

    describe("POST /api/jokes/:id/reject", () => {
      it("rejects with 401 when no x-admin-token header is provided", async () => {
        const id = await insertJoke({ status: "pending" });
        const res = await request(app).post(`/api/jokes/${id}/reject`);
        expect(res.status).toBe(401);
      });

      it("rejects a pending joke, keeping it out of the public listing", async () => {
        const id = await insertJoke({ setup: "Not making the cut", status: "pending" });

        const reject = await request(app).post(`/api/jokes/${id}/reject`).set("x-admin-token", ADMIN_TOKEN!);
        expect(reject.status).toBe(200);
        expect(reject.body.data.status).toBe("rejected");

        const list = await request(app).get("/api/jokes");
        expect(list.body.data.map((j: { id: number }) => j.id)).not.toContain(id);

        // The row is kept (not deleted), it just no longer shows up as pending either.
        const pending = await request(app).get("/api/jokes/pending").set("x-admin-token", ADMIN_TOKEN!);
        expect(pending.body.data.map((j: { id: number }) => j.id)).not.toContain(id);
      });

      it("returns 409 when the joke is already rejected", async () => {
        const id = await insertJoke({ status: "rejected" });
        const res = await request(app).post(`/api/jokes/${id}/reject`).set("x-admin-token", ADMIN_TOKEN!);
        expect(res.status).toBe(409);
      });

      it("returns 404 for an id that doesn't exist", async () => {
        const res = await request(app).post("/api/jokes/999999/reject").set("x-admin-token", ADMIN_TOKEN!);
        expect(res.status).toBe(404);
      });
    });

    describe("GET /api/jokes/stats pending_count", () => {
      it("reports how many jokes are awaiting moderation", async () => {
        await insertJoke({ status: "approved" });
        await insertJoke({ status: "pending" });
        await insertJoke({ status: "pending" });

        const res = await request(app).get("/api/jokes/stats");
        expect(res.body.data.pending_count).toBe(2);
      });
    });
  });

  // ==========================================================
  // DELETE /api/jokes/:id, admin-token gated
  // ==========================================================
  describe("DELETE /api/jokes/:id", () => {
    it("rejects with 401 when no x-admin-token header is provided", async () => {
      const id = await insertJoke();
      const res = await request(app).delete(`/api/jokes/${id}`);
      expect(res.status).toBe(401);

      const stillThere = await pool.query("SELECT 1 FROM jokes WHERE id = $1", [id]);
      expect(stillThere.rows).toHaveLength(1);
    });

    it("rejects with 401 when the token is wrong", async () => {
      const id = await insertJoke();
      const res = await request(app).delete(`/api/jokes/${id}`).set("x-admin-token", "wrong-token");
      expect(res.status).toBe(401);
    });

    it("deletes the joke and returns it when the token matches", async () => {
      const id = await insertJoke({ setup: "Doomed joke" });
      const res = await request(app).delete(`/api/jokes/${id}`).set("x-admin-token", ADMIN_TOKEN!);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(id);

      const gone = await pool.query("SELECT 1 FROM jokes WHERE id = $1", [id]);
      expect(gone.rows).toHaveLength(0);
    });

    it("returns 404 when deleting an id that doesn't exist", async () => {
      const res = await request(app).delete("/api/jokes/999999").set("x-admin-token", ADMIN_TOKEN!);
      expect(res.status).toBe(404);
    });
  });
});
