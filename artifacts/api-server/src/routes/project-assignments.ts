import { Router } from "express";
import { db, projectAssignmentsTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { AssignUserToProjectBody } from "@workspace/api-zod";
import { authenticate, authorizeProjectRole } from "../middlewares/auth";

const router = Router();

router.get("/projects/:projectId/users", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) return res.status(400).json({ error: "Invalid project ID" });

    const assignments = await db.query.projectAssignmentsTable.findMany({
      where: eq(projectAssignmentsTable.projectId, projectId),
      with: {
        user: true,
      }
    });

    res.json(assignments.map(a => {
      const user = (a as any).user;
      return {
        ...a,
        assignedAt: a.assignedAt.toISOString(),
        user: user ? {
          ...user,
          createdAt: new Date(user.createdAt).toISOString(),
          passwordHash: undefined
        } : null
      };
    }));
  } catch (err) {
    req.log.error({ err }, "Failed to list project users");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/projects/:projectId/users", authenticate, authorizeProjectRole(["TEST_LEAD"]), async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId as string);
    if (isNaN(projectId)) return res.status(400).json({ error: "Invalid project ID" });

    const body = AssignUserToProjectBody.parse(req.body);

    // Check if already assigned
    const existing = await db.query.projectAssignmentsTable.findFirst({
      where: and(
        eq(projectAssignmentsTable.projectId, projectId),
        eq(projectAssignmentsTable.userId, body.userId)
      )
    });

    if (existing) {
      return res.status(409).json({ error: "User already assigned to this project" });
    }

    const [assignment] = await db
      .insert(projectAssignmentsTable)
      .values({
        projectId,
        userId: body.userId,
        role: body.role,
      })
      .returning();

    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, body.userId)
    });

    res.status(201).json({
      ...assignment,
      assignedAt: assignment.assignedAt.toISOString(),
      user: user ? {
        ...user,
        createdAt: user.createdAt.toISOString(),
        passwordHash: undefined
      } : null
    });
  } catch (err) {
    req.log.error({ err }, "Failed to assign user to project");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/projects/:projectId/users/:userId", authenticate, authorizeProjectRole(["TEST_LEAD"]), async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId as string);
    const userId = parseInt(req.params.userId as string);
    if (isNaN(projectId) || isNaN(userId)) return res.status(400).json({ error: "Invalid IDs" });

    const targetAssignment = await db.query.projectAssignmentsTable.findFirst({
      where: and(
        eq(projectAssignmentsTable.projectId, projectId),
        eq(projectAssignmentsTable.userId, userId)
      ),
    });
    if (!targetAssignment) return res.status(404).json({ error: "Assignment not found" });

    // Prevent Test Lead from removing themselves or another Test Lead
    if (targetAssignment.role === "TEST_LEAD" && req.user!.role !== "ADMIN") {
      return res.status(403).json({ error: "Only an admin can remove a Test Lead. A project must always have a Test Lead." });
    }

    await db.delete(projectAssignmentsTable)
      .where(and(
        eq(projectAssignmentsTable.projectId, projectId),
        eq(projectAssignmentsTable.userId, userId)
      ));

    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to remove user from project");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/users/:userId/projects", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) return res.status(400).json({ error: "Invalid user ID" });

    const assignments = await db.query.projectAssignmentsTable.findMany({
      where: eq(projectAssignmentsTable.userId, userId),
      with: {
        project: true
      }
    });

    res.json(assignments.map(a => {
      const project = (a as any).project;
      return {
        ...project,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      };
    }));
  } catch (err) {
    req.log.error({ err }, "Failed to list user projects");
    res.status(500).json({ error: "Internal server error" });
  }
});


export default router;
