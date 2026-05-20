import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.SESSION_SECRET || "fallback_secret";

export interface AuthUser {
  userId: number;
  username: string;
  role: 'ADMIN' | 'AUTHOR' | 'USER';
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

const PUBLIC_PATHS = ["/auth/login", "/auth/register", "/health"];

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (PUBLIC_PATHS.includes(req.path)) {
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

/**
 * Authorize a user by their project-level role.
 * ADMIN global role always bypasses the check.
 * Usage: router.put("/path", authenticate, authorizeProjectRole(["TEST_LEAD"]), handler)
 */
export const authorizeProjectRole = (allowedProjectRoles: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (req.user.role === "ADMIN") {
      return next();
    }

    const projectId = parseInt(req.params.projectId as string);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: "Invalid project ID" });
    }

    const { db, projectAssignmentsTable } = await import("@workspace/db");
    const { eq, and } = await import("drizzle-orm");

    const assignment = await db.query.projectAssignmentsTable.findFirst({
      where: and(
        eq(projectAssignmentsTable.projectId, projectId),
        eq(projectAssignmentsTable.userId, req.user.userId)
      ),
    });

    if (!assignment || !allowedProjectRoles.includes(assignment.role)) {
      return res.status(403).json({ error: "Insufficient permissions for this project" });
    }

    next();
  };
};
