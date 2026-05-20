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
import { defectsTable } from "./defects";
import { bugsTable } from "./bugs";
import { statusAuditLogTable } from "./status-audit-log";
import { teamDiscussionsTable } from "./team-discussions";
import { teamDiscussionParticipantsTable } from "./team-discussion-participants";
import { defectNotesTable } from "./defect-notes";

export const projectsRelations = relations(projectsTable, ({ many, one }) => ({
  useCases: many(useCasesTable),
  assignments: many(projectAssignmentsTable),
  testRuns: many(testRunsTable),
  bugs: many(bugsTable),
  teamDiscussions: many(teamDiscussionsTable),
  testLead: one(usersTable, {
    fields: [projectsTable.testLeadId],
    references: [usersTable.id],
  }),
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
  defects: many(defectsTable),
  tester: one(usersTable, {
    fields: [executionsTable.testerId],
    references: [usersTable.id],
  }),
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
  assignedBugs: many(bugsTable, {
    relationName: "assignedDeveloper",
  }),
  initiatedDiscussions: many(teamDiscussionsTable, {
    relationName: "initiator",
  }),
  discussionParticipants: many(teamDiscussionParticipantsTable),
  statusAuditLogs: many(statusAuditLogTable),
  defectNotes: many(defectNotesTable),
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
  defects: many(defectsTable),
  teamDiscussions: many(teamDiscussionsTable),
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

// ── Defects Relations ──────────────────────────────────────────────────────

export const defectsRelations = relations(defectsTable, ({ one, many }) => ({
  testRun: one(testRunsTable, {
    fields: [defectsTable.testRunId],
    references: [testRunsTable.id],
  }),
  testCase: one(testCasesTable, {
    fields: [defectsTable.testCaseId],
    references: [testCasesTable.id],
  }),
  execution: one(executionsTable, {
    fields: [defectsTable.executionId],
    references: [executionsTable.id],
  }),
  notes: many(defectNotesTable),
  bug: one(bugsTable),
}));

// ── Bugs Relations ─────────────────────────────────────────────────────────

export const bugsRelations = relations(bugsTable, ({ one }) => ({
  project: one(projectsTable, {
    fields: [bugsTable.projectId],
    references: [projectsTable.id],
  }),
  defect: one(defectsTable, {
    fields: [bugsTable.defectId],
    references: [defectsTable.id],
  }),
  assignedDeveloper: one(usersTable, {
    fields: [bugsTable.assignedDeveloperId],
    references: [usersTable.id],
    relationName: "assignedDeveloper",
  }),
}));

// ── Status Audit Log Relations ─────────────────────────────────────────────

export const statusAuditLogRelations = relations(statusAuditLogTable, ({ one }) => ({
  changedBy: one(usersTable, {
    fields: [statusAuditLogTable.changedByUserId],
    references: [usersTable.id],
  }),
}));

// ── Team Discussions Relations ─────────────────────────────────────────────

export const teamDiscussionsRelations = relations(teamDiscussionsTable, ({ one, many }) => ({
  project: one(projectsTable, {
    fields: [teamDiscussionsTable.projectId],
    references: [projectsTable.id],
  }),
  testRun: one(testRunsTable, {
    fields: [teamDiscussionsTable.testRunId],
    references: [testRunsTable.id],
  }),
  initiatedBy: one(usersTable, {
    fields: [teamDiscussionsTable.initiatedByUserId],
    references: [usersTable.id],
    relationName: "initiator",
  }),
  participants: many(teamDiscussionParticipantsTable),
}));

// ── Team Discussion Participants Relations ─────────────────────────────────

export const teamDiscussionParticipantsRelations = relations(teamDiscussionParticipantsTable, ({ one }) => ({
  discussion: one(teamDiscussionsTable, {
    fields: [teamDiscussionParticipantsTable.discussionId],
    references: [teamDiscussionsTable.id],
  }),
  user: one(usersTable, {
    fields: [teamDiscussionParticipantsTable.userId],
    references: [usersTable.id],
  }),
}));

// ── Defect Notes Relations ─────────────────────────────────────────────────

export const defectNotesRelations = relations(defectNotesTable, ({ one }) => ({
  defect: one(defectsTable, {
    fields: [defectNotesTable.defectId],
    references: [defectsTable.id],
  }),
  discussion: one(teamDiscussionsTable, {
    fields: [defectNotesTable.discussionId],
    references: [teamDiscussionsTable.id],
  }),
  addedBy: one(usersTable, {
    fields: [defectNotesTable.addedByUserId],
    references: [usersTable.id],
  }),
}));
