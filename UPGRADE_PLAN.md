# Test Case Hub — Upgrade Plan

This document details every step required to upgrade the existing Test Case Hub application to match the complete specification in `TestCaseHub_Complete_Build_Prompt.md`. Each step is structured as an actionable to-do with the specific files to modify and the exact changes needed.

---

## Task Breakdown (Implementation Order)

| Task | Plan Steps | Description | Status |
|------|-----------|-------------|--------|
| **1** | §1 | DB schema — 6 new tables + modify existing (executions, projects, users) | ✅ Done |
| **2** | §2 | Role migration script + seed updates + run migration | ✅ Done |
| **3** | §3, §5, §26 | Auth middleware (SESSION_SECRET, project-role helper) + register + user edit/delete API | ⬜ |
| **4** | §7, §8, §10, §13 | Defect + Bug API routes + attachments list + auto-defect on execution | ⬜ |
| **5** | §9, §11 | Team Discussion API + Developer bug dashboard API | ⬜ |
| **6** | §6, §12, §14 | Projects API (test lead, permissions) + dual sign-off + passed_by_agreement | ⬜ |
| **7** | §4, §15 | OpenAPI spec update + codegen + typecheck | ⬜ |
| **8** | §16, §17, §18, §19 | Frontend: role badges, user mgmt, project forms, project users | ⬜ |
| **9** | §20 | Frontend: Defect Log page | ⬜ |
| **10** | §21 | Frontend: Bug List page | ⬜ |
| **11** | §22 | Frontend: Team Discussion UI | ⬜ |
| **12** | §23, §24, §25 | Frontend: Dashboard (dev widget), Sign-off updates, Tester inline defects | ⬜ |

---

## Table of Contents

1. [Database Schema Upgrades](#1-database-schema-upgrades)
2. [Role Migration & Seed Updates](#2-role-migration--seed-updates)
3. [Auth & Middleware Overhaul](#3-auth--middleware-overhaul)
4. [OpenAPI Spec Expansion](#4-openapi-spec-expansion)
5. [API Route: Auth (Register & User Management)](#5-api-route-auth-register--user-management)
6. [API Route: Projects (Test Lead, Permissions)](#6-api-route-projects-test-lead-permissions)
7. [API Routes: Defects (Full CRUD + Workflow)](#7-api-routes-defects-full-crud--workflow)
8. [API Routes: Bugs (Full CRUD + Lifecycle)](#8-api-routes-bugs-full-crud--lifecycle)
9. [API Routes: Team Discussions](#9-api-routes-team-discussions)
10. [API Route: Attachments (List endpoint)](#10-api-route-attachments-list-endpoint)
11. [API Route: Dashboard (Developer Bug Widget)](#11-api-route-dashboard-developer-bug-widget)
12. [API Route: Sign-Off (Dual Signature)](#12-api-route-sign-off-dual-signature)
13. [API Route: Executions (Auto Defect Creation)](#13-api-route-executions-auto-defect-creation)
14. [API Route: Test Runs (passed_by_agreement)](#14-api-route-test-runs-passed_by_agreement)
15. [Regenerate API Client](#15-regenerate-api-client)
16. [Frontend: Role Badges & Navigation Updates](#16-frontend-role-badges--navigation-updates)
17. [Frontend: User Management (Edit/Delete, AUTHOR role)](#17-frontend-user-management-editdelete-author-role)
18. [Frontend: Project Creation (Test Lead Dropdown)](#18-frontend-project-creation-test-lead-dropdown)
19. [Frontend: Project Users (New Roles)](#19-frontend-project-users-new-roles)
20. [Frontend: Defect Log Page](#20-frontend-defect-log-page)
21. [Frontend: Bug List Page](#21-frontend-bug-list-page)
22. [Frontend: Team Discussion UI](#22-frontend-team-discussion-ui)
23. [Frontend: Dashboard (Developer Widget, Role Awareness)](#23-frontend-dashboard-developer-widget-role-awareness)
24. [Frontend: Sign-Off (Dual Signature + Passed by Agreement)](#24-frontend-sign-off-dual-signature--passed-by-agreement)
25. [Frontend: Tester Interface (Inline Defect Reporting)](#25-frontend-tester-interface-inline-defect-reporting)
26. [Auth Token SESSION_SECRET Alignment](#26-auth-token-session_secret-alignment)
27. [Verification & Testing](#27-verification--testing)

---

## 1. Database Schema Upgrades

### Files to modify
- `lib/db/src/schema/executions.ts`
- `lib/db/src/schema/project-assignments.ts`
- `lib/db/src/schema/users.ts`
- `lib/db/src/schema/projects.ts`
- `lib/db/src/schema/relations.ts`
- `lib/db/src/schema/index.ts`

### Files to create
- `lib/db/src/schema/defects.ts`
- `lib/db/src/schema/bugs.ts`
- `lib/db/src/schema/status-audit-log.ts`
- `lib/db/src/schema/team-discussions.ts`
- `lib/db/src/schema/team-discussion-participants.ts`
- `lib/db/src/schema/defect-notes.ts`

### Step 1.1: Add missing columns to `executions.table`

Add three columns to the existing `executionsTable`:
- `testerId` — `integer("tester_id")` nullable FK → `usersTable.id` (on delete set null)
- `overallResult` — `text("overall_result)` nullable (values: `passed`, `failed`, `passed_by_agreement`)
- `notes` — `text("notes")` nullable

### Step 1.2: Update `projects.table` to add `test_lead_id`

Add to `projectsTable`:
- `testLeadId` — `integer("test_lead_id")` nullable FK → `usersTable.id` (on delete set null)

Update the `CreateProjectBody` schema (in `api-zod` later) to include `testLeadId` as required.

### Step 1.3: Create `defects.table`

```ts
export const defectsTable = pgTable("defects", {
  id: serial("id").primaryKey(),
  testRunId: integer("test_run_id").notNull().references(() => testRunsTable.id, { onDelete: "cascade" }),
  testCaseId: integer("test_case_id").notNull().references(() => testCasesTable.id, { onDelete: "cascade" }),
  executionId: integer("execution_id").notNull().references(() => executionsTable.id, { onDelete: "cascade" }),
  testerNotes: text("tester_notes"),
  status: text("status").notNull().default("New Defect"),
  retestReason: text("retest_reason"),
  acceptedByBusinessNote: text("accepted_by_business_note"),
  rejectionLog: text("rejection_log"), // JSON array [{by, at, reason}]
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});
```

### Step 1.4: Create `bugs.table`

```ts
export const bugsTable = pgTable("bugs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  defectId: integer("defect_id").notNull().references(() => defectsTable.id, { onDelete: "cascade" }),
  bugNumber: integer("bug_number").notNull(),
  supportTicketNumber: text("support_ticket_number"),
  assignedDeveloperId: integer("assigned_developer_id").references(() => usersTable.id, { onDelete: "set null" }),
  status: text("status").notNull().default("OPEN"),
  developerNotes: text("developer_notes"),
  failedToResolveReason: text("failed_to_resolve_reason"),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
  assignedAt: timestamp("assigned_at", { withTimezone: true }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  testAt: timestamp("test_at", { withTimezone: true }),
  failedToResolveAt: timestamp("failed_to_resolve_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});
```

### Step 1.5: Create `status_audit_log.table`

```ts
export const statusAuditLogTable = pgTable("status_audit_log", {
  id: serial("id").primaryKey(),
  entityType: text("entity_type").notNull(), // 'defect' | 'bug'
  entityId: integer("entity_id").notNull(),
  changedByUserId: integer("changed_by_user_id").notNull().references(() => usersTable.id),
  fromStatus: text("from_status").notNull(),
  toStatus: text("to_status").notNull(),
  reason: text("reason"),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### Step 1.6: Create `team_discussions.table`

```ts
export const teamDiscussionsTable = pgTable("team_discussions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  testRunId: integer("test_run_id").notNull().references(() => testRunsTable.id, { onDelete: "cascade" }),
  initiatedByUserId: integer("initiated_by_user_id").notNull().references(() => usersTable.id),
  meetingType: text("meeting_type").notNull(), // 'Defect Review' | 'Post-Mortem'
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});
```

### Step 1.7: Create `team_discussion_participants.table`

```ts
export const teamDiscussionParticipantsTable = pgTable("team_discussion_participants", {
  id: serial("id").primaryKey(),
  discussionId: integer("discussion_id").notNull().references(() => teamDiscussionsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  canAddNotes: boolean("can_add_notes").notNull().default(false),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### Step 1.8: Create `defect_notes.table`

```ts
export const defectNotesTable = pgTable("defect_notes", {
  id: serial("id").primaryKey(),
  defectId: integer("defect_id").notNull().references(() => defectsTable.id, { onDelete: "cascade" }),
  discussionId: integer("discussion_id").references(() => teamDiscussionsTable.id),
  addedByUserId: integer("added_by_user_id").notNull().references(() => usersTable.id),
  note: text("note").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### Step 1.9: Add relations to `relations.ts`

Add bidirectional relations for all 6 new tables:
- `defects` ↔ `test_runs`, `test_cases`, `executions`, `defect_notes`, `bugs`
- `bugs` ↔ `projects`, `defects`, `users` (assignedDeveloper)
- `team_discussions` ↔ `projects`, `test_runs`, `users` (initiator), `team_discussion_participants`
- `team_discussion_participants` ↔ `team_discussions`, `users`
- `defect_notes` ↔ `defects`, `team_discussions`, `users`
- `status_audit_log` ↔ `users` (changedBy)

### Step 1.10: Update `schema/index.ts`

Re-export all new tables and types from the new schema files.

### Step 1.11: Push schema migration

Run `pnpm run push` from `lib/db/` to apply new tables and columns to the database.

---

## 2. Role Migration & Seed Updates

### Step 2.1: Update `users.table` default role

In `lib/db/src/schema/users.ts`:
- Change default role from `"TESTER"` to `"USER"`
- Comment: `// ADMIN, AUTHOR, USER — global roles`

### Step 2.2: Create role migration script

Create `lib/db/migrate_roles.ts` that:
1. Updates `users.role` from `'OWNER'` to `'ADMIN'` (OWNER was legacy, map to ADMIN)
2. Updates `project_assignments.role` from `'OWNER'` to `'BUSINESS_OWNER'`
3. Updates `project_assignments.role` from `'AUTHOR'` to `'TEST_AUTHOR'`
4. Adds new project roles where missing

### Step 2.3: Update seed file

In `lib/db/seed_users.ts`:
- Add a user with `role: 'AUTHOR'` (global AUTHOR role for test authoring)
- Add a user with `role: 'USER'` (default role for non-admin users)
- Update existing users to use correct roles per new schema

---

## 3. Auth & Middleware Overhaul

### Files to modify
- `artifacts/api-server/src/middlewares/auth.ts`
- `artifacts/api-server/src/routes/auth.ts`
- `artifacts/api-server/src/types/index.ts` (create if not exists)

### Step 3.1: Unify JWT secret to SESSION_SECRET

In `middlewares/auth.ts`:
- Change line 4 from `const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";`
- To: `const JWT_SECRET = process.env.SESSION_SECRET || "fallback_secret";`

In `routes/auth.ts`:
- Change line 9 from `const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || "fallback_secret";`
- To: `const JWT_SECRET = process.env.SESSION_SECRET || "fallback_secret";`

### Step 3.2: Add project-level role checking middleware

Create a new middleware or helper function `authorizeProjectRole(roles: string[])` that:
- Takes the `projectId` from `req.params`
- Looks up the user's project assignment role from `project_assignments`
- Returns 403 if the user's project role is not in the allowed list
- Supports both global ADMIN (bypasses project check) and project role checking

### Step 3.3: Update the `authenticate` skip list

Add `/auth/register` to the public skip list in the `authenticate` middleware.

### Step 3.4: Update AuthUser interface

Expand the `AuthUser` interface to also accept the new global roles:
```ts
role: 'ADMIN' | 'AUTHOR' | 'USER';
```

---

## 4. OpenAPI Spec Expansion

### File to modify
- `lib/api-spec/openapi.yaml`

### Step 4.1: Add missing tags

Add tags for: `auth`, `defects`, `bugs`, `team-discussions`, `users` (for register/update/delete)

### Step 4.2: Add new endpoint definitions

Add all missing endpoints to the OpenAPI spec:

- `POST /auth/register`
- `PUT /users/{userId}`
- `DELETE /users/{userId}`
- All Defect endpoints (7)
- All Bug endpoints (6)
- All Team Discussion endpoints (6)
- `GET /attachments/{entityType}/{entityId}`
- `GET /dashboard/developer/{userId}/bugs`
- `POST /projects/{projectId}/sign-off`
- `POST /upload`

### Step 4.3: Add new schemas

Add to `components/schemas`:
- `Defect`, `CreateDefectBody`, `UpdateDefectBody`, `FlagBugBody`, `FlagRetestBody`, `BusinessAcceptBody`, `BusinessRejectBody`, `DefectNote`
- `Bug`, `AssignBugBody`, `UpdateBugStatusBody`, `UpdateBugNotesBody`, `ReassignBugBody`
- `TeamDiscussion`, `CreateDiscussionBody`, `AddParticipantBody`
- `StatusAuditLogEntry`
- All request/response types for the new endpoints

### Step 4.4: Update existing schemas

- `CreateProjectBody` — add `testLeadId: integer` (required)
- `TestProject` — add `testLeadId: integer`
- `TestRunUseCase` — expand `status` enum to include `passed_by_agreement`
- `CreateExecutionBody` — add `notes: string` (optional)
- `LoginResponse` — ensure it includes `user.role`

---

## 5. API Route: Auth (Register & User Management)

### Files to create/modify
- `artifacts/api-server/src/routes/auth.ts` (add register)
- `artifacts/api-server/src/routes/users.ts` (add update/delete)

### Step 5.1: Add `POST /auth/register`

In `routes/auth.ts`, add:
```ts
router.post("/register", authenticate, authorize(['ADMIN']), async (req, res) => {
  // Validate body: { username, password, name, email?, role }
  // Check duplicate username → 409
  // Hash password with bcrypt
  // Insert user
  // Return 201 with user (no passwordHash)
});
```

### Step 5.2: Add `PUT /users/:userId`

In `routes/users.ts`, add Admin-only endpoint to update user fields (name, email, role).

### Step 5.3: Add `DELETE /users/:userId`

In `routes/users.ts`, add Admin-only endpoint to delete a user.

---

## 6. API Route: Projects (Test Lead, Permissions)

### File to modify
- `artifacts/api-server/src/routes/projects.ts`

### Step 6.1: Update `POST /projects` to accept testLeadId

- Add `testLeadId` to the Zod validation body
- On project creation, also insert into `project_assignments` with role `'TEST_LEAD'`
- Update response to include `testLeadId`

### Step 6.2: Update permission checks

- `PUT /projects/:projectId`: Change `authorize(['ADMIN', 'AUTHOR'])` to check for project-level TEST_LEAD role using the new `authorizeProjectRole(['TEST_LEAD'])` helper, or ADMIN global role.
- `DELETE /projects/:projectId`: Keep Admin-only, remove `AUTHOR` from allowed roles.
- `POST /projects/:projectId/sign-off`: Add authenticate + proper authorization.

### Step 6.3: Update put and delete to use correct roles

- `PUT`: Allow ADMIN (global) or TEST_LEAD (project)
- `DELETE`: Allow ADMIN only
- Add testLeadId to `buildProjectDetail` response

### Step 6.4: Update test_lead_id validation on sign-off

Routes using sign-off logic should verify the user is either Admin, Test Lead, or Business Owner (not just "OWNER").

---

## 7. API Routes: Defects (Full CRUD + Workflow)

### File to create
- `artifacts/api-server/src/routes/defects.ts`

### Step 7.1: Mount the router

In `routes/index.ts`, add `router.use("/api", defectsRouter)`.

### Step 7.2: Implement all defect endpoints

Implement all 7 endpoints with full Zod validation, permission checks, and audit logging:

#### `GET /test-runs/:testRunId/defects`
- Permission: Test Lead, Admin, or active discussion participant
- Returns all defects for a test run with linked test case, execution, notes

#### `GET /defects/:defectId`
- Permission: Test Lead, Admin, or discussion participant
- Returns full detail including linked test case, execution, notes

#### `PATCH /defects/:defectId/flag-bug`
- Permission: Test Lead or Admin
- Validates current status is `New Defect`
- Creates a bug record with auto-incremented `bugNumber` per project
- Updates defect status to `Submitted to Dev to Fix`
- Logs status transition to `status_audit_log`

#### `PATCH /defects/:defectId/flag-retest`
- Permission: Test Lead or Admin
- Requires `{ reason }` in body (Zod validation — required)
- Validates current status is `New Defect` or `Ready for Testing`
- Updates defect status to `Ready for Testing`
- Logs status transition

#### `PATCH /defects/:defectId/flag-accepted-by-business`
- Permission: Test Lead or Admin
- Validates current status is `New Defect` or `Ready for Testing`
- Updates defect status to `Accepted by Business`
- Logs status transition

#### `PATCH /defects/:defectId/business-accept`
- Permission: Business Owner (check project role)
- Requires `{ note }` in body (Zod validation — required)
- Updates defect status to `Accepted by Business`
- Marks linked test case in the test run → `passed_by_agreement`
- Logs status transition

#### `PATCH /defects/:defectId/business-reject`
- Permission: Business Owner (check project role)
- Accepts optional `{ reason }`
- Updates defect status back to `Ready for Testing`
- Records rejection in `rejectionLog` (JSON array push)
- Logs status transition

#### `POST /defects/:defectId/notes`
- Permission: Test Lead, Business Owner, or participant with `canAddNotes: true`
- Requires `{ note }` and optional `{ discussionId }`
- Inserts into `defect_notes`

---

## 8. API Routes: Bugs (Full CRUD + Lifecycle)

### File to create
- `artifacts/api-server/src/routes/bugs.ts`

### Step 8.1: Mount the router

In `routes/index.ts`.

### Step 8.2: Implement all bug endpoints

#### `GET /projects/:projectId/bugs`
- Permission: Test Lead, Admin, or Developer (project role)
- Supports query filters: `?status=&developerId=&ticketNumber=`
- Returns all bugs for project with linked defect info

#### `GET /bugs/:bugId`
- Permission: Test Lead, Admin, or Developer
- Returns full bug detail with audit log entries

#### `PATCH /bugs/:bugId/assign`
- Permission: Test Lead or Admin
- Required body: `{ developerId }`, optional: `{ supportTicketNumber }`
- Updates assignedDeveloperId, supportTicketNumber
- Sets status to `ASSIGNED`, sets assignedAt
- Logs transition

#### `PATCH /bugs/:bugId/status`
- Permission: Test Lead/Admin (any status) or assigned Developer (limited: RESOLVED, FAILED_TO_RESOLVE)
- Required body: `{ status }`, optional: `{ reason }`
- Business logic per status transition per spec
- Logs every transition with reason and timestamps

#### `PATCH /bugs/:bugId/notes`
- Permission: assigned Developer or Test Lead/Admin
- Required body: `{ notes }`
- Updates developerNotes

#### `PATCH /bugs/:bugId/reassign`
- Permission: Test Lead or Admin
- Used after FAILED_TO_RESOLVE
- Updates assignedDeveloperId, resets status to ASSIGNED
- Logs transition

---

## 9. API Routes: Team Discussions

### File to create
- `artifacts/api-server/src/routes/team-discussions.ts`

### Step 9.1: Mount the router

### Step 9.2: Implement all team discussion endpoints

#### `POST /test-runs/:testRunId/discussions`
- Permission: Test Lead or Admin
- Required body: `{ meetingType, participantIds }`
- Creates discussion, adds participants with default permissions per spec
- Default: Defect Review → Developers as viewers; Post-Mortem → Business Owners with note-adding

#### `GET /discussions/:discussionId`
- Permission: participant or Admin/Test Lead
- Returns discussion with participants and linked defects

#### `POST /discussions/:discussionId/participants`
- Permission: Test Lead or Admin
- Required body: `{ userId, canAddNotes }`

#### `DELETE /discussions/:discussionId/participants/:userId`
- Permission: Test Lead or Admin

#### `PATCH /discussions/:discussionId/end`
- Permission: Test Lead or Admin
- Sets isActive = false, endedAt = now

#### `GET /discussions/:discussionId/defects/:defectId`
- Permission: Any participant
- Full drill-down: use case → test case instructions → tester results

---

## 10. API Route: Attachments (List endpoint)

### File to modify
- `artifacts/api-server/src/routes/attachments.ts`

### Step 10.1: Add `GET /attachments/:entityType/:entityId`

List all attachments for a given entity type and ID.

---

## 11. API Route: Dashboard (Developer Bug Widget)

### File to modify
- `artifacts/api-server/src/routes/dashboard.ts`

### Step 11.1: Add `GET /dashboard/developer/:userId/bugs`

Returns all bugs assigned to a developer across all projects, with project name, test case, status, last updated.

---

## 12. API Route: Sign-Off (Dual Signature)

### File to modify
- `artifacts/api-server/src/routes/projects.ts`

### Step 12.1: Rewrite sign-off endpoint

Replace the current single-signer sign-off with dual-signature logic:

1. Accept `{ userId, role }` to identify who is signing (Test Lead or Business Owner)
2. Check the user's project role matches their claim
3. Store partial signature in `sign_off_data` JSON
4. Track both `testLeadSigned` and `businessOwnerSigned` booleans
5. Only set `isSignedOff = 1` when both have signed
6. Return current signature status

The `sign_off_data` JSON structure should be:
```json
{
  "testLead": { "signedBy": "...", "signedAt": "..." },
  "businessOwner": { "signedBy": "...", "signedAt": "...", "note": "..." },
  "lastTestRunId": 123,
  "openIssues": [...]
}
```

### Step 12.2: Add `GET /projects/:projectId/sign-off-status`

Return current sign-off status (who has signed, who still needs to sign).

---

## 13. API Route: Executions (Auto Defect Creation)

### File to modify
- `artifacts/api-server/src/routes/executions.ts`

### Step 13.1: Add auto defect creation on test failure

In the `PUT /executions/:executionId` endpoint (or in `POST /test-cases/:testCaseId/execute`):
- When a test case execution is marked as failed (either `overallResult = 'failed'` or status is such):
  1. Check if a defect already exists for this execution (avoid duplicates)
  2. If not, create a `defects` record with status `New Defect`
  3. Populate `testerNotes` from the execution's notes and step results comments
  4. Link to the test run, test case, and execution

---

## 14. API Route: Test Runs (passed_by_agreement)

### File to modify
- `artifacts/api-server/src/routes/test-runs.ts`

### Step 14.1: Allow `passed_by_agreement` status

- Update the Zod validation schemas for `PATCH /test-runs/:testRunId/use-cases/:testRunUseCaseId` to accept `passed_by_agreement` as a valid status
- Update `recalculateTestRunResult()` to treat `passed_by_agreement` as passed
- Update the `sync` endpoint to support `passed_by_agreement`

---

## 15. Regenerate API Client

### Step 15.1: Run Orval codegen

```bash
cd lib/api-spec
pnpm run codegen
```

This regenerates:
- All Zod schemas in `lib/api-zod/src/generated/`
- All React Query hooks in `lib/api-client-react/src/generated/`

### Step 15.2: Verify typecheck passes

```bash
pnpm run typecheck:libs
```

Fix any type errors caused by schema changes.

---

## 16. Frontend: Role Badges & Navigation Updates

### Files to modify
- `artifacts/uat-manager/src/components/layout/Sidebar.tsx`
- `artifacts/uat-manager/src/pages/Users.tsx`
- `artifacts/uat-manager/src/lib/auth.ts`

### Step 16.1: Update role display mapping

Create a role display map:
- `ADMIN` → `"Admin"`, color `purple`
- `AUTHOR` → `"Test Author"`, color `blue`
- `USER` → `"User"`, color `gray`
- `TESTER` → `"Tester"`, color `green`

### Step 16.2: Update Sidebar

- Add links to new routes: Defects and Bugs per project context
- Update color-coded role badges in user avatar area

### Step 16.3: Update UserManagement page

- Add `AUTHOR` to the role dropdown when creating users
- Display role badges with correct colors (purple=ADMIN, blue=AUTHOR, green=TESTER)
- Add edit/delete user actions (Admin only)

---

## 17. Frontend: User Management (Edit/Delete, AUTHOR Role)

### File to modify
- `artifacts/uat-manager/src/pages/Users.tsx`

### Step 17.1: Add edit user dialog

- Trigger: Edit icon button per user row
- Dialog with fields: name, email, role (dropdown: ADMIN, AUTHOR, USER)
- Admin only

### Step 17.2: Add delete user action

- Trigger: Delete icon button per user row
- Confirmation dialog before delete
- Admin only

### Step 17.3: Update role display

Use the new role color mapping (purple=ADMIN, blue=AUTHOR, green=TESTER/User).

---

## 18. Frontend: Project Creation (Test Lead Dropdown)

### Files to modify
- `artifacts/uat-manager/src/components/projects/ProjectForm.tsx`
- `artifacts/uat-manager/src/pages/projects/ProjectCreate.tsx`

### Step 18.1: Add Test Lead dropdown to ProjectForm

- Fetch all users via `GET /api/users`
- Add a `Test Lead` select dropdown (required)
- Only visible to Admin (but only Admin can create projects anyway)

### Step 18.2: Update mutation to send testLeadId

In `ProjectCreate.tsx`, include `testLeadId` in the project creation payload.

---

## 19. Frontend: Project Users (New Roles)

### File to modify
- `artifacts/uat-manager/src/pages/projects/ProjectUsers.tsx`

### Step 19.1: Update role options

Change the role dropdown options from `AUTHOR, TESTER, OWNER` to:
- `TEST_LEAD` — "Test Lead"
- `TEST_AUTHOR` — "Test Author"
- `BUSINESS_OWNER` — "Business Owner"
- `TESTER` — "Tester"
- `DEVELOPER` — "Developer"

### Step 19.2: Update role display badges

Use color-coded badges for each project role:
- TEST_LEAD = red/amber
- TEST_AUTHOR = blue
- BUSINESS_OWNER = purple
- TESTER = green
- DEVELOPER = orange

### Step 19.3: Add Developer visibility

Show bug list link for DEVELOPER role on the project detail page.

---

## 20. Frontend: Defect Log Page

### File to create
- `artifacts/uat-manager/src/pages/projects/DefectLog.tsx`
- `artifacts/uat-manager/src/pages/projects/DefectDrillDown.tsx` (or sub-component)

### Step 20.1: Add route in App.tsx

```tsx
<Route path="/projects/:projectId/test-runs/:testRunId/defects" component={DefectLog} />
```

### Step 20.2: Build DefectLog page

Features:
- Fetches defects for a test run from `GET /api/test-runs/:testRunId/defects`
- Shows all defects with: linked Test Case, Tester's notes, current status badge
- Action buttons per defect based on user role:
  - **Test Lead/Admin**: Flag as Bug, Flag for Retesting, Flag Accepted by Business
  - **Business Owner**: Accept, Reject (when status is `Accepted by Business`)
- Defect drill-down: expand to show full use case → test case steps → tester results
- Note-adding panel (Test Lead, Business Owner, or `canAddNotes` participants)
- **Start Team Discussion** button at page level (Test Lead only)

### Step 20.3: Build Defect accordion drill-down

When a defect is expanded, show:
1. Use Case code and name
2. Test Case title and case number
3. All Test Case steps with: instruction, test data, expected result
4. Tester's actual result and comments per step (from step_results)
5. Current execution status

### Step 20.4: Implement action modals

- **Flag as Bug**: confirm dialog, creates bug, shows success
- **Flag for Retesting**: modal with required `reason` textarea
- **Flag Accepted by Business**: confirm dialog
- **Accept**: modal with required `note` textarea (Business Owner only)
- **Reject**: modal with optional `reason` textarea

---

## 21. Frontend: Bug List Page

### File to create
- `artifacts/uat-manager/src/pages/projects/BugList.tsx`

### Step 21.1: Add route in App.tsx

```tsx
<Route path="/projects/:id/bugs" component={BugList} />
```

### Step 21.2: Build BugList page

Features:
- Fetches bugs from `GET /api/projects/:projectId/bugs`
- Table columns: Bug #, Support Ticket #, Test Case, Assigned Developer, Status badge, Opened At, Last Updated
- Filters: Status dropdown, Assigned Developer dropdown, Support Ticket # text input
- **Test Lead/Admin actions per bug**: Assign developer, Change status to TEST, Reassign after FAILED_TO_RESOLVE, Escalate to Business Owner
- **Developer actions on their bugs**: Mark RESOLVED (with notes), Mark FAILED_TO_RESOLVE (required reason field), Add/edit notes

### Step 21.3: Implement action modals

- **Assign Bug**: modal with Developer dropdown + optional Support Ticket # input
- **Change Status**: modal with status dropdown + optional reason
- **Escalate to Business**: confirm dialog (triggers defect's `flag-accepted-by-business`)
- **Add Notes**: inline textarea or modal

---

## 22. Frontend: Team Discussion UI

### File to create
- `artifacts/uat-manager/src/components/projects/TeamDiscussionDialog.tsx`
- `artifacts/uat-manager/src/components/projects/ActiveDiscussionBanner.tsx`

### Step 22.1: Build Start Team Discussion dialog

From the Defect Log page, a "Start Team Discussion" button opens a modal:
- Meeting Type: radio/select `Defect Review` or `Post-Mortem`
- Participants: multi-select of project users
- Auto-select defaults based on meeting type:
  - Defect Review: Developers pre-selected (viewer)
  - Post-Mortem: Business Owners pre-selected (with note-adding permission)

### Step 22.2: Build Active Discussion Banner

While a discussion is active, show a banner on the Defect Log page:
- "Active Team Discussion — {meetingType}"
- Manage participants button
- End discussion button (Test Lead only)
- Indicator of who can add notes

### Step 22.3: Add discussion participation awareness

- Participants with `canAddNotes` see the notes panel on defects
- All participants can drill down into defect details
- Non-participants without Test Lead/Admin role are blocked from the Defect Log

---

## 23. Frontend: Dashboard (Developer Widget, Role Awareness)

### File to modify
- `artifacts/uat-manager/src/pages/Dashboard.tsx`

### Step 23.1: Add Developer view

When `user.role === 'USER'` and the user has `DEVELOPER` project assignments, show a Bug List widget:
- Fetches `GET /api/dashboard/developer/:userId/bugs`
- Table: Bug #, Support Ticket #, Project, Test Case, Status, Last Updated
- Inline status change and notes editing
- Filterable by status

### Step 23.2: Improve role-aware rendering

- Admin/Test Lead view: existing summary stats + recent activity (no change)
- Developer view: bug list widget
- Tester view: already handled by separate dashboard

---

## 24. Frontend: Sign-Off (Dual Signature + Passed by Agreement)

### Files to modify
- `artifacts/uat-manager/src/components/projects/SignOffDialog.tsx`
- `artifacts/uat-manager/src/components/projects/SignOffCertificate.tsx`
- `artifacts/uat-manager/src/pages/projects/ProjectDetail.tsx`

### Step 24.1: Update Sign-Off Dialog

- Remove single-signer flow
- Show who needs to sign: Test Lead and Business Owner
- Current user can sign only if they are one of these two
- Track which signatures exist already
- Different UI state for each signer

### Step 24.2: Update Sign-Off Certificate

Add "Passed by Agreement" section:
- For each Use Case, show status: `Passed`, `Passed by Agreement`, or `Failed`
- If `Passed by Agreement`, expand to list each Test Case with the Business Owner's acceptance note
- Show both signatures (Test Lead + Business Owner) with timestamps

### Step 24.3: Update ProjectDetail

- Change permissions from `isOwnerOrAdmin` to dual checks for `isTestLead` and `isBusinessOwner`
- Show sign-off status per signer (e.g., "Test Lead: Signed ✓", "Business Owner: Pending")

---

## 25. Frontend: Tester Interface (Inline Defect Reporting)

### File to modify
- `artifacts/uat-manager/src/pages/tester/TestExecutionView.tsx`

### Step 25.1: Add defect creation on test failure

When a tester marks a test case step as failed and completes the execution:
- Show a dialog: "A defect has been created for this failed test case"
- Allow the tester to add notes/comments that populate `tester_notes` on the defect
- Show defect ID/link after creation

### Step 25.2: Add defect list for the current run

At the bottom of the execution view or in a panel:
- Show existing defects for this test run
- Simple list: defect ID, test case, status
- Link to full Defect Log (if user has permission)

---

## 26. Auth Token SESSION_SECRET Alignment

### Files to modify (verify)
- `artifacts/api-server/src/middlewares/auth.ts`
- `artifacts/api-server/src/routes/auth.ts`
- `artifacts/api-server/.env` (if exists)

### Step 26.1: Ensure both use SESSION_SECRET

Already covered in Step 3.1. Verify:
- `auth.ts`: `const JWT_SECRET = process.env.SESSION_SECRET || "fallback_secret";`
- `auth` middleware: same

### Step 26.2: Update .env template

Ensure `.env` file(s) document `SESSION_SECRET` instead of or in addition to `JWT_SECRET`.

---

## 27. Verification & Testing

### Step 27.1: Typecheck

```bash
pnpm run typecheck:libs
pnpm run typecheck
```

Fix all type errors.

### Step 27.2: Run existing tests

```bash
pnpm test
```

Fix any broken tests (especially auth middleware tests that reference `JWT_SECRET`).

### Step 27.3: Manual verification checklist

- [ ] Login works for all roles (ADMIN, AUTHOR, USER)
- [ ] Admin can create users with global roles (ADMIN, AUTHOR, USER)
- [ ] Admin can create projects and assign Test Lead
- [ ] Test Lead can manage project users with all 5 project roles
- [ ] Test Lead can create/manage Test Runs
- [ ] Test Author can create/edit/delete Use Cases, Test Cases, Steps
- [ ] Tester can execute test cases in assigned runs
- [ ] Failed test executions auto-create defects
- [ ] Defect Log page shows all defects with correct action buttons per role
- [ ] Business Owner can accept/reject defects
- [ ] Test Lead can flag defects as bugs, retest, or accepted by business
- [ ] Bug List page shows all bugs with filters
- [ ] Developer can view bugs, update status of own bugs
- [ ] Team Discussion can be started from Defect Log
- [ ] Discussion participants see defect drill-down with notes
- [ ] Sign-off requires both Test Lead and Business Owner signatures
- [ ] Sign-off Certificate shows Passed by Agreement details
- [ ] Dashboard shows appropriate view per role
- [ ] `SESSION_SECRET` is used consistently everywhere
- [ ] All status transitions logged to `status_audit_log`

---

## Summary of Files to Create

| # | File | Purpose |
|---|---|---|
| 1 | `lib/db/src/schema/defects.ts` | Defects table schema |
| 2 | `lib/db/src/schema/bugs.ts` | Bugs table schema |
| 3 | `lib/db/src/schema/status-audit-log.ts` | Status audit log table schema |
| 4 | `lib/db/src/schema/team-discussions.ts` | Team discussions table schema |
| 5 | `lib/db/src/schema/team-discussion-participants.ts` | Discussion participants table schema |
| 6 | `lib/db/src/schema/defect-notes.ts` | Defect notes table schema |
| 7 | `lib/db/migrate_roles.ts` | Role migration script |
| 8 | `artifacts/api-server/src/routes/defects.ts` | Defect API routes |
| 9 | `artifacts/api-server/src/routes/bugs.ts` | Bug API routes |
| 10 | `artifacts/api-server/src/routes/team-discussions.ts` | Team discussion API routes |
| 11 | `artifacts/uat-manager/src/pages/projects/DefectLog.tsx` | Defect Log page |
| 12 | `artifacts/uat-manager/src/pages/projects/BugList.tsx` | Bug List page |
| 13 | `artifacts/uat-manager/src/components/projects/TeamDiscussionDialog.tsx` | Discussion creation modal |
| 14 | `artifacts/uat-manager/src/components/projects/ActiveDiscussionBanner.tsx` | Active discussion indicator |

## Summary of Files to Modify

| # | File | Changes |
|---|---|---|
| 1 | `lib/db/src/schema/executions.ts` | Add `testerId`, `overallResult`, `notes` columns |
| 2 | `lib/db/src/schema/projects.ts` | Add `testLeadId` column |
| 3 | `lib/db/src/schema/users.ts` | Change default role to `'USER'` |
| 4 | `lib/db/src/schema/relations.ts` | Add relations for 6 new tables |
| 5 | `lib/db/src/schema/index.ts` | Re-export new tables |
| 6 | `lib/db/seed_users.ts` | Add AUTHOR and USER seed users |
| 7 | `artifacts/api-server/src/middlewares/auth.ts` | Use `SESSION_SECRET`, add project-role helper |
| 8 | `artifacts/api-server/src/routes/auth.ts` | Use `SESSION_SECRET`, add register endpoint |
| 9 | `artifacts/api-server/src/routes/users.ts` | Add update/delete endpoints |
| 10 | `artifacts/api-server/src/routes/projects.ts` | Test Lead support, permission fixes, dual sign-off |
| 11 | `artifacts/api-server/src/routes/test-runs.ts` | `passed_by_agreement` support |
| 12 | `artifacts/api-server/src/routes/executions.ts` | Auto defect creation on failure |
| 13 | `artifacts/api-server/src/routes/attachments.ts` | Add list endpoint |
| 14 | `artifacts/api-server/src/routes/dashboard.ts` | Developer bug widget endpoint |
| 15 | `artifacts/api-server/src/routes/index.ts` | Mount new route modules |
| 16 | `lib/api-spec/openapi.yaml` | Add ~25 new endpoints + schemas |
| 17 | `artifacts/uat-manager/src/App.tsx` | Add new routes |
| 18 | `artifacts/uat-manager/src/pages/Users.tsx` | Edit/delete users, AUTHOR role |
| 19 | `artifacts/uat-manager/src/components/projects/ProjectForm.tsx` | Test Lead dropdown |
| 20 | `artifacts/uat-manager/src/pages/projects/ProjectCreate.tsx` | Pass testLeadId |
| 21 | `artifacts/uat-manager/src/pages/projects/ProjectUsers.tsx` | New role options |
| 22 | `artifacts/uat-manager/src/pages/projects/ProjectDetail.tsx` | Updated permissions, sign-off |
| 23 | `artifacts/uat-manager/src/pages/Dashboard.tsx` | Developer bug widget |
| 24 | `artifacts/uat-manager/src/components/projects/SignOffDialog.tsx` | Dual signature |
| 25 | `artifacts/uat-manager/src/components/projects/SignOffCertificate.tsx` | Passed by Agreement details |
| 26 | `artifacts/uat-manager/src/pages/tester/TestExecutionView.tsx` | Inline defect reporting |
| 27 | `artifacts/uat-manager/src/components/layout/Sidebar.tsx` | Role-aware navigation |
