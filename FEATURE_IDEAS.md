# Feature Ideas

Concrete ideas for this specific app, not a generic "add more features" list. Each one references the actual tables, endpoints, or components it would touch, so whoever picks one up knows where to start. None of these are built yet.

## Content and moderation

**1. Duplicate-submission detector using the trigram index that's already there.**
`GET /api/jokes?q=` already scores similarity via `pg_trgm`. Reuse the same `similarity()` function on `POST /api/jokes`: before inserting a new submission as `pending`, check it against existing `approved` jokes above a threshold (say 0.6) and flag likely duplicates in the moderation queue UI instead of making an admin catch it by eye. `ModerationQueue.tsx` would just need a "possible duplicate of #42" badge.

**2. A "flag" status for jokes that turn out to be a problem after they're already approved.**
Right now `status` only moves `pending → approved` or `pending → rejected`. There's no path back once a joke is live. Add a `flagged` status and a public `POST /api/jokes/:id/flag` (rate-limited, no auth needed) that pulls a joke out of rotation and drops it into a "flagged" section of the moderation queue, separate from new submissions.

**3. Audit log for admin actions.**
`adminAuth.ts` checks a single shared `ADMIN_TOKEN`. There's no record of who approved or rejected what, just that someone with the token did. A small `admin_actions` table (`joke_id`, `action`, `admin_label`, `created_at`) fed by a header like `x-admin-name` would give a real accountability trail without building a whole user system.

**4. Bulk approve/reject.**
`ModerationQueue.tsx` handles one joke at a time. If the queue ever backs up past a handful of submissions, checkboxes and a `POST /api/jokes/bulk-approve` (array of ids) would matter a lot more than the single-joke buttons do today.

## Discovery and browsing

**5. Weighted random instead of pure `ORDER BY RANDOM()`.**
`GET /api/jokes/random` gives every approved joke an equal shot regardless of how often it's already been shown. Add a `times_shown` counter column, increment it on each `/random` hit, and bias selection toward lower counts so the whole library actually gets seen instead of a handful of jokes dominating by luck of the shuffle.

**6. Groan-level range filter.**
`GET /api/jokes` already filters by `category` and searches by `q`. Add `?groan_min=` / `?groan_max=` using the existing `groan_level` column, wired to a two-handle slider next to `CategoryPicker.tsx`, useful for someone who specifically wants the worst (or gentlest) jokes in the database.

**7. "Joke of the Day," deterministic by date, not random per request.**
Pick one approved joke per calendar day using a seeded selection (hash the date string, mod the joke count) so everyone hitting `/api/jokes/daily` on the same day sees the same joke, and it changes at midnight. Gives the app a reason for someone to come back tomorrow instead of just refreshing `/random` in a loop.

**8. Hall of Fame: archive the top joke each week.**
A small `weekly_winners` table (`joke_id`, `week_start`, `final_score`) populated by a scheduled job (or a manually-triggered admin endpoint) snapshotting whichever approved joke has the best `upvotes - downvotes` at week's end. Gives `StatsPanel.tsx` a permanent leaderboard instead of only ever showing the current single "most upvoted."

## API and integration

**9. RSS/Atom feed of newly approved jokes.**
`GET /api/jokes/feed.xml` uses the same underlying query as the categories/list endpoints, serialized as an RSS feed instead of JSON. Costs almost nothing to build and makes the API usable by feed readers, which is a genuinely different audience than the React frontend.

**10. CSV/JSON export for admins.**
`POST /api/jokes/export` (admin-gated, same `requireAdminToken` middleware already used on delete/approve/reject) that dumps the full `jokes` table as downloadable CSV or JSON. Useful for backing up submissions or doing offline analysis outside the live database.

**11. Webhook notification when the moderation queue gets a new submission.**
An admin has to keep the "Moderate" tab open to notice new pending jokes. A configurable `MODERATION_WEBHOOK_URL` env var, POSTed to (Slack/Discord-compatible payload shape) whenever `POST /api/jokes` lands a new pending row, closes that gap without building a notification system from scratch.

**12. Per-key rate limiting instead of per-IP only.**
`rateLimiter.ts` limits by IP address, which means anyone behind the same NAT or corporate proxy shares one bucket. A lightweight API key system (`X-Api-Key` header, a `api_keys` table with a `requests_per_window` column) would let the two rate limiters key off the client instead of the network path, useful once this API has consumers other than its own React frontend.

**13. Open Graph preview for shared joke links.**
`GET /api/jokes/:id/share` returning a tiny server-rendered HTML page with OG meta tags (joke setup as the title, punchline as the description) so pasting a joke link into Slack, iMessage, or Twitter shows an actual preview card instead of a bare URL. The data's already there in the `jokes` table, this is purely a rendering endpoint.

## Voting and engagement

**14. Let voters guess the groan level, and compare against the submitter's rating.**
Right now `groan_level` is set once, by whoever submits the joke, and never challenged. Add an optional `groan_level` field to the vote payload (crowd's guess), average it per joke, and surface jokes in `StatsPanel.tsx` where the crowd's average disagrees most with the submitter's original rating. "Most mislabeled" is a genuinely funny stat for this specific app.

**15. Daily streak tracking via cookie, no login required.**
A signed cookie recording the last-visited date, incremented if the user comes back the next calendar day, reset if they skip one. Surface "you're on a 5-day groan streak" in the header. Fits the app's no-account-system philosophy (same reasoning that made vote dedup use IP address instead of a login).

**16. "Guess the punchline" mode.**
A lightweight client-only game: show the setup from `JokeList.tsx`'s existing data, hide the punchline, let the user type or pick from a few options before revealing it. No new backend needed, it's a new way of presenting data the API already returns.

## Infrastructure-adjacent (still product features, not pure ops)

**17. Localized jokes via a `?lang=` query param.**
A `joke_translations` table (`joke_id`, `lang`, `setup`, `punchline`) so `GET /api/jokes?lang=es` can return translated content where available and fall back to English otherwise. Turns this from an English-only app into one that could plausibly serve other markets without redesigning the schema.

**18. Category-level leaderboard.**
`GET /api/jokes/categories` already returns counts per category. Add a "top joke per category" view (one query, `DISTINCT ON (category) ... ORDER BY category, upvotes - downvotes DESC`) so `CategoryPicker.tsx` can show a preview of the best joke in each category before the user even clicks into it.

**19. "On this day" nostalgia view.**
`GET /api/jokes/on-this-day` returns approved jokes whose `created_at` matches today's month/day from a previous year. Only becomes meaningful once the database has real submission history spanning more than a few months, but it's a cheap query against a column that already exists.

**20. Submission cooldown per author name.**
`JokeSubmitter.tsx` lets anyone submit under any `author` name with no throttling beyond the general rate limiter. A short per-author-name cooldown (track last submission time in a small in-memory or Redis-backed map) would cut down on someone flooding the moderation queue under a made-up name, without requiring real accounts.
