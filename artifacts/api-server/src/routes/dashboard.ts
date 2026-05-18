import { Router } from "express";
import { db, projectsTable, testCasesTable, executionsTable, useCasesTable, testStepsTable, stepResultsTable, projectAssignmentsTable, usersTable } from "@workspace/db";
import { eq, desc, count, and, isNotNull, gte, inArray } from "drizzle-orm";
import { authenticate } from "../middlewares/auth";

const router = Router();

router.get("/dashboard/summary", authenticate, async (req, res) => {
  try {
    let projectIds: number[] | null = null;

    if (req.user?.role !== "ADMIN") {
      const assignments = await db.query.projectAssignmentsTable.findMany({
        where: eq(projectAssignmentsTable.userId, req.user!.userId),
      });
      projectIds = assignments.map(a => a.projectId);
      if (projectIds.length === 0) {
        return res.json({
          totalProjects: 0,
          totalTestCases: 0,
          totalExecutions: 0,
          passRate: 0,
          recentProjectsCount: 0,
        });
      }
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const queries: any[] = [];

    if (projectIds) {
      // Projects count
      queries.push(db.select({ count: count() }).from(projectsTable).where(inArray(projectsTable.id, projectIds)));

      // Test cases count - need to join with useCases
      queries.push(
        db.select({ count: count() })
          .from(testCasesTable)
          .innerJoin(useCasesTable, eq(testCasesTable.useCaseId, useCasesTable.id))
          .where(inArray(useCasesTable.projectId, projectIds))
      );

      // Executions stats
      queries.push(
        db.select({
          total: count(),
          passed: count(eq(executionsTable.status, "completed"))
        })
        .from(executionsTable)
        .innerJoin(testCasesTable, eq(executionsTable.testCaseId, testCasesTable.id))
        .innerJoin(useCasesTable, eq(testCasesTable.useCaseId, useCasesTable.id))
        .where(inArray(useCasesTable.projectId, projectIds))
      );

      // Recent projects
      queries.push(
        db.select({ count: count() })
          .from(projectsTable)
          .where(and(
            inArray(projectsTable.id, projectIds),
            gte(projectsTable.createdAt, thirtyDaysAgo)
          ))
      );
    } else {
      queries.push(db.select({ count: count() }).from(projectsTable));
      queries.push(db.select({ count: count() }).from(testCasesTable));
      queries.push(
        db.select({
          total: count(),
          passed: count(eq(executionsTable.status, "completed"))
        })
        .from(executionsTable)
      );
      queries.push(
        db.select({ count: count() })
          .from(projectsTable)
          .where(gte(projectsTable.createdAt, thirtyDaysAgo))
      );
    }

    const [pCount, tcCount, execStats, recentProjects] = await Promise.all(queries);

    const passed = Number(execStats[0]?.passed ?? 0);
    const total = Number(execStats[0]?.total ?? 0);
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

    res.json({
      totalProjects: Number(pCount[0]?.count ?? 0),
      totalTestCases: Number(tcCount[0]?.count ?? 0),
      totalExecutions: total,
      passRate,
      recentProjectsCount: Number(recentProjects[0]?.count ?? 0),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get dashboard summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/projects/:projectId/stats", authenticate, async (req, res) => {
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

    const project = await db.query.projectsTable.findFirst({
      where: eq(projectsTable.id, projectId),
    });
    if (!project) return res.status(404).json({ error: "Project not found" });

    const useCases = await db.query.useCasesTable.findMany({
      where: eq(useCasesTable.projectId, projectId),
    });

    const ucIds = useCases.map(u => u.id);
    const testCases = ucIds.length > 0 ? await db.query.testCasesTable.findMany({
      where: (tc, { inArray }) => inArray(tc.useCaseId, ucIds),
    }) : [];

    const tcIds = testCases.map(t => t.id);
    const executions = tcIds.length > 0 ? await db.query.executionsTable.findMany({
      where: (e, { inArray }) => inArray(e.testCaseId, tcIds),
      orderBy: desc(executionsTable.iterationNumber),
    }) : [];

    let totalTestCases = 0;
    let totalExecutions = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    let totalPending = 0;

    const useCaseBreakdown = useCases.map((uc) => {
      const ucTestCases = testCases.filter(tc => tc.useCaseId === uc.id);
      let ucPassed = 0;
      let ucFailed = 0;
      let ucPending = 0;

      totalTestCases += ucTestCases.length;

      for (const tc of ucTestCases) {
        const tcExecs = executions.filter(e => e.testCaseId === tc.id);
        totalExecutions += tcExecs.length;

        if (tcExecs.length === 0) {
          ucPending++;
          totalPending++;
        } else {
          const latest = tcExecs[0];
          if (latest.status === "completed") {
            ucPassed++;
            totalPassed++;
          } else if (latest.status === "failed") {
            ucFailed++;
            totalFailed++;
          } else {
            ucPending++;
            totalPending++;
          }
        }
      }

      return {
        useCaseId: uc.id,
        useCaseName: `${uc.code}: ${uc.name}`,
        passed: ucPassed,
        failed: ucFailed,
        pending: ucPending,
      };
    });

    const passRate = totalTestCases > 0 ? Math.round((totalPassed / totalTestCases) * 100) : 0;

    res.json({
      projectId: project.id,
      projectName: project.name,
      totalTestCases,
      totalExecutions,
      passed: totalPassed,
      failed: totalFailed,
      pending: totalPending,
      passRate,
      useCaseBreakdown,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get project stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/recent-activity", authenticate, async (req, res) => {
  try {
    let recentExecs: any[];
    if (req.user?.role === "ADMIN") {
      recentExecs = await db.query.executionsTable.findMany({
        orderBy: desc(executionsTable.executedAt),
        limit: 20,
      });
    } else if (req.user?.role === "TESTER") {
      // Tester sees only their own executions
      const user = await db.query.usersTable.findFirst({
        where: eq(usersTable.id, req.user!.userId),
      });
      if (!user) return res.json([]);

      recentExecs = await db.query.executionsTable.findMany({
        where: eq(executionsTable.testerName, user.name),
        orderBy: desc(executionsTable.executedAt),
        limit: 20,
      });
    } else {
      // AUTHOR: View executions for projects they are assigned to
      const assignments = await db.query.projectAssignmentsTable.findMany({
        where: eq(projectAssignmentsTable.userId, req.user!.userId),
      });
      const projectIds = assignments.map(a => a.projectId);

      if (projectIds.length === 0) {
        recentExecs = [];
      } else {
        recentExecs = await db.select({
          execution: executionsTable
        })
        .from(executionsTable)
        .innerJoin(testCasesTable, eq(executionsTable.testCaseId, testCasesTable.id))
        .innerJoin(useCasesTable, eq(testCasesTable.useCaseId, useCasesTable.id))
        .where(inArray(useCasesTable.projectId, projectIds))
        .orderBy(desc(executionsTable.executedAt))
        .limit(20);

        recentExecs = recentExecs.map(r => r.execution);
      }
    }

    if (recentExecs.length === 0) {
      return res.json([]);
    }

    // Batch-fetch related test cases
    const tcIds = [...new Set(recentExecs.map(e => e.testCaseId))];
    const testCaseRows = await db.query.testCasesTable.findMany({
      where: (tc, { inArray }) => inArray(tc.id, tcIds),
    });

    // Batch-fetch related use cases
    const ucIds = [...new Set(testCaseRows.map(tc => tc.useCaseId))];
    const useCaseRows = ucIds.length > 0 ? await db.query.useCasesTable.findMany({
      where: (uc, { inArray }) => inArray(uc.id, ucIds),
    }) : [];

    // Batch-fetch related projects
    const pIds = [...new Set(useCaseRows.map(uc => uc.projectId))];
    const projectRows = pIds.length > 0 ? await db.query.projectsTable.findMany({
      where: (p, { inArray }) => inArray(p.id, pIds),
    }) : [];

    const result = recentExecs.map((exec) => {
      const tc = testCaseRows.find(t => t.id === exec.testCaseId);
      const uc = tc ? useCaseRows.find(u => u.id === tc.useCaseId) : undefined;
      const proj = uc ? projectRows.find(p => p.id === uc.projectId) : undefined;

      return {
        executionId: exec.id,
        testCaseName: tc?.title ?? "Unknown",
        projectName: proj?.name ?? "Unknown",
        testerName: exec.testerName,
        passed: exec.status === "completed",
        executedAt: exec.executedAt.toISOString(),
      };
    });

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get recent activity");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
