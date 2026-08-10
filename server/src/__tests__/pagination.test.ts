// Tests for utils/pagination.ts, the pure helper that turns page/limit/offset query
// params into a safe, bounded { limit, offset, page } triple. No database needed.
import { describe, it, expect } from "vitest";
import { parsePagination, DEFAULT_LIMIT, MAX_LIMIT } from "../utils/pagination";

describe("parsePagination", () => {
  it("defaults to page 1, limit 20, offset 0 when nothing is provided", () => {
    expect(parsePagination({})).toEqual({ limit: DEFAULT_LIMIT, offset: 0, page: 1 });
  });

  it("computes offset from page and limit", () => {
    expect(parsePagination({ page: "3", limit: "10" })).toEqual({
      limit: 10,
      offset: 20, // (page 3 - 1) * 10
      page: 3,
    });
  });

  it("caps limit at MAX_LIMIT even if a huge value is requested", () => {
    const result = parsePagination({ limit: "999999" });
    expect(result.limit).toBe(MAX_LIMIT);
  });

  it("falls back to defaults for non-numeric or zero/negative limit", () => {
    expect(parsePagination({ limit: "abc" }).limit).toBe(DEFAULT_LIMIT);
    expect(parsePagination({ limit: "0" }).limit).toBe(DEFAULT_LIMIT);
    expect(parsePagination({ limit: "-5" }).limit).toBe(DEFAULT_LIMIT);
  });

  it("falls back to page 1 for non-numeric or zero/negative page", () => {
    expect(parsePagination({ page: "abc" }).page).toBe(1);
    expect(parsePagination({ page: "0" }).page).toBe(1);
    expect(parsePagination({ page: "-2" }).page).toBe(1);
  });

  it("lets an explicit offset override the page-derived offset", () => {
    const result = parsePagination({ page: "2", limit: "10", offset: "47" });
    expect(result.offset).toBe(47);
    // page/limit are still reported as given, only the derived offset is overridden.
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
  });

  it("accepts an explicit offset of 0", () => {
    expect(parsePagination({ offset: "0" }).offset).toBe(0);
  });

  it("ignores a negative or non-numeric explicit offset and falls back to page math", () => {
    expect(parsePagination({ page: "1", limit: "10", offset: "-1" }).offset).toBe(0);
    expect(parsePagination({ page: "1", limit: "10", offset: "abc" }).offset).toBe(0);
  });

  it("ignores non-string values (e.g. arrays from repeated query params)", () => {
    expect(parsePagination({ limit: ["10", "20"] as unknown as string })).toEqual({
      limit: DEFAULT_LIMIT,
      offset: 0,
      page: 1,
    });
  });
});
