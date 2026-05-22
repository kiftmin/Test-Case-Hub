import { Router } from "express";
import { db, testStepsTable, testCasesTable, useCasesTable, attachmentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateTestStepBody, BulkCreateTestStepsBody } from "@workspace/api-zod";
import { authenticate, checkProjectRole } from "../middlewares/auth";

const router = Router();

async function getProjectIdFromStep(stepId: number): Promise<number | null> {
  const step = await db.query.testStepsTable.findFirst({
    where: eq(testStepsTable.id, stepId),
    with: { testCase: { with: { useCase: true } } },
  });
  return step?.testCase?.useCase?.projectId ?? null;
}

async function getProjectIdFromTestCase(testCaseId: number): Promise<number | null> {
  const tc = await db.query.testCasesTable.findFirst({
    where: eq(testCasesTable.id, testCaseId),
    with: { useCase: true },
  });
  return tc?.useCase?.projectId ?? null;
}

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
          .filter((a) => a.entityType === "test_step")
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

router.post("/test-cases/:testCaseId/steps", authenticate, async (req, res) => {
  try {
    const testCaseId = parseInt(req.params.testCaseId as string);
    if (isNaN(testCaseId)) return res.status(400).json({ error: "Invalid test case ID" });

    const projectId = await getProjectIdFromTestCase(testCaseId);
    if (!projectId) return res.status(404).json({ error: "Test case not found" });
    const allowed = await checkProjectRole(req, projectId, ["TEST_LEAD", "TEST_AUTHOR"]);
    if (!allowed) return res.status(403).json({ error: "Insufficient permissions" });

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

router.post("/test-cases/:testCaseId/steps/bulk", authenticate, async (req, res) => {
  try {
    const testCaseId = parseInt(req.params.testCaseId as string);
    if (isNaN(testCaseId)) return res.status(400).json({ error: "Invalid test case ID" });

    const projectId = await getProjectIdFromTestCase(testCaseId);
    if (!projectId) return res.status(404).json({ error: "Test case not found" });
    const allowed = await checkProjectRole(req, projectId, ["TEST_LEAD", "TEST_AUTHOR"]);
    if (!allowed) return res.status(403).json({ error: "Insufficient permissions" });

    const body = BulkCreateTestStepsBody.parse(req.body);

    const existing = await db.query.testStepsTable.findMany({
      where: eq(testStepsTable.testCaseId, testCaseId),
    });
    let nextStepNumber = existing.length + 1;

    const rows = body.steps.map((s: any) => ({
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

router.put("/steps/:stepId", authenticate, async (req, res) => {
  try {
    const stepId = parseInt(req.params.stepId as string);
    if (isNaN(stepId)) return res.status(400).json({ error: "Invalid step ID" });
    
    req.log.info({ stepId }, "Updating test step");

    const body = CreateTestStepBody.parse(req.body);

    const projectId = await getProjectIdFromStep(stepId);
    if (!projectId) return res.status(404).json({ error: "Step not found" });
    const allowed = await checkProjectRole(req, projectId, ["TEST_LEAD", "TEST_AUTHOR"]);
    if (!allowed) return res.status(403).json({ error: "Insufficient permissions" });

    const updateQuery = db
      .update(testStepsTable)
      .set({
        instruction: body.instruction,
        testData: body.testData ?? null,
        expectedResult: body.expectedResult,
      })
      .where(eq(testStepsTable.id, stepId))
      .returning();

    req.log.info({ sql: updateQuery.toSQL() }, "Executing step update SQL");
    const [updated] = await updateQuery;

    if (!updated) {
      const exists = await db.query.testStepsTable.findFirst({
        where: eq(testStepsTable.id, stepId),
      });
      
      if (!exists) {
        req.log.warn({ stepId }, "Step genuinely not found in DB");
        return res.status(404).json({ error: "Step not found" });
      } else {
        req.log.error({ stepId, exists }, "Step exists but update returned empty array. Potential schema mismatch or trigger issue.");
        return res.status(500).json({ error: "Failed to update step despite it existing" });
      }
    }

    const attachments = await db.query.attachmentsTable.findMany({
      where: eq(attachmentsTable.entityId, stepId),
    });

    res.json({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      attachments: attachments
        .filter((a) => a.entityType === "test_step")
        .map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
    });
  } catch (err) {
    req.log.error({ err, stepId: req.params.stepId }, "Failed to update test step");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/steps/:stepId", authenticate, async (req, res) => {
  try {
    const stepId = parseInt(req.params.stepId as string);
    if (isNaN(stepId)) return res.status(400).json({ error: "Invalid step ID" });

    const projectId = await getProjectIdFromStep(stepId);
    if (!projectId) return res.status(404).json({ error: "Step not found" });
    const allowed = await checkProjectRole(req, projectId, ["TEST_LEAD", "TEST_AUTHOR"]);
    if (!allowed) return res.status(403).json({ error: "Insufficient permissions" });

    const deleteQuery = db.delete(testStepsTable).where(eq(testStepsTable.id, stepId));
    req.log.info({ sql: deleteQuery.toSQL(), stepId }, "Deleting test step");
    await deleteQuery;
    
    res.status(204).send();
  } catch (err) {
    req.log.error({ err, stepId: req.params.stepId }, "Failed to delete test step");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;