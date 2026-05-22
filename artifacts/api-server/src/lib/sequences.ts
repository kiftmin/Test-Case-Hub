import { db, bugsTable, testCasesTable, testStepsTable } from "@workspace/db";
import { eq, max, sql } from "drizzle-orm";

export async function nextBugNumber(projectId: number): Promise<number> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(${1}, ${projectId})`,
    );
    const [row] = await tx
      .select({ value: max(bugsTable.bugNumber) })
      .from(bugsTable)
      .where(eq(bugsTable.projectId, projectId));
    return (row?.value ?? 0) + 1;
  });
}

export async function nextCaseNumber(useCaseId: number): Promise<number> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(${2}, ${useCaseId})`,
    );
    const [row] = await tx
      .select({ value: max(testCasesTable.caseNumber) })
      .from(testCasesTable)
      .where(eq(testCasesTable.useCaseId, useCaseId));
    return (row?.value ?? 0) + 1;
  });
}

export async function nextStepNumber(testCaseId: number): Promise<number> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(${3}, ${testCaseId})`,
    );
    const [row] = await tx
      .select({ value: max(testStepsTable.stepNumber) })
      .from(testStepsTable)
      .where(eq(testStepsTable.testCaseId, testCaseId));
    return (row?.value ?? 0) + 1;
  });
}

/** Reserve a contiguous block of step numbers for bulk insert. */
export async function nextStepNumberBlock(
  testCaseId: number,
  count: number,
): Promise<number> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(${3}, ${testCaseId})`,
    );
    const [row] = await tx
      .select({ value: max(testStepsTable.stepNumber) })
      .from(testStepsTable)
      .where(eq(testStepsTable.testCaseId, testCaseId));
    return (row?.value ?? 0) + 1;
  });
}
