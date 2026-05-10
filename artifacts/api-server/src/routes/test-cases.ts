import { Router } from "express";
import { db, testCasesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateTestCaseBody } from "@workspace/api-zod";

const router = Router();

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

router.post("/use-cases/:useCaseId/test-cases", async (req, res) => {
  try {
    const useCaseId = parseInt(req.params.useCaseId);
    if (isNaN(useCaseId)) return res.status(400).json({ error: "Invalid use case ID" });

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

router.put("/test-cases/:testCaseId", async (req, res) => {
  try {
    const testCaseId = parseInt(req.params.testCaseId);
    if (isNaN(testCaseId)) return res.status(400).json({ error: "Invalid test case ID" });

    const body = CreateTestCaseBody.parse(req.body);

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

router.delete("/test-cases/:testCaseId", async (req, res) => {
  try {
    const testCaseId = parseInt(req.params.testCaseId);
    if (isNaN(testCaseId)) return res.status(400).json({ error: "Invalid test case ID" });

    await db.delete(testCasesTable).where(eq(testCasesTable.id, testCaseId));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete test case");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
