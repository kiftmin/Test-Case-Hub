import { Router } from "express";
import { db, projectsTable, useCasesTable, testCasesTable, testStepsTable, executionsTable, attachmentsTable, stepResultsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { CreateProjectBody } from "@workspace/api-zod";
import { nanoid } from "nanoid";

const router = Router();

function generateProjectCode(): string {
  return "PRJ-" + nanoid(6).toUpperCase();
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

async function buildProjectDetail(projectId: number) {
  const project = await db.query.projectsTable.findFirst({
    where: eq(projectsTable.id, projectId),
  });
  if (!project) return null;

  const useCases = await db.query.useCasesTable.findMany({
    where: eq(useCasesTable.projectId, projectId),
    orderBy: useCasesTable.id,
  });

  const ucIds = useCases.map(u => u.id);
  const testCases = ucIds.length > 0 ? await db.query.testCasesTable.findMany({
    where: (tc, { inArray }) => inArray(tc.useCaseId, ucIds),
    orderBy: testCasesTable.caseNumber,
  }) : [];

  const tcIds = testCases.map(t => t.id);

  const [steps, executions] = await Promise.all([
    tcIds.length > 0 ? db.query.testStepsTable.findMany({
      where: (ts, { inArray }) => inArray(ts.testCaseId, tcIds),
      orderBy: testStepsTable.stepNumber,
    }) : Promise.resolve([] as any[]),
    tcIds.length > 0 ? db.query.executionsTable.findMany({
      where: (e, { inArray }) => inArray(e.testCaseId, tcIds),
      orderBy: desc(executionsTable.iterationNumber),
    }) : Promise.resolve([] as any[]),
  ]);

  const stepIds = steps.map(s => s.id);
  const execIds = executions.map(e => e.id);

  const [stepAttachments, stepResults] = await Promise.all([
    stepIds.length > 0 ? db.query.attachmentsTable.findMany({
      where: (a, { and, eq, inArray }) => and(
        eq(a.entityType, "test_step"),
        inArray(a.entityId, stepIds)
      ),
    }) : Promise.resolve([] as any[]),
    execIds.length > 0 ? db.query.stepResultsTable.findMany({
      where: (sr, { inArray }) => inArray(sr.executionId, execIds),
    }) : Promise.resolve([] as any[]),
  ]);

  const srIds = stepResults.map(sr => sr.id);
  const stepResultAttachments = srIds.length > 0 ? await db.query.attachmentsTable.findMany({
    where: (a, { and, eq, inArray }) => and(
      eq(a.entityType, "step_result"),
      inArray(a.entityId, srIds)
    ),
  }) : [] as any[];

  // Manual assembly
  const result = {
    ...project,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    useCases: useCases.map(uc => {
      const ucTestCases = testCases.filter(tc => tc.useCaseId === uc.id);
      return {
        ...uc,
        createdAt: uc.createdAt.toISOString(),
        testCases: ucTestCases.map(tc => {
          const tcSteps = steps.filter(s => s.testCaseId === tc.id);
          const tcExecs = executions.filter(e => e.testCaseId === tc.id);
          return {
            ...tc,
            createdAt: tc.createdAt.toISOString(),
            steps: tcSteps.map(s => ({
              ...s,
              createdAt: s.createdAt.toISOString(),
              attachments: stepAttachments
                .filter(a => a.entityId === s.id)
                .map(a => ({ ...a, createdAt: a.createdAt.toISOString() }))
            })),
            executions: tcExecs.map(ex => {
              const exResults = stepResults.filter(sr => sr.executionId === ex.id);
              return {
                ...ex,
                executedAt: ex.executedAt.toISOString(),
                stepResults: exResults.map(sr => ({
                  ...sr,
                  recordedAt: sr.recordedAt.toISOString(),
                  attachments: stepResultAttachments
                    .filter(a => a.entityId === sr.id)
                    .map(a => ({ ...a, createdAt: a.createdAt.toISOString() }))
                }))
              };
            })
          };
        })
      };
    })
  };

  return result;
}

router.get("/projects", async (req, res) => {
  try {
    const projects = await db.query.projectsTable.findMany({
      orderBy: desc(projectsTable.updatedAt),
    });
    res.json(
      projects.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to list projects");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/projects", async (req, res) => {
  try {
    const body = CreateProjectBody.parse(req.body);
    const projectCode = generateProjectCode();
    const today = todayStr();

    const [project] = await db
      .insert(projectsTable)
      .values({
        projectCode,
        name: body.name,
        designedBy: body.designedBy,
        moduleName: body.moduleName,
        designDate: body.designDate,
        testLink: body.testLink ?? null,
        version: 1,
        versionDate: today,
      })
      .returning();

    res.status(201).json({
      ...project,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create project");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/projects/code/:projectCode", async (req, res) => {
  try {
    const project = await db.query.projectsTable.findFirst({
      where: eq(projectsTable.projectCode, req.params.projectCode),
    });
    if (!project) return res.status(404).json({ error: "Project not found" });

    const detail = await buildProjectDetail(project.id);
    if (!detail) return res.status(404).json({ error: "Project not found" });

    res.json(detail);
  } catch (err) {
    req.log.error({ err }, "Failed to get project by code");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/projects/:projectId", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) return res.status(400).json({ error: "Invalid project ID" });

    const detail = await buildProjectDetail(projectId);
    if (!detail) return res.status(404).json({ error: "Project not found" });

    res.json(detail);
  } catch (err) {
    req.log.error({ err }, "Failed to get project");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/projects/:projectId", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) return res.status(400).json({ error: "Invalid project ID" });

    const body = CreateProjectBody.parse(req.body);

    const existing = await db.query.projectsTable.findFirst({
      where: eq(projectsTable.id, projectId),
    });
    if (!existing) return res.status(404).json({ error: "Project not found" });

    const [updated] = await db
      .update(projectsTable)
      .set({
        name: body.name,
        designedBy: body.designedBy,
        moduleName: body.moduleName,
        designDate: body.designDate,
        testLink: body.testLink ?? null,
        version: existing.version + 1,
        versionDate: todayStr(),
      })
      .where(eq(projectsTable.id, projectId))
      .returning();

    res.json({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update project");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/projects/:projectId", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) return res.status(400).json({ error: "Invalid project ID" });

    await db.delete(projectsTable).where(eq(projectsTable.id, projectId));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete project");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
