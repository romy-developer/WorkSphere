# WorkSphere HRMS Development Roadmap

Roadmap based on the source audit in `docs/HRMS_MODULE_AUDIT.md` (2026-10-14). This is a proposal only; no feature implementation, migration, seed, bootstrap, password reset, or database write is authorized by this document.

## Priorities

- **P0**: foundational or blocks safe day-to-day HRMS operation.
- **P1**: essential operational workflows required after the foundation.
- **P2**: important business capability, dependent on core employee/org data.
- **P3**: optional/scale-stage capability after workflows and governance are stable.

All schema evolution must use a new reviewed migration. Never edit an applied migration. Test writes must target an explicitly isolated disposable database, never the configured application/production database.

## Phase 1 — Core Completion

### 1. Verify API/authentication runtime and DB-backed flow

- **Priority / complexity:** P0 / Medium.
- **Purpose:** Make the existing login/session slice verifiable end-to-end; the last observed backend startup attempt rejected `AUTH_TOKEN_SECRET` before listening.
- **Dependencies:** Local Postgres availability, correct private `.env` configuration, approved target for any test database; existing RBAC/user data for a manual smoke test.
- **Frontend:** Add component/integration coverage for session restore, CSRF/login, invalid credentials, server unavailable, logout, and redirects; retain generic credential errors.
- **Backend/API:** Validate runtime configuration before app construction; add a DB readiness check distinct from liveness; exercise current `GET /api/auth/csrf`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`, `/api/dashboard`, and `/api/access-control` paths.
- **Database:** No production schema change; add fixtures only in an isolated test DB if integration writes are needed. Never run reset/bootstrap for tests.
- **Authorization:** Verify `dashboard.view` and `roles.manage` enforcement and user status/sessionVersion checks.
- **Validation:** Secret present, not placeholder, >=32 UTF-8 bytes; exact frontend CORS origin; valid DB URL; do not emit secret values.
- **Tests:** Successful DB-backed login, wrong password/unknown user equivalence, disabled user, CSRF mismatch, session replay after logout, permission denial, DB unavailable/readiness response.
- **Acceptance criteria:** API starts only with valid config; readiness accurately reflects DB; browser login/logout completes against an isolated DB; no credentials/secrets appear in logs or responses.
- **Likely files:** `backend/src/index.ts`, `backend/src/app.ts`, `backend/test/auth.database.test.ts`, new isolated integration helpers/tests, `frontend/src/auth/AuthContext.tsx`, `frontend/src/auth/api.ts`, frontend component tests, `.env.example`, `README.md` (never `.env`).

### 2. Organization foundation

- **Priority / complexity:** P0 / Large.
- **Purpose:** Supply authoritative organization, site, department and job-designation references needed by employee profiles and reporting.
- **Dependencies:** Decide single-company vs multi-tenant scope, legal/company settings ownership, location/timezone policy, and archive/rename semantics.
- **Frontend:** Settings screens for company, branches/work locations, departments, and designations; forms, tables, search, validation and empty/error states.
- **Backend/API:** CRUD service/routes for organization, location, department, designation; stable pagination and uniqueness handling.
- **Database:** New models/relations for organization (if multi-tenant), location/branch, department and designation; add indexes and foreign keys in a new migration.
- **Authorization:** `roles.manage` or explicit organization-management permissions; enforce organization scope on every query.
- **Validation:** Unique names/codes within the chosen scope, valid active/archive transitions, prevent deleting referenced records, validate timezone.
- **Tests:** CRUD/duplicate/archive rules, forbidden cross-organization access, referenced-record deletion, pagination and transaction behavior.
- **Acceptance criteria:** Admin can maintain org references; employee assignments can reference valid active records; no route can cross the authorized organization boundary.
- **Likely files:** new `backend/src/organization/` domain modules and routes, `backend/src/app.ts`, `backend/prisma/schema.prisma`, new migration, frontend API/pages/components, tests, permission matrix and docs.

### 3. Employee management vertical slice

- **Priority / complexity:** P0 / Large.
- **Purpose:** Establish the core employee record that attendance, leave, payroll and reports depend on.
- **Dependencies:** Organization foundation; employee identifier and required-field policy; document storage decision; manager hierarchy rules.
- **Frontend:** Employee list with pagination/search/filter/sort, create/edit/detail views, deactivate/reactivate actions, validation and confirmation states; responsive profile/document section.
- **Backend/API:** Employee CRUD and detail endpoints, ID generation, duplicate detection, list query filters, status transitions and transaction-safe organization/manager assignment.
- **Database:** New `Employee` plus contact/employment/profile relations as needed; references to department/designation/location and manager; indexes for ID/email/name/status and commonly filtered fields. Documents should use external/object storage metadata, not raw large blobs by default.
- **Authorization:** Separate `employees.read` and `employees.manage` gates; scope records by organization; protect sensitive personal/contact data.
- **Validation:** Unique employee ID and defined unique identifiers; valid dates/status transitions; manager cannot be self or create a hierarchy cycle; referenced org records must be active; normalize email/phone according to policy.
- **Tests:** API CRUD/persistence, duplicates, bad references, cycle prevention, inactive behavior, permission boundaries, pagination/filter/sort, document authorization, UI loading/empty/validation states.
- **Acceptance criteria:** Authorized admins can create, list, view, edit, deactivate/reactivate employees; changes persist; unauthorized roles cannot read or mutate beyond policy; no sensitive fields leak in unrelated responses.
- **Likely files:** new `backend/src/employees/` modules/routes, `backend/src/app.ts`, Prisma schema/new migration, frontend employee pages/API/forms, navigation, backend/frontend tests.

### 4. User administration and role assignment

- **Priority / complexity:** P0 / Large.
- **Purpose:** Replace manual-only account/role operations with controlled administration.
- **Dependencies:** Existing authentication/RBAC matrix; account invitation/password setup policy; audit logging foundation should be implemented before enabling broad administrative changes.
- **Frontend:** User list/detail, create/invite, status control, role assignment and removal, guarded confirmation states; keep password management separate from role assignment.
- **Backend/API:** `users.read/create/update` route family and transaction services; safe role assignment through existing `UserRole`; ensure password is never returned; define invitation/reset flow.
- **Database:** Existing `User`/`UserRole` may suffice initially; add invitation/token/audit records only after policy is defined; new migration if required.
- **Authorization:** Enforce `users.read/create/update`; only `roles.manage` may assign privileged roles; prevent removing/demoting the last Super Admin unless a recovery policy is explicitly designed.
- **Validation:** Normalize/case-insensitive email uniqueness, allowed roles, account state transitions, no privilege escalation through request payloads.
- **Tests:** Create/read/update, duplicate email, assignment permissions, last-admin safety, inactive/suspended behavior, audit entry, no password/hash response.
- **Acceptance criteria:** Admin tasks persist through API/UI, non-admin users cannot mutate assignments, and every privileged change has an audit record.
- **Likely files:** new `backend/src/users/` modules/routes, `backend/src/app.ts`, possibly schema/new migration, `backend/src/auth/permissions.ts`, frontend users pages/API, tests.

### 5. Super Admin dashboard data

- **Priority / complexity:** P1 / Large.
- **Purpose:** Turn the current welcome shell into useful, accurate operational overview.
- **Dependencies:** Employee, organization, attendance and leave models; agreed definitions/timezone and authorization scope.
- **Frontend:** KPI cards/accessible charts/tables for employee totals, department distribution, attendance/leave summaries and recent activity; loading, no-data, stale/error states.
- **Backend/API:** Aggregated dashboard endpoints with bounded queries and deterministic date ranges; avoid sending entire datasets for client aggregation.
- **Database:** Read from underlying domain models; indexes determined from query plans; activity source requires audit model.
- **Authorization:** Existing `dashboard.view` plus scoped aggregate access; avoid revealing sensitive employee-level details in aggregate summaries.
- **Validation:** Explicit date range and timezone rules; clamp ranges and validate filters.
- **Tests:** Aggregation correctness against fixtures, empty periods, authorization scope, response schema, UI loading/empty/error and responsive rendering.
- **Acceptance criteria:** Dashboard values reconcile to source records and update with date filters; charts have accessible table/text equivalents; no PII leaks.
- **Likely files:** `frontend/src/pages/DashboardPage.tsx`, `frontend/src/auth/api.ts`, new backend dashboard service/routes, Prisma models/migrations from dependencies, tests.

### 6. Audit logging and core security operations

- **Priority / complexity:** P1 / Large.
- **Purpose:** Establish accountability before user, employee, payroll and asset mutations proliferate.
- **Dependencies:** Decide retention, actor identity, immutable fields, privacy/redaction, admin access and export policy.
- **Frontend:** Restricted audit viewer/search/filter after API exists; no editing/deleting audit events.
- **Backend/API:** Transactional audit writer for auth, role/user, employee and later sensitive actions; structured server logging with request/correlation IDs; centralized config validation; shared rate-limit storage/proxy policy for production.
- **Database:** New append-oriented `AuditEvent` model with actor, action, target type/id, timestamp and redacted metadata; indexes for actor/time/action; retention process documented.
- **Authorization:** Explicit audit-read permission; write events in the same transaction as important mutations where feasible; protect secrets/PII from event payloads.
- **Validation:** Allowlisted event/action shapes, payload size limits, no passwords, token values, hashes or unnecessary personal data.
- **Tests:** Atomic event creation, forbidden event reads, redaction, request correlation, persistence/retention behavior, production limiter configuration.
- **Acceptance criteria:** Sensitive changes produce searchable, protected events; secrets are never logged; deployment configuration has documented retention and rate-limit behavior.
- **Likely files:** `backend/src/app.ts`, `backend/src/index.ts`, new audit/logging modules and tests, Prisma schema/new migration, permission matrix, README/deployment docs.

## Phase 2 — Essential HRMS Workflows

### 7. Attendance

- **Priority / complexity:** P1 / Large.
- **Purpose:** Record and summarize employee working time.
- **Dependencies:** Employees, locations/timezones, holiday/shift rules, device/source and rounding policy.
- **Frontend:** Daily team view, employee check-in/out, monthly summaries, corrections and reports.
- **Backend/API:** Idempotent check-in/out commands, daily records, calculation service, correction request/approval routes, monthly aggregates.
- **Database:** Attendance events/records, correction requests, approver history; new migration and indexes by employee/date/status.
- **Authorization:** Employee self-service scope; manager/team scope; HR/admin correction permissions; audit all corrections.
- **Validation:** One valid open shift at a time, timestamps/timezone, nonnegative breaks, approved correction state transitions, duplicate event protection.
- **Tests:** Calculation boundaries, overnight/timezone/DST, duplicates, concurrent check-in, approval, permissions, monthly totals and persistence.
- **Acceptance criteria:** Daily and monthly results reconcile from events and policy; correction approvals are recorded and audited.
- **Likely files:** new `backend/src/attendance/`, schema/new migration, frontend attendance pages/API, permissions and tests.

### 8. Leave management and approvals

- **Priority / complexity:** P1 / Large.
- **Purpose:** Manage leave policies, balances, applications and decisions.
- **Dependencies:** Employee reporting hierarchy, holiday calendar, policy jurisdiction and accrual/carryover rules; shared approval model.
- **Frontend:** Leave type/policy administration, balance view, apply/cancel form, manager inbox, leave history.
- **Backend/API:** Policy/balance calculation, application and cancellation, approve/reject workflow, conflict checks, reports.
- **Database:** LeaveType, policy/version, balance/ledger, request, approval history; new migration.
- **Authorization:** Employee own records; manager assigned team; HR policy/override permissions; deny cross-scope reads.
- **Validation:** Date ordering, eligible dates, overlap, balance, attachment policy, request state and cancellation cutoff.
- **Tests:** Accrual/carryover calculations, overlap, concurrent approvals, state transitions, scopes and UI error/empty states.
- **Acceptance criteria:** Balances are explainable from ledger entries; application decisions and cancellations persist with actor/timestamps.
- **Likely files:** new `backend/src/leave/`, shared approval modules, schema/new migration, frontend leave pages/API, tests.

### 9. Holidays, shifts and schedules

- **Priority / complexity:** P1 / Large.
- **Purpose:** Define working calendars and planned schedules used by attendance and leave.
- **Dependencies:** Organization locations/timezones and attendance policy.
- **Frontend:** Calendar/weekly-off editor, shift setup, employee/team assignment and change history.
- **Backend/API:** Holiday CRUD, shift definitions, effective-dated assignments, conflict validation and overtime policy if approved.
- **Database:** HolidayCalendar/Holiday, Shift, ShiftAssignment and history; new migration.
- **Authorization:** HR/admin configuration; manager schedule scope; employees read own schedule.
- **Validation:** Nonoverlapping effective assignments, timezone/date boundaries, valid weekly-off pattern, no destructive removal of referenced shifts.
- **Tests:** Date/timezone/DST, overlapping assignment, historical versioning, permission and attendance calculation integration.
- **Acceptance criteria:** Each employee/date resolves to one effective schedule and calendar; changes do not rewrite historical records.
- **Likely files:** new `backend/src/scheduling/`, schema/new migration, frontend calendar/shift pages, tests.

### 10. Shared approval workflow

- **Priority / complexity:** P1 / Medium-Large.
- **Purpose:** Provide consistent reviewer/decision semantics for leave, attendance corrections and expenses.
- **Dependencies:** Manager mapping, domain-specific state machines and delegation policy.
- **Frontend:** Reviewer inbox, decision forms, history and notifications hooks.
- **Backend/API:** Reusable approval primitives or narrowly shared workflow service; domain-specific authorization and transitions remain explicit.
- **Database:** Approval steps/events with target references or domain-specific approval records; choose referential-integrity strategy before schema design.
- **Authorization:** Assigned approver only; separation of duties; HR override audited.
- **Validation:** Legal state transitions, no self-approval where prohibited, duplicate decision idempotency.
- **Tests:** Race/concurrent decisions, delegation, escalation, unauthorized reviewer and event history.
- **Acceptance criteria:** Each approval has a deterministic state and immutable decision history; no unauthorized or duplicate transition succeeds.
- **Likely files:** new workflow modules, domain routes/schema as necessary, UI inbox, tests.

## Phase 3 — Business Modules

### 11. Recruitment and onboarding

- **Priority / complexity:** P2 / Large.
- **Purpose:** Track openings, candidates through selection, and transition accepted hires into employees.
- **Dependencies:** Employee/org core; candidate privacy and retention policy; document storage; interview calendar integration decision.
- **Frontend:** Job opening, candidate profile/pipeline, interview schedule, selection and onboarding checklist/document views.
- **Backend/API:** Opening/candidate/stage/interview APIs; safe hire conversion; onboarding completion workflow.
- **Database:** JobOpening, Candidate, Application, Interview, OnboardingTask/Document metadata; new migration.
- **Authorization:** Recruiter/HR access separated from employee access; restrict candidate PII and documents.
- **Validation:** Legal stage transitions, duplicate candidate/application policy, time conflicts and document type/size.
- **Tests:** Pipeline transitions, conversion transaction, permissions, retention and integration adapter failure.
- **Acceptance criteria:** A selected candidate can be converted exactly once into a correctly linked employee; candidate data is access-controlled and retained per policy.
- **Likely files:** new `backend/src/recruitment/`, schema/new migration, frontend recruitment/onboarding pages, tests.

### 12. Performance management

- **Priority / complexity:** P2 / Large.
- **Purpose:** Support goals, review cycles, self/manager assessment and feedback.
- **Dependencies:** Employee hierarchy, review-cycle policy, rating/visibility/retention decisions.
- **Frontend:** Goal entry, employee self-review, manager review, feedback and reports.
- **Backend/API:** Cycle, goal, assessment, feedback, submission and lock/reopen workflows.
- **Database:** ReviewCycle, Goal, Assessment, Feedback and history; new migration.
- **Authorization:** Employee own submissions; assigned manager; restricted HR administration; explicit confidential feedback visibility.
- **Validation:** Cycle dates, submission states, reviewer assignment, rating scales and immutable finalized reviews.
- **Tests:** State transitions, visibility boundaries, reassignment, finalized record protection and reporting.
- **Acceptance criteria:** Reviews are attributable, versioned, permission-scoped and cannot be silently altered after finalization.
- **Likely files:** new `backend/src/performance/`, schema/new migration, frontend pages/API, tests.

### 13. Payroll and compensation

- **Priority / complexity:** P2 / Very Large.
- **Purpose:** Calculate and record pay accurately with controlled access and reproducible history.
- **Dependencies:** Deployment jurisdiction, currency, tax/statutory rules, payroll calendar, finance/accounting integration and legal review.
- **Frontend:** Salary structure, earnings/deductions, payroll run review/approval, payslip and history views.
- **Backend/API:** Versioned calculation engine, preview/finalize/void workflow, payslip generation, reconciliation/reporting.
- **Database:** Compensation versions, components, payroll runs/items, statutory snapshots and payslip metadata; new migration; immutable finalized outputs.
- **Authorization:** Strong separation of payroll operator/approver/read access; employee can read only own payslips; log every sensitive access/change.
- **Validation:** Currency/precision, effective dates, legal rounding, duplicate runs, idempotency, statutory rule versions and totals reconciliation.
- **Tests:** Jurisdiction-specific golden cases, rounding, mid-period changes, rollback/retry, access denial and immutable finalized run.
- **Acceptance criteria:** Finance-approved calculations reconcile exactly to source inputs and jurisdictional rules; no unauthorized salary or payslip disclosure.
- **Likely files:** new `backend/src/payroll/`, schema/new migration, frontend payroll pages, permission matrix, tests and compliance docs.

### 14. Expenses and assets

- **Priority / complexity:** P2 / Large.
- **Purpose:** Track employee reimbursements and company asset custody.
- **Dependencies:** Employee/org core, approval workflow, currency/reimbursement policy, receipt/object storage and inventory identifier policy.
- **Frontend:** Expense submission/receipt, approval/reimbursement states, asset inventory, assignment/return/history.
- **Backend/API:** Claim validation/approval/reimbursement endpoints; asset lifecycle and assignment history.
- **Database:** ExpenseClaim/Line/Receipt metadata/Approval; Asset/Assignment/History; new migration.
- **Authorization:** Employee own claims/assets; manager approval scope; finance reimbursement; inventory admin; sensitive receipts protected.
- **Validation:** Amount/currency/date/category/receipt requirements, duplicate claims, asset assignment availability, return condition.
- **Tests:** Duplicate/replay claims, approval, reimbursement state, asset contention, permission and receipt URL access.
- **Acceptance criteria:** Claims have traceable decisions and reimbursement state; assets have complete assignment/return history.
- **Likely files:** new expense/assets backend modules, schema/new migration, frontend pages/API, tests.

## Phase 4 — Reporting and Production Readiness

### 15. Reports and exports

- **Priority / complexity:** P2 / Large.
- **Purpose:** Produce consistent employee, attendance, leave and payroll reports and controlled exports.
- **Dependencies:** Source modules, metric definitions, access scopes, export format/retention and payroll statutory approval.
- **Frontend:** Filtered report catalog, saved filter parameters, export progress/download states.
- **Backend/API:** Paginated report queries and streaming/export jobs for large datasets; stable versioned schemas.
- **Database:** Add indexes/materialized aggregates only after query plans justify them; export job metadata if asynchronous.
- **Authorization:** Apply the same row-level scopes and field redaction as source screens; payroll exports restricted and audited.
- **Validation:** Filter ranges, timezone, row limits, injection-safe query construction, export expiration and file type.
- **Tests:** Reconciliation to source data, permission/filter leakage, large result limits, expired download and export failure.
- **Acceptance criteria:** Report totals reconcile to source screens; exports enforce identical scope and do not expose unauthorized fields.
- **Likely files:** report services/routes, frontend report views, schema/index migration only when evidenced, tests and API docs.

### 16. Notifications and integrations

- **Priority / complexity:** P3 / Large.
- **Purpose:** Deliver in-app/email alerts and connect approved external systems.
- **Dependencies:** Provider choice, privacy/consent, templates, delivery SLAs, retry and integration ownership.
- **Frontend:** Notification center/preferences/read state and integration status where needed.
- **Backend/API:** Queue/worker, event-to-notification rules, provider adapters, retry/dead-letter handling, versioned external APIs/webhooks.
- **Database:** Notification/preferences/delivery-attempt records and idempotency keys; integration credentials remain in secret storage, not DB/plaintext.
- **Authorization:** Own notification settings; service credentials least privilege; verify webhook signatures and replay windows.
- **Validation:** Template input escaping, recipient eligibility, payload schema, retry/idempotency, rate and size bounds.
- **Tests:** Provider failures/retries, duplicate delivery, preference suppression, webhook signature/replay and secret redaction.
- **Acceptance criteria:** Delivery state is observable without secret exposure; retries are bounded/idempotent and user preferences are honored.
- **Likely files:** notification/integration modules, workers, schema/new migration, frontend notification UI, tests and API documentation.

### 17. Production hardening, backup and recovery

- **Priority / complexity:** P1 / Large.
- **Purpose:** Operate the service reliably and protect employee/payroll data.
- **Dependencies:** Hosting/network topology, secrets provider, backup retention/RPO/RTO, support ownership and monitoring provider.
- **Frontend:** Production API URL/build deployment, user-visible retry/maintenance handling.
- **Backend/API:** Structured logs/metrics/traces, readiness/liveness, distributed rate-limit store, trusted proxy/CORS/security-header policy, graceful shutdown and resource limits.
- **Database:** Automated encrypted backups, restore drills, least-privilege app credentials, migration review/runbook; no destructive reset workflow.
- **Authorization:** Production RBAC review, administrative break-glass policy, access monitoring.
- **Validation:** Secret rotation without source exposure, TLS, dependency checks, restore and disaster drills, load and failure behavior.
- **Tests:** Deployment smoke tests, startup config failures, DB outage/readiness, rate-limit multi-instance, backup restore and security regression suite.
- **Acceptance criteria:** Documented RPO/RTO; successful restore drill; readiness detects DB outage; no secrets in logs; deployment can roll forward/back safely.
- **Likely files:** `backend/src/index.ts`, `backend/src/app.ts`, `scripts/dev.mjs`, root/backend package scripts, `.env.example`, deployment/runbook docs, monitoring and recovery configuration.

## Dependencies and Decisions to Resolve First

1. Confirm the local API is now able to start with a private valid `AUTH_TOKEN_SECRET`; do not share it. The last observed startup attempt failed this check.
2. Decide single-organization versus multi-tenant access boundaries before organization or employee schemas are designed.
3. Decide organization codes, employee ID generation, duplicate identity policy, manager hierarchy, and personal-data fields before employee CRUD.
4. Approve an isolated disposable DB strategy before adding write integration tests; existing opt-in test is read-only and not a fixture database.
5. Decide audit event retention/redaction and session invalidation after password reset before broad administration is exposed.
6. Obtain jurisdiction-specific payroll and tax/legal requirements before payroll implementation.
7. Choose document/object storage and notification/email providers before recruitment, expenses and notifications.
8. Preserve existing uncommitted changes; review `git status` before every implementation task. Never edit applied migrations or run reset/bootstrap/password-reset/initializer commands during feature development without explicit authorization.

## Recommended Single Next Development Task

**P0: Add an isolated DB-backed authentication integration suite and verify API readiness/startup configuration.** This is the narrowest next step because the current functional core depends on auth, yet existing DB coverage does not prove successful login/session behavior against PostgreSQL, and a prior observed backend startup was blocked by token-secret configuration. Do not use production/local employee data and do not make the test depend on a pre-created admin account.

**Likely files:** `backend/test/auth.database.test.ts` (replace/extend only after confirming its current read-only contract), new disposable-database test helper/config, `backend/src/index.ts`, `backend/src/app.ts`, and `.env.example`/`README.md` for test-only configuration. No `.env` edits or migration changes by default.

**Acceptance criteria:**

- The API fails fast with safe, field-specific configuration errors and never prints secret values.
- Liveness and PostgreSQL readiness are distinct and accurately report their states.
- An isolated test database is explicitly identified and guarded; test fixtures are created and cleaned only there.
- Tests cover successful persisted login, generic invalid credentials, status rejection, CSRF, session restoration, logout/sessionVersion invalidation, and current permission checks.
- No real user is created, no production data is touched, no migration is applied automatically, and the test suite remains opt-in until a disposable DB is configured.
- `npm run check`, `npm run build`, and Prisma validation pass.

After this foundation is reviewed and approved, begin Organization foundation followed by Employee CRUD as the first HR business vertical slice.
