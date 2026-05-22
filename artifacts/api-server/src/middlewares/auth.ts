import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db, usersTable, projectAssignmentsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export const JWT_SECRET =
  process.env.SESSION_SECRET ||
  (process.env.NODE_ENV === "production"
    ? (() => {
        throw new Error("SESSION_SECRET must be set in production");
      })()
    : "dev-only-fallback-secret");

export interface AuthUser {
  userId: number;
  username: string;
  role: "ADMIN" | "AUTHOR" | "USER";
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

interface JwtPayload {
  userId: number;
  username: string;
  role: AuthUser["role"];
}

export function extractBearerOrQueryToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }
  const q = req.query?.access_token;
  if (typeof q === "string" && q.length > 0) {
    return q;
  }
  return null;
}

/** Verify JWT and load current user from DB (active account, fresh role). */
export async function verifyTokenPayload(token: string): Promise<AuthUser> {
  const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, payload.userId),
  });

  if (!user) {
    throw new Error("User not found");
  }
  if (!user.isActive) {
    throw new Error("Account suspended");
  }

  return {
    userId: user.id,
    username: user.username,
    role: user.role as AuthUser["role"],
  };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (PUBLIC_PATHS.includes(req.path)) {
    return next();
  }

  const token = extractBearerOrQueryToken(req);
  if (!token) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  try {
    req.user = await verifyTokenPayload(token);
    return next();
  } catch {
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

    return next();
  };
};

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

    const assignment = await db.query.projectAssignmentsTable.findFirst({
      where: and(
        eq(projectAssignmentsTable.projectId, projectId),
        eq(projectAssignmentsTable.userId, req.user.userId),
      ),
    });

    if (!assignment || !allowedProjectRoles.includes(assignment.role)) {
      return res.status(403).json({ error: "Insufficient permissions for this project" });
    }

    return next();
  };
};

export async function checkProjectRole(
  req: AuthRequest,
  projectId: number,
  allowedProjectRoles: string[],
): Promise<boolean> {
  if (!req.user) return false;
  if (req.user.role === "ADMIN") return true;

  const assignment = await db.query.projectAssignmentsTable.findFirst({
    where: and(
      eq(projectAssignmentsTable.projectId, projectId),
      eq(projectAssignmentsTable.userId, req.user.userId),
    ),
  });

  return !!assignment && allowedProjectRoles.includes(assignment.role);
}
