# TestCaseHub — Mobile Tester Execution UX: Agent Task List

> **Purpose:** These tasks specifically redesign the tester-facing execution flow for mobile and shopfloor use. They are independent of (but compatible with) the Corporate UAT Restructure task list. Execute these one at a time in order — each builds on the previous.

---

## Context: What's Clunky Today

The current execution view (`/tester/:projectCode`) renders all scenarios → cases → steps as one long scrollable tree. On a desktop browser this is manageable. On a 6-inch phone in a noisy warehouse or shopfloor environment it creates several problems:

- Tester has to scroll far to find their place
- All steps are visible at once — easy to accidentally skip or fill in the wrong field
- Generic file input doesn't trigger the phone camera directly
- No progress indicator — tester doesn't know where they are in the overall run
- No resilience to dropped Wi-Fi — losing connection mid-test loses all unsaved input
- No quick-access URL / QR code — testers have to type the full app URL manually

---

## TASK M1 — Redesign the Tester Execution View as a Guided Step-by-Step Wizard

**Context:** Replace the current "everything visible at once" flat tree with a focused, one-step-at-a-time guided execution flow. This is the most impactful change for mobile usability.

### Navigation model

The execution view should operate across three levels with distinct screens, not a single scrollable tree:

**Level 1 — Scenario Selector Screen** (`/tester/run/:testRunId`)
- Replaces the current `/tester/:projectCode` entry point (keep old route as redirect for backward compatibility)
- Shows a card list of assigned Test Scenarios for this run
- Each card shows: Scenario code, Scenario name, Category badge, Priority badge, number of Test Cases, completion status (e.g. "2 / 4 cases done"), a green tick when all cases are complete
- Tapping a card navigates to Level 2

**Level 2 — Test Case Selector Screen** (`/tester/run/:testRunId/scenario/:scenarioId`)
- Shows the Test Scenario name and description at the top
- If `acceptance_criteria` is present (from Task 15 of the Corporate list), show it in a highlighted box
- Lists all Test Cases in this scenario as tappable rows
- Each row shows: case number, title, test type badge, estimated duration, completion status (Not Started / In Progress / Done — Pass / Done — Fail)
- Tapping a case navigates to Level 3

**Level 3 — Step Execution Screen** (`/tester/run/:testRunId/scenario/:scenarioId/case/:testCaseId`)
- This is the core execution screen
- Shows one step at a time (see "Step Wizard" section below)
- After the last step, shows a "Complete Test Case" confirmation screen

### Step Wizard (Level 3 detail)

- Top of screen: persistent **progress bar** — "Step X of Y" with a visual bar, plus "Case X of Y in this scenario"
- Below: fixed header showing the Test Case title
- **Step card** (takes up the majority of screen height):
  - Step number label
  - **Instruction** — large, readable font (minimum 16px)
  - **Test Data** — shown in a distinct highlighted box (if present)
  - **Expected Result** — shown below test data in a different colour/box
- **Actual Result field** — full-width textarea, large touch target (minimum 48px height), labelled "What actually happened?"
- **Comments field** — optional textarea, collapsible to save screen space (labelled "+ Add comment"), expands on tap
- **Photo/file attachment** — see Task M2 for camera integration
- **Pass / Fail buttons** — large, full-width, colour-coded (green PASS / red FAIL), sticky at the bottom of the screen above the device keyboard
- Navigation: swipe left/right OR "← Previous" / "Next →" chevron buttons at the top. Navigating away saves a draft of the current step's inputs automatically (see Task M3 for offline draft saving)

### What to build

1. Create three new route components in the frontend:
   - `TesterScenarioSelector` at `/tester/run/:testRunId`
   - `TesterCaseSelector` at `/tester/run/:testRunId/scenario/:scenarioId`
   - `TesterStepWizard` at `/tester/run/:testRunId/scenario/:scenarioId/case/:testCaseId`
2. The existing `/tester/:projectCode` route should resolve the project code to the active (or most recent in-progress) test run for that project and tester, then redirect to `/tester/run/:testRunId`.
3. The existing Tester Dashboard cards' "Start Testing" button should navigate to `/tester/run/:testRunId` directly (using the run ID, not the project code).
4. All three new screens must be fully responsive with a max viewport assumption of 390px wide. Use Tailwind's `sm:` breakpoints — the default layout is mobile, desktop layout is the enhancement.
5. The Pass/Fail buttons must be sticky-positioned at the bottom of the viewport (CSS `position: sticky; bottom: 0`) so they are always reachable without scrolling.
6. Preserve the existing API calls — only the frontend routing and component structure changes.

### What NOT to change
- The underlying API endpoints for executions and step results remain unchanged.
- The desktop admin/lead views (Test Run Detail, Defect Log, etc.) are unaffected.
- The old `/tester/:projectCode` route must still work (redirect only).

**Acceptance test:**
- Open the tester dashboard on a 390px-wide viewport (use browser dev tools). Tap "Start Testing" on a run. You land on the Scenario Selector — cards fill the width with no horizontal scroll.
- Tap a scenario. You see the Case Selector with case status indicators.
- Tap a case. The Step Wizard shows one step. The progress bar reads "Step 1 of X". The Pass/Fail buttons are visible at the bottom without scrolling.
- Tap the Pass button. Step 2 loads immediately. After the last step, a completion confirmation screen appears.

---

## TASK M2 — Replace Generic File Input with Mobile Camera Integration

**Context:** The current file attachment fields use a standard HTML `<input type="file">`. On desktop this is fine. On mobile, this forces the tester through a file picker dialog rather than directly opening the camera. Shopfloor testers need to photograph the screen or physical equipment as evidence — one tap should open the camera.

### What to build

1. In the Step Wizard (Task M1), replace each attachment input with a custom `CameraCapture` component:
   - Renders as a large, tappable card: camera icon + label "Tap to photograph result"
   - On tap: uses `<input type="file" accept="image/*" capture="environment">` — the `capture="environment"` attribute triggers the rear camera directly on iOS and Android, bypassing the file picker
   - If a photo has been captured: show a thumbnail preview of the image with a "Retake" button and a small "Remove" (×) button
   - Below the camera card: a secondary link "Attach file instead" that opens a standard file picker without `capture` attribute (for when a tester needs to attach a PDF or document instead of a photo)
2. The component uploads to `POST /api/upload` immediately on capture (same as existing upload flow). Show a small upload spinner on the thumbnail while uploading. Store the returned `fileUrl` in component state for submission with the step result.
3. Build the same `CameraCapture` component so it degrades gracefully on desktop — on a non-touch device it renders as a standard file input with a camera icon.
4. Apply the `CameraCapture` component to:
   - The "Actual Result" attachment field in each step
   - The "Comments" attachment field in each step

**Acceptance test:**
- Open the Step Wizard on an actual Android or iOS device (or browser emulation with "mobile" device selected in dev tools).
- Tap the camera card on the Actual Result attachment. The device camera opens immediately (no file picker dialog shown first).
- Capture a photo. A thumbnail appears with "Retake" and "×" buttons.
- Tap "Retake" — the camera opens again.
- On desktop: the same component renders as a normal file picker button.

---

## TASK M3 — Add Local Draft Saving for In-Progress Step Results

**Context:** Shopfloors frequently have patchy Wi-Fi or the user may lock their phone mid-test and return minutes later. Any unsaved data in form fields is currently lost on navigation or connection drop. Testers should never lose work.

### What to build

1. In the Step Wizard component (Task M1), implement draft auto-save using the browser's `sessionStorage` (not `localStorage` — drafts should clear when the browser tab is closed, since stale drafts from a previous session would confuse a new test run):
   - Key pattern: `draft_step_{testRunId}_{testCaseId}_{stepId}`
   - Value: JSON object `{ actualResult, comments, attachmentUrl, savedAt }`
   - Trigger: auto-save on every `onChange` event on the Actual Result and Comments fields, debounced to 800ms
2. On mount of each step, check `sessionStorage` for a matching draft key. If found and `savedAt` is within the current day, pre-populate the fields with the draft data and show a subtle amber banner: "Draft restored — last saved at [time]" with a "Clear draft" link.
3. On successful submission of a step result (API call returns 200/201), delete the corresponding draft key from `sessionStorage`.
4. Add a global "Connection Lost" banner: listen for the browser `window.offline` event. When triggered, show a red sticky banner at the top: "⚠ No connection — your inputs are being saved as drafts locally." When `window.online` fires, replace with a green banner "Connection restored" that auto-dismisses after 3 seconds.

**Acceptance test:**
- Start filling in an Actual Result for a step. Wait 1 second. Refresh the page. The text reappears in the field with an amber "Draft restored" banner.
- Submit the step result successfully. Reload the page. The draft banner does not appear (draft was cleared on submission).
- In browser dev tools, set the network to "Offline". The red connection banner appears. Set back to "Online". The green banner appears then dismisses.

---

## TASK M4 — Add QR Code and Short-Link Access for Shopfloor Testers

**Context:** Typing a full URL on a phone in a loud, busy shopfloor environment is error-prone and slow. Testers should be able to scan a QR code posted near the workstation to jump directly into their assigned test run. The Test Lead prints and posts this QR code before the testing session.

### What to build

1. Add a new API endpoint: `GET /api/test-runs/:testRunId/access-qr` — Admin or TEST_LEAD only. Returns:
   ```json
   { "accessUrl": "https://<app-domain>/tester/run/:testRunId", "qrDataUrl": "<base64 PNG data URL of QR code>" }
   ```
   Generate the QR code server-side using the `qrcode` npm package (`npm install qrcode`). The QR code encodes the full URL to `/tester/run/:testRunId`.

2. On the Test Run Detail page, add a **"Get QR Code"** button (visible to Admin and TEST_LEAD only, only for runs with status `scheduled` or `in_progress`).

3. Clicking opens a modal containing:
   - The QR code image (large, minimum 256×256px)
   - The plain-text URL below it (selectable/copyable)
   - A **"Download QR Code"** button that triggers a PNG download of the QR image
   - A **"Print QR Sheet"** button that opens a print-specific page showing: the QR code, the project name, the run name, the scheduled date, and the instruction "Scan to begin testing. Log in with your TestCaseHub credentials."

4. The QR code URL (`/tester/run/:testRunId`) requires the tester to be logged in. If not logged in, they are redirected to `/login` with a `?redirect=/tester/run/:testRunId` parameter, and after successful login they land directly on the correct Scenario Selector screen.
   - Implement the redirect: in the login page, after successful authentication, check for a `redirect` query parameter and navigate there instead of the default dashboard.

**Acceptance test:**
- Open the Test Run Detail page as a Test Lead. The "Get QR Code" button is visible.
- Click it. A modal appears with a scannable QR code and the correct URL.
- "Download QR Code" downloads a PNG file.
- "Print QR Sheet" opens a print dialog with the formatted sheet.
- Scan the QR code on a phone where you are not logged in. You land on the login page. After logging in, you land on the Scenario Selector for that test run.

---

## TASK M5 — Add a "Quick Result" Mode for Experienced Testers

**Context:** Experienced shopfloor testers who have run the same test cases many times don't need to read the instruction on every step — they just need to quickly record Pass/Fail and move on. A compact "quick result" mode lets them run through familiar tests in half the time, while still capturing a proper audit trail.

### What to build

1. Add a toggle at the top of the **Case Selector screen** (Level 2 from Task M1): **"Quick Mode"** / "Guided Mode" — toggle switch, defaults to "Guided Mode".
   - Persist the preference in `sessionStorage` key `tester_mode_{userId}` so it survives navigation within the session.

2. **Quick Mode — Step List View** (replaces the step-by-step wizard for the selected case):
   - Shows all steps for the test case as a compact vertical list (no wizard navigation)
   - Each row shows: step number, instruction (truncated to 2 lines with "Show more" expand), and two large tap targets: ✓ (Pass) and ✗ (Fail) — no Actual Result or Comments fields shown by default
   - Tapping ✗ (Fail) expands that row inline to show the Actual Result textarea and camera attachment (required for a fail — validate before submission)
   - A **"Submit All"** button at the bottom submits all step results in a single action (one API call per step result, fired sequentially)
   - If any step is unrecorded when "Submit All" is tapped, highlight those rows in amber and prevent submission

3. **Guided Mode** remains unchanged from Task M1 (one step at a time).

4. The mode toggle is only visible on the Case Selector and propagates into the Step Wizard / Step List. It is not visible to Test Leads or Admins (they don't execute test cases).

**Acceptance test:**
- Open the Case Selector. The "Guided Mode / Quick Mode" toggle is visible.
- Switch to Quick Mode. Tap a test case. All steps appear as a compact list with ✓ and ✗ buttons.
- Mark all steps as Pass. Tap "Submit All". The case is marked complete and you return to the Case Selector.
- Switch back to Guided Mode. Tap the same case (now completed, so read-only). The step-by-step wizard shows read-only results.
- Refresh the page. The mode preference is still set to Quick Mode (persisted in sessionStorage).

---

## TASK M6 — Add Mobile-Optimised Tester Dashboard

**Context:** The current Tester Dashboard (`/tester/dashboard`) was designed as a responsive component but has not been reviewed for true mobile usability. On a phone, the countdown timers, card layouts, and button sizing need to be purpose-built for thumb navigation.

### What to build

Rebuild the Tester Dashboard component with the following mobile-first rules (keep the same data and API calls — only the presentation changes):

1. **Layout:** Single-column card list, full viewport width. No sidebars. Maximum content width 480px, centred on desktop.

2. **Card design per Test Run:**
   - Top row: Project name (bold, large) + Status badge (NEW / IN PROGRESS / COMPLETED) right-aligned
   - Second row: Run name in medium weight
   - Third row: Scheduled date — rendered as a human-friendly relative label: "Today", "Tomorrow", "In 3 days", or the date if more than 7 days away. Show a clock icon + countdown timer only if the run starts within 24 hours (format: "Starts in 2h 14m").
   - Fourth row: Progress indicator — a thin coloured progress bar showing (completed cases / total cases), with the fraction label "3 / 8 cases done" next to it. For NEW runs, show "0 / 8 cases pending".
   - Bottom: Full-width action button — "Start Testing" (green, for NEW), "Continue Testing" (orange, for IN PROGRESS), "Review Results" (grey, for COMPLETED), "Locked" (disabled grey, for not-yet-started runs).

3. **Empty state:** If no runs are assigned, show a centred illustration placeholder (an SVG of a clipboard) and the message "No test runs assigned to you yet."

4. **Pull-to-refresh:** Implement a pull-down gesture using the `touchstart`/`touchmove`/`touchend` events that triggers a React Query refetch on the dashboard data. Show a spinning indicator at the top while refreshing.

5. **Header:** Replace any complex nav header with a simple bar: app logo/name left, logged-in user's first name + avatar initial right. No hamburger menu — testers don't need navigation to other sections.

**Acceptance test:**
- Open `/tester/dashboard` on a 390px viewport. All run cards stack vertically, no horizontal overflow.
- A run scheduled for today shows the relative label "Today" and countdown timer (if within 24 hours).
- An in-progress run shows the progress bar filled proportionally.
- Pull down on the card list — a refresh spinner appears and the data reloads.
- With no runs assigned, the empty state clipboard illustration and message are shown.

---

## Summary

| Task | What it fixes | Effort |
|------|--------------|--------|
| M1 | Clunky all-at-once tree → guided 3-level wizard with progress bar | High |
| M2 | Generic file picker → one-tap camera capture | Low |
| M3 | Data loss on connection drop → session-storage draft saving + offline banner | Medium |
| M4 | Manual URL typing → QR code scan-to-start | Medium |
| M5 | Slow for experienced testers → Quick Mode compact step list | Medium |
| M6 | Dashboard not thumb-friendly → mobile-first card redesign | Medium |

### Recommended execution order

Run M1 first — it is the foundation all other tasks build on. M2 and M3 can be done in parallel after M1. M4 is independent and can be done at any point. M5 and M6 are polish tasks — do them last.

### Relationship to the Corporate UAT Restructure tasks

These mobile tasks are fully compatible with the restructure list. Specifically:
- **Task M1** must render the `acceptance_criteria` field added by Corporate Task 15 in the Level 2 Case Selector screen.
- **Task M1** must trigger the tester scenario sign-off (Corporate Task 7) at the completion screen after the last case in a scenario.
- **Task M1** must respect the Entry Criteria gate (Corporate Task 5) — if `entry_confirmed` is false for the run, the Scenario Selector shows a full-screen blocker: "This test run has not been cleared to start. Contact your Test Lead."
- **Task M4** QR code should only be generated for runs where `entry_confirmed = true` (or include a warning on the QR sheet if not yet confirmed).
