import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || "fallback_secret";

export interface AuthUser {
  userId: number;
  username: string;
  role: 'ADMIN' | 'AUTHOR' | 'TESTER';
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  // Allow login and health check routes
  if (req.path === "/auth/login" || req.path === "/health") {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthUser;
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

export const authorize = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    next();
  };
};
