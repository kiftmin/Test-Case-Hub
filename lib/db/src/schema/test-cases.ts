import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { useCasesTable } from "./use-cases";

export const testCasesTable = pgTable("test_cases", {
  id: serial("id").primaryKey(),
  useCaseId: integer("use_case_id").notNull().references(() => useCasesTable.id, { onDelete: "cascade" }),
  caseNumber: integer("case_number").notNull(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTestCaseSchema = createInsertSchema(testCasesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertTestCase = typeof testCasesTable.$inferInsert;
export type TestCase = typeof testCasesTable.$inferSelect;
