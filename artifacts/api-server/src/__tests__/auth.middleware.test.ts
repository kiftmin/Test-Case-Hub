import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";

vi.mock("@workspace/db", () => ({
  db: {
    query: {
      usersTable: { findFirst: vi.fn() },
      projectAssignmentsTable: { findFirst: vi.fn() },
    },
  },
  usersTable: {},
  projectAssignmentsTable: {},
}));

import { db } from "@workspace/db";
import { authenticate, authorize } from "../middlewares/auth";

function mockReq(overrides: Record<string, any> = {}) {
  return {
    path: "/some-protected-route",
    headers: {},
    user: undefined,
    ...overrides,
  } as any;
}

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("authenticate middleware", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("allows requests to /auth/login without a token", () => {
    const req = mockReq({ path: "/auth/login" });
    const res = mockRes();
    const next = vi.fn();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("allows requests to /health without a token", () => {
    const req = mockReq({ path: "/health" });
    const res = mockRes();
    const next = vi.fn();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("returns 401 when no authorization header is present", async () => {
    const req = mockReq({ query: {} });
    const res = mockRes();
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Missing or invalid authorization header",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when header does not start with Bearer", async () => {
    const req = mockReq({ headers: { authorization: "Basic abc123" }, query: {} });
    const res = mockRes();
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when token is invalid", async () => {
    const req = mockReq({ headers: { authorization: "Bearer invalid-token" }, query: {} });
    const res = mockRes();
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid token" });
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() and sets req.user when token is valid", async () => {
    const payload = { userId: 1, username: "admin", role: "ADMIN" };
    const token = jwt.sign(payload, process.env.SESSION_SECRET || "dev-only-fallback-secret");

    (db.query.usersTable.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1,
      username: "admin",
      role: "ADMIN",
      isActive: true,
    });

    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeDefined();
    expect(req.user.userId).toBe(1);
    expect(req.user.role).toBe("ADMIN");
  });
});

describe("authorize middleware", () => {
  it("calls next() when the user has one of the required roles", () => {
    const req = mockReq({ user: { userId: 1, username: "admin", role: "ADMIN" } });
    const res = mockRes();
    const next = vi.fn();

    const middleware = authorize(["ADMIN", "AUTHOR"]);
    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("returns 403 when the user does not have the required role", () => {
    const req = mockReq({ user: { userId: 2, username: "user1", role: "USER" } });
    const res = mockRes();
    const next = vi.fn();

    const middleware = authorize(["ADMIN"]);
    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: "Insufficient permissions",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when req.user is undefined", () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    const middleware = authorize(["ADMIN"]);
    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Authentication required",
    });
    expect(next).not.toHaveBeenCalled();
  });
});
