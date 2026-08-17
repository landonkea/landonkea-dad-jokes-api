// Import Router and the Request/Response types from Express.
// Router lets us define routes in a separate file and mount them in the main app.
// Request and Response are TypeScript types that describe the shape of HTTP requests and responses.
import { Router, Request, Response } from "express";
// Import the database pool so we can run SQL queries against PostgreSQL.
import pool from "../db/pool";
// Import our TypeScript interfaces for type safety throughout this file.
// JokeInput = shape of data for creating a joke, ApiResponse = standard response format, Joke = a joke object.
import { JokeInput, ApiResponse, Joke } from "../types";
// Import the vote-specific rate limiter (stricter than the general API limiter).
import { voteLimiter } from "../middleware/rateLimiter";
// Import our Zod validation schemas, these check that incoming data is valid before we use it.
import { jokeInputSchema, voteInputSchema } from "../validation/jokeSchema";
// Import the pure "sort" query param -> SQL ORDER BY clause helper (unit-tested separately).
import { getSortClause } from "../utils/sortOptions";
// Import the pure pagination helper that turns page/limit/offset params into a safe, bounded triple.
import { parsePagination } from "../utils/pagination";
// Import the admin-token middleware that guards the DELETE route.
import { requireAdminToken } from "../middleware/adminAuth";

// Create a new Router instance.
// This router will handle all routes relative to "/api/jokes" (as mounted in index.ts).
const router = Router();

// ============================================================
// GET /, Get all jokes (with optional filters and sorting)
// ============================================================
// This route handles GET requests to "/api/jokes" (the base path).
// GET means "give me data", we're not creating or changing anything, just reading.
// The "/" here means the root path of this router.
// "async" lets us use "await" inside to wait for the database query to finish.
router.get("/", async (_req: Request, res: Response): Promise<void> => {
  // "try" wraps code that might fail. If the database query fails, the "catch" block handles it.
  try {
    // Extract query parameters from the URL. For example, if someone visits
    // "/api/jokes?category=puns&sort=groan&page=2&limit=5", then:
    //   category = "puns", sort = "groan", page = "2", limit = "5"
    // Query parameters come after the "?" in a URL and are key=value pairs.
    const { category, sort, q } = _req.query;

    // "params" is an array of values that will replace $1, $2, etc. in the query.
    // We start with an empty array because we haven't added any filters yet.
    // These params are shared between the SELECT and the COUNT query below, since
    // both need the exact same WHERE clause to stay consistent.
    const filterParams: unknown[] = [];
    // Public listing only ever shows approved jokes, pending submissions are still
    // awaiting moderation, and rejected ones were turned down. Both are only visible
    // through the admin-gated moderation endpoints below.
    let whereClause = " WHERE status = 'approved'";

    // Only filter by category if the user provided one.
    // "typeof category === 'string'" makes sure it's actually a string and not something weird.
    if (category && typeof category === "string") {
      // Add the category value to the params array. It will replace $1 in the query.
      filterParams.push(category);
      // Build a WHERE clause. "$${filterParams.length}" becomes "$1" because
      // filterParams now has 1 item. This is how we safely filter by the user's category.
      // We use $1 instead of inserting the value directly to prevent SQL injection attacks.
      whereClause += ` AND category = $${filterParams.length}`;
    }

    // Full-text/fuzzy search via ?q=. Relies on the pg_trgm extension and the GIN trigram
    // indexes on setup/punchline (see db/schema.ts). Two things happen with the search term:
    //   1. It's added to the WHERE clause as an OR of substring matching (ILIKE '%term%',
    //      so "widget" still matches a joke that only contains "gadget widgets") and
    //      trigram similarity() above a low threshold (so a typo like "wigdet" still matches).
    //   2. relevanceOrder is set so the SELECT below sorts best-match-first instead of the
    //      usual score/groan/date ordering, when you're searching, "closest match" is a
    //      more useful order than "most upvoted".
    // Scoped to the same "status = 'approved'" WHERE clause as everything else in this
    // route, search must never surface pending/rejected submissions.
    let relevanceOrder: string | null = null;
    if (typeof q === "string" && q.trim() !== "") {
      const searchTerm = q.trim();
      filterParams.push(searchTerm);
      const qParam = `$${filterParams.length}`;
      whereClause += ` AND (setup ILIKE '%' || ${qParam} || '%' OR punchline ILIKE '%' || ${qParam} || '%' OR similarity(setup, ${qParam}) > 0.2 OR similarity(punchline, ${qParam}) > 0.2)`;
      relevanceOrder = `GREATEST(similarity(setup, ${qParam}), similarity(punchline, ${qParam})) DESC`;
    }

    // Determine how to sort the results based on the "sort" query parameter.
    // Delegated to a pure helper (utils/sortOptions.ts) so the ordering logic, including
    // the "controversial" scoring math, can be unit-tested without a database.
    // A search (?q=) always takes ordering priority over ?sort=, "best match" is what
    // someone searching wants to see first, not "most upvoted" or "newest".
    const sortOption = relevanceOrder || getSortClause(typeof sort === "string" ? sort : undefined);

    // Turn page/limit/offset query params into a safe, bounded { limit, offset, page } triple.
    // Delegated to a pure helper (utils/pagination.ts) so the edge cases (bad input, huge
    // limits, explicit offset overriding page) can be unit-tested without a database.
    const { limit, offset, page } = parsePagination(_req.query);

    // Build the SELECT query: filters, then sort, then page window (LIMIT/OFFSET).
    // LIMIT/OFFSET params are appended after the filter params so their placeholder
    // numbers ($2, $3, ...) come after any WHERE clause placeholders.
    const selectParams = [...filterParams, limit, offset];
    const query = `SELECT * FROM jokes${whereClause} ORDER BY ${sortOption} LIMIT $${selectParams.length - 1} OFFSET $${selectParams.length}`;

    // Run a COUNT(*) with the same WHERE clause so the client knows the total number of
    // matching jokes (needed to render "page 2 of 5" style pagination UI).
    const countQuery = `SELECT COUNT(*) FROM jokes${whereClause}`;

    // Execute both queries. They're independent, so run them concurrently.
    const [result, countResult] = await Promise.all([
      pool.query(query, selectParams),
      pool.query(countQuery, filterParams),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);

    // Build our standard API response with "success: true" and the joke data.
    // "result.rows" is an array of joke objects returned by the database.
    const response: ApiResponse<Joke[]> = {
      success: true,
      // Pass the array of jokes as the data payload.
      data: result.rows,
      // Pagination metadata so the client can render "page X of Y" and know if there's more.
      pagination: {
        page,
        limit,
        offset,
        total,
        total_pages: Math.max(Math.ceil(total / limit), 1),
      },
    };

    // Send the response back to the client as JSON.
    // By default, this sends HTTP status 200 (OK, everything worked).
    res.json(response);

  // If anything goes wrong (database error, etc.), the "catch" block runs.
  } catch (err) {
    // Build an error response with "success: false" and the error message.
    // "(err as Error)" tells TypeScript to treat "err" as an Error object
    // so we can access ".message" on it.
    const response: ApiResponse<null> = {
      success: false,
      error: (err as Error).message,
    };

    // Send the error response with HTTP status 500 (Internal Server Error).
    res.status(500).json(response);
  }
});

// ============================================================
// GET /random, Get one random joke
// ============================================================
// This route handles GET requests to "/api/jokes/random".
// It picks one joke at random from the database, perfect for a "surprise me" button.
router.get("/random", async (_req: Request, res: Response): Promise<void> => {
  try {
    // SQL query: "SELECT * FROM jokes" = get all columns from the jokes table.
    // "ORDER BY RANDOM()" shuffles all the rows randomly.
    // "LIMIT 1" takes only the first (randomly shuffled) row.
    // So we get one random joke. Only approved jokes are eligible, a pending
    // submission shouldn't be able to show up before a moderator has seen it.
    const result = await pool.query("SELECT * FROM jokes WHERE status = 'approved' ORDER BY RANDOM() LIMIT 1");

    // If the result has 0 rows, the database is empty, there are no jokes to return.
    if (result.rows.length === 0) {
      // Send a 404 (Not Found) response with a funny error message.
      // HTTP 404 means "the thing you asked for doesn't exist."
      res.status(404).json({ success: false, error: "No jokes found. The database is as empty as my dad's joke book." });
      // "return" stops execution here so we don't try to access result.rows[0] below
      // (which would be undefined since there are no rows).
      return;
    }

    // Build a successful response. "result.rows[0]" gets the first (and only) joke from the result.
    const response: ApiResponse<Joke> = {
      success: true,
      data: result.rows[0],
    };

    // Send the random joke back to the client.
    res.json(response);
  } catch (err) {
    // If something goes wrong, send a 500 error response.
    const response: ApiResponse<null> = {
      success: false,
      error: (err as Error).message,
    };
    res.status(500).json(response);
  }
});

// ============================================================
// GET /categories, Get all categories with joke counts
// ============================================================
// This route handles GET requests to "/api/jokes/categories".
// It returns a list of categories and how many jokes are in each one.
// This is useful for building a filter menu in the frontend.
router.get("/categories", async (_req: Request, res: Response): Promise<void> => {
  try {
    // This SQL query groups jokes by their category and counts how many are in each group.
    // "SELECT category, COUNT(*) as count" = pick the category name and count the rows in each group.
    // "GROUP BY category" = group all rows that have the same category together.
    // "ORDER BY count DESC" = put the category with the most jokes at the top.
    // Example result: [{ category: "classic", count: 8 }, { category: "animals", count: 6 }, ...]
    const result = await pool.query(
      "SELECT category, COUNT(*) as count FROM jokes WHERE status = 'approved' GROUP BY category ORDER BY count DESC"
    );

    // Build and send a successful response with the category data.
    const response: ApiResponse<{ category: string; count: number }[]> = {
      success: true,
      data: result.rows,
    };
    res.json(response);
  } catch (err) {
    // If the query fails, send a 500 error response.
    const response: ApiResponse<null> = {
      success: false,
      error: (err as Error).message,
    };
    res.status(500).json(response);
  }
});

// ============================================================
// GET /stats, Get overall statistics about all jokes
// ============================================================
// This route handles GET requests to "/api/jokes/stats".
// It returns a dashboard-style summary of the entire joke collection.
router.get("/stats", async (_req: Request, res: Response): Promise<void> => {
  try {
    // Run a SQL query that calculates aggregate statistics across ALL jokes.
    // "COUNT(*)" = total number of jokes.
    // "SUM(upvotes + downvotes)" = the total of all votes across all jokes combined.
    // "ROUND(AVG(groan_level), 1)" = the average groan level, rounded to 1 decimal place.
    // This is like asking "give me the big picture stats."
    // Every aggregate below is scoped to status = 'approved', pending/rejected
    // submissions haven't cleared moderation, so they shouldn't skew public stats.
    const stats = await pool.query(`
      SELECT
        COUNT(*) as total_jokes,
        SUM(upvotes + downvotes) as total_votes,
        ROUND(AVG(groan_level), 1) as avg_groan_level
      FROM jokes
      WHERE status = 'approved'
    `);

    // Find the single most upvoted joke in the entire database.
    // "ORDER BY upvotes DESC" sorts from most to fewest upvotes.
    // "LIMIT 1" grabs just the top one.
    const mostUpvoted = await pool.query(
      "SELECT * FROM jokes WHERE status = 'approved' ORDER BY upvotes DESC LIMIT 1"
    );

    // Get the count of jokes per category (same query as the /categories endpoint).
    // This provides category breakdown data as part of the stats.
    const categoryCounts = await pool.query(
      "SELECT category, COUNT(*) as count FROM jokes WHERE status = 'approved' GROUP BY category ORDER BY count DESC"
    );

    // How many submissions are sitting in the moderation queue right now. Not
    // gated behind admin auth (it's just a count, no joke content), but it's what
    // powers the "N pending" badge an admin would want to see before opening the
    // queue itself.
    const pendingCount = await pool.query(
      "SELECT COUNT(*) as count FROM jokes WHERE status = 'pending'"
    );

    // Build a combined stats object.
    // "...stats.rows[0]" uses the "spread operator" to take all the properties from the first row
    // of the stats query (total_jokes, total_votes, avg_groan_level) and put them into this object.
    // Then we add the most_upvoted joke and the category counts on top.
    const response: ApiResponse<typeof stats.rows[0] & { most_upvoted: Joke | null; category_counts: { category: string; count: number }[]; pending_count: number }> = {
      success: true,
      data: {
        // Spread the aggregate stats (total_jokes, total_votes, avg_groan_level).
        ...stats.rows[0],
        // The most upvoted joke, or null if there are no jokes at all.
        // "|| null" handles the case where mostUpvoted.rows[0] is undefined (empty database).
        most_upvoted: mostUpvoted.rows[0] || null,
        // The full list of categories with their counts.
        category_counts: categoryCounts.rows,
        // How many submissions are awaiting moderation right now.
        pending_count: parseInt(pendingCount.rows[0].count, 10),
      },
    };
    // Send the stats response back to the client.
    res.json(response);
  } catch (err) {
    const response: ApiResponse<null> = {
      success: false,
      error: (err as Error).message,
    };
    res.status(500).json(response);
  }
});

// ============================================================
// GET /pending, Get all jokes awaiting moderation (admin only)
// ============================================================
// This route handles GET requests to "/api/jokes/pending".
// It's how an admin reviews the moderation queue: every joke someone has submitted
// that hasn't been approved or rejected yet, oldest first (so the queue is worked
// in the order jokes came in, like a support ticket queue).
// NOTE: This MUST be declared before GET "/:id" below, Express matches routes in
// the order they're registered, and "/:id" would otherwise swallow "/pending" by
// treating the literal word "pending" as an :id value.
router.get("/pending", requireAdminToken, async (req: Request, res: Response): Promise<void> => {
  try {
    // Reuse the same pagination helper as the public listing, the queue can grow
    // large, so admins page through it rather than fetching everything at once.
    const { limit, offset, page } = parsePagination(req.query);

    const [result, countResult] = await Promise.all([
      pool.query(
        "SELECT * FROM jokes WHERE status = 'pending' ORDER BY created_at ASC LIMIT $1 OFFSET $2",
        [limit, offset]
      ),
      pool.query("SELECT COUNT(*) FROM jokes WHERE status = 'pending'"),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);

    const response: ApiResponse<Joke[]> = {
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        offset,
        total,
        total_pages: Math.max(Math.ceil(total / limit), 1),
      },
    };
    res.json(response);
  } catch (err) {
    const response: ApiResponse<null> = {
      success: false,
      error: (err as Error).message,
    };
    res.status(500).json(response);
  }
});

// ============================================================
// GET /:id, Get a single joke by its ID number
// ============================================================
// This route handles GET requests to "/api/jokes/42" (or any number).
// The ":id" part is a URL parameter, it captures whatever number is in the URL
// and makes it available as req.params.id.
// Think of it like a form field: the URL is the form, and ":id" is the blank to fill in.
// Only approved jokes are visible here, a pending or rejected joke isn't public yet,
// so it 404s just like an id that doesn't exist at all (this also means the queue
// doesn't leak which ids are "real but not approved" to an unauthenticated caller).
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    // Query the database for a joke where the "id" column matches the number from the URL.
    // "$1" is a placeholder that gets replaced by req.params.id safely.
    const result = await pool.query("SELECT * FROM jokes WHERE id = $1 AND status = 'approved'", [
      // req.params.id is whatever was in the URL after "/api/jokes/".
      // For example, if the URL is "/api/jokes/42", then req.params.id is "42".
      req.params.id,
    ]);

    // If no joke was found with that ID, send a 404 (Not Found) response.
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: "Joke not found. It probably died of cringe." });
      // Stop execution so we don't try to access a non-existent row below.
      return;
    }

    // Send back the found joke wrapped in our standard response format.
    const response: ApiResponse<Joke> = {
      success: true,
      // Get the first (and only) row from the results.
      data: result.rows[0],
    };
    res.json(response);
  } catch (err) {
    const response: ApiResponse<null> = {
      success: false,
      error: (err as Error).message,
    };
    res.status(500).json(response);
  }
});

// ============================================================
// POST /, Create a new joke
// ============================================================
// This route handles POST requests to "/api/jokes".
// POST means "I'm sending you data to create something new."
// Unlike GET (which just reads data), POST sends data in the request body.
router.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate the incoming request body against our Zod schema.
    // "safeParse" tries to validate and returns either { success: true, data } or { success: false, error }.
    // This prevents invalid data from ever reaching our database.
    const parsed = jokeInputSchema.safeParse(req.body);
    // If validation failed, send back a 400 (Bad Request) with the specific error messages.
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        // Join all validation error messages into a single string separated by "; ".
        // "parsed.error.issues" is an array of error objects from Zod.
        error: parsed.error.issues.map((i) => i.message).join("; "),
      });
      // Stop execution, don't try to insert invalid data.
      return;
    }
    // Destructure the validated data into individual variables for easy use.
    const { setup, punchline, category, groan_level, author } = parsed.data;

    // Insert the new joke into the database with status = 'pending', public
    // submissions go through moderation before they're visible to anyone else or
    // eligible for voting. An admin approves or rejects it via the /:id/approve
    // and /:id/reject routes below (see GET /pending for the review queue).
    // "RETURNING *" tells PostgreSQL to send back the newly created row.
    const result = await pool.query(
      `INSERT INTO jokes (setup, punchline, category, groan_level, author, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      // The "||" operator provides fallback values for optional fields.
      // If category is undefined, use "classic". If groan_level is undefined, use 5. Etc.
      [setup, punchline, category || "classic", groan_level || 5, author || "Anonymous Dad"]
    );

    // Build a success response with the newly created joke.
    const response: ApiResponse<Joke> = {
      success: true,
      data: result.rows[0],
    };
    // Send with HTTP status 201 (Created), this is the correct status for successful resource creation.
    res.status(201).json(response);
  } catch (err) {
    const response: ApiResponse<null> = {
      success: false,
      error: (err as Error).message,
    };
    res.status(500).json(response);
  }
});

// ============================================================
// POST /vote, Upvote or downvote a joke
// ============================================================
// This route handles POST requests to "/api/jokes/vote".
// The client sends which joke they're voting on and whether it's an upvote or downvote.
// NOTE: This route MUST come after the /:id route in the code, because Express matches
// routes in order. If "/vote" were a parameter, it would be caught by /:id first.
router.post("/vote", voteLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate the vote data against our Zod schema.
    const parsed = voteInputSchema.safeParse(req.body);
    // If validation failed, send a 400 error with the validation messages.
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join("; "),
      });
      return;
    }
    // Extract the validated joke_id and vote_type from the parsed data.
    const { joke_id, vote_type } = parsed.data;

    // Identify the voter by IP address. This is the only identity signal we have,
    // there's no login/account system, so it's an imperfect dedup (shared IPs/NAT
    // can share a vote slot, VPNs can dodge it), but it stops the easy case of a
    // single browser mashing the vote button or refreshing to vote again.
    const voterIp = req.ip || req.socket.remoteAddress || "unknown";

    // A joke has to have cleared moderation before it can be voted on, otherwise
    // someone could vote on (or find out about the existence of) a joke that's
    // still pending review, or one that was rejected. Treat both cases as 404,
    // same as an id that doesn't exist at all.
    const jokeStatus = await pool.query("SELECT status FROM jokes WHERE id = $1", [joke_id]);
    if (jokeStatus.rows.length === 0 || jokeStatus.rows[0].status !== "approved") {
      res.status(404).json({ success: false, error: "Joke not found." });
      return;
    }

    // Insert a new record into the votes table to log this vote (including who cast
    // it, so a second vote on this joke from the same IP can be rejected). "ON
    // CONFLICT (joke_id, voter_ip) DO NOTHING" relies on the uq_votes_joke_voter
    // unique index (see db/schema.ts) to make "one vote per IP per joke" atomic:
    // a separate SELECT-then-INSERT here used to leave a window where two
    // near-simultaneous requests from the same IP could both pass a "no existing
    // vote" check before either had inserted, double-counting the vote. An insert
    // that hits the constraint returns zero rows instead of erroring, which is how
    // we tell "this was a duplicate" apart from "this was a new vote" below.
    const inserted = await pool.query(
      "INSERT INTO votes (joke_id, vote_type, voter_ip) VALUES ($1, $2, $3) ON CONFLICT (joke_id, voter_ip) DO NOTHING RETURNING id",
      [joke_id, vote_type, voterIp]
    );
    if (inserted.rows.length === 0) {
      res.status(409).json({
        success: false,
        error: "You've already voted on this joke.",
      });
      return;
    }

    // Determine which column to update: "upvotes" if vote_type is "up", "downvotes" if "down".
    // The ternary operator (condition ? valueIfTrue : valueIfFalse) is a compact if/else.
    const column = vote_type === "up" ? "upvotes" : "downvotes";
    // Increment the appropriate vote counter on the joke by 1.
    // "SET ${column} = ${column} + 1" adds 1 to whichever column was chosen.
    await pool.query(`UPDATE jokes SET ${column} = ${column} + 1 WHERE id = $1`, [
      joke_id,
    ]);

    // Fetch the updated joke so we can send it back to the client.
    // This way the client gets the joke with its new vote count.
    const jokeResult = await pool.query("SELECT * FROM jokes WHERE id = $1", [
      joke_id,
    ]);

    // If no joke exists with that ID (shouldn't happen but just in case), send a 404.
    if (jokeResult.rows.length === 0) {
      res.status(404).json({ success: false, error: "Joke not found." });
      return;
    }

    // Send back the updated joke with its new vote counts.
    const response: ApiResponse<Joke> = {
      success: true,
      data: jokeResult.rows[0],
    };
    res.json(response);
  } catch (err) {
    // Postgres error code 23505 = unique_violation. In normal operation the
    // "ON CONFLICT (joke_id, voter_ip) DO NOTHING" above already handles a
    // duplicate vote by returning zero rows (see the `inserted.rows.length
    // === 0` branch), confirmed under real concurrent load against a live
    // database (5 rounds of 6 simultaneous requests, exactly one vote
    // recorded each time, no error). This branch is a defensive fallback,
    // not a documented gap in that mechanism: it converts any unique
    // constraint violation that reaches here into the same clean 409
    // rather than letting a raw Postgres error message leak to the client.
    if ((err as { code?: string }).code === "23505") {
      res.status(409).json({
        success: false,
        error: "You've already voted on this joke.",
      });
      return;
    }
    const response: ApiResponse<null> = {
      success: false,
      error: (err as Error).message,
    };
    res.status(500).json(response);
  }
});

// ============================================================
// POST /:id/approve, Approve a pending joke (admin only)
// ============================================================
// This route handles POST requests to "/api/jokes/42/approve".
// Moves a joke from "pending" to "approved", making it visible in the public API
// (GET /, /random, /categories, /stats, /:id) and eligible for voting.
router.post("/:id/approve", requireAdminToken, async (req: Request, res: Response): Promise<void> => {
  try {
    // Only actually transitions a joke that's currently "pending", approving an
    // already-approved or rejected joke is a no-op at the SQL level so we can tell
    // apart "doesn't exist" from "exists but wasn't pending" below.
    const result = await pool.query(
      "UPDATE jokes SET status = 'approved' WHERE id = $1 AND status = 'pending' RETURNING *",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      // Figure out whether the id doesn't exist at all, or exists but wasn't
      // pending (already approved/rejected), so we can give an accurate error.
      const existing = await pool.query("SELECT status FROM jokes WHERE id = $1", [req.params.id]);
      if (existing.rows.length === 0) {
        res.status(404).json({ success: false, error: "Joke not found." });
      } else {
        res.status(409).json({
          success: false,
          error: `Joke is already "${existing.rows[0].status}", not pending.`,
        });
      }
      return;
    }

    const response: ApiResponse<Joke> = {
      success: true,
      data: result.rows[0],
    };
    res.json(response);
  } catch (err) {
    const response: ApiResponse<null> = {
      success: false,
      error: (err as Error).message,
    };
    res.status(500).json(response);
  }
});

// ============================================================
// POST /:id/reject, Reject a pending joke (admin only)
// ============================================================
// This route handles POST requests to "/api/jokes/42/reject".
// Moves a joke from "pending" to "rejected". The row is kept (not deleted) so
// there's a record of what was submitted and turned down, an admin who wants it
// gone entirely can still DELETE /:id afterward.
router.post("/:id/reject", requireAdminToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      "UPDATE jokes SET status = 'rejected' WHERE id = $1 AND status = 'pending' RETURNING *",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      const existing = await pool.query("SELECT status FROM jokes WHERE id = $1", [req.params.id]);
      if (existing.rows.length === 0) {
        res.status(404).json({ success: false, error: "Joke not found." });
      } else {
        res.status(409).json({
          success: false,
          error: `Joke is already "${existing.rows[0].status}", not pending.`,
        });
      }
      return;
    }

    const response: ApiResponse<Joke> = {
      success: true,
      data: result.rows[0],
    };
    res.json(response);
  } catch (err) {
    const response: ApiResponse<null> = {
      success: false,
      error: (err as Error).message,
    };
    res.status(500).json(response);
  }
});

// ============================================================
// DELETE /:id, Delete a joke by its ID number
// ============================================================
// This route handles DELETE requests to "/api/jokes/42" (or any number).
// DELETE means "remove this thing from existence."
// "requireAdminToken" runs first, anyone without a valid x-admin-token header gets
// rejected before this handler ever touches the database. Previously ANY visitor
// could delete ANY joke with no auth check at all.
router.delete("/:id", requireAdminToken, async (req: Request, res: Response): Promise<void> => {
  try {
    // Delete the joke from the database where the id matches.
    // "RETURNING *" sends back the deleted row so we can confirm what was removed.
    // This is useful, the client might want to know what they just deleted.
    const result = await pool.query(
      "DELETE FROM jokes WHERE id = $1 RETURNING *",
      [req.params.id]
    );

    // If result.rows is empty, no joke had that id, nothing was deleted.
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: "Joke not found." });
      return;
    }

    // Send back the deleted joke data. The client can use this to update their UI.
    const response: ApiResponse<Joke> = {
      success: true,
      data: result.rows[0],
    };
    res.json(response);
  } catch (err) {
    const response: ApiResponse<null> = {
      success: false,
      error: (err as Error).message,
    };
    res.status(500).json(response);
  }
});

// Export this router so it can be imported and used in index.ts.
// When index.ts says "app.use('/api/jokes', jokesRouter)", it takes all the routes
// defined above and mounts them under "/api/jokes".
// So the GET "/" route above becomes GET "/api/jokes" in the full app.
export default router;
