import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { testRunsTable } from "./test-runs";
import { testCasesTable } from "./test-cases";
import { executionsTable } from "./executions";

export const defectsTable = pgTable("defects", {
  id: serial("id").primaryKey(),
  testRunId: integer("test_run_id").notNull().references(() => testRunsTable.id, { onDelete: "cascade" }),
  testCaseId: integer("test_case_id").notNull().references(() => testCasesTable.id, { onDelete: "cascade" }),
  executionId: integer("execution_id").notNull().references(() => executionsTable.id, { onDelete: "cascade" }),
  testerNotes: text("tester_notes"),
  status: text("status").notNull().default("New Defect"),
  retestReason: text("retest_reason"),
  acceptedByBusinessNote: text("accepted_by_business_note"),
  rejectionLog: text("rejection_log"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDefectSchema = createInsertSchema(defectsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDefect = typeof defectsTable.$inferInsert;
export type Defect = typeof defectsTable.$inferSelect;
