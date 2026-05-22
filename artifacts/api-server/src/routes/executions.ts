import { Router } from "express";
import { db, executionsTable, attachmentsTable, stepResultsTable, testRunsTable, testRunUseCasesTable, testCasesTable, usersTable, defectsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { CreateExecutionBody, UpdateStepResultBody } from "@workspace/api-zod";
import { authenticate } from "../middlewares/auth";

const router = Router();

router.get("/test-cases/:testCaseId/executions", async (req, res) => {
  try {
    const testCaseId = parseInt(req.params.testCaseId);
    if (isNaN(testCaseId)) return res.status(400).json({ error: "Invalid test case ID" });

    const executions = await db.query.executionsTable.findMany({
      where: eq(executionsTable.testCaseId, testCaseId),
      orderBy: desc(executionsTable.iterationNumber),
    });

    const result = await Promise.all(
      executions.map(async (exec) => {
        const stepResults = await db.query.stepResultsTable.findMany({
          where: eq(stepResultsTable.executionId, exec.id),
        });

        const stepResultsWithAttachments = await Promise.all(
          stepResults.map(async (sr) => {
            const attachments = await db.query.attachmentsTable.findMany({
              where: eq(attachmentsTable.entityId, sr.id),
            });
            return {
              ...sr,
              recordedAt: sr.recordedAt.toISOString(),
              attachments: attachments
                .filter((a) => a.entityType === "step_result")
                .map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
            };
          })
        );

        return {
          ...exec,
          executedAt: exec.executedAt.toISOString(),
          stepResults: stepResultsWithAttachments,
        };
      })
    );

    res.json(result);
  } catch (err: any) {
    req.log.error({ 
      err: {
        message: err.message,
        stack: err.stack,
        ...err
      }
    }, "Failed to list executions");
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

router.post("/test-cases/:testCaseId/executions", authenticate, async (req, res) => {
  try {
    const testCaseId = parseInt(req.params.testCaseId as string);
    if (isNaN(testCaseId)) return res.status(400).json({ error: "Invalid test case ID" });

    const body = CreateExecutionBody.parse(req.body);

    // ── Schedule & Assignment Enforcement ──────────────────────────────────
    if (body.testRunId) {
      const run = await db.query.testRunsTable.findFirst({
        where: eq(testRunsTable.id, body.testRunId),
      });

      if (!run) return res.status(404).json({ error: "Test run not found" });

      // 1. Check schedule
      if (run.scheduledAt > new Date()) {
        return res.status(403).json({ 
          error: "Test run is not yet available", 
          scheduledAt: run.scheduledAt.toISOString() 
        });
      }

      // 2. Check if already completed
      if (run.status === "completed") {
        return res.status(403).json({ error: "Test run has already been completed and submitted" });
      }

      // 3. Check assignment
      const testCase = await db.query.testCasesTable.findFirst({
        where: eq(testCasesTable.id, testCaseId),
      });

      if (!testCase) return res.status(404).json({ error: "Test case not found" });

      const assignment = await db.query.testRunUseCasesTable.findFirst({
        where: and(
          eq(testRunUseCasesTable.testRunId, body.testRunId),
          eq(testRunUseCasesTable.useCaseId, testCase.useCaseId)
        ),
      });

      if (!assignment) {
        return res.status(403).json({ error: "This test case is not part of the specified test run" });
      }

      // Verify that the tester matches the assignment
      if (assignment.assignedTesterId !== null) {
        const assignedUser = await db.query.usersTable.findFirst({
          where: eq(usersTable.id, assignment.assignedTesterId),
        });

        // We compare against testerName provided in the body (from UI)
        if (assignedUser && assignedUser.name !== body.testerName) {
          return res.status(403).json({ 
            error: "You are not assigned to this use case",
            assignedTo: assignedUser.name
          });
        }
      } else {
        // If unassigned, we might want to block or allow any tester to "pick it up".
        // The requirement says "testers can only record results for use cases assigned to them".
        return res.status(403).json({ error: "No tester has been assigned to this use case yet" });
      }

      // 4. Check if this test case already has an execution in this run
      const existingExec = await db.query.executionsTable.findFirst({
        where: and(
          eq(executionsTable.testCaseId, testCaseId),
          eq(executionsTable.testRunId, body.testRunId)
        ),
      });
      if (existingExec) {
        return res.status(403).json({ error: "This test case has already been executed in this test run" });
      }
    }
    // ───────────────────────────────────────────────────────────────────────

    const existing = await db.query.executionsTable.findMany({
      where: eq(executionsTable.testCaseId, testCaseId),
    });
    const iterationNumber = existing.length + 1;

    const [exec] = await db
      .insert(executionsTable)
      .values({
        testCaseId,
        testRunId: body.testRunId ?? null,
        iterationNumber,
        testerName: body.testerName,
        status: body.status || 'in_progress',
      })
      .returning();

    res.status(201).json({
      ...exec,
      executedAt: exec.executedAt.toISOString(),
      stepResults: [],
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create execution");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/executions/:executionId", authenticate, async (req, res) => {
  try {
    const executionId = parseInt(req.params.executionId as string);
    if (isNaN(executionId)) return res.status(400).json({ error: "Invalid execution ID" });

    const body = CreateExecutionBody.parse(req.body);

    const [updated] = await db
      .update(executionsTable)
      .set({
        testerName: body.testerName,
        status: body.status || 'in_progress',
      })
      .where(eq(executionsTable.id, executionId))
      .returning();

    if (!updated) return res.status(404).json({ error: "Execution not found" });

    // Verify assignment if it's part of a test run
    if (updated.testRunId) {
      const testCase = await db.query.testCasesTable.findFirst({
        where: eq(testCasesTable.id, updated.testCaseId),
      });

      if (testCase) {
        const assignment = await db.query.testRunUseCasesTable.findFirst({
          where: and(
            eq(testRunUseCasesTable.testRunId, updated.testRunId),
            eq(testRunUseCasesTable.useCaseId, testCase.useCaseId)
          ),
        });

        if (assignment && assignment.assignedTesterId !== null) {
          const assignedUser = await db.query.usersTable.findFirst({
            where: eq(usersTable.id, assignment.assignedTesterId),
          });

          if (assignedUser && assignedUser.name !== body.testerName) {
            return res.status(403).json({ error: "You are not authorized to update this execution" });
          }
        }
      }
    }

    if (body.status === "failed" && updated.testRunId) {
      const existingDefect = await db.query.defectsTable.findFirst({
        where: eq(defectsTable.executionId, executionId),
      });
      if (!existingDefect) {
        const stepResultsForNotes = await db.query.stepResultsTable.findMany({
          where: eq(stepResultsTable.executionId, executionId),
        });
        const stepComments = stepResultsForNotes
          .filter(sr => sr.comments)
          .map(sr => `Step: ${sr.comments}`)
          .join("\n");
        await db.insert(defectsTable).values({
          testRunId: updated.testRunId,
          testCaseId: updated.testCaseId,
          executionId,
          testerNotes: [updated.notes, stepComments].filter(Boolean).join("\n\n"),
          status: "New Defect",
        });
      }
    }

    const stepResults = await db.query.stepResultsTable.findMany({
      where: eq(stepResultsTable.executionId, executionId),
    });

    const stepResultsWithAttachments = await Promise.all(
      stepResults.map(async (sr) => {
        const attachments = await db.query.attachmentsTable.findMany({
          where: eq(attachmentsTable.entityId, sr.id),
        });
        return {
          ...sr,
          recordedAt: sr.recordedAt.toISOString(),
          attachments: attachments
            .filter((a) => a.entityType === "step_result")
            .map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
        };
      })
    );

    res.json({
      ...updated,
      executedAt: updated.executedAt.toISOString(),
      stepResults: stepResultsWithAttachments,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update execution");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/executions/:executionId/steps/:stepId/result", authenticate, async (req, res) => {
  try {
    const executionId = parseInt(req.params.executionId as string);
    const stepId = parseInt(req.params.stepId as string);
    if (isNaN(executionId) || isNaN(stepId)) return res.status(400).json({ error: "Invalid execution or step ID" });

    const body = UpdateStepResultBody.parse(req.body);

    // Check if result already exists
    const existing = await db.query.stepResultsTable.findFirst({
      where: and(
        eq(stepResultsTable.executionId, executionId),
        eq(stepResultsTable.stepId, stepId)
      )
    });

    let result;
    if (existing) {
      // Update
      const [updated] = await db.update(stepResultsTable)
        .set({
          actualResult: body.actualResult ?? null,
          comments: body.comments ?? null,
          passed: body.passed ?? null,
        })
        .where(eq(stepResultsTable.id, existing.id))
        .returning();
      result = updated;
    } else {
      // Insert
      const [inserted] = await db.insert(stepResultsTable)
        .values({
          executionId,
          stepId,
          actualResult: body.actualResult ?? null,
          comments: body.comments ?? null,
          passed: body.passed ?? null,
        })
        .returning();
      result = inserted;
    }

    const attachments = await db.query.attachmentsTable.findMany({
      where: eq(attachmentsTable.entityId, result.id),
    });

    res.json({
      ...result,
      recordedAt: result.recordedAt.toISOString(),
      attachments: attachments
        .filter((a) => a.entityType === "step_result")
        .map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update step result");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
