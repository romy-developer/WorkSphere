# WorkSphere HRMS: Employee Management CRUD Plan

Date: 14 October 2026
Status: **Plan only. No implementation or database operation has been performed.**

## 1. Verified Current State

The current Prisma schema contains only `User`, `Role`, `Permission`, `UserRole`, and `RolePermission`. The existing migration, `backend/prisma/migrations/20261014000100_auth_rbac_init/migration.sql`, creates those auth/RBAC structures; it has no employee or organization records. Do not edit that migration.

The Express API currently mounts auth routes from `backend/src/routes/auth.ts` and two protected routes from `backend/src/routes/protected.ts`. There are no controllers, services, repositories, or endpoints for employees, departments, or designations. The existing pattern is route -> service -> repository, with Zod request validation, `authenticate`, `requirePermission`, Prisma, and a generic safe 500 response in `backend/src/app.ts`.

The frontend routes in `frontend/src/App.tsx` are `/login`, `/dashboard`, `/roles`, and `/unauthorized`. `frontend/src/pages/RolesPage.tsx` is a read-only API-backed view; it is not a CRUD/form pattern. `frontend/src/pages/DashboardPage.tsx` is a basic welcome view. The shared shell and permission-aware navigation are in `frontend/src/components/ProtectedLayout.tsx`; API calls and response parsing are in `frontend/src/auth/api.ts`. No employee table, reusable data-table/form library, or employee form exists.

The existing permission keys are already declared in `backend/src/auth/permissions.ts`: `employees.read` and `employees.manage`. The current source matrix intends both for `SUPER_ADMIN` and `HR_ADMIN`, read-only for `MANAGER`, and neither for `EMPLOYEE`. The actual role/permission rows in a live database have not been verified by this plan.

Backend tests use Vitest/Supertest and the in-memory `InMemoryAuthRepository` in `backend/test/helpers.ts`. Current endpoint coverage is in `backend/test/auth.test.ts`. The opt-in `backend/test/auth.database.test.ts` is read-only and must remain excluded until the dedicated test database is configured and approved. Its URL guard is in `backend/test/database-test-config.ts`; five guard unit tests currently cover its safety rules.

## 2. Confirmed Decisions

| Decision | Status | Approved requirement |
|---|---|---|
| Organization scope | **APPROVED** | Single organization. Do not add an organization/tenant model solely for this milestone. |
| Employee ID | **APPROVED** | Generate automatically, e.g. `EMP0001`; callers do not choose IDs. Generation must be concurrency-safe and backed by a database unique constraint. |
| Login account | **APPROVED** | Optional. An employee can exist without a `User` account. Employee creation must never automatically create a login. |
| Department and designation | **APPROVED** | Separate catalog/master tables with foreign-key relationships from Employee. Catalog management endpoints/UI are a separate scope decision and must not be assumed to exist. |
| Employee departure | **APPROVED** | Soft deactivation; preserve employee and related history, with an explicit reactivation path. Do not physically delete the employee. |
| ID and work-email uniqueness | **APPROVED** | Employee IDs and work emails are globally unique. Deactivated employees continue reserving both values unless a separately approved future policy permits reuse. |

## 3. Technical Proposals and Remaining Schema Review

The approved decisions above are requirements. The following are technical proposals, not existing code or already-final schema choices:

- Canonicalize work email by trimming and lowercasing at every API write. Enforce case-insensitive collision behavior at the database level, not just in a pre-insert query; review a canonical stored-value check plus unique constraint, a functional `lower(workEmail)` unique index, or another Prisma/PostgreSQL-compatible strategy. The chosen migration must make mixed-case duplicates impossible even if a write bypasses the application service.
- Generate employee IDs from a dedicated PostgreSQL sequence, formatting `EMP` plus a zero-padded sequence value (e.g. `EMP0001`). A sequence is atomic across concurrent app instances and permits gaps; never derive IDs from `COUNT(Employee)`, `MAX(employeeId)`, or an unlocked read-then-increment. Keep a global unique database constraint as the final collision guard; IDs remain reserved after deactivation.
- Model deactivation separately from employment lifecycle (for example, `deactivatedAt IS NULL` means active in the system, non-null means deactivated) so termination/employment status is not conflated with record visibility.
- Keep employment type/status enum values proposed until HR approves allowed values and transitions. Treat leave workflow as separate unless the future leave domain explicitly defines status integration.
- Optional login linkage may be a nullable unique `Employee.userId` relation. Linking must be explicit; require approved identity reconciliation, compare normalized employee work email and existing `User.email` case-insensitively, and reject a `User` already linked to another employee. Do not create a `User` during employee creation or change `User.email`, password, session version, status, roles, or permissions as a side effect.
- Do not add profile photo or address until storage, privacy, access, retention and deletion requirements are approved. No media/document architecture currently exists.
- Require an assigned manager, when present, to reference a valid Employee; prevent self-reference and reporting cycles. The policy for managers who later deactivate requires review; never cascade-delete subordinates or their history.

The existing `User.email` field has a case-sensitive unique constraint. A unique index on Employee work email cannot by itself enforce uniqueness across two tables. An Employee and User may share a normalized address only when they represent the same identity through an explicit one-to-one link; if a matching unlinked User exists, do not create a second identity or auto-link—return a conflict and require the explicit authorized link workflow. A pre-check alone is race-prone if User creation can run concurrently. If strict cross-table uniqueness is required, schema review must choose a shared canonical identity registry or another database-enforced strategy; do not claim that ordinary per-table unique indexes provide it.

### Conflicts and Dependencies

- The current schema and migration contain authentication/RBAC models only; `Employee`, `Department`, and `Designation` do not exist. This milestone therefore needs a new reviewed migration, not edits to the existing migration.
- `User.email` has a case-sensitive unique constraint. Employee work email is approved globally unique and case-insensitive. Review the cross-model identity policy and database enforcement for normalized Employee email before implementation; do not rely only on application pre-checks.
- The optional employee-to-`User` relation requires a minimal Prisma inverse relation on `User`, but no auth field, password, status, session version, role, or permission behavior should change. Account creation is explicitly not part of Employee CRUD.
- `employees.read` and `employees.manage` already exist in `backend/src/auth/permissions.ts`; employee APIs/UI do not exist. Do not alter existing role grants. The declared `MANAGER` read grant does not itself define which employee rows managers may read; approve row-level visibility and manager linkage before exposing list/detail data.
- Separate Department and Designation tables are approved as employee references, but catalog management endpoints/UI are not present and are a separate scope decision. Employee forms need a safe way to list valid catalog values before they can be operational; do not invent automatic catalog seeding.
- Single-organization scope is approved. Do not add an organization/tenant model, tenant fields, or organization-scoped unique keys solely for this milestone.
- The employee-ID sequence/default and case-insensitive email constraint may require database-specific migration SQL that Prisma 6 does not represent fully. Verify Prisma schema/introspection behavior and generated migration diff before approval/application.
- The test integration suite is read-only today and no `worksphere_test` DB run is recorded. Do not use `worksphere`; any persistence/concurrency test must wait for the approved isolated role/database setup.

## 4. Proposed Data Model

Names and enum values below are proposals, subject to the decisions above and Prisma validation during implementation.

### Employee

| Field | Proposed type / nullability | Constraints and notes |
|---|---|---|
| `id` | UUID, required | Internal primary key, generated by Prisma. Not the human-facing employee ID. |
| `employeeId` | `VarChar(32)`, required | Globally unique, generated by the database sequence, e.g. `EMP0001`; never accepted from create/update payloads and never reused after deactivation. |
| `firstName` | `VarChar(100)`, required | Trim and validate length at API boundary. |
| `lastName` | `VarChar(100)`, required | Trim and validate length at API boundary. |
| `workEmail` | `VarChar(320)`, required | Globally unique, canonical lowercase form after trimming. Database enforcement must make uniqueness case-insensitive. Inactive employees retain the value. |
| `mobile` | `VarChar(32)`, optional | Normalize/validate format per agreed policy; do not log. |
| `departmentId` | UUID, required | Foreign key to separate `Department` catalog; indexed; referenced catalog cannot be deleted while in use. |
| `designationId` | UUID, required | Foreign key to separate `Designation` catalog; indexed; referenced catalog cannot be deleted while in use. |
| `employmentType` | Enum, required | Candidate values: `FULL_TIME`, `PART_TIME`, `CONTRACT`, `TEMPORARY`, `INTERN`; product approval required. |
| `employmentStatus` | Enum, required, default `ACTIVE` | Technical proposal: `ACTIVE`, `ON_LEAVE`, `TERMINATED`; approve lifecycle/transitions. Deactivation is separate via `deactivatedAt`; leave approvals remain a separate workflow. |
| `joiningDate` | PostgreSQL `DATE`, required | Validate a real calendar date and policy on future dates. |
| `reportingManagerId` | UUID, optional | Self-relation to `Employee`; indexed; restrictive delete behavior to preserve history. Validate no self-reference/cycles and manager eligibility in service. |
| `userId` | UUID, optional, unique | Optional one-to-one FK to `User`; null for employees without login accounts. Link only through an explicit identity-checked flow. A minimal reverse relation field on `User` may be needed by Prisma. |
| `deactivatedAt` | Timestamptz, optional | Null means active; set on soft deactivation and clear only on approved reactivation. This preserves the row and history. |
| `createdAt`, `updatedAt` | Timestamptz, required | Use existing Prisma timestamp conventions; update on profile/lifecycle changes. |

Profile-photo and address fields are intentionally excluded from the first model: no compatible media/document subsystem or PII policy was found. Never store passwords, session tokens, authentication cookies, password hashes, or other credentials in employee profile fields.

### Employee ID Generation

Use a dedicated PostgreSQL sequence (proposed name `EmployeeIdSequence`) as the concurrency-safe source of numbers. The migration should establish a database-side default/generation mechanism that formats the next value as `EMP` plus a minimum four-digit, zero-padded decimal number; wider values remain intact. Sequence allocation is atomic across concurrent requests and may leave gaps after rollbacks; gaps are expected and must not be repaired by reusing IDs. Do not use a row count, `MAX(employeeId)`, an in-memory counter, or an unlocked read-then-increment. Apply a global unique constraint on `Employee.employeeId`; translate an unexpected collision to a safe error. Review how the chosen default is represented and introspected by Prisma 6 before finalizing schema and migration.

### Work Email Normalization and Uniqueness

Treat work email as case-insensitive by policy: trim whitespace and lowercase before validation/storage and use the normalized value for comparisons. Enforce the policy in PostgreSQL as well as the service. The schema review must choose a representation supported safely by this Prisma version, such as a canonical lowercased stored value with a database check plus unique constraint, or a migration-managed functional unique index on `lower(workEmail)`. A simple case-sensitive `@unique` on unnormalized input is insufficient. On conflicts, return a safe `409`; never disclose another employee's details. Deactivation does not release the address.

### Department and Designation Catalogs

Add separate catalog models so employee forms and foreign keys use persisted references rather than free-text values. This approves the data relationship, not catalog CRUD scope: department/designation administration endpoints and UI are a separate scope decision and must not be assumed to exist or silently included. There are currently no catalog models, APIs, or screens. Employee form dropdowns depend on approved catalog read APIs and available catalog records.

- `Department`: UUID primary key, display name, optional code, active/deactivated state, timestamps. Decide name/code uniqueness and normalization during schema review.
- `Designation`: UUID primary key, title, optional code, active/deactivated state, timestamps. Whether designation belongs to a department remains a technical decision.
- Employee relations use restrictive delete behavior while referenced; catalog rows are deactivated/archived rather than deleted. Single-organization scope means no organization/tenant model or organization-scoped uniqueness is added solely for this milestone.

### Indexes and Uniqueness

- Global unique `employeeId` backed by the sequence-generated value; IDs remain reserved after deactivation.
- Global case-insensitive unique `workEmail` across Employee records; addresses remain reserved after deactivation.
- Unique nullable `Employee.userId` to enforce at most one employee profile per login account.
- Index `departmentId`, `designationId`, `reportingManagerId`, `employmentStatus`, and `joiningDate` based on list filters and relationship queries.
- No organization compound indexes are proposed for this single-organization milestone. Add indexes only for approved query/filter patterns.
- A `User` back-relation field may be needed for Prisma's optional one-to-one relation. Any such change must be minimal and reviewed; do not modify existing User email/password/status/session semantics, Role, Permission, UserRole, or RolePermission behavior.

### Migration Proposal

Use a new, timestamp-prefixed migration such as `YYYYMMDDHHMMSS_employee_management_init` (final timestamp/name assigned when implementation is approved). Expected effects: create `Employee`, `Department`, and `Designation` tables; add approved employment enums, foreign keys, global unique constraints, query indexes, the employee-ID sequence/default, and the database enforcement for canonical case-insensitive work email. Add only the minimal optional inverse `User` relation field required for a one-to-one Employee link; do not alter User's existing email/password/status/session behavior. Do not create an Organization/tenant model for this single-organization milestone. The migration must not drop or rewrite existing auth/RBAC rows. Review Prisma's generated SQL plus any intentional sequence/functional-index SQL and the target database before applying. No migration is created or run during this planning task.

## 5. Backend Plan

Add an `employees` module consistent with current route/service/repository separation:

- `backend/src/routes/employees.ts` (or module-owned route file) mounts authenticated endpoints through `backend/src/app.ts`.
- `backend/src/employees/service.ts` owns use cases and lifecycle rules.
- `backend/src/employees/prisma-repository.ts` owns Prisma queries and writes.
- `backend/src/employees/validation.ts` (or equivalent module-local schemas) defines strict Zod request/query validation.

Proposed route contract:

| Method / route | Purpose | Permission |
|---|---|---|
| `GET /api/employees` | Paginated list, search and filters | `employees.read` |
| `GET /api/employees/:id` | View employee details | `employees.read` |
| `POST /api/employees` | Create employee | `employees.manage` |
| `PATCH /api/employees/:id` | Update editable fields | `employees.manage` |
| `POST /api/employees/:id/deactivate` | Soft-deactivate without physical deletion | `employees.manage` |
| `POST /api/employees/:id/reactivate` | Reactivate a previously deactivated employee | `employees.manage` |
| `POST /api/employees/:id/account-link` | Explicitly link an existing matching User; separate scope/approval, never creates a user | `employees.manage` and `users.update` |

Use the existing `authenticate` middleware and `requirePermission` on every route. Zod should reject unknown fields, malformed IDs, invalid enum values, invalid pagination, and oversized search parameters. Return field-safe `400` validation errors; `401` unauthenticated; `403` forbidden; `404` employee/reference not found; `409` duplicate employee ID or normalized work email; generic `500` for unexpected failures. Do not expose Prisma errors, SQL, stack traces, PII beyond the authorized response, or secrets.

List API proposal: bounded `page`/`pageSize` parameters (e.g. defaults `1`/`25`, maximum `100`), stable ordering with an ID tiebreaker, and filters for employment status/type, department, designation, and manager. Search only approved fields such as employee ID, name, and work email. Normal lists exclude `deactivatedAt IS NOT NULL`; `includeDeactivated=true` should require `employees.manage`. Return a typed page envelope with records, page, page size, and total (or an approved cursor contract). Validate sort fields against an allowlist; never interpolate user sort/search input into raw SQL.

Deactivation only sets `deactivatedAt` and the update timestamp. It does not delete or cascade to related records, clear department/designation/manager history, release employee ID/work email, or change employment status unless a separately approved policy defines that mapping. Reactivation is explicit, clears `deactivatedAt`, keeps the same ID/email, and validates references before restoring normal-list visibility. Do not add a physical DELETE endpoint.

Create/update operations should use Prisma's parameterized client calls and unique constraints as the final duplicate guard. Normalize employee IDs and work email before persistence. Map unique-constraint errors to safe `409` errors. Use a transaction when a workflow changes multiple records (e.g. employee plus audit event or optional account link); a single employee row mutation need not be wrapped in a redundant transaction. Deactivation and relationship checks must be atomic enough to avoid invalid manager/reference races; add retry/locking only if demonstrated necessary.

Do not automatically assign RBAC permissions or create/link a `User` while creating an employee. If the optional account-link workflow is included, make it a separate explicit request: the target `User` must already exist, be unused by another Employee, and match the employee's canonical work email under a case-insensitive comparison. Require both `employees.manage` and `users.update`; never set/reset passwords or alter role grants/session/auth fields. No login credentials are accepted in Employee CRUD. Do not add raw SQL unless Prisma cannot express a demonstrated constraint; sequence/default and case-insensitive uniqueness SQL must be reviewed and tested explicitly.

## 6. Permissions and RBAC

The minimum permission contract already exists: `employees.read` for list/detail and `employees.manage` for create/update/deactivate/reactivate. Reuse these keys rather than introducing duplicates. `backend/src/auth/permissions.ts` currently lists both for `SUPER_ADMIN` and `HR_ADMIN`, `employees.read` for `MANAGER`, and neither for `EMPLOYEE`. Preserve all existing role-to-permission grants; do not automatically grant permissions to all existing database roles or users. Actual DB assignment state remains unverified.

Implementation should add route-level guards for every operation, test the current intended matrix, and keep frontend navigation visibility as convenience only. Because `MANAGER` already has `employees.read`, approve whether that permission exposes the directory or only a managed reporting population before shipping list/detail routes; do not silently assume full-directory visibility. The optional account-link route must also require `users.update`. Any change to role grants requires separate review, an intentional initialization/migration strategy, and approval; employee feature deployment must not silently elevate roles.

## 7. Frontend Plan

- Add employee route(s) under the existing protected layout in `frontend/src/App.tsx`.
- Add a permission-filtered navigation entry in `frontend/src/components/ProtectedLayout.tsx` using `employees.read` (or an approved route access rule).
- Extend `frontend/src/auth/api.ts` with typed list/detail/create/update/deactivate functions and response parsing; preserve credentialed requests and safe error handling.
- Add `frontend/src/pages/EmployeesPage.tsx` for list/search/filter/pagination, and create/edit/detail pages or focused components following the current Tailwind visual language.
- Add labeled accessible inputs, keyboard-operable controls, semantic table/list markup, pending/disabled submit states, inline validation, confirmation before deactivation, and responsive overflow handling.
- Cover initial loading, empty results, successful mutation, field validation, 401/403/404/409 and network/server errors without exposing backend internals.
- Do not add photo upload/address controls until storage and PII policy is approved. Do not introduce a component/UI library without an identified need; none exists for forms/tables currently.

## 8. Testing Plan

### Safe unit/API tests (no database)

Use Vitest, Supertest, `createTestApp`, `InMemoryAuthRepository`, `makeUser`, and the existing fake hasher patterns in `backend/test/helpers.ts`:

- Valid create/list/detail/update/deactivate requests and expected response shapes.
- Zod failures for missing/extra fields, length bounds, invalid UUIDs, invalid dates/enums, invalid page/page size, bad filters/sort keys.
- Duplicate employee ID and work email conflicts, including mixed-case work-email normalization.
- Sequence-backed ID generation under concurrent create attempts (isolated PostgreSQL integration test) and database uniqueness as the final guard; no count-based IDs.
- Not-found employee, department, designation and manager references.
- Optional login behavior: create an employee without a User, explicit link to a matching existing User, reject email mismatch/already-linked User, and prove Employee creation never creates a User or changes auth/RBAC state.
- `401` for missing/invalid session; `403` for callers without `employees.read`/`employees.manage`; manager/read-only behavior and no privilege escalation.
- Case-insensitive work-email collision detection, including an unlinked User with a matching email; require explicit link or return conflict according to the approved identity policy.
- Deactivation retains the row and references, leaves ID/email reserved, removes it from default active-list results, and reactivation restores it without changing the ID/email.
- Search, filters, stable pagination ordering and total/page metadata, including empty results.
- Manager self-assignment, cycles, missing/inactive manager policy, department/designation relationship validation, and invalid employment/deactivation transitions.

### Frontend tests

Use current frontend Vitest setup; there is currently only a permission utility test and no DOM testing dependency. First choose a test approach compatible with installed dependencies (or request approval before adding a package). Cover list states, pagination/search interactions, form validation, submit errors/success, permission-gated navigation, deactivation confirmation, and accessibility labels/keyboard flow.

### Database integration tests (gated)

Do not run or add integration tests against the regular `DATABASE_URL`/`worksphere` database. Only after the dedicated `worksphere_test` role and database are safely configured and explicitly approved, extend guarded `backend/test/auth.database.test.ts` or add a guarded employee integration suite that explicitly injects `WORKSPHERE_TEST_DATABASE_URL`. Keep URL guards; verify exact current database name before any fixture writes. Use deterministic test-owned records, transactions or cleanup restricted to the disposable DB, and no production/local business data. Until that setup and successful run occur, DB persistence tests remain **PENDING / REQUIRES VERIFICATION**.

## 9. Implementation Phases

### Phase 0: Schema and policy review

- Confirm canonical work-email storage plus database-enforced case-insensitive uniqueness and review collision behavior with existing `User.email` values.
- Validate Prisma 6 representation for the sequence-backed `employeeId` default, optional one-to-one User relation, catalog relations, employment enums, timestamps and restrictive deletion behavior.
- Decide Department/Designation uniqueness and how catalogs are populated/read. Catalog management CRUD/UI must be separately scoped and approved; employee forms cannot assume those APIs already exist.
- Confirm manager eligibility and the existing `MANAGER` role's row-level `employees.read` scope.

### Phase 1: Database model and migration proposal

- Add proposed Employee, Department and Designation models and indexes only after Phase 0 decisions.
- Generate/review a new timestamped migration; check that it only creates/extends the intended employee/catalog structures, sequence and constraints, with no auth/RBAC rewrites or destructive operations.
- Review migration SQL and target environment. Do not apply it until explicitly approved.

### Phase 2: Backend persistence and API

- Implement repositories, service/use cases and strict Zod schemas.
- Add list/detail/create/update/deactivate/reactivate routes with existing auth middleware and permission keys.
- Implement sequence-based ID creation, canonical global work-email conflict handling, catalog/manager validation, explicit optional User linking, safe errors and default active-list filtering.
- Add isolated in-memory/Supertest tests for validation, duplicate/not-found, auth/RBAC and lifecycle rules.

### Phase 3: Frontend

- Add employee list with search, approved filters and stable pagination; add detail and create/edit forms.
- Add accessible field errors, loading/empty/success/error states, permission-gated navigation and a deactivation confirmation.
- Keep catalog selection dependent on an approved catalog read API/data source; do not invent catalog CRUD.
- Add frontend behavior tests using the existing test stack; package additions require separate approval if needed.

### Phase 4: Verification and release gate

- Run type checks, unit/API/frontend tests, build and Prisma validation without loading a DB integration suite accidentally.
- Run employee persistence/concurrency integration tests only after the dedicated `worksphere_test` role/database is configured and explicitly approved. Never run against `worksphere`.
- Review permission grants and migration SQL; apply the migration only with explicit target verification and approval.
- Update the audit/roadmap from observed results; keep database integration marked pending until the isolated suite succeeds.

## 10. Risks and Approval Gates

- **PII:** Employee names, email and mobile are personal data. Define local access, retention, backup, export and audit requirements before production use.
- **Organization scope:** A single-company schema may require redesign if future multi-tenancy is expected; decide before migration.
- **Duplicate normalization:** Existing PostgreSQL unique constraints are case-sensitive. Canonicalize identifiers in the service and ensure DB-level constraints support the approved uniqueness policy.
- **Reference data:** Employees cannot select real departments/designations until the catalogs and authorized setup workflow exist; do not invent seeded production records.
- **Manager hierarchy:** Prevent self-reference/cycles and define behavior for deactivated managers.
- **RBAC drift:** Source role matrix does not prove live `RolePermission` rows. Verify only through an approved safe environment; never widen grants automatically.
- **Migration/data risk:** New migration only; inspect generated SQL; no reset, drops, or modification of applied migrations.
- **Integration test risk:** The development DB is explicitly forbidden for integration tests; require the isolated test role/database and exact-name guard.
- **Document/photo risk:** No existing media storage; avoid upload/storage changes until separately designed.

## 11. Acceptance Criteria

The milestone is complete only when all approved criteria are met:

1. Prisma schema and reviewed new migration contain the Employee/Department/Designation relations, internal primary key, sequence-generated globally unique employee ID, globally unique normalized work email, optional unique User link, indexes and deactivation timestamp. No organization model or unnecessary auth-model behavior changes are introduced.
2. ID generation is safe under concurrent creates, never count-derived, and backed by a global database unique constraint. Case-insensitive work-email collisions are rejected by database enforcement as well as API normalization.
3. API list/search/filter/pagination, detail, create, update, deactivate and reactivate persist via Prisma, validate all untrusted input, and preserve inactive history. Deactivated rows are omitted from normal lists and reactivation retains the same ID/email.
4. Every route enforces authentication and the intended permission; the current role grants are unchanged. Optional account linking is explicit, identity-checked, one-to-one, and creates no User/password/role automatically.
5. Frontend employee list/form/detail supports accessible search, approved filters, pagination, save feedback, errors, and deactivation confirmation in responsive existing styles. Photo/address remain out of scope.
6. Tests cover validation, CRUD, duplicate IDs/emails, case-insensitive conflicts, concurrent ID generation, optional account linkage, deactivation/reactivation, manager relationships, not found, authorization, search/pagination, and UI states.
7. Any database integration test runs only against an explicitly approved, dedicated `worksphere_test` database after the suite is successfully verified; otherwise persistence integration remains marked unverified.
8. Type checks, non-DB tests, build, and Prisma schema validation pass. Migration deployment has separate explicit approval.
