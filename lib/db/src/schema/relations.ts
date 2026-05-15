import { relations } from "drizzle-orm";
import { projectsTable } from "./projects";
import { useCasesTable } from "./use-cases";
import { testCasesTable } from "./test-cases";
import { testStepsTable } from "./test-steps";
import { executionsTable } from "./executions";
import { attachmentsTable } from "./attachments";
import { projectAssignmentsTable } from "./project-assignments";
import { stepResultsTable } from "./step-results";
import { usersTable } from "./users";
import { testRunsTable, testRunUseCasesTable } from "./test-runs";

export const projectsRelations = relations(projectsTable, ({ many }) => ({
  useCases: many(useCasesTable),
  assignments: many(projectAssignmentsTable),
  testRuns: many(testRunsTable),
}));

export const useCasesRelations = relations(useCasesTable, ({ one, many }) => ({
  project: one(projectsTable, {
    fields: [useCasesTable.projectId],
    references: [projectsTable.id],
  }),
  testCases: many(testCasesTable),
  testRunUseCases: many(testRunUseCasesTable),
}));

export const testCasesRelations = relations(testCasesTable, ({ one, many }) => ({
  useCase: one(useCasesTable, {
    fields: [testCasesTable.useCaseId],
    references: [useCasesTable.id],
  }),
  steps: many(testStepsTable),
  executions: many(executionsTable),
}));

export const testStepsRelations = relations(testStepsTable, ({ one, many }) => ({
  testCase: one(testCasesTable, {
    fields: [testStepsTable.testCaseId],
    references: [testCasesTable.id],
  }),
  attachments: many(attachmentsTable),
}));

export const executionsRelations = relations(executionsTable, ({ one, many }) => ({
  testCase: one(testCasesTable, {
    fields: [executionsTable.testCaseId],
    references: [testCasesTable.id],
  }),
  testRun: one(testRunsTable, {
    fields: [executionsTable.testRunId],
    references: [testRunsTable.id],
  }),
  stepResults: many(stepResultsTable),
}));

export const stepResultsRelations = relations(stepResultsTable, ({ one, many }) => ({
  execution: one(executionsTable, {
    fields: [stepResultsTable.executionId],
    references: [executionsTable.id],
  }),
  attachments: many(attachmentsTable),
}));

export const attachmentsRelations = relations(attachmentsTable, ({ one }) => ({
  step: one(testStepsTable, {
    fields: [attachmentsTable.entityId],
    references: [testStepsTable.id],
  }),
  stepResult: one(stepResultsTable, {
    fields: [attachmentsTable.entityId],
    references: [stepResultsTable.id],
  }),
}));

export const projectAssignmentsRelations = relations(projectAssignmentsTable, ({ one }) => ({
  project: one(projectsTable, {
    fields: [projectAssignmentsTable.projectId],
    references: [projectsTable.id],
  }),
  user: one(usersTable, {
    fields: [projectAssignmentsTable.userId],
    references: [usersTable.id],
  }),
}));

export const usersRelations = relations(usersTable, ({ many }) => ({
  assignments: many(projectAssignmentsTable),
  testRunUseCases: many(testRunUseCasesTable),
}));

// -------------------------------------------------------
// Test Runs Relations
// -------------------------------------------------------

export const testRunsRelations = relations(testRunsTable, ({ one, many }) => ({
  project: one(projectsTable, {
    fields: [testRunsTable.projectId],
    references: [projectsTable.id],
  }),
  useCases: many(testRunUseCasesTable),
  executions: many(executionsTable),
}));

export const testRunUseCasesRelations = relations(testRunUseCasesTable, ({ one }) => ({
  testRun: one(testRunsTable, {
    fields: [testRunUseCasesTable.testRunId],
    references: [testRunsTable.id],
  }),
  useCase: one(useCasesTable, {
    fields: [testRunUseCasesTable.useCaseId],
    references: [useCasesTable.id],
  }),
  assignedTester: one(usersTable, {
    fields: [testRunUseCasesTable.assignedTesterId],
    references: [usersTable.id],
  }),
}));
