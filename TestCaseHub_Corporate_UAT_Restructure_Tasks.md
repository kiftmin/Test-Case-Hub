# TestCaseHub — Corporate UAT Restructure: Agent Task List

> **How to use this list:** Hand each task to your coding agent one at a time. Each task is self-contained and testable before proceeding to the next. Tasks are ordered by dependency — do not skip ahead.

---

## PHASE 1 — STRUCTURAL FOUNDATIONS

### Task 1 — Rename "Use Cases" to "Test Scenarios" throughout the system

**Context:** In corporate UAT, the top-level grouping under a Test Plan is called a *Test Scenario* (or *Test Condition*), not a "Use Case". "Use Case" is a requirements/UML term. Renaming aligns terminology with how QA leads and auditors expect to read reports.

**What to change:**
1. In the database: add a migration that renames no columns — the underlying column/table names can stay (`use_cases`, `use_case_id`) but add a `display_label` migration comment. Update all **API response payloads** to expose the key as `testScenario` / `testScenarios` instead of `useCase` / `useCases`.
2. In the frontend: replace every label, heading, button text, and page title that reads "Use Case" / "Use Cases" with "Test Scenario" / "Test Scenarios".
3. Update the OpenAPI spec (`lib/api-spec/`) to rename the relevant schema objects and operation IDs accordingly, then re-run Orval to regenerate the client.

**Acceptance test:** Open the Project Detail (Test Plan) page. No text reading "Use Case" should appear anywhere in the UI. The API response for `GET /api/projects/:projectId` should return `testScenarios` (not `useCases`).

---

### Task 2 — Add a formal "Test Plan" document header to the Project Detail page

**Context:** Corporate UAT always begins with a signed, versioned Test Plan document that captures scope, objectives, entry/exit criteria, and sign-off fields. Currently the Project Detail page is an interactive tree view with no formal document header.

**What to build:**
1. At the top of the Project Detail page (`/projects/:id`), add a collapsible **"Test Plan Header"** card (expanded by default) containing:
   - **Document Title** (auto-generated as `"UAT Test Plan — {project.name}"`)
   - **Project Code**, **Version**, **Version Date**
   - **Module / Application Under Test** (`module_name`)
   - **Prepared By** (`designed_by`)
   - **Test Lead** (resolved name from `test_lead_id`)
   - **Objectives** — free-text field (new DB column: `projects.objectives`, text, nullable)
   - **Scope** — free-text field (new DB column: `projects.scope`, text, nullable)
   - **Out of Scope** — free-text field (new DB column: `projects.out_of_scope`, text, nullable)
   - **Entry Criteria** — free-text field (new DB column: `projects.entry_criteria`, text, nullable)
   - **Exit Criteria** — free-text field (new DB column: `projects.exit_criteria`, text, nullable)
   - **Test Environment / Test Link** (`test_link`)
2. Add these five new columns to the `projects` table via a Drizzle migration (all `text`, nullable, no defaults).
3. Expose all five new fields on `GET /api/projects/:projectId` and accept them on `PUT /api/projects/:projectId`.
4. The Test Plan Header fields are editable by Admin and TEST_LEAD only (same permission as other project edits). All other roles see them read-only.

**Acceptance test:** Navigate to a project. The Test Plan Header card is visible with all fields. A TEST_LEAD can edit and save Objectives, Scope, Entry Criteria, and Exit Criteria. A TESTER sees the same card but with no edit controls.

---

### Task 3 — Add "Test Scenario" priority and category fields

**Context:** Corporate UAT Test Scenarios are always classified by business priority (Critical / High / Medium / Low) and optionally by functional category (e.g. "Finance", "HR", "Procurement"). This drives risk-based testing and executive reporting.

**What to build:**
1. Add two new columns to `use_cases` via migration:
   - `priority` — text, nullable, allowed values: `Critical | High | Medium | Low`
   - `category` — text, nullable (free text)
2. Expose both on all `use_cases` API responses.
3. On `POST` and `PUT` for use cases, accept and validate `priority` (must be one of the four values or null) and `category` (any string or null).
4. In the Project Detail UI, show a **Priority badge** (colour-coded: Critical=red, High=orange, Medium=blue, Low=grey) and the **Category** label next to each Test Scenario row.
5. Add a **Priority** dropdown and **Category** text input to the Create/Edit Test Scenario form.

**Acceptance test:** Create a new Test Scenario with Priority = "Critical" and Category = "Finance". Save it. The scenario row shows a red "Critical" badge and "Finance" label. Edit it and change to Priority = "Medium". The badge updates to blue.

---

### Task 4 — Add "Test Case" type and expected duration fields

**Context:** In corporate UAT, test cases are typed (Positive / Negative / Edge Case / Integration) and estimated for duration. This data feeds capacity planning and run scheduling.

**What to build:**
1. Add two new columns to `test_cases` via migration:
   - `test_type` — text, nullable, allowed values: `Positive | Negative | Edge Case | Integration`
   - `estimated_minutes` — integer, nullable
2. Expose both on all `test_cases` API responses. Accept on `POST` and `PUT`.
3. In the Project Detail UI, show the `test_type` as a small badge on each Test Case row. Show `estimated_minutes` as "(~Xm)" next to the badge when present.
4. Add a **Test Type** dropdown and **Estimated Duration (minutes)** number input to the Create/Edit Test Case form.

**Acceptance test:** Create a Test Case with type "Negative" and duration 15. It shows a "Negative" badge and "(~15m)" in the tree. Edit it to change duration to 30. The label updates.

---

## PHASE 2 — TEST RUN ENHANCEMENTS

### Task 5 — Add formal Test Run "Entry Check" gate

**Context:** Corporate UAT requires a formal confirmation that entry criteria are met before a Test Run can move from `scheduled` to `in_progress`. Without this, testers start executing against a system that may not be ready.

**What to build:**
1. Add a new column to `test_runs` via migration: `entry_confirmed` (boolean, default false, not null).
2. Add a new API endpoint: `PATCH /api/test-runs/:testRunId/confirm-entry` — Admin or project TEST_LEAD only. Sets `entry_confirmed = true` and records who confirmed and when (store in a new column `entry_confirmed_by_user_id` nullable FK → users, and `entry_confirmed_at` nullable timestamp).
3. **Guard on execution:** the `POST /api/test-runs/:testRunId/test-cases/:testCaseId/execute` endpoint must return `403` with message `"Entry criteria not confirmed for this test run"` if `entry_confirmed` is false.
4. In the Test Run Detail UI, show a prominent **"Entry Criteria Not Confirmed"** banner (amber) when `entry_confirmed` is false. Show a **"Confirm Entry"** button for Admin/TEST_LEAD that calls the new endpoint. When confirmed, replace the banner with a green **"Entry Criteria Confirmed"** chip showing who confirmed and when.

**Acceptance test:** Create a new Test Run. Attempt to start execution as a TESTER — it should be blocked with the 403 message. The Test Lead clicks "Confirm Entry". The banner turns green. The TESTER can now execute.

---

### Task 6 — Add Test Run "Environment Readiness" checklist

**Context:** Before a UAT run, corporate teams complete a standard readiness checklist (test data loaded, environment stable, access granted, etc.). This is documented on the Test Run, not just assumed.

**What to build:**
1. Create a new table `test_run_checklist_items` via migration:
   ```
   id, test_run_id (FK → test_runs, cascade),
   item_text (text, not null),
   is_checked (boolean, default false),
   checked_by_user_id (nullable FK → users),
   checked_at (nullable timestamp),
   sort_order (integer, default 0)
   ```
2. When a new Test Run is created (`POST /api/projects/:projectId/test-runs`), automatically seed the following default checklist items (in order):
   - "Test environment is deployed and accessible"
   - "Test data has been loaded and verified"
   - "All testers have been granted system access"
   - "Test scenarios and cases have been reviewed and approved"
   - "Defect tracking process has been communicated to the team"
3. Add API endpoints:
   - `GET /api/test-runs/:testRunId/checklist`
   - `PATCH /api/test-runs/:testRunId/checklist/:itemId` — Admin or TEST_LEAD — `{ isChecked: boolean }`
   - `POST /api/test-runs/:testRunId/checklist` — Admin or TEST_LEAD — add custom item `{ itemText }`
   - `DELETE /api/test-runs/:testRunId/checklist/:itemId` — Admin or TEST_LEAD
4. In the Test Run Detail UI, show the checklist as a collapsible section above the use case list. Checked items show a green tick. Progress indicator shows "X / Y items checked".

**Acceptance test:** Create a new Test Run. The checklist section shows 5 pre-seeded items, all unchecked. The Test Lead checks "Test environment is deployed and accessible". It saves with a green tick and records who checked it. A custom item can be added and deleted.

---

### Task 7 — Add tester sign-off per Test Scenario execution

**Context:** In corporate UAT, after executing all test cases in a scenario, the tester formally signs off that scenario (not just implicitly by completing cases). This creates an auditable record per tester per scenario.

**What to build:**
1. Add two new columns to `test_run_use_cases` via migration:
   - `tester_sign_off` (boolean, default false)
   - `tester_sign_off_at` (nullable timestamp with timezone)
2. Add a new API endpoint: `PATCH /api/test-runs/:testRunId/use-cases/:testRunUseCaseId/tester-sign-off` — TESTER or TEST_LEAD (assigned tester only, or Test Lead). Sets `tester_sign_off = true` and `tester_sign_off_at = NOW()`.
3. In the Test Execution View, after all test cases under a scenario are completed, show a **"Sign Off This Scenario"** button. On click, call the endpoint and show a confirmation: "Scenario signed off by [name] at [datetime]".
4. On the Test Run Detail page (admin/lead view), show a sign-off indicator per scenario row.

**Acceptance test:** Complete all test cases in a scenario during a test run. The "Sign Off This Scenario" button appears. Click it. The button is replaced by a "Signed off by [name]" label with timestamp. The Test Run Detail page shows a checkmark for that scenario's sign-off column.

---

## PHASE 3 — DEFECT & BUG MANAGEMENT ENHANCEMENTS

### Task 8 — Add defect severity and priority fields

**Context:** Corporate defect logs always classify defects by Severity (impact on the system) and Priority (urgency of fix). Currently defects have no classification, making triage impossible.

**What to build:**
1. Add two new columns to `defects` via migration:
   - `severity` — text, nullable, allowed values: `Critical | Major | Minor | Cosmetic`
   - `priority` — text, nullable, allowed values: `P1 | P2 | P3 | P4`
2. Expose both on all `defects` API responses. Accept on the defect creation payload (auto-created on test case failure) and on a new update endpoint.
3. Add a new endpoint: `PATCH /api/defects/:defectId/classify` — TEST_LEAD only — `{ severity, priority }`.
4. In the Defect Log UI, show Severity and Priority as colour-coded badges on each defect row:
   - Severity: Critical=red, Major=orange, Minor=blue, Cosmetic=grey
   - Priority: P1=red, P2=orange, P3=yellow, P4=grey
5. Add Severity and Priority filter dropdowns to the Defect Log page toolbar.
6. When a defect is automatically created (on test case failure), default both fields to `null`. The Test Lead classifies them via the Defect Log.

**Acceptance test:** Fail a test case. Go to the Defect Log. The new defect shows no severity/priority badges (unclassified). The Test Lead clicks classify, sets Severity=Major and Priority=P2. The badges appear. Filter by Severity=Major — only that defect shows.

---

### Task 9 — Add "Root Cause Category" to bugs

**Context:** Corporate post-mortems require bugs to be categorised by root cause for process improvement tracking. This is a standard field on all enterprise defect trackers.

**What to build:**
1. Add a new column to `bugs` via migration: `root_cause_category` — text, nullable, allowed values: `Requirements Gap | Design Defect | Coding Error | Environment Issue | Test Data Issue | Configuration Error | Third-Party Integration | Other`.
2. Expose on all `bugs` API responses. Accept on `PATCH /api/bugs/:bugId/status` payload (optional) and via a standalone update: extend `PATCH /api/bugs/:bugId/notes` to also accept `{ rootCauseCategory }` (optional).
3. In the Bug List UI, add a **Root Cause** column (shows the value or "—" if unset). Developers and Test Lead can set/edit this field inline on the bug row.
4. Add a Root Cause filter to the Bug List filter bar.

**Acceptance test:** Open a bug. Set Root Cause Category = "Coding Error". The Bug List shows "Coding Error" in the Root Cause column. Filter by Root Cause = "Coding Error" — only matching bugs appear.

---

### Task 10 — Add defect re-test execution flow

**Context:** When a defect is set to "Ready for Testing", it should be explicitly re-tested by a tester, not just assumed resolved. Currently the system has no structured re-test execution — defects just change status.

**What to build:**
1. Add a new table `defect_retests` via migration:
   ```
   id, defect_id (FK → defects, cascade),
   test_run_id (FK → test_runs, cascade),
   assigned_tester_id (nullable FK → users, set null on delete),
   retest_result (text, nullable): passed | failed
   retest_notes (text, nullable),
   retested_by_user_id (nullable FK → users),
   retested_at (nullable timestamp with timezone),
   created_at
   ```
2. When the Test Lead sets a defect to "Ready for Testing" (existing `flag-retest` endpoint), also create a `defect_retests` record linked to the current test run.
3. Add new API endpoints:
   - `GET /api/defects/:defectId/retests`
   - `PATCH /api/defect-retests/:retestId` — TESTER or TEST_LEAD — `{ retestResult, retestNotes }`. On `retestResult = 'failed'`, automatically change defect status back to `New Defect` and log to `status_audit_log`.
4. In the Defect Log UI, defects with status "Ready for Testing" show a **"Record Retest Result"** button (visible to assigned TESTER and TEST_LEAD). Clicking opens a modal: Pass / Fail toggle + notes field. Submitting calls the PATCH endpoint.

**Acceptance test:** Flag a defect for retesting. The defect status changes to "Ready for Testing" and a retest record is created. The tester sees "Record Retest Result". They set it to Failed. The defect status reverts to "New Defect" and the audit log shows the transition.

---

## PHASE 4 — REPORTING & SIGN-OFF ENHANCEMENTS

### Task 11 — Add UAT Summary Dashboard (Test Lead / Admin view)

**Context:** Corporate UAT managers need a real-time summary dashboard showing run progress, defect counts by severity, and test coverage. The current dashboard shows only totals — it lacks the run-level breakdown corporate clients require.

**What to build:**
1. Add a new API endpoint: `GET /api/projects/:projectId/uat-summary` — returns:
   - Total test scenarios, total test cases, total test steps
   - Per-run breakdown: run name, scheduled date, status, total use cases, passed, failed, pending, pass rate %
   - Defect counts by status
   - Defect counts by severity (Critical / Major / Minor / Cosmetic)
   - Bug counts by status
   - Overall project pass rate across all completed runs
2. Build a new page `/projects/:id/stats` (replace or enhance the existing stats page) with:
   - A summary stat bar (total scenarios, cases, steps, overall pass rate)
   - A **Test Runs Progress** table (one row per run, columns: Run Name, Scheduled, Status, Scenarios Passed, Scenarios Failed, Scenarios Pending, Pass Rate %)
   - A **Defect Summary** section: bar or table showing counts by status and by severity
   - A **Bug Summary** section: counts by status
3. Accessible to: Admin, TEST_LEAD, BUSINESS_OWNER (read-only).

**Acceptance test:** Navigate to `/projects/:id/stats`. All three sections render with live data from the database. A TEST_AUTHOR cannot access this page (redirect or 403).

---

### Task 12 — Enhance the Sign-off Certificate with corporate UAT structure

**Context:** The current sign-off certificate is minimal. Corporate UAT sign-off documents require formal sections covering test objectives, scope confirmation, results summary, open issues register, and attestation statements from both the Test Lead and Business Owner.

**What to build (enhance the existing Sign-off Certificate page):**

1. **Section 1 — Document Header**: Project name, project code, version, version date, module, prepared by, test lead name, date of sign-off.
2. **Section 2 — Test Objectives & Scope**: Pull from the new `objectives`, `scope`, `out_of_scope`, `entry_criteria`, and `exit_criteria` fields added in Task 2. If empty, show "Not specified."
3. **Section 3 — Test Execution Summary**: Table — one row per Test Scenario, columns: Scenario Code, Scenario Name, Priority, # Test Cases, Result (Passed / Passed by Agreement / Failed). Show overall pass rate %.
4. **Section 4 — Defect Summary**: Table — counts of defects by Severity and by final status. List all open defects (non-resolved) with ID, severity, priority, and current status.
5. **Section 5 — Open Issues Register**: All use cases/test cases that did not fully pass, with their Accepted-by-Business note if applicable. If none, show "No open issues."
6. **Section 6 — Attestation**:
   - Test Lead attestation block: "I confirm that UAT has been conducted in accordance with the agreed Test Plan and that the system is ready for release subject to the open issues noted above." — Name, Role, Date, Signature field (text).
   - Business Owner attestation block: same statement adapted. — Name, Role, Date, Signature field (text).
7. Store both attestation text signatures in the existing `sign_off_data` JSON on the `projects` table (extend the JSON structure).
8. Add a **"Download as PDF"** button that uses the browser's `window.print()` with a print-specific stylesheet that formats the certificate cleanly on A4/Letter.

**Acceptance test:** Navigate to the sign-off certificate. All six sections render. The Test Lead fills in the attestation field and submits. The Business Owner's attestation block remains pending until they sign. The "Download as PDF" button opens a clean print dialog.

---

### Task 13 — Add a test execution progress report per Test Run

**Context:** Stakeholders need a printable/exportable per-run report showing every scenario, every test case, the tester assigned, the result, and any defects raised. This is a standard UAT deliverable submitted to the steering committee.

**What to build:**
1. The existing `GET /api/test-runs/:testRunId/full-report` endpoint should be enhanced to return:
   - Run metadata (name, scheduled date, status, entry confirmed by, entry confirmed at)
   - Per scenario: scenario code, name, priority, category, assigned tester, free pass flag, status, tester sign-off
   - Per test case within each scenario: case number, title, test type, estimated minutes, execution result, actual result summary, defect raised (yes/no, defect ID)
   - Per step within each test case: step number, instruction, expected result, actual result, pass/fail, comments
   - Defects summary at the end
2. Build a new printable Report page at `/projects/:id/test-runs/:runId/report`:
   - Accessible to Admin, TEST_LEAD, BUSINESS_OWNER
   - Renders all the above data in a clean, table-based layout
   - Print button using `window.print()` with print CSS (no nav/sidebar, clean typography)
3. Add a **"View Report"** link/button on the Test Run Detail page, visible to Admin and TEST_LEAD.

**Acceptance test:** Complete at least one test case in a test run. Click "View Report". The report page renders all executed scenarios and cases with results. Print preview shows a clean A4 layout with no navigation chrome.

---

## PHASE 5 — ROLE & WORKFLOW REFINEMENTS

### Task 14 — Add "UAT Coordinator" project role

**Context:** Large corporate UATs have a UAT Coordinator who manages scheduling, communications, and progress tracking but does not author test cases or execute them. This is distinct from the Test Lead (who owns the overall UAT) and Tester (who executes).

**What to build:**
1. Add `UAT_COORDINATOR` as a valid value for `project_assignments.role`.
2. Update the project role validation everywhere: DB migration comment, Zod schemas, OpenAPI spec, frontend role dropdowns.
3. **Permissions for UAT_COORDINATOR:**
   - Read-only access to Test Plans, Test Scenarios, Test Cases (same as DEVELOPER)
   - Full read access to all Test Runs (view detail, view report)
   - Can view the UAT Summary Dashboard (`/projects/:id/stats`)
   - Can view the Defect Log (same as an invited participant, without needing a Team Discussion invitation)
   - Cannot create/edit/delete any content, execute test cases, or sign off
4. Update the permission matrix in the frontend to reflect UAT_COORDINATOR access.
5. On the Project Users page, UAT_COORDINATOR appears as a selectable role in the "Add User" dropdown.

**Acceptance test:** Assign a user as UAT_COORDINATOR on a project. They can view the Test Plan, Test Runs, Stats, and Defect Log. They cannot see any create/edit/delete buttons. Attempting to call a restricted endpoint returns 403.

---

### Task 15 — Add mandatory "Acceptance Criteria" field to Test Cases

**Context:** In formal UAT, every test case must have explicit acceptance criteria (the condition that defines a pass), separate from the test steps. This is an audit requirement — testers and business owners must agree upfront what "pass" means.

**What to build:**
1. Add a new column to `test_cases` via migration: `acceptance_criteria` — text, nullable.
2. Expose on all `test_cases` API responses. Accept on `POST` and `PUT`.
3. In the Project Detail UI, add an **"Acceptance Criteria"** field to the Create/Edit Test Case form (textarea). Show it below the title field.
4. In the Test Case row in the tree view, if `acceptance_criteria` is set, show a small "AC" chip that expands to reveal the criteria text on hover/click.
5. In the Test Execution View, display the acceptance criteria prominently at the top of each test case card, above the steps — labelled **"Acceptance Criteria"** in bold.

**Acceptance test:** Create a test case with acceptance criteria "User is redirected to the dashboard within 2 seconds." The "AC" chip appears in the tree view. During test execution, the criteria text is visible at the top of the test case card before any steps.

---

### Task 16 — Enforce Test Plan version increment on structural changes

**Context:** Corporate UAT requires that the Test Plan version increments not only on project metadata edits (already implemented) but also whenever test scenarios, test cases, or test steps are added, edited, or deleted — since these constitute structural changes to the Test Plan document.

**What to build:**
1. In the API server, add a helper function `bumpProjectVersion(projectId, db)` that does `UPDATE projects SET version = version + 1, version_date = NOW() WHERE id = $projectId`.
2. Call `bumpProjectVersion` after every successful:
   - `POST /api/projects/:projectId/use-cases`
   - `PUT /api/use-cases/:useCaseId`
   - `DELETE /api/use-cases/:useCaseId`
   - `POST /api/use-cases/:useCaseId/test-cases`
   - `PUT /api/test-cases/:testCaseId`
   - `DELETE /api/test-cases/:testCaseId`
   - `POST /api/test-cases/:testCaseId/steps`
   - `POST /api/test-cases/:testCaseId/steps/bulk`
   - `PUT /api/test-steps/:stepId`
   - `DELETE /api/test-steps/:stepId`
3. In the Test Plan Header (Task 2), show the updated version and version date in real time after any save.

**Acceptance test:** Note the current project version (e.g., v3). Add a new test step to any test case. Reload the Project Detail page. The version in the Test Plan Header has incremented to v4 and the version date shows today's date.

---

## PHASE 6 — DATA INTEGRITY & AUDIT

### Task 17 — Add a full Audit Trail page per project

**Context:** Corporate clients require a complete, tamper-evident audit trail of all significant actions on a project. The current `status_audit_log` only covers defect and bug status changes — it needs to be extended.

**What to build:**
1. Rename (or extend alongside) `status_audit_log` to support a broader `entity_type` range. Add support for these new entity types (add a migration to allow new text values — no structural change needed since `entity_type` is already `text`):
   - `project` — project metadata updated, signed off
   - `test_run` — created, status changed, entry confirmed, deleted
   - `test_scenario` — created, updated, deleted
   - `test_case` — created, updated, deleted
   - `execution` — started, completed, result recorded
2. Add a logging call to the relevant API route handlers for each of the above event types. Each log entry records: `entity_type`, `entity_id`, `changed_by_user_id`, `from_status` (nullable), `to_status` (nullable), `reason` (nullable, use for action description), `changed_at`.
3. Add a new API endpoint: `GET /api/projects/:projectId/audit-log?limit=100&offset=0` — Admin and TEST_LEAD only. Returns log entries for all entities belonging to this project, joined with user name, sorted by `changed_at` DESC.
4. Build a new page `/projects/:id/audit` — Admin and TEST_LEAD only:
   - Table: Timestamp | Action | Entity Type | Entity ID | Performed By | Details
   - Filter by entity type and date range
   - Link from the Project Detail page sidebar/nav

**Acceptance test:** Perform the following actions on a project: edit a test case, change a test run status, sign off the project. Navigate to `/projects/:id/audit`. All three actions appear as distinct entries with the correct user, timestamp, and description. A TEST_AUTHOR cannot access the page.

---

### Task 18 — Final: Update the Current State Prompt document

**Context:** Once all tasks above are complete, the `TestCaseHub_Current_State_Prompt.md` needs to reflect the new corporate-aligned state so future agents start from the correct baseline.

**What to do:**
1. Update the **Database Schema** section to include all new columns and tables added in Tasks 1–17.
2. Update the **API Endpoints** section with all new and modified endpoints.
3. Update the **User Roles / Permission Matrix** to include `UAT_COORDINATOR`.
4. Update the **Frontend Pages & Components** section to include all new pages and components.
5. Update the **Business Logic** section to document the Entry Check gate, version bumping rules, and retest flow.
6. Update the **General Implementation Rules** section to add:
   - Rule: All structural changes to the Test Plan (scenarios, cases, steps) must trigger a project version increment.
   - Rule: Entry criteria must be confirmed before test execution can begin.
7. Save the updated file as `TestCaseHub_Corporate_State_Prompt.md` at the project root.

**Acceptance test:** The new prompt document accurately reflects every feature in the running application. A fresh coding agent given only this document could reproduce the current system without referencing the old prompt or this task list.

---

## Summary: New Elements Added by This Task List

| # | Element | Type |
|---|---------|------|
| 1 | "Test Scenario" terminology | Rename throughout |
| 2 | Test Plan document header (objectives, scope, entry/exit criteria) | DB + API + UI |
| 3 | Test Scenario priority & category | DB + API + UI |
| 4 | Test Case type & estimated duration | DB + API + UI |
| 5 | Entry Criteria confirmation gate | DB + API + UI |
| 6 | Environment readiness checklist | DB + API + UI |
| 7 | Tester sign-off per scenario | DB + API + UI |
| 8 | Defect severity & priority fields | DB + API + UI |
| 9 | Bug root cause category | DB + API + UI |
| 10 | Structured defect re-test flow | DB + API + UI |
| 11 | UAT Summary Dashboard | API + UI |
| 12 | Enhanced sign-off certificate (6 sections + attestation + PDF) | API + UI |
| 13 | Per-run printable execution report | API + UI |
| 14 | UAT_COORDINATOR project role | DB + API + UI |
| 15 | Acceptance Criteria on Test Cases | DB + API + UI |
| 16 | Version bump on structural Test Plan changes | API logic |
| 17 | Full Audit Trail page | DB + API + UI |
| 18 | Updated Current State Prompt | Documentation |
