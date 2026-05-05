import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { testCasesTable } from "./test-cases";

export const executionsTable = pgTable("executions", {
  id: serial("id").primaryKey(),
  testCaseId: integer("test_case_id").notNull().references(() => testCasesTable.id, { onDelete: "cascade" }),
  iterationNumber: integer("iteration_number").notNull(),
  testerName: text("tester_name").notNull(),
  actualResult: text("actual_result"),
  comments: text("comments"),
  passed: boolean("passed"),
  executedAt: timestamp("executed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertExecutionSchema = createInsertSchema(executionsTable).omit({
  id: true,
  executedAt: true,
});
export type InsertExecution = z.infer<typeof insertExecutionSchema>;
export type Execution = typeof executionsTable.$inferSelect;
