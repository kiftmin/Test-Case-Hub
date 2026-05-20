import { Router } from "express";
import { db, projectsTable, useCasesTable, testCasesTable, testStepsTable, executionsTable, attachmentsTable, stepResultsTable, usersTable, projectAssignmentsTable, testRunsTable, testRunUseCasesTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { CreateProjectBody } from "@workspace/api-zod";
import { nanoid } from "nanoid";
import { z } from "zod";
import { authenticate, authorize, authorizeProjectRole } from "../middlewares/auth";

const CreateProjectBodyExtended = CreateProjectBody.extend({
  testLeadId: z.number().optional(),
});

const SignOffBody = z.object({
  role: z.enum(["TEST_LEAD", "BUSINESS_OWNER"]),
  note: z.string().optional(),
});

const router = Router();

function generateProjectCode(): string {
  return "PRJ-" + nanoid(6).toUpperCase();
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

async function buildProjectDetail(projectId: number, userRole?: string) {
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
    signOffData: userRole === "USER" ? null : project.signOffData,
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

router.get("/projects", authenticate, async (req, res) => {
  try {
    let projects: any[];
    if (req.user?.role === "ADMIN") {
      projects = await db.query.projectsTable.findMany({
        orderBy: desc(projectsTable.updatedAt),
      });
    } else {
      const userId = req.user!.userId;
      const assignments = await db.query.projectAssignmentsTable.findMany({
        where: eq(projectAssignmentsTable.userId, userId),
      });
      const projectIds = assignments.map(a => a.projectId);

      if (projectIds.length === 0) {
        projects = [];
      } else {
        projects = await db.query.projectsTable.findMany({
          where: (p, { inArray }) => inArray(p.id, projectIds),
          orderBy: desc(projectsTable.updatedAt),
        });
      }
    }

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

router.post("/projects", authenticate, authorize(['ADMIN']), async (req, res) => {
  try {
    const body = CreateProjectBodyExtended.parse(req.body);
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
        testLeadId: body.testLeadId ?? null,
        version: 1,
        versionDate: today,
      })
      .returning();

    if (body.testLeadId) {
      await db.insert(projectAssignmentsTable).values({
        projectId: project.id,
        userId: body.testLeadId,
        role: "TEST_LEAD",
      }).onConflictDoNothing();
    }

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

router.get("/projects/code/:projectCode", authenticate, async (req, res) => {
  try {
    const projectCode = req.params.projectCode as string;
    const project = await db.query.projectsTable.findFirst({
      where: eq(projectsTable.projectCode, projectCode),
    });
    if (!project) return res.status(404).json({ error: "Project not found" });

    // Check visibility
    if (req.user?.role !== "ADMIN") {
      const assignment = await db.query.projectAssignmentsTable.findFirst({
        where: and(
          eq(projectAssignmentsTable.projectId, project.id),
          eq(projectAssignmentsTable.userId, req.user!.userId)
        )
      });
      if (!assignment) return res.status(403).json({ error: "You are not assigned to this project" });
    }

    const detail = await buildProjectDetail(project.id, req.user?.role);
    if (!detail) return res.status(404).json({ error: "Project not found" });

    res.json(detail);
  } catch (err) {
    req.log.error({ err }, "Failed to get project by code");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/projects/:projectId", authenticate, async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId as string);
    if (isNaN(projectId)) return res.status(400).json({ error: "Invalid project ID" });

    // Check visibility
    if (req.user?.role !== "ADMIN") {
      const assignment = await db.query.projectAssignmentsTable.findFirst({
        where: and(
          eq(projectAssignmentsTable.projectId, projectId),
          eq(projectAssignmentsTable.userId, req.user!.userId)
        )
      });
      if (!assignment) return res.status(403).json({ error: "You are not assigned to this project" });
    }

    const detail = await buildProjectDetail(projectId, req.user?.role);
    if (!detail) return res.status(404).json({ error: "Project not found" });

    res.json(detail);
  } catch (err) {
    req.log.error({ err }, "Failed to get project");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/projects/:projectId", authenticate, authorizeProjectRole(["TEST_LEAD"]), async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId as string);
    if (isNaN(projectId)) return res.status(400).json({ error: "Invalid project ID" });

    const body = CreateProjectBodyExtended.parse(req.body);

    const existing = await db.query.projectsTable.findFirst({
      where: eq(projectsTable.id, projectId),
    });
    if (!existing) return res.status(404).json({ error: "Project not found" });

    if (body.testLeadId !== undefined && body.testLeadId !== existing.testLeadId) {
      if (existing.testLeadId) {
        await db.delete(projectAssignmentsTable).where(
          and(
            eq(projectAssignmentsTable.projectId, projectId),
            eq(projectAssignmentsTable.userId, existing.testLeadId),
            eq(projectAssignmentsTable.role, "TEST_LEAD")
          )
        );
      }
      await db.insert(projectAssignmentsTable).values({
        projectId,
        userId: body.testLeadId,
        role: "TEST_LEAD",
      }).onConflictDoNothing();
    }

    const [updated] = await db
      .update(projectsTable)
      .set({
        name: body.name,
        designedBy: body.designedBy,
        moduleName: body.moduleName,
        designDate: body.designDate,
        testLink: body.testLink ?? null,
        testLeadId: body.testLeadId ?? null,
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

router.delete("/projects/:projectId", authenticate, authorize(['ADMIN']), async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId as string);
    if (isNaN(projectId)) return res.status(400).json({ error: "Invalid project ID" });

    await db.delete(projectsTable).where(eq(projectsTable.id, projectId));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete project");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /projects/:projectId/sign-off
 * Dual-signature sign-off: both Test Lead and Business Owner must sign.
 */
router.post("/projects/:projectId/sign-off", authenticate, async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId as string);
    if (isNaN(projectId)) return res.status(400).json({ error: "Invalid project ID" });

    const body = SignOffBody.parse(req.body);

    const assignment = await db.query.projectAssignmentsTable.findFirst({
      where: and(
        eq(projectAssignmentsTable.projectId, projectId),
        eq(projectAssignmentsTable.userId, req.user!.userId)
      )
    });

    if (req.user!.role !== "ADMIN" && assignment?.role !== body.role) {
      return res.status(403).json({ error: `You are not authorized to sign as ${body.role}` });
    }

    const project = await db.query.projectsTable.findFirst({
      where: eq(projectsTable.id, projectId),
    });
    if (!project) return res.status(404).json({ error: "Project not found" });

    const existingData = project.signOffData ? JSON.parse(project.signOffData) : {};
    const now = new Date().toISOString();

    const signatureKey = body.role === "TEST_LEAD" ? "testLead" : "businessOwner";
    existingData[signatureKey] = {
      signedBy: req.user!.username,
      signedById: req.user!.userId,
      signedAt: now,
      ...(body.note ? { note: body.note } : {}),
    };

    await db.update(projectsTable)
      .set({
        signOffData: JSON.stringify(existingData),
        isSignedOff: existingData.testLead && existingData.businessOwner ? 1 : 0,
      })
      .where(eq(projectsTable.id, projectId));

    res.json({ success: true, signOffData: existingData });
  } catch (err: any) {
    req.log.error({ err }, "Failed to sign off project");
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

/**
 * GET /projects/:projectId/sign-off-status
 */
router.get("/projects/:projectId/sign-off-status", authenticate, async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId as string);
    if (isNaN(projectId)) return res.status(400).json({ error: "Invalid project ID" });

    const project = await db.query.projectsTable.findFirst({
      where: eq(projectsTable.id, projectId),
    });
    if (!project) return res.status(404).json({ error: "Project not found" });

    const signOffData = project.signOffData ? JSON.parse(project.signOffData) : {};

    res.json({
      isSignedOff: project.isSignedOff === 1,
      testLeadSigned: !!signOffData.testLead,
      businessOwnerSigned: !!signOffData.businessOwner,
      signOffData,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get sign-off status");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
