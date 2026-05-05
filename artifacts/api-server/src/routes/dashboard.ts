import { Router } from "express";
import { db, projectsTable, testCasesTable, executionsTable, useCasesTable, testStepsTable } from "@workspace/db";
import { eq, desc, count, and, isNotNull } from "drizzle-orm";

const router = Router();

router.get("/dashboard/summary", async (req, res) => {
  try {
    const [projectCount, testCaseCount, execCount] = await Promise.all([
      db.select({ count: count() }).from(projectsTable),
      db.select({ count: count() }).from(testCasesTable),
      db.select({ count: count() }).from(executionsTable),
    ]);

    const allExecs = await db.query.executionsTable.findMany({
      where: isNotNull(executionsTable.passed),
    });

    const passed = allExecs.filter((e) => e.passed === true).length;
    const passRate = allExecs.length > 0 ? Math.round((passed / allExecs.length) * 100) : 0;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentProjects = await db.query.projectsTable.findMany({
      orderBy: desc(projectsTable.createdAt),
    });
    const recentProjectsCount = recentProjects.filter(
      (p) => p.createdAt >= thirtyDaysAgo
    ).length;

    res.json({
      totalProjects: projectCount[0]?.count ?? 0,
      totalTestCases: testCaseCount[0]?.count ?? 0,
      totalExecutions: execCount[0]?.count ?? 0,
      passRate,
      recentProjectsCount,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get dashboard summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/projects/:projectId/stats", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) return res.status(400).json({ error: "Invalid project ID" });

    const project = await db.query.projectsTable.findFirst({
      where: eq(projectsTable.id, projectId),
    });
    if (!project) return res.status(404).json({ error: "Project not found" });

    const useCases = await db.query.useCasesTable.findMany({
      where: eq(useCasesTable.projectId, projectId),
    });

    let totalTestCases = 0;
    let totalExecutions = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    let totalPending = 0;

    const useCaseBreakdown = await Promise.all(
      useCases.map(async (uc) => {
        const testCases = await db.query.testCasesTable.findMany({
          where: eq(testCasesTable.useCaseId, uc.id),
        });

        totalTestCases += testCases.length;

        let ucPassed = 0;
        let ucFailed = 0;
        let ucPending = 0;

        for (const tc of testCases) {
          const executions = await db.query.executionsTable.findMany({
            where: eq(executionsTable.testCaseId, tc.id),
            orderBy: desc(executionsTable.iterationNumber),
          });

          totalExecutions += executions.length;

          if (executions.length === 0) {
            ucPending++;
            totalPending++;
          } else {
            const latest = executions[0];
            if (latest.passed === true) {
              ucPassed++;
              totalPassed++;
            } else if (latest.passed === false) {
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
      })
    );

    const passRate =
      totalTestCases > 0 ? Math.round((totalPassed / totalTestCases) * 100) : 0;

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

router.get("/dashboard/recent-activity", async (req, res) => {
  try {
    const recentExecs = await db.query.executionsTable.findMany({
      orderBy: desc(executionsTable.executedAt),
      limit: 20,
    });

    const result = await Promise.all(
      recentExecs.map(async (exec) => {
        const testCase = await db.query.testCasesTable.findFirst({
          where: eq(testCasesTable.id, exec.testCaseId),
        });

        let projectName = "Unknown";
        if (testCase) {
          const useCase = await db.query.useCasesTable.findFirst({
            where: eq(useCasesTable.id, testCase.useCaseId),
          });
          if (useCase) {
            const project = await db.query.projectsTable.findFirst({
              where: eq(projectsTable.id, useCase.projectId),
            });
            if (project) projectName = project.name;
          }
        }

        return {
          executionId: exec.id,
          testCaseName: testCase?.title ?? "Unknown",
          projectName,
          testerName: exec.testerName,
          passed: exec.passed,
          executedAt: exec.executedAt.toISOString(),
        };
      })
    );

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get recent activity");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
