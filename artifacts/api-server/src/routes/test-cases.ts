import { Router } from "express";
import { db, testCasesTable, useCasesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateTestCaseBody } from "@workspace/api-zod";
import { authenticate, checkProjectRole } from "../middlewares/auth";

const router = Router();

async function getProjectIdFromTestCase(testCaseId: number): Promise<number | null> {
  const tc = await db.query.testCasesTable.findFirst({
    where: eq(testCasesTable.id, testCaseId),
    with: { useCase: true },
  });
  return tc?.useCase?.projectId ?? null;
}

async function getProjectIdFromUseCase(useCaseId: number): Promise<number | null> {
  const uc = await db.query.useCasesTable.findFirst({
    where: eq(useCasesTable.id, useCaseId),
  });
  return uc?.projectId ?? null;
}

router.get("/use-cases/:useCaseId/test-cases", async (req, res) => {
  try {
    const useCaseId = parseInt(req.params.useCaseId);
    if (isNaN(useCaseId)) return res.status(400).json({ error: "Invalid use case ID" });

    const testCases = await db.query.testCasesTable.findMany({
      where: eq(testCasesTable.useCaseId, useCaseId),
      orderBy: testCasesTable.caseNumber,
    });

    res.json(testCases.map((tc) => ({ ...tc, createdAt: tc.createdAt.toISOString() })));
  } catch (err) {
    req.log.error({ err }, "Failed to list test cases");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/use-cases/:useCaseId/test-cases", authenticate, async (req, res) => {
  try {
    const useCaseId = parseInt(req.params.useCaseId as string);
    if (isNaN(useCaseId)) return res.status(400).json({ error: "Invalid use case ID" });

    const projectId = await getProjectIdFromUseCase(useCaseId);
    if (!projectId) return res.status(404).json({ error: "Use case not found" });
    const allowed = await checkProjectRole(req, projectId, ["TEST_LEAD", "TEST_AUTHOR"]);
    if (!allowed) return res.status(403).json({ error: "Insufficient permissions" });

    const body = CreateTestCaseBody.parse(req.body);

    const existing = await db.query.testCasesTable.findMany({
      where: eq(testCasesTable.useCaseId, useCaseId),
    });
    const caseNumber = existing.length + 1;

    const [tc] = await db
      .insert(testCasesTable)
      .values({ useCaseId, title: body.title, caseNumber })
      .returning();

    res.status(201).json({ ...tc, createdAt: tc.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to create test case");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/test-cases/:testCaseId", authenticate, async (req, res) => {
  try {
    const testCaseId = parseInt(req.params.testCaseId as string);
    if (isNaN(testCaseId)) return res.status(400).json({ error: "Invalid test case ID" });

    const body = CreateTestCaseBody.parse(req.body);

    const projectId = await getProjectIdFromTestCase(testCaseId);
    if (!projectId) return res.status(404).json({ error: "Test case not found" });
    const allowed = await checkProjectRole(req, projectId, ["TEST_LEAD", "TEST_AUTHOR"]);
    if (!allowed) return res.status(403).json({ error: "Insufficient permissions" });

    const updateQuery = db
      .update(testCasesTable)
      .set({ title: body.title })
      .where(eq(testCasesTable.id, testCaseId))
      .returning();

    req.log.info({ sql: updateQuery.toSQL(), testCaseId }, "Executing test case update");
    const [updated] = await updateQuery;

    if (!updated) {
      req.log.warn({ testCaseId }, "Test case not found for update");
      return res.status(404).json({ error: "Test case not found" });
    }

    res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err, testCaseId: req.params.testCaseId }, "Failed to update test case");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/test-cases/:testCaseId", authenticate, async (req, res) => {
  try {
    const testCaseId = parseInt(req.params.testCaseId as string);
    if (isNaN(testCaseId)) return res.status(400).json({ error: "Invalid test case ID" });

    const projectId = await getProjectIdFromTestCase(testCaseId);
    if (!projectId) return res.status(404).json({ error: "Test case not found" });
    const allowed = await checkProjectRole(req, projectId, ["TEST_LEAD", "TEST_AUTHOR"]);
    if (!allowed) return res.status(403).json({ error: "Insufficient permissions" });

    await db.delete(testCasesTable).where(eq(testCasesTable.id, testCaseId));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete test case");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;