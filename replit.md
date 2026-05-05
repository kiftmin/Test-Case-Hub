# Workspace

## Overview

pnpm workspace monorepo using TypeScript. UAT Test Case Management System ("TestFlow") — a full-stack web app for designing and executing user acceptance tests.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite, Tailwind CSS, TanStack Query, Recharts, Wouter

## Artifacts

- `artifacts/uat-manager` — React + Vite frontend (preview path: `/`)
- `artifacts/api-server` — Express API server (preview path: `/api`)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Database Schema

Tables in `lib/db/src/schema/`:
- `projects` — top-level test projects (projectCode, name, designedBy, moduleName, designDate, testLink, version, versionDate)
- `use_cases` — use cases per project (code e.g. UC1, name)
- `test_cases` — test cases per use case (caseNumber, title)
- `test_steps` — steps per test case (stepNumber, instruction, testData, expectedResult)
- `executions` — tester execution results (iterationNumber, testerName, actualResult, comments, passed)
- `attachments` — file/URL attachments for steps or executions

## API Routes

All routes under `/api`:
- `GET/POST /projects` — list/create projects
- `GET/PUT/DELETE /projects/:id` — project CRUD
- `GET /projects/code/:code` — get project by code (for tester login)
- `GET/POST /projects/:id/use-cases` — use cases
- `PUT/DELETE /use-cases/:id` — use case CRUD
- `GET/POST /use-cases/:id/test-cases` — test cases
- `PUT/DELETE /test-cases/:id` — test case CRUD
- `GET/POST /test-cases/:id/steps` — steps
- `POST /test-cases/:id/steps/bulk` — bulk create steps
- `PUT/DELETE /steps/:id` — step CRUD
- `GET/POST /test-cases/:id/executions` — executions
- `PUT /executions/:id` — update execution
- `POST/DELETE /attachments` — attachments
- `GET /dashboard/summary` — overall stats
- `GET /dashboard/projects/:id/stats` — per-project pass/fail stats
- `GET /dashboard/recent-activity` — recent test runs

## Frontend Pages

Admin:
- `/` — Dashboard with stats and recent activity
- `/projects` — All projects list with search
- `/projects/new` — Create project
- `/projects/:id` — Project detail with use case tree and step editor
- `/projects/:id/edit` — Edit project metadata
- `/projects/:id/stats` — Pass/fail analytics with charts

Tester:
- `/tester` — Enter project code + tester name
- `/tester/:projectCode` — Mobile-responsive test execution view

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
