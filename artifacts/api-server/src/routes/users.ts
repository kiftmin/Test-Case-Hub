import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { CreateUserBody } from "@workspace/api-zod";
import bcrypt from "bcryptjs";
import { authenticate, authorize } from "../middlewares/auth";
import { z } from "zod";

const router = Router();

const UpdateUserBody = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional().nullable(),
  role: z.enum(["ADMIN", "AUTHOR", "USER"]).optional(),
});

router.get("/users", authenticate, authorize(['ADMIN']), async (req, res) => {
  try {
    const users = await db.query.usersTable.findMany({
      orderBy: desc(usersTable.createdAt),
    });
    
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

router.post("/users", authenticate, authorize(['ADMIN']), async (req, res) => {
  try {
    const body = CreateUserBody.parse(req.body);
    
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

router.put("/users/:userId", authenticate, authorize(['ADMIN']), async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) return res.status(400).json({ error: "Invalid user ID" });

    const body = UpdateUserBody.parse(req.body);

    const existing = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, userId),
    });
    if (!existing) return res.status(404).json({ error: "User not found" });

    const [updated] = await db
      .update(usersTable)
      .set({
        ...(body.name !== undefined && { name: body.name }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.role !== undefined && { role: body.role }),
      })
      .where(eq(usersTable.id, userId))
      .returning();

    const { passwordHash: _, ...result } = updated;

    res.json({
      ...result,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update user");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/users/:userId", authenticate, authorize(['ADMIN']), async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) return res.status(400).json({ error: "Invalid user ID" });

    const existing = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, userId),
    });
    if (!existing) return res.status(404).json({ error: "User not found" });

    await db.delete(usersTable).where(eq(usersTable.id, userId));

    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete user");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
