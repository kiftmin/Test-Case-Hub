import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { LoginBody } from "@workspace/api-zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { authenticate, authorize } from "../middlewares/auth";

const router = Router();
const JWT_SECRET = process.env.SESSION_SECRET || "fallback_secret";

const RegisterBody = z.object({
  username: z.string().min(1),
  password: z.string().min(6),
  name: z.string().min(1),
  email: z.string().email().optional().nullable(),
  role: z.enum(["ADMIN", "USER"]).default("USER"),
});

router.post("/login", async (req, res) => {
  try {
    const body = LoginBody.parse(req.body);
    
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.username, body.username),
    });
    
    if (!user) {
      return res.status(401).json({ error: "Invalid username or password" });
    }
    
    const isValid = await bcrypt.compare(body.password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid username or password" });
    }
    
    if (!user.isActive) {
      return res.status(403).json({ error: "Account has been suspended. Contact your administrator." });
    }
    
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: "24h" }
    );
    
    const { passwordHash: _, ...userResult } = user;
    
    res.json({
      token,
      user: {
        ...userResult,
        createdAt: user.createdAt.toISOString()
      }
    });
  } catch (err) {
    req.log.error({ err }, "Login failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/register", authenticate, authorize(["ADMIN"]), async (req, res) => {
  try {
    const body = RegisterBody.parse(req.body);

    const existing = await db.query.usersTable.findFirst({
      where: eq(usersTable.username, body.username),
    });
    if (existing) {
      return res.status(409).json({ error: "Username already exists" });
    }

    const passwordHash = await bcrypt.hash(body.password, 10);

    const [user] = await db
      .insert(usersTable)
      .values({
        username: body.username,
        passwordHash,
        name: body.name,
        email: body.email ?? null,
        role: body.role,
      })
      .returning();

    const { passwordHash: _, ...result } = user;

    res.status(201).json({
      ...result,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Registration failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
