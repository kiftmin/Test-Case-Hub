# Test Case Hub — Complete Application Build Prompt

## Overview

You are building **Test Case Hub**, a full-stack UAT Test Case Management System. This document is the single source of truth for the complete application — existing functionality plus all new features. Build the entire application from scratch based on this specification. Do not make assumptions; follow this document precisely.

---

## Tech Stack

- **Monorepo**: pnpm workspaces
- **Database**: PostgreSQL (via Neon), ORM: Drizzle ORM with `drizzle-zod` for schema validation
- **API Server**: Express 5, TypeScript, JWT authentication (`jsonwebtoken`), pino logging, Zod validation
- **Frontend**: React 18, TypeScript, Vite, Wouter (routing), TanStack Query, Tailwind CSS, shadcn/ui components
- **API Contract**: OpenAPI spec → generated client via Orval (React Query hooks + Zod types)
- **File Uploads**: multer, stored in `artifacts/api-server/uploads/`
- **Auth**: JWT stored in `localStorage`, sent as `Bearer` token in `Authorization` header. The API client must call `setAuthTokenGetter(getAuthToken)` at app startup in `main.tsx`.
- **Environment**: API server loads env from `artifacts/api-server/.env` via `node --env-file=.env`. Required vars: `DATABASE_URL`, `SESSION_SECRET` (used as JWT secret for both signing and verification — use the same variable in both `auth.ts` route and `middlewares/auth.ts`), `PORT`.

---

## Workspace Structure

```
/
├── lib/
│   ├── db/                    # Drizzle schema, migrations, seed
│   ├── api-zod/               # Zod types generated from OpenAPI
│   ├── api-spec/              # OpenAPI YAML + Orval config
│   └── api-client-react/      # Generated React Query hooks + custom fetch
├── artifacts/
│   ├── api-server/            # Express API
│   └── uat-manager/           # React frontend
```

---

## User Roles

There is only **one global role** (on the user record). All other roles are **project roles** appointed and managed by the Test Lead (or Admin) per project.

### Global Role (stored on `users.role`)
- `ADMIN` — System administrator. Full system access. Manages all users globally. Creates projects and assigns the Test Lead at project creation time. Can also change the Test Lead for a project at any time. All other users are stored with `role = 'USER'` globally — their functional role is determined entirely by their project assignment.

### Project Roles (stored on `project_assignments.role`)
All project roles are assigned by the Test Lead (or Admin). The Test Lead is the sole manager of a project's users and workflow.

- `TEST_LEAD` — Assigned by Admin at project creation (and changeable by Admin). Full control of the project: manages all project users, creates/edits/deletes Test Plans, manages Test Runs, manages the Defect Log and Bug List, signs off the project.
- `TEST_AUTHOR` — Appointed by the Test Lead. Can create, edit, and delete Use Cases, Test Cases, and Test Steps only. Cannot manage users, Test Runs, Defects, Bugs, or sign off the project.
- `BUSINESS_OWNER` — Appointed by the Test Lead. Can sign off the project, accept/reject defects, and add notes in Team Discussions.
- `TESTER` — Appointed by the Test Lead. Executes Test Cases in Test Runs. Can add notes to Test Case steps during execution. Can be invited as a viewer to Team Discussions.
- `DEVELOPER` — Appointed by the Test Lead. Read-only access to Test Plans, Use Cases, Test Cases, and completed Test Runs (for context). Full access to the Bug List — can see all project bugs, filter, update status of their own assigned bugs, and add notes. Can be invited as a viewer to Team Discussions.

### Permission Matrix

| Action | ADMIN | TEST_LEAD | TEST_AUTHOR | BUSINESS_OWNER | TESTER | DEVELOPER |
|---|---|---|---|---|---|---|
| Manage global users | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create project | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Assign / change Test Lead on project | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Edit / delete project metadata | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage project users (add/remove/assign roles) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create/edit/delete Use Cases, Test Cases, Test Steps | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| View Test Plans, Use Cases, Test Cases | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (read-only) |
| Create/manage Test Runs | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Execute Test Cases (Tester interface) | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Sign off project | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Manage Defect Log | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View Defect Log | ✅ | ✅ | ❌ | When invited | When invited | When invited |
| Manage Bug List | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View Bug List | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Update bug status / add bug notes | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ (own bugs) |
| Accept/reject defects | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |

---

## Database Schema

Use Drizzle ORM. All tables use `serial` primary keys. Use `timestamp` with `withTimezone: true`. All status fields are `text` (not enums). Use database migrations — do not drop existing tables.

### `users`
```
id, username (unique), password_hash, name, email,
role (ADMIN | USER, default USER), created_at
```
All non-admin users have `role = 'USER'` globally. Their functional permissions within a project are determined solely by their `project_assignments.role`.

### `projects`
```
id, project_code (unique, auto-generated "PRJ-XXXXXX"), name, designed_by,
module_name, design_date, test_link, version (default 1), version_date,
test_lead_id (FK → users.id), is_signed_off (integer, default 0),
sign_off_data (text/JSON), created_at, updated_at
```

### `project_assignments`
```
id, project_id (FK → projects, cascade), user_id (FK → users, cascade),
role (TEST_LEAD | TEST_AUTHOR | BUSINESS_OWNER | TESTER | DEVELOPER), assigned_at
```

### `use_cases`
```
id, project_id (FK → projects, cascade), code, name, created_at
```

### `test_cases`
```
id, use_case_id (FK → use_cases, cascade), case_number, title, created_at
```

### `test_steps`
```
id, test_case_id (FK → test_cases, cascade), step_number, instruction,
test_data, expected_result, created_at
```

### `attachments`
```
id, entity_type (text), entity_id (integer), field (text),
file_name, file_url, file_type, created_at
```

### `test_runs`
```
id, project_id (FK → projects, cascade), name,
status (scheduled | in_progress | completed, default scheduled),
scheduled_at, passed (boolean, nullable), source_test_run_id (nullable FK → test_runs),
created_at, updated_at
```

### `test_run_use_cases`
```
id, test_run_id (FK → test_runs, cascade), use_case_id (FK → use_cases, cascade),
assigned_tester_id (nullable FK → users, set null on delete),
free_pass (boolean, default false),
status (pending | in_progress | passed | failed | passed_by_agreement, default pending),
created_at
```

### `executions`
```
id, test_case_id (FK → test_cases, cascade),
test_run_id (nullable FK → test_runs, set null on delete),
iteration_number, tester_name, tester_id (nullable FK → users),
status (in_progress | completed | failed, default in_progress),
overall_result (passed | failed | passed_by_agreement, nullable),
notes (text, nullable), executed_at
```

### `step_results`
```
id, execution_id (FK → executions, cascade), step_id (FK → test_steps, cascade),
actual_result (text, nullable), comments (text, nullable),
passed (boolean, nullable), recorded_at
```

### `defects`
```
id, test_run_id (FK → test_runs, cascade),
test_case_id (FK → test_cases, cascade),
execution_id (FK → executions, cascade),
tester_notes (text, nullable),
status (New Defect | Submitted to Dev to Fix | Ready for Testing | Accepted by Business | Passed by Agreement),
retest_reason (text, nullable),          -- populated when flagged for retesting
accepted_by_business_note (text, nullable),  -- populated when Business Owner accepts
rejection_log (text/JSON, nullable),     -- log of all reject actions [{by, at, reason}]
created_at, updated_at
```

### `bugs`
```
id, project_id (FK → projects, cascade),
defect_id (FK → defects, cascade),
bug_number (integer, auto-increment per project),
support_ticket_number (text, nullable),
assigned_developer_id (nullable FK → users, set null on delete),
status (OPEN | ASSIGNED | RESOLVED | TEST | FAILED_TO_RESOLVE),
developer_notes (text, nullable),
failed_to_resolve_reason (text, nullable),
opened_at, assigned_at (nullable), resolved_at (nullable),
test_at (nullable), failed_to_resolve_at (nullable),
created_at, updated_at
```

### `status_audit_log`
```
id, entity_type (text: defect | bug), entity_id (integer),
changed_by_user_id (FK → users), from_status (text), to_status (text),
reason (text, nullable), changed_at
```

### `team_discussions`
```
id, project_id (FK → projects, cascade), test_run_id (FK → test_runs, cascade),
initiated_by_user_id (FK → users),
meeting_type (Defect Review | Post-Mortem),
is_active (boolean, default true),
created_at, ended_at (nullable)
```

### `team_discussion_participants`
```
id, discussion_id (FK → team_discussions, cascade),
user_id (FK → users, cascade),
can_add_notes (boolean, default false),
added_at
```

### `defect_notes`
```
id, defect_id (FK → defects, cascade),
discussion_id (nullable FK → team_discussions),
added_by_user_id (FK → users),
note (text), created_at
```

---

## API Endpoints

All protected routes require `Authorization: Bearer <token>`. The JWT is signed and verified using `process.env.SESSION_SECRET`.

### Auth
- `POST /api/auth/login` — `{ username, password }` → `{ token, user }`
- `POST /api/auth/register` — Admin only — `{ username, password, name, email, role }`

### Users
- `GET /api/users` — Admin only — list all users
- `POST /api/users` — Admin only — create user
- `PUT /api/users/:userId` — Admin only — update user
- `DELETE /api/users/:userId` — Admin only

### Projects
- `GET /api/projects` — list projects (filtered by user's assignments for non-admins)
- `POST /api/projects` — Admin only — `{ name, designedBy, moduleName, designDate, testLink, testLeadId }` — auto-generates project code, auto-increments version
- `GET /api/projects/:projectId` — full project detail including use cases, test cases, steps
- `GET /api/projects/code/:projectCode` — same as above, by code
- `PUT /api/projects/:projectId` — Admin or project TEST_LEAD
- `DELETE /api/projects/:projectId` — Admin only
- `POST /api/projects/:projectId/sign-off` — Test Lead or Business Owner

### Project Assignments
- `GET /api/projects/:projectId/users` — list project members with roles
- `POST /api/projects/:projectId/users` — Admin or project TEST_LEAD — `{ userId, role }` — valid project roles: `TEST_LEAD`, `TEST_AUTHOR`, `BUSINESS_OWNER`, `TESTER`, `DEVELOPER`
- `DELETE /api/projects/:projectId/users/:userId` — Admin or project TEST_LEAD

### Use Cases
- `GET /api/projects/:projectId/use-cases`
- `POST /api/projects/:projectId/use-cases` — Admin, project TEST_LEAD, or project TEST_AUTHOR — `{ code, name }`
- `PUT /api/use-cases/:useCaseId` — Admin, project TEST_LEAD, or project TEST_AUTHOR
- `DELETE /api/use-cases/:useCaseId` — Admin, project TEST_LEAD, or project TEST_AUTHOR

### Test Cases
- `GET /api/use-cases/:useCaseId/test-cases`
- `POST /api/use-cases/:useCaseId/test-cases` — Admin, project TEST_LEAD, or project TEST_AUTHOR
- `PUT /api/test-cases/:testCaseId` — Admin, project TEST_LEAD, or project TEST_AUTHOR
- `DELETE /api/test-cases/:testCaseId` — Admin, project TEST_LEAD, or project TEST_AUTHOR

### Test Steps
- `GET /api/test-cases/:testCaseId/steps`
- `POST /api/test-cases/:testCaseId/steps` — Admin, project TEST_LEAD, or project TEST_AUTHOR
- `POST /api/test-cases/:testCaseId/steps/bulk` — Admin, project TEST_LEAD, or project TEST_AUTHOR
- `PUT /api/test-steps/:stepId` — Admin, project TEST_LEAD, or project TEST_AUTHOR
- `DELETE /api/test-steps/:stepId` — Admin, project TEST_LEAD, or project TEST_AUTHOR

### Test Runs
- `GET /api/projects/:projectId/test-runs`
- `POST /api/projects/:projectId/test-runs` — Admin or project TEST_LEAD — `{ name, scheduledAt, useCaseIds? }` — if `useCaseIds` omitted, includes all use cases
- `GET /api/test-runs/:testRunId` — full detail with use cases and assignments
- `PATCH /api/test-runs/:testRunId` — Admin or project TEST_LEAD — update name, scheduledAt, status
- `PATCH /api/test-runs/:testRunId/use-cases/:testRunUseCaseId` — assign tester, free pass, status
- `POST /api/test-runs/:testRunId/use-cases` — add a use case to a non-completed run — Admin or project TEST_LEAD
- `DELETE /api/test-runs/:testRunId/use-cases/:testRunUseCaseId` — remove pending use case — Admin or project TEST_LEAD
- `POST /api/test-runs/:testRunId/use-cases/:useCaseId/sync` — recalculate use case status from executions
- `POST /api/test-runs/:testRunId/re-run` — Admin or project TEST_LEAD — `{ name, scheduledAt, failedOnly }`
- `GET /api/projects/:projectId/test-runs/analytics` — completed runs summary
- `GET /api/test-runs/:testRunId/full-report`

### Executions (Tester Interface)
- `GET /api/dashboard/tester/:userId/test-runs`
- `POST /api/test-runs/:testRunId/test-cases/:testCaseId/execute` — create execution
- `PATCH /api/executions/:executionId` — update status, result, notes
- `POST /api/executions/:executionId/steps/:stepId/result` — save step result
- `PUT /api/executions/:executionId/steps/:stepId/result` — update step result

### Defects
- `GET /api/test-runs/:testRunId/defects` — Test Lead + invited participants
- `GET /api/defects/:defectId` — detail including linked test case, execution, notes
- `PATCH /api/defects/:defectId/flag-bug` — Test Lead — moves defect to Bug List
- `PATCH /api/defects/:defectId/flag-retest` — Test Lead — `{ reason }` (required)
- `PATCH /api/defects/:defectId/flag-accepted-by-business` — Test Lead — flags for Business Owner action
- `PATCH /api/defects/:defectId/business-accept` — Business Owner — `{ note }` (required)
- `PATCH /api/defects/:defectId/business-reject` — Business Owner — `{ reason }` (optional)
- `POST /api/defects/:defectId/notes` — Test Lead, Business Owner, or delegated participant — `{ note }`

### Bugs
- `GET /api/projects/:projectId/bugs` — Test Lead and Developers — supports `?status=&developerId=&ticketNumber=` filters
- `GET /api/bugs/:bugId`
- `PATCH /api/bugs/:bugId/assign` — Test Lead — `{ developerId, supportTicketNumber? }`
- `PATCH /api/bugs/:bugId/status` — Test Lead or assigned Developer — `{ status, reason? }` — logs transition
- `PATCH /api/bugs/:bugId/notes` — Developer (own bugs) or Test Lead — `{ notes }`
- `PATCH /api/bugs/:bugId/reassign` — Test Lead — `{ developerId }` — used after FAILED_TO_RESOLVE

### Team Discussions
- `POST /api/test-runs/:testRunId/discussions` — Test Lead — `{ meetingType, participantIds }` — starts discussion
- `GET /api/discussions/:discussionId` — participants and defects in scope
- `POST /api/discussions/:discussionId/participants` — Test Lead — `{ userId, canAddNotes }`
- `DELETE /api/discussions/:discussionId/participants/:userId` — Test Lead
- `PATCH /api/discussions/:discussionId/end` — Test Lead — closes discussion
- `GET /api/discussions/:discussionId/defects/:defectId` — full drill-down: use case → test case instructions → tester results

### Dashboard
- `GET /api/dashboard/summary` — totals: projects, test cases, users, pass rate
- `GET /api/dashboard/recent-activity` — recent executions
- `GET /api/dashboard/developer/:userId/bugs` — Developer dashboard bug list

### Attachments & Uploads
- `POST /api/upload` — multipart file upload → returns `{ fileUrl, fileName, fileType }`
- `POST /api/attachments` — save attachment record
- `GET /api/attachments/:entityType/:entityId`
- `DELETE /api/attachments/:attachmentId`

### Health
- `GET /api/health`

---

## Business Logic

### Project Creation
The System Admin creates a project and must select a Test Lead (from globally registered users) at creation time. The Test Lead is stored both in `projects.test_lead_id` and automatically added to `project_assignments` with role `TEST_LEAD`.

### Test Run Lifecycle
Treat like a Scrum sprint: `scheduled` → `in_progress` → `completed`. A Test Run's overall `passed` field is recalculated each time a Use Case status changes to `passed` or `failed`. The run passes when every non-free-pass use case passes. The run is marked `completed` automatically when all use cases have a terminal status.

A `test_run_use_cases.status` of `passed_by_agreement` counts as passed for the purposes of overall run result calculation.

### Automatic Defect Creation
When a Test Case execution is marked as `failed` (either directly or because all steps are completed and at least one failed), the system automatically:
1. Creates a `defects` record with status `New Defect`, linked to the test run, test case, and execution.
2. Populates `tester_notes` from the execution's notes and step results comments.

### Defect Workflow

```
New Defect
  ├─→ [Test Lead: Flag as Bug] → Submitted to Dev to Fix → (Bug created, Bug status: OPEN)
  ├─→ [Test Lead: Flag for Retesting] → Ready for Testing (reason required)
  └─→ [Test Lead: Flag Accepted by Business]
        ├─→ [Business Owner: Accept] → Accepted by Business
        │     → linked test case in test run → passed_by_agreement
        └─→ [Business Owner: Reject] → Ready for Testing (logged)

Ready for Testing → available to Test Lead to add to a new Test Run
```

### Bug Lifecycle

```
OPEN (auto, when defect → bug)
  → ASSIGNED (Test Lead manually assigns Developer + optional support ticket)
  → RESOLVED (Developer marks when fix is ready)
  → TEST (Test Lead marks when deployed to test environment)
       → linked Defect status changes to "Ready for Testing"
  
From RESOLVED or TEST:
  → FAILED_TO_RESOLVE (Developer, reason required)
       ├─→ [Test Lead: Escalate to Business] → same "Accepted by Business" flow
       └─→ [Test Lead: Reassign] → status back to ASSIGNED, new developer

Bug Number: auto-increment per project (1, 2, 3…)
Support Ticket Number: free-text, manually assigned by Test Lead, no validation
```

All status transitions on both Defects and Bugs must be logged to `status_audit_log` with: entity type, entity id, changed_by user id, from status, to status, reason (if applicable), timestamp.

### "Passed by Agreement" — Sign-off Document Impact
When a Test Case is flagged `passed_by_agreement`, the parent Use Case in the Test Run is also considered `passed_by_agreement`. In the sign-off document:
- A Use Case where all Test Cases passed normally → shows **Passed**
- A Use Case where one or more Test Cases are `passed_by_agreement` → shows **Passed by Agreement**
- For each such Test Case, the sign-off document must explicitly list: Test Case name/reference + the Business Owner's acceptance note.

### Team Discussion
The Test Lead initiates a Team Discussion from the Defect Log for a specific Test Run. They select:
- **Meeting Type**: `Defect Review` or `Post-Mortem`
- **Participants**: users to invite

Default invitees by type:
- **Defect Review**: Developers invited by default (viewer). Business Owners and Testers not invited by default but can be added.
- **Post-Mortem**: Business Owners invited by default (with note-adding permission). Developers and Testers can be invited (viewer).

Permissions during a discussion:
- Test Lead: can always add notes.
- Business Owner: can add notes if invited.
- Developer: viewer by default; Test Lead can delegate note-adding permission.
- Tester: viewer by default; Business Owner can delegate note-adding permission.
- Delegations are per-discussion only (stored in `team_discussion_participants.can_add_notes`).

Viewers can drill down into any Defect to see: full Use Case detail → Test Case instructions (steps, expected results) → Tester's actual results and notes from the Test Run.

A Team Discussion is not a persistent scheduled meeting object — it is a live access-control context on the Defect Log. It has no date, attendee list, or minutes.

---

## Frontend Pages & Components

### Routing (Wouter)

```
/                          → Dashboard (role-aware)
/login                     → Login page
/users                     → User Management (Admin only)
/projects                  → Projects List
/projects/new              → Create Project (Admin only)
/projects/:id              → Project Detail (Test Plan view)
/projects/:id/edit         → Edit Project
/projects/:id/stats        → Project Stats
/projects/:id/users        → Project User Management
/projects/:id/test-runs    → Test Run List
/projects/:id/test-runs/:runId          → Test Run Detail
/projects/:id/test-runs/:runId/defects  → Defect Log
/projects/:id/bugs         → Bug List
/tester                    → Tester Login (enter project code)
/tester/dashboard          → Tester Dashboard
/tester/:projectCode       → Test Execution View
```

### Dashboard (role-aware)
Render different content based on the logged-in user's global role and project roles:

- **Admin / Test Lead view**: Total Projects, Total Test Cases, Total Users, Pass Rate. Recent Executions feed.
- **Developer view**: Bug list widget showing all bugs assigned to them across all projects. Columns: Bug #, Support Ticket #, Project, Test Case, Status, Last Updated. Can change status and add notes inline. Filterable by status.
- **Tester view**: Assigned Test Runs with countdown to start time, pending use case count.

When creating a user, the Admin selects a global role: `ADMIN`, `AUTHOR`, or `TESTER`. The `AUTHOR` role is displayed as "Test Author" in the UI. The Users page shows all users with their global role, displayed with distinct colour badges: purple for ADMIN, blue for AUTHOR, green for TESTER.

### Login Page
Single login for all roles. After login, redirect to Dashboard. No separate "Tester Login" that only uses a project code — all users log in via username/password. The tester project-code entry is for accessing the execution interface once logged in.

### Project Creation Form
Fields: Project Name, Designed By, Module Name, Design Date, Test Link (optional), **Test Lead** (dropdown of all registered users — required). Auto-generates Project Code. Admin only. The selected Test Lead is stored in `projects.test_lead_id` and automatically added to `project_assignments` with role `TEST_LEAD`.

### Project Detail (Test Plan)
Hierarchical tree view: Use Cases → Test Cases → Test Steps. Create/edit/delete is available to Admin, users with project role `TEST_LEAD`, and users with project role `TEST_AUTHOR`. All other roles are read-only. Attachments per step field (instruction, test data, expected result).

### Test Run Detail
Shows use cases in the run, assigned testers, statuses, free pass toggles. Admin and Test Lead can manage. Shows link to Defect Log when run has defects.

### Defect Log Page (`/projects/:id/test-runs/:runId/defects`)
Only visible to Test Lead, Admin, and users with active Team Discussion invitations. Shows all defects for the run. Each defect shows: linked Test Case, Tester's notes, current status, action buttons based on role.

Test Lead action buttons per defect:
- **Flag as Bug** (when status is `New Defect`)
- **Flag for Retesting** (when status is `New Defect` or `Ready for Testing`) — opens modal with required free-text reason
- **Flag Accepted by Business** (when status is `New Defect` or `Ready for Testing`)
- **Start Team Discussion** (button at page level, not per defect)

Business Owner action buttons (when status is `Accepted by Business` and they are the project's Business Owner):
- **Accept** — opens modal with required free-text note
- **Reject** — opens modal with optional reason field

Defect drill-down (for all viewers in an active discussion): clicking a defect expands to show full use case context: test case steps with instructions and expected results, and the tester's actual results and comments per step.

Note-adding panel: visible to Test Lead, Business Owner, and any participant with `canAddNotes: true`. Shows existing notes thread and a text input.

### Bug List Page (`/projects/:id/bugs`)
Visible to Test Lead, Admin, and Developers. Shows all bugs for the project.

Columns: Bug #, Support Ticket #, Test Case, Assigned Developer, Status, Opened At, last status change datetime.

Filters: Status, Assigned Developer, Support Ticket #.

Test Lead actions per bug:
- Assign developer (dropdown of project developers) + enter support ticket number
- Change status to TEST
- Reassign after FAILED_TO_RESOLVE
- Escalate to Business Owner (triggers Accepted by Business flow on linked defect)

Developer actions on their bugs:
- Mark RESOLVED (with notes)
- Mark FAILED_TO_RESOLVE (required reason field)
- Add/edit notes

### Sign-off Certificate
Triggered from Project Detail. Validates that a completed Test Run exists. Shows:
- Project details and metadata
- Sign-off status (Test Lead + Business Owner signatures)
- Compliance confirmations (checklist)
- Last Test Run results per Use Case
  - Status: `Passed`, `Passed by Agreement`, or `Failed`
  - For any `Passed by Agreement` Use Case: expand to list each such Test Case with the Business Owner's acceptance note
- Open issues / accepted workarounds section (for any remaining failed use cases accepted for post-release fix)

Both the **Test Lead** and **Business Owner** must sign off. Track both signatures in `sign_off_data` JSON on the project. The sign-off is complete when both have signed.

### Team Discussion UI
Accessible from the Defect Log page via "Start Team Discussion" button (Test Lead only). Opens a modal to select:
- Meeting Type: `Defect Review` or `Post-Mortem`
- Participants: multi-select of project users

While a discussion is active, an indicator banner appears on the Defect Log. The Test Lead can manage participants and end the discussion from this interface. Participants see the Defect Log with their permitted level of access (notes panel visible if `canAddNotes: true`).

---

## Tester Interface

The Tester Interface is a streamlined, mobile-responsive execution view.

### Tester Dashboard (`/tester/dashboard`)
Shows assigned Test Runs for the logged-in tester. Each card shows: project name, run name, scheduled date, countdown timer, number of assigned use cases, pending count. A "Start Testing" button becomes active when the run is available (scheduled time reached).

### Test Execution View (`/tester/:projectCode`)
- Shows the Test Link with a "Share to Mobile" button
- Lists assigned Use Cases → Test Cases → Test Steps
- Per Test Case: iteration number (auto-assigned), tester name (pre-filled from login)
- Per Test Step: Actual Result (text + file attachment), Comments (text + file attachment), Pass/Fail toggle
- On completion of a Test Case, set status and trigger sync to update the Test Run use case status
- If a Test Case is failed, the system automatically creates a Defect in the background

---

## API Client Setup

In `lib/api-client-react/src/custom-fetch.ts`, implement a `setAuthTokenGetter(fn)` function that stores a callback used by all API calls to inject the `Authorization: Bearer <token>` header.

In `artifacts/uat-manager/src/main.tsx`:
```ts
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { getAuthToken } from "./lib/auth";
setAuthTokenGetter(getAuthToken);
```

---

## Auth Middleware

In `artifacts/api-server/src/middlewares/auth.ts`:
```ts
const JWT_SECRET = process.env.SESSION_SECRET || "fallback_secret";
```

In `artifacts/api-server/src/routes/auth.ts`:
```ts
const JWT_SECRET = process.env.SESSION_SECRET || "fallback_secret";
```

Both files **must** use `SESSION_SECRET`. Never mix `JWT_SECRET` and `SESSION_SECRET`.

The JWT payload must include: `{ userId, username, role }`.

---

## General Implementation Rules

1. **All status transitions** on Defects and Bugs must write a record to `status_audit_log`.
2. **All substantiation/reason fields** described as required are mandatory — validate server-side with Zod and return 400 if missing.
3. **Do not break** any functionality described in this document when implementing other parts.
4. **Apply all permission checks** consistently in both API middleware (route-level `authenticate` + `authorize`) and frontend (hide/show UI elements based on role).
5. **Database migrations** — never drop or truncate existing tables. Add new columns, tables, and constraints only.
6. **Auto-increment Bug Number per project**: when inserting a bug, query `MAX(bug_number)` for that project and add 1.
7. **Notification model**: there is no email or push notification system. "Notifications" are implemented as UI indicators — e.g., a badge on the Business Owner's project view showing defects awaiting their action (`Accepted by Business` status).
8. **File uploads**: use multer. Store files in `artifacts/api-server/uploads/`. Return a relative URL. Support image, PDF, DOCX, XLSX file types.
9. **Versioning**: increment `projects.version` and update `projects.version_date` on every project update (PUT).
10. **Project code generation**: `PRJ-` + 6 random alphanumeric characters (uppercase).
11. **The `OWNER` role** — if it exists in any legacy code, replace it with `BUSINESS_OWNER` everywhere: database values, backend checks, frontend labels.
12. **The `AUTHOR` role** — this is a kept global role (`users.role = 'AUTHOR'`), displayed in the UI as "Test Author". Do NOT rename or remove it. Ensure it is present in all role dropdowns when creating users, and that its permissions (test design write access, test run management) are enforced consistently in both API middleware and frontend.
13. **`test_run_use_cases.status`** must support `passed_by_agreement` as a valid value in addition to the existing values.
14. All API responses must serialize timestamps as ISO-8601 strings.
