import { Router } from "express";
import { db, defectsTable, defectNotesTable, bugsTable, statusAuditLogTable, testRunsTable, projectsTable, usersTable, projectAssignmentsTable, testCasesTable, testRunUseCasesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { authenticate, checkProjectRole } from "../middlewares/auth";

const router = Router();

const FlagRetestBody = z.object({
  reason: z.string().min(1),
});

const BusinessAcceptBody = z.object({
  note: z.string().min(1),
});

const BusinessRejectBody = z.object({
  reason: z.string().optional(),
});

const AddNoteBody = z.object({
  note: z.string().min(1),
  discussionId: z.number().optional(),
});

async function logStatusChange(
  entityType: string,
  entityId: number,
  changedByUserId: number,
  fromStatus: string,
  toStatus: string,
  reason?: string,
) {
  await db.insert(statusAuditLogTable).values({
    entityType,
    entityId,
    changedByUserId,
    fromStatus,
    toStatus,
    reason: reason ?? null,
  });
}

function canAccessDefect(projectRole: string | undefined): boolean {
  if (!projectRole) return false;
  return ["TEST_LEAD", "TEST_AUTHOR", "BUSINESS_OWNER"].includes(projectRole);
}

router.get("/test-runs/:testRunId/defects", authenticate, async (req, res) => {
  try {
    const testRunId = parseInt(req.params.testRunId as string);
    if (isNaN(testRunId)) return res.status(400).json({ error: "Invalid test run ID" });

    if (req.user!.role !== "ADMIN") {
      const run = await db.query.testRunsTable.findFirst({
        where: eq(testRunsTable.id, testRunId),
      });
      if (!run) return res.status(404).json({ error: "Test run not found" });
      const assignment = await db.query.projectAssignmentsTable.findFirst({
        where: and(
          eq(projectAssignmentsTable.projectId, run.projectId),
          eq(projectAssignmentsTable.userId, req.user!.userId),
        ),
      });
      if (!canAccessDefect(assignment?.role)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
    }

    const defects = await db.query.defectsTable.findMany({
      where: eq(defectsTable.testRunId, testRunId),
      with: {
        testCase: true,
        execution: true,
        notes: true,
      },
      orderBy: desc(defectsTable.createdAt),
    });

    res.json(defects.map(d => ({
      ...d,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to list defects");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/defects/:defectId", authenticate, async (req, res) => {
  try {
    const defectId = parseInt(req.params.defectId as string);
    if (isNaN(defectId)) return res.status(400).json({ error: "Invalid defect ID" });

    const defect = await db.query.defectsTable.findFirst({
      where: eq(defectsTable.id, defectId),
      with: {
        testCase: true,
        execution: true,
        notes: {
          with: {
            addedBy: { columns: { id: true, name: true, username: true } },
          },
        },
      },
    });

    if (!defect) return res.status(404).json({ error: "Defect not found" });

    const run = await db.query.testRunsTable.findFirst({
      where: eq(testRunsTable.id, defect.testRunId),
    });

    if (req.user!.role !== "ADMIN") {
      if (!run) return res.status(404).json({ error: "Test run not found" });
      const assignment = await db.query.projectAssignmentsTable.findFirst({
        where: and(
          eq(projectAssignmentsTable.projectId, run.projectId),
          eq(projectAssignmentsTable.userId, req.user!.userId),
        ),
      });
      if (!canAccessDefect(assignment?.role)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
    }

    res.json({
      ...defect,
      createdAt: defect.createdAt.toISOString(),
      updatedAt: defect.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get defect");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/defects/:defectId/flag-bug", authenticate, async (req, res) => {
  try {
    const defectId = parseInt(req.params.defectId as string);
    if (isNaN(defectId)) return res.status(400).json({ error: "Invalid defect ID" });

    const defect = await db.query.defectsTable.findFirst({
      where: eq(defectsTable.id, defectId),
    });

    if (!defect) return res.status(404).json({ error: "Defect not found" });
    if (defect.status !== "New Defect") {
      return res.status(400).json({ error: `Cannot flag bug from status "${defect.status}". Must be "New Defect".` });
    }

    const run = await db.query.testRunsTable.findFirst({
      where: eq(testRunsTable.id, defect.testRunId),
      with: { project: true },
    });
    if (!run) return res.status(404).json({ error: "Test run not found" });
    const allowed = await checkProjectRole(req, run.projectId, ["TEST_LEAD"]);
    if (!allowed) return res.status(403).json({ error: "Insufficient permissions" });

    const { nextBugNumber } = await import("../lib/sequences");
    const bugNumber = await nextBugNumber(run.projectId);

    const [bug] = await db.insert(bugsTable).values({
      projectId: run.projectId,
      defectId,
      bugNumber,
      status: "OPEN",
    }).returning();

    await db.update(defectsTable)
      .set({ status: "Submitted to Dev to Fix" })
      .where(eq(defectsTable.id, defectId));

    await logStatusChange("defect", defectId, req.user!.userId, defect.status, "Submitted to Dev to Fix");

    res.json({ defect: { ...defect, status: "Submitted to Dev to Fix" }, bug });
  } catch (err) {
    req.log.error({ err }, "Failed to flag bug");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/defects/:defectId/flag-retest", authenticate, async (req, res) => {
  try {
    const defectId = parseInt(req.params.defectId as string);
    if (isNaN(defectId)) return res.status(400).json({ error: "Invalid defect ID" });

    const body = FlagRetestBody.parse(req.body);

    const defect = await db.query.defectsTable.findFirst({
      where: eq(defectsTable.id, defectId),
    });

    if (!defect) return res.status(404).json({ error: "Defect not found" });
    if (defect.status !== "New Defect" && defect.status !== "Ready for Testing") {
      return res.status(400).json({ error: `Cannot flag retest from status "${defect.status}".` });
    }

    const run = await db.query.testRunsTable.findFirst({
      where: eq(testRunsTable.id, defect.testRunId),
    });
    if (!run) return res.status(404).json({ error: "Test run not found" });
    const allowed = await checkProjectRole(req, run.projectId, ["TEST_LEAD"]);
    if (!allowed) return res.status(403).json({ error: "Insufficient permissions" });

    const oldStatus = defect.status;
    await db.update(defectsTable)
      .set({ status: "Ready for Testing", retestReason: body.reason })
      .where(eq(defectsTable.id, defectId));

    await logStatusChange("defect", defectId, req.user!.userId, oldStatus, "Ready for Testing", body.reason);

    const updated = await db.query.defectsTable.findFirst({ where: eq(defectsTable.id, defectId) });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to flag retest");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/defects/:defectId/flag-accepted-by-business", authenticate, async (req, res) => {
  try {
    const defectId = parseInt(req.params.defectId as string);
    if (isNaN(defectId)) return res.status(400).json({ error: "Invalid defect ID" });

    const defect = await db.query.defectsTable.findFirst({
      where: eq(defectsTable.id, defectId),
    });

    if (!defect) return res.status(404).json({ error: "Defect not found" });
    if (defect.status !== "New Defect" && defect.status !== "Ready for Testing") {
      return res.status(400).json({ error: `Cannot accept from status "${defect.status}".` });
    }

    const run = await db.query.testRunsTable.findFirst({
      where: eq(testRunsTable.id, defect.testRunId),
    });
    if (!run) return res.status(404).json({ error: "Test run not found" });
    const allowed = await checkProjectRole(req, run.projectId, ["TEST_LEAD"]);
    if (!allowed) return res.status(403).json({ error: "Insufficient permissions" });

    const oldStatus = defect.status;
    await db.update(defectsTable)
      .set({ status: "Accepted by Business" })
      .where(eq(defectsTable.id, defectId));

    await logStatusChange("defect", defectId, req.user!.userId, oldStatus, "Accepted by Business");

    const updated = await db.query.defectsTable.findFirst({ where: eq(defectsTable.id, defectId) });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to flag accepted by business");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/defects/:defectId/business-accept", authenticate, async (req, res) => {
  try {
    const defectId = parseInt(req.params.defectId as string);
    if (isNaN(defectId)) return res.status(400).json({ error: "Invalid defect ID" });

    const body = BusinessAcceptBody.parse(req.body);

    const defect = await db.query.defectsTable.findFirst({
      where: eq(defectsTable.id, defectId),
    });
    if (!defect) return res.status(404).json({ error: "Defect not found" });

    const run = await db.query.testRunsTable.findFirst({
      where: eq(testRunsTable.id, defect.testRunId),
    });
    if (!run) return res.status(404).json({ error: "Test run not found" });

    const assignment = await db.query.projectAssignmentsTable.findFirst({
      where: and(
        eq(projectAssignmentsTable.projectId, run.projectId),
        eq(projectAssignmentsTable.userId, req.user!.userId),
      ),
    });
    if (req.user!.role !== "ADMIN" && assignment?.role !== "BUSINESS_OWNER") {
      return res.status(403).json({ error: "Only Business Owner can accept defects" });
    }

    if (defect.status !== "New Defect" && defect.status !== "Ready for Testing") {
      return res.status(400).json({ error: `Cannot accept from status "${defect.status}".` });
    }

    const oldStatus = defect.status;
    await db.update(defectsTable)
      .set({ status: "Accepted by Business", acceptedByBusinessNote: body.note })
      .where(eq(defectsTable.id, defectId));

    const testCase = await db.query.testCasesTable.findFirst({
      where: eq(testCasesTable.id, defect.testCaseId),
    });
    if (testCase) {
      const trUc = await db.query.testRunUseCasesTable.findFirst({
        where: and(
          eq(testRunUseCasesTable.testRunId, defect.testRunId),
          eq(testRunUseCasesTable.useCaseId, testCase.useCaseId),
        ),
      });
      if (trUc) {
        await db.update(testRunUseCasesTable)
          .set({ status: "passed_by_agreement" })
          .where(eq(testRunUseCasesTable.id, trUc.id));
      }
    }

    await logStatusChange("defect", defectId, req.user!.userId, oldStatus, "Accepted by Business", body.note);

    const updated = await db.query.defectsTable.findFirst({ where: eq(defectsTable.id, defectId) });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to business accept defect");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/defects/:defectId/business-reject", authenticate, async (req, res) => {
  try {
    const defectId = parseInt(req.params.defectId as string);
    if (isNaN(defectId)) return res.status(400).json({ error: "Invalid defect ID" });

    const body = BusinessRejectBody.parse(req.body);

    const defect = await db.query.defectsTable.findFirst({
      where: eq(defectsTable.id, defectId),
    });
    if (!defect) return res.status(404).json({ error: "Defect not found" });

    const run = await db.query.testRunsTable.findFirst({
      where: eq(testRunsTable.id, defect.testRunId),
    });
    if (!run) return res.status(404).json({ error: "Test run not found" });

    const assignment = await db.query.projectAssignmentsTable.findFirst({
      where: and(
        eq(projectAssignmentsTable.projectId, run.projectId),
        eq(projectAssignmentsTable.userId, req.user!.userId),
      ),
    });
    if (req.user!.role !== "ADMIN" && assignment?.role !== "BUSINESS_OWNER") {
      return res.status(403).json({ error: "Only Business Owner can reject defects" });
    }

    const oldStatus = defect.status;
    const rejectionEntry = JSON.stringify({
      rejectedBy: req.user!.userId,
      reason: body.reason ?? null,
      rejectedAt: new Date().toISOString(),
    });

    const existingLog = defect.rejectionLog ? JSON.parse(defect.rejectionLog) : [];
    existingLog.push(rejectionEntry);

    await db.update(defectsTable)
      .set({ status: "Ready for Testing", rejectionLog: JSON.stringify(existingLog) })
      .where(eq(defectsTable.id, defectId));

    await logStatusChange("defect", defectId, req.user!.userId, oldStatus, "Ready for Testing", body.reason);

    const updated = await db.query.defectsTable.findFirst({ where: eq(defectsTable.id, defectId) });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to business reject defect");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/defects/:defectId/notes", authenticate, async (req, res) => {
  try {
    const defectId = parseInt(req.params.defectId as string);
    if (isNaN(defectId)) return res.status(400).json({ error: "Invalid defect ID" });

    const body = AddNoteBody.parse(req.body);

    const defect = await db.query.defectsTable.findFirst({
      where: eq(defectsTable.id, defectId),
    });
    if (!defect) return res.status(404).json({ error: "Defect not found" });

    const run = await db.query.testRunsTable.findFirst({
      where: eq(testRunsTable.id, defect.testRunId),
    });

    if (req.user!.role !== "ADMIN") {
      if (!run) return res.status(404).json({ error: "Test run not found" });
      const assignment = await db.query.projectAssignmentsTable.findFirst({
        where: and(
          eq(projectAssignmentsTable.projectId, run.projectId),
          eq(projectAssignmentsTable.userId, req.user!.userId),
        ),
      });
      if (!canAccessDefect(assignment?.role)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
    }

    const [note] = await db.insert(defectNotesTable).values({
      defectId,
      discussionId: body.discussionId ?? null,
      addedByUserId: req.user!.userId,
      note: body.note,
    }).returning();

    res.status(201).json({
      ...note,
      createdAt: note.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to add defect note");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
