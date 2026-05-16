import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { LoginBody } from "@workspace/api-zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || "fallback_secret";

router.post("/auth/login", async (req, res) => {
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

export default router;
