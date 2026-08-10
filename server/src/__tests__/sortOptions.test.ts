// Tests for utils/sortOptions.ts, the pure helper that turns a "sort" query param
// into a SQL ORDER BY clause. No database needed; we're just checking the generated
// SQL fragment, plus (separately) the underlying "controversial" scoring math.
import { describe, it, expect } from "vitest";
import { getSortClause } from "../utils/sortOptions";

describe("getSortClause", () => {
  it("sorts by groan level descending when sort=groan", () => {
    expect(getSortClause("groan")).toBe("groan_level DESC");
  });

  it("sorts by created_at ascending when sort=oldest", () => {
    expect(getSortClause("oldest")).toBe("created_at ASC");
  });

  it("defaults to net score (upvotes - downvotes) descending", () => {
    expect(getSortClause(undefined)).toBe("upvotes - downvotes DESC");
    expect(getSortClause("")).toBe("upvotes - downvotes DESC");
    expect(getSortClause("nonsense")).toBe("upvotes - downvotes DESC");
  });

  it("uses a closeness-ratio expression for sort=controversial, not ABS(diff)", () => {
    const clause = getSortClause("controversial");
    expect(clause).toBe(
      "(LEAST(upvotes, downvotes)::float / GREATEST(upvotes + downvotes, 1)) DESC"
    );
    // Guard against regressing back to the old, broken formula.
    expect(clause).not.toContain("ABS(upvotes - downvotes)");
  });
});

// The SQL for "controversial" does the actual sorting, but the scoring formula itself
// (MIN(up,down) / GREATEST(up+down, 1)) is simple enough to mirror in plain JS and test
// directly. This locks in the bug-fix regression: a 50/50 split must outrank both an
// untouched joke (0/0) and a lopsided joke, which the old ABS(upvotes-downvotes) formula
// got backwards (0/0 and 50/50 scored identically under it).
function closenessScore(upvotes: number, downvotes: number): number {
  return Math.min(upvotes, downvotes) / Math.max(upvotes + downvotes, 1);
}

describe("controversial closeness scoring (mirrors the SQL formula)", () => {
  it("scores an even 50/50 split as maximally controversial (0.5)", () => {
    expect(closenessScore(50, 50)).toBe(0.5);
  });

  it("scores an untouched 0/0 joke as not controversial at all (0)", () => {
    expect(closenessScore(0, 0)).toBe(0);
  });

  it("ranks a 50/50 split as more controversial than a 0/0 joke", () => {
    expect(closenessScore(50, 50)).toBeGreaterThan(closenessScore(0, 0));
  });

  it("ranks a 50/50 split as more controversial than a lopsided 99/1 joke", () => {
    expect(closenessScore(50, 50)).toBeGreaterThan(closenessScore(99, 1));
  });

  it("does NOT tie 0/0 and 50/50 the way the old ABS(diff) formula did", () => {
    const oldFormula = (up: number, down: number) => Math.abs(up - down);
    // Under the old (buggy) formula these two cases were indistinguishable.
    expect(oldFormula(0, 0)).toBe(oldFormula(50, 50));
    // Under the fixed formula they are clearly different.
    expect(closenessScore(0, 0)).not.toBe(closenessScore(50, 50));
  });
});
