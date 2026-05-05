import { Router } from "express";
import { db, executionsTable, attachmentsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { CreateExecutionBody } from "@workspace/api-zod";

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
        const attachments = await db.query.attachmentsTable.findMany({
          where: eq(attachmentsTable.entityId, exec.id),
        });
        return {
          ...exec,
          executedAt: exec.executedAt.toISOString(),
          attachments: attachments
            .filter((a) => a.entityType === "execution")
            .map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
        };
      })
    );

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to list executions");
    res.status(500).json({ error: "Internal server error" });
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
        actualResult: body.actualResult ?? null,
        comments: body.comments ?? null,
        passed: body.passed ?? null,
      })
      .returning();

    res.status(201).json({
      ...exec,
      executedAt: exec.executedAt.toISOString(),
      attachments: [],
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
        actualResult: body.actualResult ?? null,
        comments: body.comments ?? null,
        passed: body.passed ?? null,
      })
      .where(eq(executionsTable.id, executionId))
      .returning();

    if (!updated) return res.status(404).json({ error: "Execution not found" });

    const attachments = await db.query.attachmentsTable.findMany({
      where: eq(attachmentsTable.entityId, executionId),
    });

    res.json({
      ...updated,
      executedAt: updated.executedAt.toISOString(),
      attachments: attachments
        .filter((a) => a.entityType === "execution")
        .map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update execution");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
