import { Router } from "express";
import { authenticate, authorize } from "../middlewares/auth";
import { db,
  testRunsTable,
  testRunUseCasesTable,
  useCasesTable,
  testCasesTable,
  testStepsTable,
  executionsTable,
  stepResultsTable,
  usersTable,
  projectsTable,
  attachmentsTable,
  projectAssignmentsTable,
} from "@workspace/db";
import { eq, desc, and, inArray } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// ──────────────────────────────────────────────────────────────────
// Request body schemas
// ──────────────────────────────────────────────────────────────────
const CreateTestRunBody = z.object({
  name: z.string().min(1),
  scheduledAt: z.string().datetime(), // ISO-8601 datetime
  useCaseIds: z.array(z.number()).optional(), // omit = all use cases in project
});

const UpdateTestRunBody = z.object({
  name: z.string().min(1).optional(),
  scheduledAt: z.string().datetime().optional(),
  status: z.enum(["scheduled", "in_progress", "completed"]).optional(),
});

const UpdateTestRunUseCaseBody = z.object({
  assignedTesterId: z.number().nullable().optional(),
  freePass: z.boolean().optional(),
  status: z.enum(["pending", "in_progress", "passed", "failed"]).optional(),
});

const ReRunBody = z.object({
  failedOnly: z.boolean().default(false), // true = only include failed use cases
  name: z.string().min(1),
  scheduledAt: z.string().datetime(),
});

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

/** Recalculates and persists the overall pass/fail for a completed test run. */
export async function recalculateTestRunResult(testRunId: number) {
  const ucRows = await db.query.testRunUseCasesTable.findMany({
    where: eq(testRunUseCasesTable.testRunId, testRunId),
  });

  if (ucRows.length === 0) return;

  const allExecuted = ucRows.every((uc) => uc.status === "passed" || uc.status === "failed");
  if (!allExecuted) return; // not finished yet

  // A run passes when every non-free-pass use case passed.
  const passed = ucRows
    .filter((uc) => !uc.freePass)
    .every((uc) => uc.status === "passed");

  await db
    .update(testRunsTable)
    .set({ passed, status: "completed" })
    .where(eq(testRunsTable.id, testRunId));
}

/** Formats a test run row with its use cases for API responses. */
async function buildTestRunDetail(testRunId: number) {
  const run = await db.query.testRunsTable.findFirst({
    where: eq(testRunsTable.id, testRunId),
  });
  if (!run) return null;

  const ucRows = await db.query.testRunUseCasesTable.findMany({
    where: eq(testRunUseCasesTable.testRunId, testRunId),
  });

  const ucIds = ucRows.map((r) => r.useCaseId);
  const useCases =
    ucIds.length > 0
      ? await db.query.useCasesTable.findMany({
          where: inArray(useCasesTable.id, ucIds),
        })
      : [];

  const testerIds = ucRows
    .map((r) => r.assignedTesterId)
    .filter((id): id is number => id !== null);
  const testers =
    testerIds.length > 0
      ? await db.query.usersTable.findMany({
          where: inArray(usersTable.id, testerIds),
        })
      : [];

  return {
    ...run,
    scheduledAt: run.scheduledAt.toISOString(),
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    useCases: ucRows.map((ucRow) => {
      const uc = useCases.find((u) => u.id === ucRow.useCaseId);
      const tester = testers.find((t) => t.id === ucRow.assignedTesterId);
      return {
        ...ucRow,
        createdAt: ucRow.createdAt.toISOString(),
        useCaseCode: uc?.code ?? null,
        useCaseName: uc?.name ?? null,
        assignedTesterName: tester?.name ?? null,
        assignedTesterUsername: tester?.username ?? null,
      };
    }),
  };
}

// ──────────────────────────────────────────────────────────────────
// Routes
// ──────────────────────────────────────────────────────────────────

/**
 * GET /projects/:projectId/test-runs
 * List all test runs for a project (newest first).
 */
router.get("/projects/:projectId/test-runs", authenticate, async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId as string);
    if (isNaN(projectId)) return res.status(400).json({ error: "Invalid project ID" });

    let runs: any[];
    if (req.user?.role === "ADMIN") {
      runs = await db.query.testRunsTable.findMany({
        where: eq(testRunsTable.projectId, projectId),
        orderBy: desc(testRunsTable.scheduledAt),
      });
    } else if (req.user?.role === "AUTHOR") {
      // Authors see runs for assigned projects
      const assignment = await db.query.projectAssignmentsTable.findFirst({
        where: and(
          eq(projectAssignmentsTable.projectId, projectId),
          eq(projectAssignmentsTable.userId, req.user!.userId)
        )
      });
      if (!assignment) return res.status(403).json({ error: "You are not assigned to this project" });

      runs = await db.query.testRunsTable.findMany({
        where: eq(testRunsTable.projectId, projectId),
        orderBy: desc(testRunsTable.scheduledAt),
      });
    } else {
      // Testers see only runs where they have at least one use case assignment
      const myRunAssignments = await db.query.testRunUseCasesTable.findMany({
        where: eq(testRunUseCasesTable.assignedTesterId, req.user!.userId),
      });
      const runIds = [...new Set(myRunAssignments.map(a => a.testRunId))];

      if (runIds.length === 0) {
        runs = [];
      } else {
        runs = await db.query.testRunsTable.findMany({
          where: (tr, { and, eq, inArray }) => and(
            eq(tr.projectId, projectId),
            inArray(tr.id, runIds)
          ),
          orderBy: desc(testRunsTable.scheduledAt),
        });
      }
    }

    res.json(
      runs.map((r) => ({
        ...r,
        scheduledAt: r.scheduledAt.toISOString(),
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to list test runs");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /projects/:projectId/test-runs
 * Create a new test run. Defaults to including all use cases in the project.
 */
router.post("/projects/:projectId/test-runs", authenticate, authorize(['ADMIN', 'AUTHOR']), async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId as string);
    if (isNaN(projectId)) return res.status(400).json({ error: "Invalid project ID" });

    const project = await db.query.projectsTable.findFirst({
      where: eq(projectsTable.id, projectId),
    });
    if (!project) return res.status(404).json({ error: "Project not found" });

    const body = CreateTestRunBody.parse(req.body);

    // Resolve which use cases to include
    let ucIds = body.useCaseIds;
    if (!ucIds || ucIds.length === 0) {
      const allUcs = await db.query.useCasesTable.findMany({
        where: eq(useCasesTable.projectId, projectId),
      });
      ucIds = allUcs.map((u) => u.id);
    }

    if (ucIds.length === 0) {
      return res.status(422).json({ error: "Project has no use cases to include in the test run" });
    }

    // Create the run
    const [run] = await db
      .insert(testRunsTable)
      .values({
        projectId,
        name: body.name,
        scheduledAt: new Date(body.scheduledAt),
        status: "scheduled",
      })
      .returning();

    // Attach use cases
    await db.insert(testRunUseCasesTable).values(
      ucIds.map((useCaseId) => ({
        testRunId: run.id,
        useCaseId,
        freePass: false,
        status: "pending" as const,
      }))
    );

    const detail = await buildTestRunDetail(run.id);
    res.status(201).json(detail);
  } catch (err: any) {
    req.log.error({ err }, "Failed to create test run");
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

/**
 * GET /test-runs/:testRunId
 * Get full detail of a test run including its use cases and assignments.
 */
router.get("/test-runs/:testRunId", authenticate, async (req, res) => {
  try {
    const testRunId = parseInt(req.params.testRunId as string);
    if (isNaN(testRunId)) return res.status(400).json({ error: "Invalid test run ID" });

    const run = await db.query.testRunsTable.findFirst({
      where: eq(testRunsTable.id, testRunId),
    });
    if (!run) return res.status(404).json({ error: "Test run not found" });

    // Check visibility
    if (req.user?.role !== "ADMIN") {
      if (req.user?.role === "AUTHOR") {
        const assignment = await db.query.projectAssignmentsTable.findFirst({
          where: and(
            eq(projectAssignmentsTable.projectId, run.projectId),
            eq(projectAssignmentsTable.userId, req.user!.userId)
          )
        });
        if (!assignment) return res.status(403).json({ error: "You are not assigned to this project" });
      } else {
        // Tester
        const assignment = await db.query.testRunUseCasesTable.findFirst({
          where: and(
            eq(testRunUseCasesTable.testRunId, testRunId),
            eq(testRunUseCasesTable.assignedTesterId, req.user!.userId)
          )
        });
        if (!assignment) return res.status(403).json({ error: "You are not assigned to any use case in this test run" });
      }
    }

    const detail = await buildTestRunDetail(testRunId);
    if (!detail) return res.status(404).json({ error: "Test run not found" });

    res.json(detail);
  } catch (err) {
    req.log.error({ err }, "Failed to get test run");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PATCH /test-runs/:testRunId
 * Update top-level test run fields (name, scheduledAt, status).
 */
router.patch("/test-runs/:testRunId", authenticate, authorize(['ADMIN', 'AUTHOR']), async (req, res) => {
  try {
    const testRunId = parseInt(req.params.testRunId as string);
    if (isNaN(testRunId)) return res.status(400).json({ error: "Invalid test run ID" });

    const body = UpdateTestRunBody.parse(req.body);

    const existing = await db.query.testRunsTable.findFirst({
      where: eq(testRunsTable.id, testRunId),
    });
    if (!existing) return res.status(404).json({ error: "Test run not found" });

    const updateData: Partial<typeof existing> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.scheduledAt !== undefined) (updateData as any).scheduledAt = new Date(body.scheduledAt);

    await db.update(testRunsTable).set(updateData).where(eq(testRunsTable.id, testRunId));

    const detail = await buildTestRunDetail(testRunId);
    res.json(detail);
  } catch (err: any) {
    req.log.error({ err }, "Failed to update test run");
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

/**
 * PATCH /test-runs/:testRunId/use-cases/:testRunUseCaseId
 * Update a specific use case entry in a test run:
 *   - assign/unassign a tester
 *   - toggle free pass
 *   - update execution status (pending / in_progress / passed / failed)
 */
router.patch("/test-runs/:testRunId/use-cases/:testRunUseCaseId", authenticate, async (req, res) => {
  try {
    const testRunId = parseInt(req.params.testRunId as string);
    const testRunUseCaseId = parseInt(req.params.testRunUseCaseId as string);
    if (isNaN(testRunId) || isNaN(testRunUseCaseId)) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    const existing = await db.query.testRunUseCasesTable.findFirst({
      where: and(
        eq(testRunUseCasesTable.id, testRunUseCaseId),
        eq(testRunUseCasesTable.testRunId, testRunId)
      ),
    });
    if (!existing) return res.status(404).json({ error: "Test run use case not found" });

    const body = UpdateTestRunUseCaseBody.parse(req.body);

    const updateData: Partial<typeof existing> = {};

    // Authorization check for TESTER role
    if (req.user?.role === 'TESTER') {
      if (body.freePass !== undefined || body.assignedTesterId !== undefined) {
        return res.status(403).json({ error: "Testers cannot modify assignments or free pass status" });
      }
    }

    if (body.freePass !== undefined) updateData.freePass = body.freePass;
    if (body.status !== undefined) updateData.status = body.status;
    if ("assignedTesterId" in body) updateData.assignedTesterId = body.assignedTesterId ?? null;

    await db
      .update(testRunUseCasesTable)
      .set(updateData)
      .where(eq(testRunUseCasesTable.id, testRunUseCaseId));

    // If this update finished a use case, check if the whole run is now complete
    if (body.status === "passed" || body.status === "failed") {
      await recalculateTestRunResult(testRunId);
    }

    const detail = await buildTestRunDetail(testRunId);
    res.json(detail);
  } catch (err: any) {
    req.log.error({ err }, "Failed to update test run use case");
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

/**
 * POST /test-runs/:testRunId/use-cases
 * Add a use case to an existing (non-completed) test run.
 */
router.post("/test-runs/:testRunId/use-cases", authenticate, authorize(['ADMIN', 'AUTHOR']), async (req, res) => {
  try {
    const testRunId = parseInt(req.params.testRunId as string);
    if (isNaN(testRunId)) return res.status(400).json({ error: "Invalid test run ID" });

    const body = z.object({ useCaseId: z.number() }).parse(req.body);

    const run = await db.query.testRunsTable.findFirst({
      where: eq(testRunsTable.id, testRunId),
    });
    if (!run) return res.status(404).json({ error: "Test run not found" });
    if (run.status === "completed") {
      return res.status(422).json({ error: "Cannot modify a completed test run" });
    }

    // Avoid duplicates
    const existing = await db.query.testRunUseCasesTable.findFirst({
      where: and(
        eq(testRunUseCasesTable.testRunId, testRunId),
        eq(testRunUseCasesTable.useCaseId, body.useCaseId)
      ),
    });
    if (existing) return res.status(409).json({ error: "Use case already in this test run" });

    await db.insert(testRunUseCasesTable).values({
      testRunId,
      useCaseId: body.useCaseId,
      freePass: false,
      status: "pending",
    });

    const detail = await buildTestRunDetail(testRunId);
    res.status(201).json(detail);
  } catch (err: any) {
    req.log.error({ err }, "Failed to add use case to test run");
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

/**
 * DELETE /test-runs/:testRunId/use-cases/:testRunUseCaseId
 * Remove a use case from a test run (only if pending).
 */
router.delete("/test-runs/:testRunId/use-cases/:testRunUseCaseId", authenticate, authorize(['ADMIN', 'AUTHOR']), async (req, res) => {
  try {
    const testRunId = parseInt(req.params.testRunId as string);
    const testRunUseCaseId = parseInt(req.params.testRunUseCaseId as string);
    if (isNaN(testRunId) || isNaN(testRunUseCaseId)) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    const row = await db.query.testRunUseCasesTable.findFirst({
      where: and(
        eq(testRunUseCasesTable.id, testRunUseCaseId),
        eq(testRunUseCasesTable.testRunId, testRunId)
      ),
    });
    if (!row) return res.status(404).json({ error: "Not found" });
    if (row.status !== "pending") {
      return res.status(422).json({ error: "Cannot remove a use case that has already been started" });
    }

    await db.delete(testRunUseCasesTable).where(eq(testRunUseCasesTable.id, testRunUseCaseId));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to remove use case from test run");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /test-runs/:testRunId/use-cases/:useCaseId/sync
 * Syncs the status of a test run use case based on its test case executions.
 */
router.post("/test-runs/:testRunId/use-cases/:useCaseId/sync", async (req, res) => {
  try {
    const testRunId = parseInt(req.params.testRunId);
    const useCaseId = parseInt(req.params.useCaseId);
    if (isNaN(testRunId) || isNaN(useCaseId)) return res.status(400).json({ error: "Invalid ID" });

    const runUc = await db.query.testRunUseCasesTable.findFirst({
      where: and(
        eq(testRunUseCasesTable.testRunId, testRunId),
        eq(testRunUseCasesTable.useCaseId, useCaseId)
      )
    });

    if (!runUc) return res.status(404).json({ error: "Test run use case not found" });

    // Get all test cases for this use case
    const testCases = await db.query.testCasesTable.findMany({
      where: eq(testCasesTable.useCaseId, useCaseId)
    });

    if (testCases.length === 0) return res.json(runUc);

    // Get the latest execution for each test case in this test run
    let allPassed = true;
    let anyFailed = false;
    let anyStarted = false;

    for (const tc of testCases) {
      const exec = await db.query.executionsTable.findFirst({
        where: and(
          eq(executionsTable.testCaseId, tc.id),
          eq(executionsTable.testRunId, testRunId)
        ),
        orderBy: desc(executionsTable.executedAt)
      });

      if (!exec) {
        allPassed = false;
      } else {
        anyStarted = true;
        if (exec.status === "failed") anyFailed = true;
        if (exec.status !== "completed") allPassed = false;
      }
    }

    let newStatus: "pending" | "in_progress" | "passed" | "failed" = "pending";
    if (anyFailed) newStatus = "failed";
    else if (allPassed) newStatus = "passed";
    else if (anyStarted) newStatus = "in_progress";

    if (newStatus !== runUc.status) {
      await db.update(testRunUseCasesTable)
        .set({ status: newStatus })
        .where(eq(testRunUseCasesTable.id, runUc.id));
      
      if (newStatus === "passed" || newStatus === "failed") {
        await recalculateTestRunResult(testRunId);
      }
    }

    const detail = await buildTestRunDetail(testRunId);
    res.json(detail);
  } catch (err: any) {
    req.log.error({ err }, "Failed to sync use case status");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /test-runs/:testRunId/re-run
 * Create a new test run based on a completed (failed) run.
 * By default includes all use cases; if failedOnly=true, only failed ones.
 */
router.post("/test-runs/:testRunId/re-run", authenticate, authorize(['ADMIN', 'AUTHOR']), async (req, res) => {
  try {
    const sourceTestRunId = parseInt(req.params.testRunId as string);
    if (isNaN(sourceTestRunId)) return res.status(400).json({ error: "Invalid test run ID" });

    const sourceRun = await db.query.testRunsTable.findFirst({
      where: eq(testRunsTable.id, sourceTestRunId),
    });
    if (!sourceRun) return res.status(404).json({ error: "Source test run not found" });

    const body = ReRunBody.parse(req.body);

    // Get source use cases
    const sourceUcs = await db.query.testRunUseCasesTable.findMany({
      where: eq(testRunUseCasesTable.testRunId, sourceTestRunId),
    });

    const ucsToInclude = body.failedOnly
      ? sourceUcs.filter((uc) => uc.status === "failed")
      : sourceUcs;

    if (ucsToInclude.length === 0) {
      return res.status(422).json({ error: "No use cases to include in the re-run" });
    }

    // Create the new run
    const [newRun] = await db
      .insert(testRunsTable)
      .values({
        projectId: sourceRun.projectId,
        name: body.name,
        scheduledAt: new Date(body.scheduledAt),
        status: "scheduled",
        sourceTestRunId,
      })
      .returning();

    // Copy use cases — preserve free-pass flags from source, reset status to pending
    await db.insert(testRunUseCasesTable).values(
      ucsToInclude.map((uc) => ({
        testRunId: newRun.id,
        useCaseId: uc.useCaseId,
        freePass: uc.freePass,
        status: "pending" as const,
        // Don't carry over tester assignments — admin can reassign
      }))
    );

    const detail = await buildTestRunDetail(newRun.id);
    res.status(201).json(detail);
  } catch (err: any) {
    req.log.error({ err }, "Failed to create re-run");
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

/**
 * GET /dashboard/tester/:userId/test-runs
 * Returns test runs assigned to a specific tester, with countdown info.
 */
router.get("/dashboard/tester/:userId/test-runs", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) return res.status(400).json({ error: "Invalid user ID" });

    // Find all test run use case entries assigned to this tester
    const allAssignments = await db.select().from(testRunUseCasesTable);
    const assignments = allAssignments.filter(a => a.assignedTesterId === userId);

    if (assignments.length === 0) return res.json([]);

    const runIds = [...new Set(assignments.map((a) => a.testRunId))];

    const runs = await db
      .select({
        run: testRunsTable,
        projectCode: projectsTable.projectCode,
      })
      .from(testRunsTable)
      .innerJoin(projectsTable, eq(testRunsTable.projectId, projectsTable.id))
      .where(
        and(
          inArray(testRunsTable.id, runIds),
          inArray(testRunsTable.status, ["scheduled", "in_progress"])
        )
      )
      .orderBy(testRunsTable.scheduledAt);


    const now = new Date();
    const result = runs.map(({ run, projectCode }) => {
      const scheduledAt = new Date(run.scheduledAt);
      const msUntilStart = scheduledAt.getTime() - now.getTime();
      const myUcs = assignments.filter((a) => a.testRunId === run.id);

      return {
        ...run,
        projectCode,
        scheduledAt: run.scheduledAt.toISOString(),
        createdAt: run.createdAt.toISOString(),
        updatedAt: run.updatedAt.toISOString(),
        msUntilStart: Math.max(0, msUntilStart),
        isAvailable: msUntilStart <= 0,
        myUseCaseCount: myUcs.length,
        myPendingCount: myUcs.filter((u) => u.status === "pending").length,
      };
    });

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get tester test runs");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /projects/:projectId/test-runs/analytics
 * Returns a summary of all completed test runs for a project.
 */
router.get("/projects/:projectId/test-runs/analytics", authenticate, async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId as string);
    if (isNaN(projectId)) return res.status(400).json({ error: "Invalid project ID" });

    // Check visibility
    if (req.user?.role !== "ADMIN") {
      const assignment = await db.query.projectAssignmentsTable.findFirst({
        where: and(
          eq(projectAssignmentsTable.projectId, projectId),
          eq(projectAssignmentsTable.userId, req.user!.userId)
        )
      });
      if (!assignment) return res.status(403).json({ error: "You are not assigned to this project" });
    }

    const runs = await db.query.testRunsTable.findMany({
      where: and(
        eq(testRunsTable.projectId, projectId),
        eq(testRunsTable.status, "completed")
      ),
      orderBy: desc(testRunsTable.scheduledAt),
    });

    const result = await Promise.all(
      runs.map(async (run) => {
        const ucRows = await db.query.testRunUseCasesTable.findMany({
          where: eq(testRunUseCasesTable.testRunId, run.id),
        });

        return {
          id: run.id,
          name: run.name,
          scheduledAt: run.scheduledAt.toISOString(),
          passed: run.passed,
          totalUseCases: ucRows.length,
          passedUseCases: ucRows.filter((u) => u.status === "passed").length,
          failedUseCases: ucRows.filter((u) => u.status === "failed").length,
          freePassCount: ucRows.filter((u) => u.freePass).length,
          sourceTestRunId: run.sourceTestRunId,
        };
      })
    );

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get test run analytics");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /test-runs/:testRunId/full-report
 * Returns a complete dataset for generating a detailed report.
 */
router.get("/test-runs/:testRunId/full-report", async (req, res) => {
  try {
    const testRunId = parseInt(req.params.testRunId);
    if (isNaN(testRunId)) return res.status(400).json({ error: "Invalid test run ID" });

    const runDetail = await buildTestRunDetail(testRunId);
    if (!runDetail) return res.status(404).json({ error: "Test run not found" });

    // For each use case in the run, fetch all its test cases and their latest execution in THIS run
    const detailedUseCases = await Promise.all(
      runDetail.useCases.map(async (uc) => {
        const testCases = await db.query.testCasesTable.findMany({
          where: (tc, { eq }) => eq(tc.useCaseId, uc.useCaseId),
          orderBy: (tc, { asc }) => asc(tc.caseNumber),
        });

        const tcIds = testCases.map((tc) => tc.id);

        const [allSteps, allExecutions] = await Promise.all([
          tcIds.length > 0
            ? db.query.testStepsTable.findMany({
                where: (ts, { inArray }) => inArray(ts.testCaseId, tcIds),
                orderBy: (ts, { asc }) => asc(ts.stepNumber),
              })
            : Promise.resolve([] as any[]),
          tcIds.length > 0
            ? db.query.executionsTable.findMany({
                where: (e, { and, eq, inArray }) =>
                  and(inArray(e.testCaseId, tcIds), eq(e.testRunId, testRunId)),
                orderBy: (e, { desc }) => desc(e.executedAt),
              })
            : Promise.resolve([] as any[]),
        ]);

        const stepIds = allSteps.map((s) => s.id);
        const execIds = allExecutions.map((e) => e.id);

        const [allStepAttachments, allStepResults] = await Promise.all([
          stepIds.length > 0
            ? db.query.attachmentsTable.findMany({
                where: (a, { and, eq, inArray }) =>
                  and(eq(a.entityType, "test_step"), inArray(a.entityId, stepIds)),
              })
            : Promise.resolve([] as any[]),
          execIds.length > 0
            ? db.query.stepResultsTable.findMany({
                where: (sr, { inArray }) => inArray(sr.executionId, execIds),
              })
            : Promise.resolve([] as any[]),
        ]);

        const srIds = allStepResults.map((sr) => sr.id);
        const allStepResultAttachments =
          srIds.length > 0
            ? await db.query.attachmentsTable.findMany({
                where: (a, { and, eq, inArray }) =>
                  and(eq(a.entityType, "step_result"), inArray(a.entityId, srIds)),
              })
            : [];

        const testCasesWithDetails = testCases.map((tc) => {
          // Get the latest execution for this test case
          const execution = allExecutions.find((e) => e.testCaseId === tc.id);
          const steps = allSteps.filter((s) => s.testCaseId === tc.id);

          return {
            ...tc,
            execution,
            steps: steps.map((s) => {
              const stepAttachments = allStepAttachments
                .filter((a) => a.entityId === s.id)
                .map((a) => ({ ...a, createdAt: a.createdAt.toISOString() }));

              const sr = execution ? allStepResults.find((r) => r.executionId === execution.id && r.stepId === s.id) : null;

              let result = null;
              if (sr) {
                const resultAttachments = allStepResultAttachments
                  .filter((a) => a.entityId === sr.id)
                  .map((a) => ({ ...a, createdAt: a.createdAt.toISOString() }));
                result = {
                  ...sr,
                  recordedAt: sr.recordedAt.toISOString(),
                  attachments: resultAttachments
                };
              }

              return {
                ...s,
                createdAt: s.createdAt.toISOString(),
                attachments: stepAttachments,
                result,
              };
            }),
          };
        });

        return {
          ...uc,
          testCases: testCasesWithDetails,
        };
      })
    );

    res.json({
      ...runDetail,
      useCases: detailedUseCases
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get detailed test run report");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
