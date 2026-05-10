import { Router } from "express";
import { db, executionsTable, attachmentsTable, stepResultsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { CreateExecutionBody, UpdateStepResultBody } from "@workspace/api-zod";

const router = Router();

router.get("/test-cases/:testCaseId/executions", async (req, res) => {
  try {
    const testCaseId = parseInt(req.params.testCaseId);
    if (isNaN(testCaseId)) return res.status(400).json({ error: "Invalid test case ID" });

    const executions = await db.query.executionsTable.findMany({
      where: eq(executionsTable.testCaseId, testCaseId),
      orderBy: desc(executionsTable.iterationNumber),
    });

    const result = await Promise.all(
      executions.map(async (exec) => {
        const stepResults = await db.query.stepResultsTable.findMany({
          where: eq(stepResultsTable.executionId, exec.id),
        });

        const stepResultsWithAttachments = await Promise.all(
          stepResults.map(async (sr) => {
            const attachments = await db.query.attachmentsTable.findMany({
              where: eq(attachmentsTable.entityId, sr.id),
            });
            return {
              ...sr,
              recordedAt: sr.recordedAt.toISOString(),
              attachments: attachments
                .filter((a) => a.entityType === "step_result")
                .map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
            };
          })
        );

        return {
          ...exec,
          executedAt: exec.executedAt.toISOString(),
          stepResults: stepResultsWithAttachments,
        };
      })
    );

    res.json(result);
  } catch (err: any) {
    req.log.error({ 
      err: {
        message: err.message,
        stack: err.stack,
        ...err
      }
    }, "Failed to list executions");
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

router.post("/test-cases/:testCaseId/executions", async (req, res) => {
  try {
    const testCaseId = parseInt(req.params.testCaseId);
    if (isNaN(testCaseId)) return res.status(400).json({ error: "Invalid test case ID" });

    const body = CreateExecutionBody.parse(req.body);

    const existing = await db.query.executionsTable.findMany({
      where: eq(executionsTable.testCaseId, testCaseId),
    });
    const iterationNumber = existing.length + 1;

    const [exec] = await db
      .insert(executionsTable)
      .values({
        testCaseId,
        iterationNumber,
        testerName: body.testerName,
        status: body.status || 'in_progress',
      })
      .returning();

    res.status(201).json({
      ...exec,
      executedAt: exec.executedAt.toISOString(),
      stepResults: [],
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create execution");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/executions/:executionId", async (req, res) => {
  try {
    const executionId = parseInt(req.params.executionId);
    if (isNaN(executionId)) return res.status(400).json({ error: "Invalid execution ID" });

    const body = CreateExecutionBody.parse(req.body);

    const [updated] = await db
      .update(executionsTable)
      .set({
        testerName: body.testerName,
        status: body.status || 'in_progress',
      })
      .where(eq(executionsTable.id, executionId))
      .returning();

    if (!updated) return res.status(404).json({ error: "Execution not found" });

    const stepResults = await db.query.stepResultsTable.findMany({
      where: eq(stepResultsTable.executionId, executionId),
    });

    const stepResultsWithAttachments = await Promise.all(
      stepResults.map(async (sr) => {
        const attachments = await db.query.attachmentsTable.findMany({
          where: eq(attachmentsTable.entityId, sr.id),
        });
        return {
          ...sr,
          recordedAt: sr.recordedAt.toISOString(),
          attachments: attachments
            .filter((a) => a.entityType === "step_result")
            .map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
        };
      })
    );

    res.json({
      ...updated,
      executedAt: updated.executedAt.toISOString(),
      stepResults: stepResultsWithAttachments,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update execution");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/executions/:executionId/steps/:stepId/result", async (req, res) => {
  try {
    const executionId = parseInt(req.params.executionId);
    const stepId = parseInt(req.params.stepId);
    if (isNaN(executionId) || isNaN(stepId)) return res.status(400).json({ error: "Invalid execution or step ID" });

    const body = UpdateStepResultBody.parse(req.body);

    // Check if result already exists
    const existing = await db.query.stepResultsTable.findFirst({
      where: and(
        eq(stepResultsTable.executionId, executionId),
        eq(stepResultsTable.stepId, stepId)
      )
    });

    let result;
    if (existing) {
      // Update
      const [updated] = await db.update(stepResultsTable)
        .set({
          actualResult: body.actualResult ?? null,
          comments: body.comments ?? null,
          passed: body.passed ?? null,
        })
        .where(eq(stepResultsTable.id, existing.id))
        .returning();
      result = updated;
    } else {
      // Insert
      const [inserted] = await db.insert(stepResultsTable)
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
      where: eq(attachmentsTable.entityId, result.id),
    });

    res.json({
      ...result,
      recordedAt: result.recordedAt.toISOString(),
      attachments: attachments
        .filter((a) => a.entityType === "step_result")
        .map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update step result");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
