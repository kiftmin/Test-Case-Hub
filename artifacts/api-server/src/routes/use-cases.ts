import { Router } from "express";
import { db, useCasesTable, testCasesTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { CreateUseCaseBody } from "@workspace/api-zod";
import { authenticate, authorize } from "../middlewares/auth";

const router = Router();

router.get("/projects/:projectId/use-cases", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) return res.status(400).json({ error: "Invalid project ID" });

    const useCases = await db.query.useCasesTable.findMany({
      where: eq(useCasesTable.projectId, projectId),
      orderBy: useCasesTable.id,
    });

    res.json(useCases.map((uc) => ({ ...uc, createdAt: uc.createdAt.toISOString() })));
  } catch (err) {
    req.log.error({ err }, "Failed to list use cases");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/projects/:projectId/use-cases", authenticate, authorize(['ADMIN', 'AUTHOR']), async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId as string);
    if (isNaN(projectId)) return res.status(400).json({ error: "Invalid project ID" });

    const body = CreateUseCaseBody.parse(req.body);

    const existing = await db.query.useCasesTable.findMany({
      where: eq(useCasesTable.projectId, projectId),
    });
    const ucNumber = existing.length + 1;
    const code = `UC${ucNumber}`;

    const [uc] = await db
      .insert(useCasesTable)
      .values({ projectId, code, name: body.name })
      .returning();

    res.status(201).json({ ...uc, createdAt: uc.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to create use case");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/use-cases/:useCaseId", authenticate, authorize(['ADMIN', 'AUTHOR']), async (req, res) => {
  try {
    const useCaseId = parseInt(req.params.useCaseId as string);
    if (isNaN(useCaseId)) return res.status(400).json({ error: "Invalid use case ID" });

    const body = CreateUseCaseBody.parse(req.body);

    const updateQuery = db
      .update(useCasesTable)
      .set({ name: body.name })
      .where(eq(useCasesTable.id, useCaseId))
      .returning();

    req.log.info({ sql: updateQuery.toSQL(), useCaseId }, "Executing use case update");
    const [updated] = await updateQuery;

    if (!updated) {
      req.log.warn({ useCaseId }, "Use case not found for update");
      return res.status(404).json({ error: "Use case not found" });
    }

    res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err, useCaseId: req.params.useCaseId }, "Failed to update use case");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/use-cases/:useCaseId", authenticate, authorize(['ADMIN', 'AUTHOR']), async (req, res) => {
  try {
    const useCaseId = parseInt(req.params.useCaseId as string);
    if (isNaN(useCaseId)) return res.status(400).json({ error: "Invalid use case ID" });

    await db.delete(useCasesTable).where(eq(useCasesTable.id, useCaseId));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete use case");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
