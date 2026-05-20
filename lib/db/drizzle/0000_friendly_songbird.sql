-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_code" text NOT NULL,
	"name" text NOT NULL,
	"designed_by" text NOT NULL,
	"module_name" text NOT NULL,
	"design_date" text NOT NULL,
	"test_link" text,
	"version" integer DEFAULT 1 NOT NULL,
	"version_date" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_signed_off" integer DEFAULT 0 NOT NULL,
	"sign_off_data" text,
	"test_lead_id" integer,
	CONSTRAINT "projects_project_code_unique" UNIQUE("project_code")
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"field" text NOT NULL,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"file_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "use_cases" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_cases" (
	"id" serial PRIMARY KEY NOT NULL,
	"use_case_id" integer NOT NULL,
	"case_number" integer NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"test_case_id" integer NOT NULL,
	"step_number" integer NOT NULL,
	"instruction" text NOT NULL,
	"test_data" text,
	"expected_result" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"role" text DEFAULT 'USER' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "project_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" text NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "step_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"execution_id" integer NOT NULL,
	"step_id" integer NOT NULL,
	"actual_result" text,
	"comments" text,
	"passed" boolean,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"passed" boolean,
	"source_test_run_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_run_use_cases" (
	"id" serial PRIMARY KEY NOT NULL,
	"test_run_id" integer NOT NULL,
	"use_case_id" integer NOT NULL,
	"assigned_tester_id" integer,
	"free_pass" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bugs" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"defect_id" integer NOT NULL,
	"bug_number" integer NOT NULL,
	"support_ticket_number" text,
	"assigned_developer_id" integer,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"developer_notes" text,
	"failed_to_resolve_reason" text,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"assigned_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"test_at" timestamp with time zone,
	"failed_to_resolve_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "status_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"changed_by_user_id" integer NOT NULL,
	"from_status" text NOT NULL,
	"to_status" text NOT NULL,
	"reason" text,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "defects" (
	"id" serial PRIMARY KEY NOT NULL,
	"test_run_id" integer NOT NULL,
	"test_case_id" integer NOT NULL,
	"execution_id" integer NOT NULL,
	"tester_notes" text,
	"status" text DEFAULT 'New Defect' NOT NULL,
	"retest_reason" text,
	"accepted_by_business_note" text,
	"rejection_log" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_discussions" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"test_run_id" integer NOT NULL,
	"initiated_by_user_id" integer NOT NULL,
	"meeting_type" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "executions" (
	"id" serial PRIMARY KEY NOT NULL,
	"test_case_id" integer NOT NULL,
	"iteration_number" integer NOT NULL,
	"tester_name" text NOT NULL,
	"executed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"test_run_id" integer,
	"tester_id" integer,
	"overall_result" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "team_discussion_participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"discussion_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"can_add_notes" boolean DEFAULT false NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "defect_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"defect_id" integer NOT NULL,
	"discussion_id" integer,
	"added_by_user_id" integer NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_test_lead_id_users_id_fk" FOREIGN KEY ("test_lead_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "use_cases" ADD CONSTRAINT "use_cases_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_use_case_id_use_cases_id_fk" FOREIGN KEY ("use_case_id") REFERENCES "public"."use_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_steps" ADD CONSTRAINT "test_steps_test_case_id_test_cases_id_fk" FOREIGN KEY ("test_case_id") REFERENCES "public"."test_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assignments" ADD CONSTRAINT "project_assignments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assignments" ADD CONSTRAINT "project_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "step_results" ADD CONSTRAINT "step_results_execution_id_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."executions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "step_results" ADD CONSTRAINT "step_results_step_id_test_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."test_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_run_use_cases" ADD CONSTRAINT "test_run_use_cases_test_run_id_test_runs_id_fk" FOREIGN KEY ("test_run_id") REFERENCES "public"."test_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_run_use_cases" ADD CONSTRAINT "test_run_use_cases_use_case_id_use_cases_id_fk" FOREIGN KEY ("use_case_id") REFERENCES "public"."use_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_run_use_cases" ADD CONSTRAINT "test_run_use_cases_assigned_tester_id_users_id_fk" FOREIGN KEY ("assigned_tester_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bugs" ADD CONSTRAINT "bugs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bugs" ADD CONSTRAINT "bugs_defect_id_defects_id_fk" FOREIGN KEY ("defect_id") REFERENCES "public"."defects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bugs" ADD CONSTRAINT "bugs_assigned_developer_id_users_id_fk" FOREIGN KEY ("assigned_developer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_audit_log" ADD CONSTRAINT "status_audit_log_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "defects" ADD CONSTRAINT "defects_test_run_id_test_runs_id_fk" FOREIGN KEY ("test_run_id") REFERENCES "public"."test_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "defects" ADD CONSTRAINT "defects_test_case_id_test_cases_id_fk" FOREIGN KEY ("test_case_id") REFERENCES "public"."test_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "defects" ADD CONSTRAINT "defects_execution_id_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."executions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_discussions" ADD CONSTRAINT "team_discussions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_discussions" ADD CONSTRAINT "team_discussions_test_run_id_test_runs_id_fk" FOREIGN KEY ("test_run_id") REFERENCES "public"."test_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_discussions" ADD CONSTRAINT "team_discussions_initiated_by_user_id_users_id_fk" FOREIGN KEY ("initiated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "executions" ADD CONSTRAINT "executions_test_case_id_test_cases_id_fk" FOREIGN KEY ("test_case_id") REFERENCES "public"."test_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "executions" ADD CONSTRAINT "executions_test_run_id_test_runs_id_fk" FOREIGN KEY ("test_run_id") REFERENCES "public"."test_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "executions" ADD CONSTRAINT "executions_tester_id_users_id_fk" FOREIGN KEY ("tester_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_discussion_participants" ADD CONSTRAINT "team_discussion_participants_discussion_id_team_discussions_id_" FOREIGN KEY ("discussion_id") REFERENCES "public"."team_discussions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_discussion_participants" ADD CONSTRAINT "team_discussion_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "defect_notes" ADD CONSTRAINT "defect_notes_defect_id_defects_id_fk" FOREIGN KEY ("defect_id") REFERENCES "public"."defects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "defect_notes" ADD CONSTRAINT "defect_notes_discussion_id_team_discussions_id_fk" FOREIGN KEY ("discussion_id") REFERENCES "public"."team_discussions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "defect_notes" ADD CONSTRAINT "defect_notes_added_by_user_id_users_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
*/