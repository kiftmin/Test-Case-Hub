import { pgTable, foreignKey, unique, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const projects = pgTable("projects", {
	id: serial().primaryKey().notNull(),
	projectCode: text("project_code").notNull(),
	name: text().notNull(),
	designedBy: text("designed_by").notNull(),
	moduleName: text("module_name").notNull(),
	designDate: text("design_date").notNull(),
	testLink: text("test_link"),
	version: integer().default(1).notNull(),
	versionDate: text("version_date").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	isSignedOff: integer("is_signed_off").default(0).notNull(),
	signOffData: text("sign_off_data"),
	testLeadId: integer("test_lead_id"),
}, (table) => [
	foreignKey({
			columns: [table.testLeadId],
			foreignColumns: [users.id],
			name: "projects_test_lead_id_users_id_fk"
		}).onDelete("set null"),
	unique("projects_project_code_unique").on(table.projectCode),
]);

export const attachments = pgTable("attachments", {
	id: serial().primaryKey().notNull(),
	entityType: text("entity_type").notNull(),
	entityId: integer("entity_id").notNull(),
	field: text().notNull(),
	fileName: text("file_name").notNull(),
	fileUrl: text("file_url").notNull(),
	fileType: text("file_type").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const useCases = pgTable("use_cases", {
	id: serial().primaryKey().notNull(),
	projectId: integer("project_id").notNull(),
	code: text().notNull(),
	name: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "use_cases_project_id_projects_id_fk"
		}).onDelete("cascade"),
]);

export const testCases = pgTable("test_cases", {
	id: serial().primaryKey().notNull(),
	useCaseId: integer("use_case_id").notNull(),
	caseNumber: integer("case_number").notNull(),
	title: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.useCaseId],
			foreignColumns: [useCases.id],
			name: "test_cases_use_case_id_use_cases_id_fk"
		}).onDelete("cascade"),
]);

export const testSteps = pgTable("test_steps", {
	id: serial().primaryKey().notNull(),
	testCaseId: integer("test_case_id").notNull(),
	stepNumber: integer("step_number").notNull(),
	instruction: text().notNull(),
	testData: text("test_data"),
	expectedResult: text("expected_result").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.testCaseId],
			foreignColumns: [testCases.id],
			name: "test_steps_test_case_id_test_cases_id_fk"
		}).onDelete("cascade"),
]);

export const users = pgTable("users", {
	id: serial().primaryKey().notNull(),
	username: text().notNull(),
	passwordHash: text("password_hash").notNull(),
	name: text().notNull(),
	email: text(),
	role: text().default('USER').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("users_username_unique").on(table.username),
]);

export const projectAssignments = pgTable("project_assignments", {
	id: serial().primaryKey().notNull(),
	projectId: integer("project_id").notNull(),
	userId: integer("user_id").notNull(),
	role: text().notNull(),
	assignedAt: timestamp("assigned_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "project_assignments_project_id_projects_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "project_assignments_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const stepResults = pgTable("step_results", {
	id: serial().primaryKey().notNull(),
	executionId: integer("execution_id").notNull(),
	stepId: integer("step_id").notNull(),
	actualResult: text("actual_result"),
	comments: text(),
	passed: boolean(),
	recordedAt: timestamp("recorded_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.executionId],
			foreignColumns: [executions.id],
			name: "step_results_execution_id_executions_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.stepId],
			foreignColumns: [testSteps.id],
			name: "step_results_step_id_test_steps_id_fk"
		}).onDelete("cascade"),
]);

export const testRuns = pgTable("test_runs", {
	id: serial().primaryKey().notNull(),
	projectId: integer("project_id").notNull(),
	name: text().notNull(),
	status: text().default('scheduled').notNull(),
	scheduledAt: timestamp("scheduled_at", { withTimezone: true, mode: 'string' }).notNull(),
	passed: boolean(),
	sourceTestRunId: integer("source_test_run_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "test_runs_project_id_projects_id_fk"
		}).onDelete("cascade"),
]);

export const testRunUseCases = pgTable("test_run_use_cases", {
	id: serial().primaryKey().notNull(),
	testRunId: integer("test_run_id").notNull(),
	useCaseId: integer("use_case_id").notNull(),
	assignedTesterId: integer("assigned_tester_id"),
	freePass: boolean("free_pass").default(false).notNull(),
	status: text().default('pending').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.testRunId],
			foreignColumns: [testRuns.id],
			name: "test_run_use_cases_test_run_id_test_runs_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.useCaseId],
			foreignColumns: [useCases.id],
			name: "test_run_use_cases_use_case_id_use_cases_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.assignedTesterId],
			foreignColumns: [users.id],
			name: "test_run_use_cases_assigned_tester_id_users_id_fk"
		}).onDelete("set null"),
]);

export const bugs = pgTable("bugs", {
	id: serial().primaryKey().notNull(),
	projectId: integer("project_id").notNull(),
	defectId: integer("defect_id").notNull(),
	bugNumber: integer("bug_number").notNull(),
	supportTicketNumber: text("support_ticket_number"),
	assignedDeveloperId: integer("assigned_developer_id"),
	status: text().default('OPEN').notNull(),
	developerNotes: text("developer_notes"),
	failedToResolveReason: text("failed_to_resolve_reason"),
	openedAt: timestamp("opened_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	assignedAt: timestamp("assigned_at", { withTimezone: true, mode: 'string' }),
	resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: 'string' }),
	testAt: timestamp("test_at", { withTimezone: true, mode: 'string' }),
	failedToResolveAt: timestamp("failed_to_resolve_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "bugs_project_id_projects_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.defectId],
			foreignColumns: [defects.id],
			name: "bugs_defect_id_defects_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.assignedDeveloperId],
			foreignColumns: [users.id],
			name: "bugs_assigned_developer_id_users_id_fk"
		}).onDelete("set null"),
]);

export const statusAuditLog = pgTable("status_audit_log", {
	id: serial().primaryKey().notNull(),
	entityType: text("entity_type").notNull(),
	entityId: integer("entity_id").notNull(),
	changedByUserId: integer("changed_by_user_id").notNull(),
	fromStatus: text("from_status").notNull(),
	toStatus: text("to_status").notNull(),
	reason: text(),
	changedAt: timestamp("changed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.changedByUserId],
			foreignColumns: [users.id],
			name: "status_audit_log_changed_by_user_id_users_id_fk"
		}),
]);

export const defects = pgTable("defects", {
	id: serial().primaryKey().notNull(),
	testRunId: integer("test_run_id").notNull(),
	testCaseId: integer("test_case_id").notNull(),
	executionId: integer("execution_id").notNull(),
	testerNotes: text("tester_notes"),
	status: text().default('New Defect').notNull(),
	retestReason: text("retest_reason"),
	acceptedByBusinessNote: text("accepted_by_business_note"),
	rejectionLog: text("rejection_log"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.testRunId],
			foreignColumns: [testRuns.id],
			name: "defects_test_run_id_test_runs_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.testCaseId],
			foreignColumns: [testCases.id],
			name: "defects_test_case_id_test_cases_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.executionId],
			foreignColumns: [executions.id],
			name: "defects_execution_id_executions_id_fk"
		}).onDelete("cascade"),
]);

export const teamDiscussions = pgTable("team_discussions", {
	id: serial().primaryKey().notNull(),
	projectId: integer("project_id").notNull(),
	testRunId: integer("test_run_id").notNull(),
	initiatedByUserId: integer("initiated_by_user_id").notNull(),
	meetingType: text("meeting_type").notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	endedAt: timestamp("ended_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "team_discussions_project_id_projects_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.testRunId],
			foreignColumns: [testRuns.id],
			name: "team_discussions_test_run_id_test_runs_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.initiatedByUserId],
			foreignColumns: [users.id],
			name: "team_discussions_initiated_by_user_id_users_id_fk"
		}),
]);

export const executions = pgTable("executions", {
	id: serial().primaryKey().notNull(),
	testCaseId: integer("test_case_id").notNull(),
	iterationNumber: integer("iteration_number").notNull(),
	testerName: text("tester_name").notNull(),
	executedAt: timestamp("executed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	status: text().default('in_progress').notNull(),
	testRunId: integer("test_run_id"),
	testerId: integer("tester_id"),
	overallResult: text("overall_result"),
	notes: text(),
}, (table) => [
	foreignKey({
			columns: [table.testCaseId],
			foreignColumns: [testCases.id],
			name: "executions_test_case_id_test_cases_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.testRunId],
			foreignColumns: [testRuns.id],
			name: "executions_test_run_id_test_runs_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.testerId],
			foreignColumns: [users.id],
			name: "executions_tester_id_users_id_fk"
		}).onDelete("set null"),
]);

export const teamDiscussionParticipants = pgTable("team_discussion_participants", {
	id: serial().primaryKey().notNull(),
	discussionId: integer("discussion_id").notNull(),
	userId: integer("user_id").notNull(),
	canAddNotes: boolean("can_add_notes").default(false).notNull(),
	addedAt: timestamp("added_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.discussionId],
			foreignColumns: [teamDiscussions.id],
			name: "team_discussion_participants_discussion_id_team_discussions_id_"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "team_discussion_participants_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const defectNotes = pgTable("defect_notes", {
	id: serial().primaryKey().notNull(),
	defectId: integer("defect_id").notNull(),
	discussionId: integer("discussion_id"),
	addedByUserId: integer("added_by_user_id").notNull(),
	note: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.defectId],
			foreignColumns: [defects.id],
			name: "defect_notes_defect_id_defects_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.discussionId],
			foreignColumns: [teamDiscussions.id],
			name: "defect_notes_discussion_id_team_discussions_id_fk"
		}),
	foreignKey({
			columns: [table.addedByUserId],
			foreignColumns: [users.id],
			name: "defect_notes_added_by_user_id_users_id_fk"
		}),
]);
