import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { CreateUserBody } from "@workspace/api-zod";
import bcrypt from "bcryptjs";

const router = Router();

router.get("/users", async (req, res) => {
  try {
    const users = await db.query.usersTable.findMany({
      orderBy: desc(usersTable.createdAt),
    });
    
    // Don't return password hashes
    const result = users.map(u => {
      const { passwordHash, ...rest } = u;
      return {
        ...rest,
        createdAt: u.createdAt.toISOString()
      };
    });
    
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to list users");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/users", async (req, res) => {
  try {
    const body = CreateUserBody.parse(req.body);
    
    const passwordHash = await bcrypt.hash(body.password, 10);
    
    const [user] = await db
      .insert(usersTable)
      .values({
        username: body.username,
        passwordHash,
        name: body.name,
        email: body.email ?? null,
        role: body.role as any,
      })
      .returning();
      
    const { passwordHash: _, ...result } = user;
    
    res.status(201).json({
      ...result,
      createdAt: user.createdAt.toISOString()
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create user");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
