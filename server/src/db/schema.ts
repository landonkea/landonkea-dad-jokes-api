// The actual CREATE TABLE / CREATE INDEX statements for the app's schema, pulled out of
// db/init.ts so integration tests can stand up the same schema against a test database
// without duplicating this SQL (and risking the two copies drifting apart).
export const SCHEMA_SQL = `
  -- pg_trgm provides trigram-based similarity() scoring and lets GIN indexes speed up
  -- both ILIKE '%substring%' lookups and fuzzy/typo-tolerant matching (see the search
  -- indexes below and the ?q= search in routes/jokes.ts GET /). "IF NOT EXISTS" makes
  -- this safe to run against a database that already has the extension installed.
  CREATE EXTENSION IF NOT EXISTS pg_trgm;

  -- This creates the "jokes" table where all our dad jokes will be stored.
  CREATE TABLE IF NOT EXISTS jokes (
    id SERIAL PRIMARY KEY,
    setup TEXT NOT NULL,
    punchline TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'classic',
    groan_level INTEGER DEFAULT 5 CHECK (groan_level >= 1 AND groan_level <= 10),
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    author VARCHAR(100) DEFAULT 'Anonymous Dad',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- This creates the "votes" table to track individual upvotes and downvotes.
  CREATE TABLE IF NOT EXISTS votes (
    id SERIAL PRIMARY KEY,
    joke_id INTEGER REFERENCES jokes(id) ON DELETE CASCADE,
    vote_type VARCHAR(4) NOT NULL CHECK (vote_type IN ('up', 'down')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  ALTER TABLE votes ADD COLUMN IF NOT EXISTS voter_ip VARCHAR(45);

  -- Moderation status for the joke submission queue. New submissions come in as
  -- 'pending' (see routes/jokes.ts POST /) and only become publicly visible once
  -- an admin approves them. Defaulting the COLUMN itself to 'approved' (rather than
  -- 'pending') means this ALTER is safe to run against a database that already has
  -- jokes in it, every pre-existing row (including seed data) is grandfathered in
  -- as already-approved instead of silently disappearing from the public API.
  ALTER TABLE jokes ADD COLUMN IF NOT EXISTS status VARCHAR(10) NOT NULL DEFAULT 'approved'
    CHECK (status IN ('pending', 'approved', 'rejected'));

  CREATE INDEX IF NOT EXISTS idx_jokes_category ON jokes(category);
  CREATE INDEX IF NOT EXISTS idx_jokes_groan_level ON jokes(groan_level);
  CREATE INDEX IF NOT EXISTS idx_votes_joke_id ON votes(joke_id);
  CREATE INDEX IF NOT EXISTS idx_votes_joke_ip ON votes(joke_id, voter_ip);
  CREATE INDEX IF NOT EXISTS idx_jokes_score ON jokes ((upvotes - downvotes));
  CREATE INDEX IF NOT EXISTS idx_jokes_status ON jokes(status);

  -- Trigram GIN indexes for the ?q= search on GET /api/jokes (see routes/jokes.ts).
  -- Separate per-column indexes (rather than one index on the concatenated
  -- "setup || ' ' || punchline") so a search that only matches the punchline (or
  -- only the setup) can still use an index instead of falling back to a seq scan,
  -- and so future features (e.g. "search setups only") have an index ready to use.
  -- gin_trgm_ops backs both substring matching (ILIKE '%term%') and the similarity()
  -- fuzzy/typo-tolerant scoring used for relevance ordering.
  CREATE INDEX IF NOT EXISTS idx_jokes_setup_trgm ON jokes USING GIN (setup gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS idx_jokes_punchline_trgm ON jokes USING GIN (punchline gin_trgm_ops);
`;
