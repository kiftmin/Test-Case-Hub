import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
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

  it("returns 401 when no authorization header is present", () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Missing or invalid authorization header",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when header does not start with Bearer", () => {
    const req = mockReq({ headers: { authorization: "Basic abc123" } });
    const res = mockRes();
    const next = vi.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when token is invalid", () => {
    const req = mockReq({ headers: { authorization: "Bearer invalid-token" } });
    const res = mockRes();
    const next = vi.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid token" });
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() and sets req.user when token is valid", () => {
    const payload = { userId: 1, username: "admin", role: "ADMIN" };
    const token = jwt.sign(payload, "fallback_secret");

    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = vi.fn();

    authenticate(req, res, next);

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
    const req = mockReq({ user: { userId: 2, username: "tester", role: "TESTER" } });
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
