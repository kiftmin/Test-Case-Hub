import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@workspace/db", () => {
  const mockDb: any = vi.fn();
  mockDb.query = {
    testRunsTable: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    testRunUseCasesTable: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    useCasesTable: { findMany: vi.fn() },
    usersTable: { findMany: vi.fn() },
    projectsTable: { findFirst: vi.fn() },
    testCasesTable: { findMany: vi.fn() },
  };
  mockDb.select = vi.fn().mockReturnThis();
  mockDb.from = vi.fn().mockReturnThis();
  mockDb.innerJoin = vi.fn().mockReturnThis();
  mockDb.where = vi.fn().mockReturnThis();
  mockDb.orderBy = vi.fn().mockReturnThis();
  mockDb.insert = vi.fn().mockReturnThis();
  mockDb.update = vi.fn().mockReturnThis();
  mockDb.delete = vi.fn().mockReturnThis();
  mockDb.values = vi.fn().mockReturnThis();
  mockDb.set = vi.fn().mockReturnThis();
  mockDb.returning = vi.fn();

  return {
    db: mockDb,
    testRunsTable: {},
    testRunUseCasesTable: {},
    useCasesTable: {},
    testCasesTable: {},
    testStepsTable: {},
    executionsTable: {},
    stepResultsTable: {},
    usersTable: {},
    projectsTable: {},
    attachmentsTable: {},
    projectAssignmentsTable: {},
    eq: vi.fn().mockReturnValue({}),
    desc: vi.fn(),
    and: vi.fn(),
    inArray: vi.fn(),
  };
});

import { db, testRunsTable, testRunUseCasesTable } from "@workspace/db";

describe("Test run route helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("recalculateTestRunResult", () => {
    it("marks run as passed when all non-free-pass use cases pass", async () => {
      const findMany = db.query.testRunUseCasesTable.findMany as any;
      findMany.mockResolvedValue([
        { status: "passed", freePass: false },
        { status: "passed", freePass: false },
        { status: "failed", freePass: true },
      ]);

      const { recalculateTestRunResult } = await import("../routes/test-runs");

      await recalculateTestRunResult(1);

      expect(db.update).toHaveBeenCalledWith(testRunsTable);
    });

    it("does not calculate if not all use cases are executed", async () => {
      const findMany = db.query.testRunUseCasesTable.findMany as any;
      findMany.mockResolvedValue([
        { status: "passed", freePass: false },
        { status: "pending", freePass: false },
      ]);

      const { recalculateTestRunResult } = await import("../routes/test-runs");

      await recalculateTestRunResult(1);

      expect(db.update).not.toHaveBeenCalled();
    });

    it("does nothing when there are no use cases", async () => {
      const findMany = db.query.testRunUseCasesTable.findMany as any;
      findMany.mockResolvedValue([]);

      const { recalculateTestRunResult } = await import("../routes/test-runs");

      await recalculateTestRunResult(1);

      expect(db.update).not.toHaveBeenCalled();
    });
  });
});
