import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { projectsTable } from "./projects";
import { useCasesTable } from "./use-cases";
import { usersTable } from "./users";

// ------------------------------------------------------------
// Test Runs
// A test run is a scheduled execution of a set of use cases
// within a project. It has an overall pass/fail result.
// ------------------------------------------------------------
export const testRunsTable = pgTable("test_runs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // Status lifecycle: 'scheduled' -> 'in_progress' -> 'completed'
  status: text("status").notNull().default("scheduled"),
  // The date/time when the test run becomes available to testers
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  // Overall pass/fail result — null until the run is completed
  passed: boolean("passed"),
  // If this run was created as a re-run from another, track the source
  sourceTestRunId: integer("source_test_run_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTestRunSchema = createInsertSchema(testRunsTable).omit({
  id: true,
  passed: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTestRun = typeof testRunsTable.$inferInsert;
export type TestRun = typeof testRunsTable.$inferSelect;

// ------------------------------------------------------------
// Test Run Use Cases
// Represents the use cases that are part of a test run.
// Each entry can optionally assign a specific tester and can
// have a "free pass" — meaning a failure won't fail the whole run.
// ------------------------------------------------------------
export const testRunUseCasesTable = pgTable("test_run_use_cases", {
  id: serial("id").primaryKey(),
  testRunId: integer("test_run_id")
    .notNull()
    .references(() => testRunsTable.id, { onDelete: "cascade" }),
  useCaseId: integer("use_case_id")
    .notNull()
    .references(() => useCasesTable.id, { onDelete: "cascade" }),
  // The tester assigned to execute this use case (nullable = unassigned)
  assignedTesterId: integer("assigned_tester_id").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  // If true, a failure does not fail the overall test run
  freePass: boolean("free_pass").notNull().default(false),
  // Status lifecycle: 'pending' | 'in_progress' | 'passed' | 'failed'
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTestRunUseCaseSchema = createInsertSchema(testRunUseCasesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertTestRunUseCase = typeof testRunUseCasesTable.$inferInsert;
export type TestRunUseCase = typeof testRunUseCasesTable.$inferSelect;
