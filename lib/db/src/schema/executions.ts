import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { testCasesTable } from "./test-cases";
import { testRunsTable } from "./test-runs";

export const executionsTable = pgTable("executions", {
  id: serial("id").primaryKey(),
  testCaseId: integer("test_case_id").notNull().references(() => testCasesTable.id, { onDelete: "cascade" }),
  // Link to a test run — null for ad-hoc executions outside of a scheduled run
  testRunId: integer("test_run_id").references(() => testRunsTable.id, { onDelete: "set null" }),
  iterationNumber: integer("iteration_number").notNull(),
  testerName: text("tester_name").notNull(),
  status: text("status").notNull().default("in_progress"), // 'in_progress', 'completed'
  executedAt: timestamp("executed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertExecutionSchema = createInsertSchema(executionsTable).omit({
  id: true,
  executedAt: true,
});
export type InsertExecution = typeof executionsTable.$inferInsert;
export type Execution = typeof executionsTable.$inferSelect;
