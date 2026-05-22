import { Router } from "express";
import { db, bugsTable, defectsTable, statusAuditLogTable, projectsTable, projectAssignmentsTable, testRunsTable, usersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { authenticate, checkProjectRole } from "../middlewares/auth";

const router = Router();

const AssignBugBody = z.object({
  developerId: z.number(),
  supportTicketNumber: z.string().optional(),
});

const UpdateBugStatusBody = z.object({
  status: z.enum(["OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "TEST", "FAILED_TO_RESOLVE", "CLOSED", "REOPENED"]),
  reason: z.string().optional(),
});

const UpdateBugNotesBody = z.object({
  notes: z.string().min(1),
});

const ReassignBugBody = z.object({
  developerId: z.number(),
});

async function logBugStatusChange(
  bugId: number,
  changedByUserId: number,
  fromStatus: string,
  toStatus: string,
  reason?: string,
) {
  await db.insert(statusAuditLogTable).values({
    entityType: "bug",
    entityId: bugId,
    changedByUserId,
    fromStatus,
    toStatus,
    reason: reason ?? null,
  });
}

router.get("/projects/:projectId/bugs", authenticate, async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId as string);
    if (isNaN(projectId)) return res.status(400).json({ error: "Invalid project ID" });

    if (req.user!.role !== "ADMIN") {
      const assignment = await db.query.projectAssignmentsTable.findFirst({
        where: and(
          eq(projectAssignmentsTable.projectId, projectId),
          eq(projectAssignmentsTable.userId, req.user!.userId),
        ),
      });
      if (!assignment || !["TEST_LEAD", "TEST_AUTHOR", "BUSINESS_OWNER"].includes(assignment.role)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
    }

    const { status, developerId, ticketNumber } = req.query as Record<string, string | undefined>;

    let bugs = await db.query.bugsTable.findMany({
      where: eq(bugsTable.projectId, projectId),
      with: {
        defect: true,
        assignedDeveloper: { columns: { id: true, name: true, username: true } },
      },
      orderBy: desc(bugsTable.createdAt),
    });

    if (status) bugs = bugs.filter((b: any) => b.status === status);
    if (developerId) bugs = bugs.filter((b: any) => b.assignedDeveloperId === parseInt(developerId));
    if (ticketNumber) bugs = bugs.filter((b: any) => b.supportTicketNumber === ticketNumber);

    res.json(bugs.map(b => ({
      ...b,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
      openedAt: b.openedAt.toISOString(),
      assignedAt: b.assignedAt?.toISOString() ?? null,
      resolvedAt: b.resolvedAt?.toISOString() ?? null,
      testAt: b.testAt?.toISOString() ?? null,
      failedToResolveAt: b.failedToResolveAt?.toISOString() ?? null,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to list bugs");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/bugs/:bugId", authenticate, async (req, res) => {
  try {
    const bugId = parseInt(req.params.bugId as string);
    if (isNaN(bugId)) return res.status(400).json({ error: "Invalid bug ID" });

    const bug = await db.query.bugsTable.findFirst({
      where: eq(bugsTable.id, bugId),
      with: {
        defect: {
          with: {
            testCase: true,
            execution: true,
          },
        },
        assignedDeveloper: { columns: { id: true, name: true, username: true } },
      },
    });

    if (!bug) return res.status(404).json({ error: "Bug not found" });

    if (req.user!.role !== "ADMIN") {
      const assignment = await db.query.projectAssignmentsTable.findFirst({
        where: and(
          eq(projectAssignmentsTable.projectId, bug.projectId),
          eq(projectAssignmentsTable.userId, req.user!.userId),
        ),
      });
      if (!assignment || !["TEST_LEAD", "TEST_AUTHOR", "BUSINESS_OWNER"].includes(assignment.role)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
    }

    const auditLogs = await db.query.statusAuditLogTable.findMany({
      where: and(
        eq(statusAuditLogTable.entityType, "bug"),
        eq(statusAuditLogTable.entityId, bugId),
      ),
      orderBy: desc(statusAuditLogTable.changedAt),
    });

    res.json({
      ...bug,
      createdAt: bug.createdAt.toISOString(),
      updatedAt: bug.updatedAt.toISOString(),
      openedAt: bug.openedAt.toISOString(),
      assignedAt: bug.assignedAt?.toISOString() ?? null,
      resolvedAt: bug.resolvedAt?.toISOString() ?? null,
      testAt: bug.testAt?.toISOString() ?? null,
      failedToResolveAt: bug.failedToResolveAt?.toISOString() ?? null,
      auditLogs: auditLogs.map(l => ({
        ...l,
        changedAt: l.changedAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get bug");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/bugs/:bugId/assign", authenticate, async (req, res) => {
  try {
    const bugId = parseInt(req.params.bugId as string);
    if (isNaN(bugId)) return res.status(400).json({ error: "Invalid bug ID" });

    const body = AssignBugBody.parse(req.body);

    const bug = await db.query.bugsTable.findFirst({
      where: eq(bugsTable.id, bugId),
    });
    if (!bug) return res.status(404).json({ error: "Bug not found" });

    const allowed = await checkProjectRole(req, bug.projectId, ["TEST_LEAD"]);
    if (!allowed) return res.status(403).json({ error: "Insufficient permissions" });

    const oldStatus = bug.status;
    await db.update(bugsTable)
      .set({
        assignedDeveloperId: body.developerId,
        supportTicketNumber: body.supportTicketNumber ?? bug.supportTicketNumber,
        status: "ASSIGNED",
        assignedAt: new Date(),
      })
      .where(eq(bugsTable.id, bugId));

    await logBugStatusChange(bugId, req.user!.userId, oldStatus, "ASSIGNED");

    const updated = await db.query.bugsTable.findFirst({ where: eq(bugsTable.id, bugId) });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to assign bug");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/bugs/:bugId/status", authenticate, async (req, res) => {
  try {
    const bugId = parseInt(req.params.bugId as string);
    if (isNaN(bugId)) return res.status(400).json({ error: "Invalid bug ID" });

    const body = UpdateBugStatusBody.parse(req.body);

    const bug = await db.query.bugsTable.findFirst({
      where: eq(bugsTable.id, bugId),
    });
    if (!bug) return res.status(404).json({ error: "Bug not found" });

    const isAdmin = req.user!.role === "ADMIN";
    const isAssignedDev = bug.assignedDeveloperId === req.user!.userId;

    if (!isAdmin) {
      const assignment = await db.query.projectAssignmentsTable.findFirst({
        where: and(
          eq(projectAssignmentsTable.projectId, bug.projectId),
          eq(projectAssignmentsTable.userId, req.user!.userId),
        ),
      });
      const isTestLead = assignment?.role === "TEST_LEAD" || assignment?.role === "TEST_AUTHOR";
      if (!isTestLead && !isAssignedDev) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      if (isAssignedDev && !isAdmin && !isTestLead) {
        if (body.status !== "RESOLVED" && body.status !== "FAILED_TO_RESOLVE") {
          return res.status(403).json({ error: "Developers can only set RESOLVED or FAILED_TO_RESOLVE" });
        }
      }
    }

    const oldStatus = bug.status;
    const now = new Date();
    const updateData: Record<string, unknown> = { status: body.status };

    if (body.status === "RESOLVED") updateData.resolvedAt = now;
    if (body.status === "FAILED_TO_RESOLVE") {
      updateData.failedToResolveAt = now;
      updateData.failedToResolveReason = body.reason ?? null;
    }
    if (body.status === "IN_PROGRESS") {
      updateData.status = "IN_PROGRESS";
    }

    await db.update(bugsTable)
      .set(updateData)
      .where(eq(bugsTable.id, bugId));

    await logBugStatusChange(bugId, req.user!.userId, oldStatus, body.status, body.reason);

    const updated = await db.query.bugsTable.findFirst({ where: eq(bugsTable.id, bugId) });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update bug status");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/bugs/:bugId/notes", authenticate, async (req, res) => {
  try {
    const bugId = parseInt(req.params.bugId as string);
    if (isNaN(bugId)) return res.status(400).json({ error: "Invalid bug ID" });

    const body = UpdateBugNotesBody.parse(req.body);

    const bug = await db.query.bugsTable.findFirst({
      where: eq(bugsTable.id, bugId),
    });
    if (!bug) return res.status(404).json({ error: "Bug not found" });

    const isAdmin = req.user!.role === "ADMIN";
    const isAssignedDev = bug.assignedDeveloperId === req.user!.userId;

    if (!isAdmin && !isAssignedDev) {
      const assignment = await db.query.projectAssignmentsTable.findFirst({
        where: and(
          eq(projectAssignmentsTable.projectId, bug.projectId),
          eq(projectAssignmentsTable.userId, req.user!.userId),
        ),
      });
      if (!assignment || !["TEST_LEAD", "TEST_AUTHOR"].includes(assignment.role)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
    }

    await db.update(bugsTable)
      .set({ developerNotes: body.notes })
      .where(eq(bugsTable.id, bugId));

    const updated = await db.query.bugsTable.findFirst({ where: eq(bugsTable.id, bugId) });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update bug notes");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/bugs/:bugId/reassign", authenticate, async (req, res) => {
  try {
    const bugId = parseInt(req.params.bugId as string);
    if (isNaN(bugId)) return res.status(400).json({ error: "Invalid bug ID" });

    const body = ReassignBugBody.parse(req.body);

    const bug = await db.query.bugsTable.findFirst({
      where: eq(bugsTable.id, bugId),
    });
    if (!bug) return res.status(404).json({ error: "Bug not found" });

    const allowed = await checkProjectRole(req, bug.projectId, ["TEST_LEAD"]);
    if (!allowed) return res.status(403).json({ error: "Insufficient permissions" });
    if (bug.status !== "FAILED_TO_RESOLVE") {
      return res.status(400).json({ error: "Can only reassign bugs with FAILED_TO_RESOLVE status" });
    }

    const oldStatus = bug.status;
    await db.update(bugsTable)
      .set({
        assignedDeveloperId: body.developerId,
        status: "ASSIGNED",
        assignedAt: new Date(),
      })
      .where(eq(bugsTable.id, bugId));

    await logBugStatusChange(bugId, req.user!.userId, oldStatus, "ASSIGNED", "Reassigned after failed to resolve");

    const updated = await db.query.bugsTable.findFirst({ where: eq(bugsTable.id, bugId) });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to reassign bug");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
