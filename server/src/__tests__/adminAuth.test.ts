// Tests for middleware/adminAuth.ts, the shared-secret check guarding DELETE /api/jokes/:id.
// No database or real HTTP server needed: we build minimal fake Express req/res/next
// objects, which is enough to exercise the middleware's branching logic in isolation.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";

// config/env.ts reads process.env.ADMIN_TOKEN at import time (as `config.adminToken`),
// so we must set the env var BEFORE importing the middleware, and reset modules between
// tests that need different token configurations.
const ORIGINAL_ADMIN_TOKEN = process.env.ADMIN_TOKEN;

function makeReq(headers: Record<string, string | undefined>): Request {
  return {
    header: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;
}

function makeRes(): Response & { statusCode?: number; body?: unknown } {
  const res: Partial<Response> & { statusCode?: number; body?: unknown } = {};
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res as Response;
  }) as unknown as Response["status"];
  res.json = vi.fn((body: unknown) => {
    res.body = body;
    return res as Response;
  }) as unknown as Response["json"];
  return res as Response & { statusCode?: number; body?: unknown };
}

describe("requireAdminToken", () => {
  afterEach(() => {
    process.env.ADMIN_TOKEN = ORIGINAL_ADMIN_TOKEN;
    vi.resetModules();
  });

  it("fails closed with 503 when ADMIN_TOKEN is not configured on the server", async () => {
    delete process.env.ADMIN_TOKEN;
    vi.resetModules();
    const { requireAdminToken } = await import("../middleware/adminAuth");

    const req = makeReq({ "x-admin-token": "anything" });
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    requireAdminToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects with 401 when the header is missing", async () => {
    process.env.ADMIN_TOKEN = "secret-token";
    vi.resetModules();
    const { requireAdminToken } = await import("../middleware/adminAuth");

    const req = makeReq({});
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    requireAdminToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects with 401 when the header value doesn't match", async () => {
    process.env.ADMIN_TOKEN = "secret-token";
    vi.resetModules();
    const { requireAdminToken } = await import("../middleware/adminAuth");

    const req = makeReq({ "x-admin-token": "wrong-token" });
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    requireAdminToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() when the header matches ADMIN_TOKEN", async () => {
    process.env.ADMIN_TOKEN = "secret-token";
    vi.resetModules();
    const { requireAdminToken } = await import("../middleware/adminAuth");

    const req = makeReq({ "x-admin-token": "secret-token" });
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    requireAdminToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
