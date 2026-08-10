// Pure helper for turning page/limit/offset query params into a safe, bounded
// { limit, offset, page } triple. Pulled out of routes/jokes.ts so the edge
// cases (bad input, huge limits, explicit offset overriding page) can be
// unit-tested without a database.

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export interface PaginationParams {
  limit: number;
  offset: number;
  page: number;
}

// Express puts query params on req.query as string | string[] | ParsedQs | undefined.
// We only ever care about the plain-string case here, anything else (arrays,
// nested objects) is treated the same as "not provided".
type QueryValue = string | string[] | undefined | unknown;

function parsePositiveInt(value: QueryValue): number | null {
  if (typeof value !== "string") return null;
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function parsePagination(query: {
  page?: QueryValue;
  limit?: QueryValue;
  offset?: QueryValue;
}): PaginationParams {
  // limit: default 20, capped at 100 so nobody can ask for the entire table in one go.
  const parsedLimit = parsePositiveInt(query.limit);
  const limit = parsedLimit ? Math.min(parsedLimit, MAX_LIMIT) : DEFAULT_LIMIT;

  // page: default 1 (1-indexed, like most APIs users expect).
  const page = parsePositiveInt(query.page) ?? 1;

  // offset defaults to what "page" implies, but an explicit ?offset= always wins
  //, this satisfies both "give me page 3" and "give me results 47 onward" callers.
  const offsetFromPage = (page - 1) * limit;
  let offset = offsetFromPage;
  if (typeof query.offset === "string") {
    const n = parseInt(query.offset, 10);
    if (Number.isFinite(n) && n >= 0) {
      offset = n;
    }
  }

  return { limit, offset, page };
}
