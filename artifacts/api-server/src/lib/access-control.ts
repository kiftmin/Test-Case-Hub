import {
  db,
  testRunsTable,
  projectAssignmentsTable,
  testRunUseCasesTable,
  testCasesTable,
  executionsTable,
  stepResultsTable,
  testStepsTable,
  usersTable,
  useCasesTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import type { AuthRequest } from "../middlewares/auth";

export async function getProjectAssignment(userId: number, projectId: number) {
  return db.query.projectAssignmentsTable.findFirst({
    where: and(
      eq(projectAssignmentsTable.projectId, projectId),
      eq(projectAssignmentsTable.userId, userId),
    ),
  });
}

export function isGlobalAdmin(req: AuthRequest): boolean {
  return req.user?.role === "ADMIN";
}

/** Caller may access project data (any assigned role or global admin). */
export async function canAccessProject(req: AuthRequest, projectId: number): Promise<boolean> {
  if (!req.user) return false;
  if (isGlobalAdmin(req)) return true;
  const assignment = await getProjectAssignment(req.user.userId, projectId);
  return !!assignment;
}

/** Same visibility rules as GET /test-runs/:testRunId */
export async function canViewTestRun(req: AuthRequest, testRunId: number): Promise<boolean> {
  if (!req.user) return false;
  if (isGlobalAdmin(req)) return true;

  const run = await db.query.testRunsTable.findFirst({
    where: eq(testRunsTable.id, testRunId),
  });
  if (!run) return false;

  const projectAssignment = await getProjectAssignment(req.user.userId, run.projectId);
  if (!projectAssignment) return false;

  if (projectAssignment.role === "TESTER") {
    const assignment = await db.query.testRunUseCasesTable.findFirst({
      where: and(
        eq(testRunUseCasesTable.testRunId, testRunId),
        eq(testRunUseCasesTable.assignedTesterId, req.user.userId),
      ),
    });
    return !!assignment;
  }

  return true;
}

/** User may read another user's dashboard only if self or global admin. */
export function canAccessUserDashboard(req: AuthRequest, targetUserId: number): boolean {
  if (!req.user) return false;
  if (isGlobalAdmin(req)) return true;
  return req.user.userId === targetUserId;
}

/** Assigned tester on the use case, or project test lead / author, or global admin. */
export async function canModifyTestRunUseCase(
  req: AuthRequest,
  testRunId: number,
  testRunUseCaseId: number,
  body: {
    freePass?: boolean;
    assignedTesterId?: number | null;
    status?: string;
  },
): Promise<{ allowed: boolean; error?: string }> {
  if (!req.user) return { allowed: false, error: "Authentication required" };

  const run = await db.query.testRunsTable.findFirst({
    where: eq(testRunsTable.id, testRunId),
  });
  if (!run) return { allowed: false, error: "Test run not found" };

  const existing = await db.query.testRunUseCasesTable.findFirst({
    where: and(
      eq(testRunUseCasesTable.id, testRunUseCaseId),
      eq(testRunUseCasesTable.testRunId, testRunId),
    ),
  });
  if (!existing) return { allowed: false, error: "Test run use case not found" };

  const changingAssignment =
    body.freePass !== undefined ||
    body.assignedTesterId !== undefined;
  const changingStatus = body.status !== undefined;

  if (isGlobalAdmin(req)) return { allowed: true };

  if (changingAssignment) {
    const allowed = await import("../middlewares/auth").then((m) =>
      m.checkProjectRole(req, run.projectId, ["TEST_LEAD"]),
    );
    if (!allowed) {
      return { allowed: false, error: "Insufficient permissions" };
    }
    return { allowed: true };
  }

  if (changingStatus) {
    if (existing.assignedTesterId === req.user.userId) return { allowed: true };
    const lead = await import("../middlewares/auth").then((m) =>
      m.checkProjectRole(req, run.projectId, ["TEST_LEAD", "TEST_AUTHOR"]),
    );
    if (lead) return { allowed: true };
    return { allowed: false, error: "Insufficient permissions" };
  }

  return { allowed: true };
}

/** Verify caller may create/update an execution in a test run (by user id, not display name). */
export async function verifyTestRunExecutionAccess(
  req: AuthRequest,
  testRunId: number,
  testCaseId: number,
): Promise<{ ok: true } | { ok: false; status: number; error: string; assignedTo?: string }> {
  if (!req.user) return { ok: false, status: 401, error: "Authentication required" };

  const run = await db.query.testRunsTable.findFirst({
    where: eq(testRunsTable.id, testRunId),
  });
  if (!run) return { ok: false, status: 404, error: "Test run not found" };

  if (run.scheduledAt > new Date()) {
    return {
      ok: false,
      status: 403,
      error: "Test run is not yet available",
    };
  }

  if (run.status === "completed") {
    return { ok: false, status: 403, error: "Test run has already been completed and submitted" };
  }

  const testCase = await db.query.testCasesTable.findFirst({
    where: eq(testCasesTable.id, testCaseId),
  });
  if (!testCase) return { ok: false, status: 404, error: "Test case not found" };

  const assignment = await db.query.testRunUseCasesTable.findFirst({
    where: and(
      eq(testRunUseCasesTable.testRunId, testRunId),
      eq(testRunUseCasesTable.useCaseId, testCase.useCaseId),
    ),
  });

  if (!assignment) {
    return { ok: false, status: 403, error: "This test case is not part of the specified test run" };
  }

  if (assignment.assignedTesterId === null) {
    return { ok: false, status: 403, error: "No tester has been assigned to this use case yet" };
  }

  if (isGlobalAdmin(req)) return { ok: true };

  if (assignment.assignedTesterId !== req.user.userId) {
    const assignedUser = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, assignment.assignedTesterId),
    });
    return {
      ok: false,
      status: 403,
      error: "You are not assigned to this use case",
      assignedTo: assignedUser?.name,
    };
  }

  return { ok: true };
}

/** Load execution and verify update/step access for test-run executions. */
export async function verifyExecutionModifyAccess(
  req: AuthRequest,
  executionId: number,
): Promise<
  | { ok: true; execution: typeof executionsTable.$inferSelect }
  | { ok: false; status: number; error: string }
> {
  if (!req.user) return { ok: false, status: 401, error: "Authentication required" };

  const execution = await db.query.executionsTable.findFirst({
    where: eq(executionsTable.id, executionId),
  });
  if (!execution) return { ok: false, status: 404, error: "Execution not found" };

  if (!execution.testRunId) {
    if (isGlobalAdmin(req)) return { ok: true, execution };
    return { ok: false, status: 403, error: "Ad-hoc executions require administrator access" };
  }

  const access = await verifyTestRunExecutionAccess(
    req,
    execution.testRunId,
    execution.testCaseId,
  );
  if (!access.ok) {
    return { ok: false, status: access.status, error: access.error };
  }

  return { ok: true, execution };
}

export async function resolveProjectIdForTestCase(testCaseId: number): Promise<number | null> {
  const testCase = await db.query.testCasesTable.findFirst({
    where: eq(testCasesTable.id, testCaseId),
  });
  if (!testCase) return null;
  const useCase = await db.query.useCasesTable.findFirst({
    where: eq(useCasesTable.id, testCase.useCaseId),
  });
  return useCase?.projectId ?? null;
}

export async function canAccessAttachmentEntity(
  req: AuthRequest,
  entityType: string,
  entityId: number,
): Promise<boolean> {
  if (!req.user) return false;
  if (isGlobalAdmin(req)) return true;

  if (entityType === "step_result") {
    const stepResult = await db.query.stepResultsTable.findFirst({
      where: eq(stepResultsTable.id, entityId),
    });
    if (!stepResult) return false;
    const execution = await db.query.executionsTable.findFirst({
      where: eq(executionsTable.id, stepResult.executionId),
    });
    if (!execution) return false;
    if (execution.testRunId) {
      // Allow access if the user is the executor of this step result
      if (execution.testerId === req.user.userId) {
        return true;
      }
      return canViewTestRun(req, execution.testRunId);
    }
    const projectId = await resolveProjectIdForTestCase(execution.testCaseId);
    if (projectId === null) return false;
    return canAccessProject(req, projectId);
  }

  if (entityType === "test_step") {
    const step = await db.query.testStepsTable.findFirst({
      where: eq(testStepsTable.id, entityId),
    });
    if (!step) return false;
    const projectId = await resolveProjectIdForTestCase(step.testCaseId);
    if (projectId === null) return false;
    return canAccessProject(req, projectId);
  }

  return false;
}
