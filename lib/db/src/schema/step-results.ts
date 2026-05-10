import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { executionsTable } from "./executions";
import { testStepsTable } from "./test-steps";

export const stepResultsTable = pgTable("step_results", {
  id: serial("id").primaryKey(),
  executionId: integer("execution_id").notNull().references(() => executionsTable.id, { onDelete: "cascade" }),
  stepId: integer("step_id").notNull().references(() => testStepsTable.id, { onDelete: "cascade" }),
  actualResult: text("actual_result"),
  comments: text("comments"),
  passed: boolean("passed"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStepResultSchema = createInsertSchema(stepResultsTable).omit({
  id: true,
  recordedAt: true,
});
export type InsertStepResult = typeof stepResultsTable.$inferInsert;
export type StepResult = typeof stepResultsTable.$inferSelect;
