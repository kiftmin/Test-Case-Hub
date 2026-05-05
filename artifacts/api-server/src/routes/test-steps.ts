import { Router } from "express";
import { db, testStepsTable, attachmentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateTestStepBody, BulkCreateTestStepsBody } from "@workspace/api-zod";

const router = Router();

async function stepsWithAttachments(steps: typeof testStepsTable.$inferSelect[]) {
  return Promise.all(
    steps.map(async (step) => {
      const attachments = await db.query.attachmentsTable.findMany({
        where: eq(attachmentsTable.entityId, step.id),
      });
      return {
        ...step,
        createdAt: step.createdAt.toISOString(),
        attachments: attachments
          .filter((a) => a.entityType === "step")
          .map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
      };
    })
  );
}

router.get("/test-cases/:testCaseId/steps", async (req, res) => {
  try {
    const testCaseId = parseInt(req.params.testCaseId);
    if (isNaN(testCaseId)) return res.status(400).json({ error: "Invalid test case ID" });

    const steps = await db.query.testStepsTable.findMany({
      where: eq(testStepsTable.testCaseId, testCaseId),
      orderBy: testStepsTable.stepNumber,
    });

    res.json(await stepsWithAttachments(steps));
  } catch (err) {
    req.log.error({ err }, "Failed to list test steps");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/test-cases/:testCaseId/steps", async (req, res) => {
  try {
    const testCaseId = parseInt(req.params.testCaseId);
    if (isNaN(testCaseId)) return res.status(400).json({ error: "Invalid test case ID" });

    const body = CreateTestStepBody.parse(req.body);

    const existing = await db.query.testStepsTable.findMany({
      where: eq(testStepsTable.testCaseId, testCaseId),
    });
    const stepNumber = existing.length + 1;

    const [step] = await db
      .insert(testStepsTable)
      .values({
        testCaseId,
        stepNumber,
        instruction: body.instruction,
        testData: body.testData ?? null,
        expectedResult: body.expectedResult,
      })
      .returning();

    res.status(201).json({
      ...step,
      createdAt: step.createdAt.toISOString(),
      attachments: [],
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create test step");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/test-cases/:testCaseId/steps/bulk", async (req, res) => {
  try {
    const testCaseId = parseInt(req.params.testCaseId);
    if (isNaN(testCaseId)) return res.status(400).json({ error: "Invalid test case ID" });

    const body = BulkCreateTestStepsBody.parse(req.body);

    const existing = await db.query.testStepsTable.findMany({
      where: eq(testStepsTable.testCaseId, testCaseId),
    });
    let nextStepNumber = existing.length + 1;

    const rows = body.steps.map((s) => ({
      testCaseId,
      stepNumber: nextStepNumber++,
      instruction: s.instruction,
      testData: s.testData ?? null,
      expectedResult: s.expectedResult,
    }));

    const steps = await db.insert(testStepsTable).values(rows).returning();

    res.status(201).json(
      steps.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
        attachments: [],
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to bulk create test steps");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/steps/:stepId", async (req, res) => {
  try {
    const stepId = parseInt(req.params.stepId);
    if (isNaN(stepId)) return res.status(400).json({ error: "Invalid step ID" });

    const body = CreateTestStepBody.parse(req.body);

    const [updated] = await db
      .update(testStepsTable)
      .set({
        instruction: body.instruction,
        testData: body.testData ?? null,
        expectedResult: body.expectedResult,
      })
      .where(eq(testStepsTable.id, stepId))
      .returning();

    if (!updated) return res.status(404).json({ error: "Step not found" });

    const attachments = await db.query.attachmentsTable.findMany({
      where: eq(attachmentsTable.entityId, stepId),
    });

    res.json({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      attachments: attachments
        .filter((a) => a.entityType === "step")
        .map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update test step");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/steps/:stepId", async (req, res) => {
  try {
    const stepId = parseInt(req.params.stepId);
    if (isNaN(stepId)) return res.status(400).json({ error: "Invalid step ID" });

    await db.delete(testStepsTable).where(eq(testStepsTable.id, stepId));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete test step");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
