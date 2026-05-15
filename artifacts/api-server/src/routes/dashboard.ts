import { Router } from "express";
import { db, projectsTable, testCasesTable, executionsTable, useCasesTable, testStepsTable, stepResultsTable } from "@workspace/db";
import { eq, desc, count, and, isNotNull, gte } from "drizzle-orm";

const router = Router();

router.get("/dashboard/summary", async (req, res) => {
  try {
    const [projectCount, testCaseCount, execCount] = await Promise.all([
      db.select({ count: count() }).from(projectsTable),
      db.select({ count: count() }).from(testCasesTable),
      db.select({ count: count() }).from(executionsTable),
    ]);

    // Use a more efficient pass rate query
    const execStats = await db
      .select({
        total: count(),
        passed: count(eq(executionsTable.status, "completed"))
      })
      .from(executionsTable);

    const passed = Number(execStats[0]?.passed ?? 0);
    const total = Number(execStats[0]?.total ?? 0);
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [recentProjects] = await db
      .select({ count: count() })
      .from(projectsTable)
      .where(gte(projectsTable.createdAt, thirtyDaysAgo));

    res.json({
      totalProjects: Number(projectCount[0]?.count ?? 0),
      totalTestCases: Number(testCaseCount[0]?.count ?? 0),
      totalExecutions: total,
      passRate,
      recentProjectsCount: Number(recentProjects?.count ?? 0),
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

router.get("/dashboard/recent-activity", async (req, res) => {
  try {
    const recentExecs = await db.query.executionsTable.findMany({
      orderBy: desc(executionsTable.executedAt),
      limit: 20,
    });

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
