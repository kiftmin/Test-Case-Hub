import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { testCasesTable } from "./test-cases";

export const testStepsTable = pgTable("test_steps", {
  id: serial("id").primaryKey(),
  testCaseId: integer("test_case_id").notNull().references(() => testCasesTable.id, { onDelete: "cascade" }),
  stepNumber: integer("step_number").notNull(),
  instruction: text("instruction").notNull(),
  testData: text("test_data"),
  expectedResult: text("expected_result").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTestStepSchema = createInsertSchema(testStepsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertTestStep = typeof testStepsTable.$inferInsert;
export type TestStep = typeof testStepsTable.$inferSelect;
