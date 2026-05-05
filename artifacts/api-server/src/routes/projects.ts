import { Router } from "express";
import { db, projectsTable, useCasesTable, testCasesTable, testStepsTable, executionsTable, attachmentsTable } from "@workspace/db";
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

  const useCasesWithDetail = await Promise.all(
    useCases.map(async (uc) => {
      const testCases = await db.query.testCasesTable.findMany({
        where: eq(testCasesTable.useCaseId, uc.id),
        orderBy: testCasesTable.caseNumber,
      });

      const testCasesWithDetail = await Promise.all(
        testCases.map(async (tc) => {
          const [steps, executions] = await Promise.all([
            db.query.testStepsTable.findMany({
              where: eq(testStepsTable.testCaseId, tc.id),
              orderBy: testStepsTable.stepNumber,
            }),
            db.query.executionsTable.findMany({
              where: eq(executionsTable.testCaseId, tc.id),
              orderBy: desc(executionsTable.iterationNumber),
            }),
          ]);

          const stepsWithAttachments = await Promise.all(
            steps.map(async (step) => {
              const attachments = await db.query.attachmentsTable.findMany({
                where: eq(attachmentsTable.entityId, step.id),
              });
              return {
                ...step,
                attachments: attachments.filter((a) => a.entityType === "step"),
              };
            })
          );

          const execsWithAttachments = await Promise.all(
            executions.map(async (exec) => {
              const attachments = await db.query.attachmentsTable.findMany({
                where: eq(attachmentsTable.entityId, exec.id),
              });
              return {
                ...exec,
                executedAt: exec.executedAt.toISOString(),
                attachments: attachments.filter((a) => a.entityType === "execution"),
              };
            })
          );

          return {
            ...tc,
            createdAt: tc.createdAt.toISOString(),
            steps: stepsWithAttachments.map((s) => ({
              ...s,
              createdAt: s.createdAt.toISOString(),
              attachments: s.attachments.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
            })),
            executions: execsWithAttachments,
          };
        })
      );

      return {
        ...uc,
        createdAt: uc.createdAt.toISOString(),
        testCases: testCasesWithDetail,
      };
    })
  );

  return {
    ...project,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    useCases: useCasesWithDetail,
  };
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
