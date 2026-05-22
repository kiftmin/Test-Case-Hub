import { Router } from "express";
import { db, executionsTable, attachmentsTable, stepResultsTable, testRunsTable, testRunUseCasesTable, testCasesTable, defectsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { CreateExecutionBody, UpdateStepResultBody } from "@workspace/api-zod";
import { authenticate } from "../middlewares/auth";
import {
  canAccessProject,
  resolveProjectIdForTestCase,
  verifyTestRunExecutionAccess,
  verifyExecutionModifyAccess,
} from "../lib/access-control";

const router = Router();

async function formatExecution(exec: typeof executionsTable.$inferSelect) {
  const stepResults = await db.query.stepResultsTable.findMany({
    where: eq(stepResultsTable.executionId, exec.id),
  });

  const stepResultsWithAttachments = await Promise.all(
    stepResults.map(async (sr) => {
      const attachments = await db.query.attachmentsTable.findMany({
        where: and(
          eq(attachmentsTable.entityId, sr.id),
          eq(attachmentsTable.entityType, "step_result"),
        ),
      });
      return {
        ...sr,
        recordedAt: sr.recordedAt.toISOString(),
        attachments: attachments.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
      };
    }),
  );

  return {
    ...exec,
    executedAt: exec.executedAt.toISOString(),
    stepResults: stepResultsWithAttachments,
  };
}

router.get("/test-cases/:testCaseId/executions", authenticate, async (req, res) => {
  try {
    const testCaseId = parseInt(req.params.testCaseId as string);
    if (isNaN(testCaseId)) return res.status(400).json({ error: "Invalid test case ID" });

    const projectId = await resolveProjectIdForTestCase(testCaseId);
    if (projectId === null) return res.status(404).json({ error: "Test case not found" });
    if (!(await canAccessProject(req, projectId))) {
      return res.status(403).json({ error: "You are not assigned to this project" });
    }

    const executions = await db.query.executionsTable.findMany({
      where: eq(executionsTable.testCaseId, testCaseId),
      orderBy: desc(executionsTable.iterationNumber),
    });

    const result = await Promise.all(executions.map(formatExecution));
    return res.json(result);
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to list executions");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/test-cases/:testCaseId/executions", authenticate, async (req, res) => {
  try {
    const testCaseId = parseInt(req.params.testCaseId as string);
    if (isNaN(testCaseId)) return res.status(400).json({ error: "Invalid test case ID" });

    const body = CreateExecutionBody.parse(req.body);

    if (!body.testRunId) {
      return res.status(400).json({ error: "testRunId is required" });
    }

    const access = await verifyTestRunExecutionAccess(req, body.testRunId, testCaseId);
    if (!access.ok) {
      return res.status(access.status).json({
        error: access.error,
        ...(access.assignedTo ? { assignedTo: access.assignedTo } : {}),
      });
    }

    const existingExec = await db.query.executionsTable.findFirst({
      where: and(
        eq(executionsTable.testCaseId, testCaseId),
        eq(executionsTable.testRunId, body.testRunId),
      ),
    });
    if (existingExec) {
      return res.status(403).json({ error: "This test case has already been executed in this test run" });
    }

    const existing = await db.query.executionsTable.findMany({
      where: eq(executionsTable.testCaseId, testCaseId),
    });
    const iterationNumber = existing.length + 1;

    const tester = req.user!;
    const [exec] = await db
      .insert(executionsTable)
      .values({
        testCaseId,
        testRunId: body.testRunId,
        iterationNumber,
        testerName: body.testerName || tester.username,
        status: body.status || "in_progress",
      })
      .returning();

    return res.status(201).json({
      ...exec,
      executedAt: exec.executedAt.toISOString(),
      stepResults: [],
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create execution");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/executions/:executionId", authenticate, async (req, res) => {
  try {
    const executionId = parseInt(req.params.executionId as string);
    if (isNaN(executionId)) return res.status(400).json({ error: "Invalid execution ID" });

    const access = await verifyExecutionModifyAccess(req, executionId);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const body = CreateExecutionBody.parse(req.body);

    const [updated] = await db
      .update(executionsTable)
      .set({
        testerName: body.testerName ?? access.execution.testerName,
        status: body.status || "in_progress",
      })
      .where(eq(executionsTable.id, executionId))
      .returning();

    if (!updated) return res.status(404).json({ error: "Execution not found" });

    if (body.status === "failed" && updated.testRunId) {
      const existingDefect = await db.query.defectsTable.findFirst({
        where: eq(defectsTable.executionId, executionId),
      });
      if (!existingDefect) {
        const stepResultsForNotes = await db.query.stepResultsTable.findMany({
          where: eq(stepResultsTable.executionId, executionId),
        });
        const stepComments = stepResultsForNotes
          .filter((sr) => sr.comments)
          .map((sr) => `Step: ${sr.comments}`)
          .join("\n");
        await db.insert(defectsTable).values({
          testRunId: updated.testRunId,
          testCaseId: updated.testCaseId,
          executionId,
          testerNotes: [updated.notes, stepComments].filter(Boolean).join("\n\n"),
          status: "New Defect",
        });
      }
    }

    return res.json(await formatExecution(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update execution");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/executions/:executionId/steps/:stepId/result", authenticate, async (req, res) => {
  try {
    const executionId = parseInt(req.params.executionId as string);
    const stepId = parseInt(req.params.stepId as string);
    if (isNaN(executionId) || isNaN(stepId)) {
      return res.status(400).json({ error: "Invalid execution or step ID" });
    }

    const access = await verifyExecutionModifyAccess(req, executionId);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const body = UpdateStepResultBody.parse(req.body);

    const existing = await db.query.stepResultsTable.findFirst({
      where: and(
        eq(stepResultsTable.executionId, executionId),
        eq(stepResultsTable.stepId, stepId),
      ),
    });

    let result;
    if (existing) {
      const [updated] = await db
        .update(stepResultsTable)
        .set({
          actualResult: body.actualResult ?? null,
          comments: body.comments ?? null,
          passed: body.passed ?? null,
        })
        .where(eq(stepResultsTable.id, existing.id))
        .returning();
      result = updated;
    } else {
      const [inserted] = await db
        .insert(stepResultsTable)
        .values({
          executionId,
          stepId,
          actualResult: body.actualResult ?? null,
          comments: body.comments ?? null,
          passed: body.passed ?? null,
        })
        .returning();
      result = inserted;
    }

    const attachments = await db.query.attachmentsTable.findMany({
      where: and(
        eq(attachmentsTable.entityId, result.id),
        eq(attachmentsTable.entityType, "step_result"),
      ),
    });

    return res.json({
      ...result,
      recordedAt: result.recordedAt.toISOString(),
      attachments: attachments.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update step result");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
