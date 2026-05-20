import { relations } from "drizzle-orm/relations";
import { users, projects, useCases, testCases, testSteps, projectAssignments, executions, stepResults, testRuns, testRunUseCases, bugs, defects, statusAuditLog, teamDiscussions, teamDiscussionParticipants, defectNotes } from "./schema";

export const projectsRelations = relations(projects, ({one, many}) => ({
	user: one(users, {
		fields: [projects.testLeadId],
		references: [users.id]
	}),
	useCases: many(useCases),
	projectAssignments: many(projectAssignments),
	testRuns: many(testRuns),
	bugs: many(bugs),
	teamDiscussions: many(teamDiscussions),
}));

export const usersRelations = relations(users, ({many}) => ({
	projects: many(projects),
	projectAssignments: many(projectAssignments),
	testRunUseCases: many(testRunUseCases),
	bugs: many(bugs),
	statusAuditLogs: many(statusAuditLog),
	teamDiscussions: many(teamDiscussions),
	executions: many(executions),
	teamDiscussionParticipants: many(teamDiscussionParticipants),
	defectNotes: many(defectNotes),
}));

export const useCasesRelations = relations(useCases, ({one, many}) => ({
	project: one(projects, {
		fields: [useCases.projectId],
		references: [projects.id]
	}),
	testCases: many(testCases),
	testRunUseCases: many(testRunUseCases),
}));

export const testCasesRelations = relations(testCases, ({one, many}) => ({
	useCase: one(useCases, {
		fields: [testCases.useCaseId],
		references: [useCases.id]
	}),
	testSteps: many(testSteps),
	defects: many(defects),
	executions: many(executions),
}));

export const testStepsRelations = relations(testSteps, ({one, many}) => ({
	testCase: one(testCases, {
		fields: [testSteps.testCaseId],
		references: [testCases.id]
	}),
	stepResults: many(stepResults),
}));

export const projectAssignmentsRelations = relations(projectAssignments, ({one}) => ({
	project: one(projects, {
		fields: [projectAssignments.projectId],
		references: [projects.id]
	}),
	user: one(users, {
		fields: [projectAssignments.userId],
		references: [users.id]
	}),
}));

export const stepResultsRelations = relations(stepResults, ({one}) => ({
	execution: one(executions, {
		fields: [stepResults.executionId],
		references: [executions.id]
	}),
	testStep: one(testSteps, {
		fields: [stepResults.stepId],
		references: [testSteps.id]
	}),
}));

export const executionsRelations = relations(executions, ({one, many}) => ({
	stepResults: many(stepResults),
	defects: many(defects),
	testCase: one(testCases, {
		fields: [executions.testCaseId],
		references: [testCases.id]
	}),
	testRun: one(testRuns, {
		fields: [executions.testRunId],
		references: [testRuns.id]
	}),
	user: one(users, {
		fields: [executions.testerId],
		references: [users.id]
	}),
}));

export const testRunsRelations = relations(testRuns, ({one, many}) => ({
	project: one(projects, {
		fields: [testRuns.projectId],
		references: [projects.id]
	}),
	testRunUseCases: many(testRunUseCases),
	defects: many(defects),
	teamDiscussions: many(teamDiscussions),
	executions: many(executions),
}));

export const testRunUseCasesRelations = relations(testRunUseCases, ({one}) => ({
	testRun: one(testRuns, {
		fields: [testRunUseCases.testRunId],
		references: [testRuns.id]
	}),
	useCase: one(useCases, {
		fields: [testRunUseCases.useCaseId],
		references: [useCases.id]
	}),
	user: one(users, {
		fields: [testRunUseCases.assignedTesterId],
		references: [users.id]
	}),
}));

export const bugsRelations = relations(bugs, ({one}) => ({
	project: one(projects, {
		fields: [bugs.projectId],
		references: [projects.id]
	}),
	defect: one(defects, {
		fields: [bugs.defectId],
		references: [defects.id]
	}),
	user: one(users, {
		fields: [bugs.assignedDeveloperId],
		references: [users.id]
	}),
}));

export const defectsRelations = relations(defects, ({one, many}) => ({
	bugs: many(bugs),
	testRun: one(testRuns, {
		fields: [defects.testRunId],
		references: [testRuns.id]
	}),
	testCase: one(testCases, {
		fields: [defects.testCaseId],
		references: [testCases.id]
	}),
	execution: one(executions, {
		fields: [defects.executionId],
		references: [executions.id]
	}),
	defectNotes: many(defectNotes),
}));

export const statusAuditLogRelations = relations(statusAuditLog, ({one}) => ({
	user: one(users, {
		fields: [statusAuditLog.changedByUserId],
		references: [users.id]
	}),
}));

export const teamDiscussionsRelations = relations(teamDiscussions, ({one, many}) => ({
	project: one(projects, {
		fields: [teamDiscussions.projectId],
		references: [projects.id]
	}),
	testRun: one(testRuns, {
		fields: [teamDiscussions.testRunId],
		references: [testRuns.id]
	}),
	user: one(users, {
		fields: [teamDiscussions.initiatedByUserId],
		references: [users.id]
	}),
	teamDiscussionParticipants: many(teamDiscussionParticipants),
	defectNotes: many(defectNotes),
}));

export const teamDiscussionParticipantsRelations = relations(teamDiscussionParticipants, ({one}) => ({
	teamDiscussion: one(teamDiscussions, {
		fields: [teamDiscussionParticipants.discussionId],
		references: [teamDiscussions.id]
	}),
	user: one(users, {
		fields: [teamDiscussionParticipants.userId],
		references: [users.id]
	}),
}));

export const defectNotesRelations = relations(defectNotes, ({one}) => ({
	defect: one(defects, {
		fields: [defectNotes.defectId],
		references: [defects.id]
	}),
	teamDiscussion: one(teamDiscussions, {
		fields: [defectNotes.discussionId],
		references: [teamDiscussions.id]
	}),
	user: one(users, {
		fields: [defectNotes.addedByUserId],
		references: [users.id]
	}),
}));