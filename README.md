# WorkSphere HRMS

WorkSphere is a TypeScript monorepo for an HR management system. Module 1 provides cookie-based authentication and RBAC using a React + Vite frontend, an Express API, PostgreSQL through Prisma, and Vitest/Supertest testing. Employee management, attendance, leave, and payroll modules are not included.

## Requirements

- Windows 10/11
- Node.js 20.19 or newer and npm
- PostgreSQL 18 running locally or reachable from this machine

## Setup

Project documentation: [Module Audit](docs/HRMS_MODULE_AUDIT.md), [Development Roadmap](docs/HRMS_DEVELOPMENT_ROADMAP.md), and the [WorkSphere Laptop Setup Guide](docs/WORKSPHERE_LAPTOP_SETUP_GUIDE.md).

Run these commands from the repository root in PowerShell. The conditional copy preserves an existing local `.env`:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Edit `.env` and replace `DB_USER` and `DB_PASSWORD` with your PostgreSQL credentials. Keep the real values in `.env`; it is ignored by Git. The connection targets the existing `worksphere` database and does not create or migrate it.

Set `AUTH_TOKEN_SECRET` to a fresh random secret of at least 32 bytes. For example, generate 32 random bytes locally in PowerShell and copy the hexadecimal result into `.env`:

```powershell
[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

Do not commit or share the generated value. `FRONTEND_ORIGIN` should exactly match the local Vite origin. `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` are only needed when running the one-time administrator bootstrap; no default administrator password is provided.

```powershell
npm install
npm run db:validate
npm run db:generate
```

Before applying a migration, inspect `backend/prisma/migrations/20261014000100_auth_rbac_init/migration.sql` and confirm the target database and existing tables. This migration creates the `UserStatus` enum, five auth/RBAC tables, indexes, and foreign keys. It contains no drops or changes to existing tables. Do not run the deployment command until that change is approved and the target schema has been checked. Once approved, apply with:

```powershell
npm run db:migrate:deploy
npm run db:generate
```

The application API and frontend run locally at `http://localhost:3000` and `http://localhost:5173`:

```powershell
npm run dev
```

The frontend uses an HttpOnly, SameSite=Strict session cookie. Production sets the cookie's Secure flag. A double-submit CSRF token is required for login and logout. Sessions expire after 15 minutes; logout increments the user's session version so a copied token is invalidated server-side. Login attempts are rate-limited, and inactive/suspended accounts receive the same generic failure as invalid credentials.

## RBAC Initialization

After the auth/RBAC migration is applied, initialize the approved Super Admin role, seven permission records, and their `RolePermission` links. This command is safe to repeat: existing records and descriptions are preserved, and missing links are added transactionally. It does not create users or modify any other roles.

```powershell
npm run initialize:rbac --workspace backend
```

To verify in a SQL client connected to the same database, this query should return `SUPER_ADMIN` with all seven permission keys:

```sql
SELECT r.name, p.key
FROM "Role" AS r
JOIN "RolePermission" AS rp ON rp."roleId" = r.id
JOIN "Permission" AS p ON p.id = rp."permissionId"
WHERE r.name = 'SUPER_ADMIN'
ORDER BY p.key;
```

## Initial Administrator

After the migration is explicitly approved and applied, set `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` in the ignored root `.env`, then run:

```powershell
npm run bootstrap:admin --workspace backend
```

The password must be at least 14 characters with upper-case, lower-case, numeric, and symbol characters. It is hashed with Argon2id. Before running bootstrap, the `SUPER_ADMIN` role, all seven permissions in the matrix below, and their `RolePermission` links must already exist. Bootstrap checks this configuration but does not create or update roles or permissions; it fails with the missing configuration names if anything is absent.

Bootstrap creates only the new `User` and its `UserRole` link in a serializable transaction. An email belonging to a non-admin account is rejected without elevation. If that account is already a Super Admin, or another Super Admin already exists, a retry is a no-op and does not rehash or replace any password. Concurrent serialization or email-uniqueness conflicts are retried up to three times, with account state checked again on each attempt. Success and failure messages never print the supplied email or password.

## Roles and Permissions

Every authenticated business API requires authentication and the route-specific permission. The interface hides inaccessible navigation as a convenience only; the backend enforces all access.

| Permission | SUPER_ADMIN | HR_ADMIN | MANAGER | EMPLOYEE |
| --- | --- | --- | --- | --- |
| `users.read` | Yes | Yes | No | No |
| `users.create` | Yes | Yes | No | No |
| `users.update` | Yes | Yes | No | No |
| `roles.manage` | Yes | No | No | No |
| `employees.read` | Yes | Yes | Yes | No |
| `employees.manage` | Yes | Yes | No | No |
| `dashboard.view` | Yes | Yes | Yes | Yes |

`GET /api/auth/csrf`, `POST /api/auth/login`, `GET /api/auth/me`, and `POST /api/auth/logout` provide session operations. `GET /api/dashboard` requires `dashboard.view`; `GET /api/access-control` requires `roles.manage`. No user CRUD or employee records are implemented in this module.

## Common Commands

```powershell
npm run check       # Type checks and tests
npm run build       # Production builds for both workspaces
npm test            # Backend Supertest and frontend Vitest suites
npm run db:validate # Validate the Prisma schema
npm run db:generate # Generate the Prisma client
npm run db:migrate:deploy # Apply pending migrations (database-changing; review and approve first)
npm run initialize:rbac --workspace backend # Initialize Super Admin role and permissions (database-changing)
npm run bootstrap:admin --workspace backend # Create initial Super Admin (database-changing)
```

The optional database-backed authentication test is read-only and runs only when `RUN_DATABASE_AUTH_TESTS=1`. It requires `WORKSPHERE_TEST_DATABASE_URL` in the ignored root `.env`, targeting a local PostgreSQL database named exactly `worksphere_test`. Use a dedicated test-only role that has no access to the development or production database; do not reuse `DB_USER` or put real credentials in tracked files. URL-encode reserved characters in the test role password. `.env.example` contains placeholders only.

PowerShell does not automatically import `.env` values into its process environment. For the migration procedure below, load only the two URLs into the current process without displaying them. This does not modify `.env`:

```powershell
$databaseSettings = @{}
foreach ($line in Get-Content -LiteralPath ".env") {
	if ($line -match '^\s*(DATABASE_URL|WORKSPHERE_TEST_DATABASE_URL)\s*=\s*(.*)$') {
		$name = $Matches[1]
		$value = $Matches[2].Trim()
		if ($value.Length -ge 2 -and $value.StartsWith('"') -and $value.EndsWith('"')) {
			$value = $value.Substring(1, $value.Length - 2)
		}
		$databaseSettings[$name] = $value
	}
}

if ([string]::IsNullOrWhiteSpace($databaseSettings["DATABASE_URL"]) -or
		[string]::IsNullOrWhiteSpace($databaseSettings["WORKSPHERE_TEST_DATABASE_URL"])) {
	throw "Both database URLs must be configured in .env."
}

$env:DATABASE_URL = $databaseSettings["DATABASE_URL"]
$env:WORKSPHERE_TEST_DATABASE_URL = $databaseSettings["WORKSPHERE_TEST_DATABASE_URL"]
```

The migration procedure aborts if either URL is missing or malformed, if the test URL is not local PostgreSQL database `worksphere_test`, or if its host/port/database matches the application URL. Do not remove the checks or substitute a default URL.

No database is created or migrated automatically. These are proposed commands for review only; do not run them until creation and schema writes to the dedicated test database are explicitly approved. First provision the dedicated `worksphere_test_user` PostgreSQL role with access limited to the test database. The role must exist before database creation. Then create the database as a PostgreSQL administrator:

```powershell
createdb -h localhost -U postgres -O worksphere_test_user worksphere_test
```

After the two URLs have been explicitly supplied to this PowerShell process, validate them and apply migrations only to the test database:

```powershell
$testUrl = $env:WORKSPHERE_TEST_DATABASE_URL
$applicationUrl = $env:DATABASE_URL
if ([string]::IsNullOrWhiteSpace($testUrl) -or [string]::IsNullOrWhiteSpace($applicationUrl)) {
	throw "Both database URLs must be configured in this PowerShell process."
}

$testUri = $null
$applicationUri = $null
if (
	-not [uri]::TryCreate($testUrl, [System.UriKind]::Absolute, [ref]$testUri) -or
	-not [uri]::TryCreate($applicationUrl, [System.UriKind]::Absolute, [ref]$applicationUri)
) {
	throw "A database URL is malformed."
}

$testDatabase = [uri]::UnescapeDataString($testUri.AbsolutePath.TrimStart('/'))
$applicationDatabase = [uri]::UnescapeDataString($applicationUri.AbsolutePath.TrimStart('/'))
$testPort = if ($testUri.Port -gt 0) { $testUri.Port } else { 5432 }
$applicationPort = if ($applicationUri.Port -gt 0) { $applicationUri.Port } else { 5432 }
$testHost = if ($testUri.IsLoopback) { "loopback" } else { $testUri.DnsSafeHost.ToLowerInvariant() }
$applicationHost = if ($applicationUri.IsLoopback) { "loopback" } else { $applicationUri.DnsSafeHost.ToLowerInvariant() }

if (
	-not $testUri.IsAbsoluteUri -or
	$testUri.Scheme -notin @("postgres", "postgresql") -or
	-not $testUri.IsLoopback -or
	$testDatabase -cne "worksphere_test" -or
	-not $applicationUri.IsAbsoluteUri -or
	$applicationUri.Scheme -notin @("postgres", "postgresql") -or
	[string]::IsNullOrWhiteSpace($applicationUri.Host) -or
	[string]::IsNullOrWhiteSpace($applicationDatabase) -or
	($testHost -eq $applicationHost -and $testPort -eq $applicationPort -and $testDatabase -eq $applicationDatabase)
) {
	throw "Refusing unsafe database migration target."
}

$previousDatabaseUrl = $env:DATABASE_URL
try {
	$env:DATABASE_URL = $testUrl
	npm.cmd run db:migrate:deploy
	if ($LASTEXITCODE -ne 0) { throw "Test database migration failed." }
} finally {
	$env:DATABASE_URL = $previousDatabaseUrl
}
```

After approval and setup, run the read-only test from PowerShell. Its Prisma client is explicitly constructed with the validated `WORKSPHERE_TEST_DATABASE_URL`:

```powershell
$env:RUN_DATABASE_AUTH_TESTS = "1"
npm.cmd run test --workspace backend -- test/auth.database.test.ts
Remove-Item Env:RUN_DATABASE_AUTH_TESTS
```

Prisma validation and generation use `DATABASE_URL` from the root `.env`; they do not connect to or alter database contents. Migration deployment and administrator bootstrap do write to PostgreSQL and must be reviewed before execution.

## Workspace Layout

- `frontend/` - React, TypeScript, Vite, and Tailwind CSS
- `backend/` - Express API, TypeScript, Vitest, Supertest, and Prisma schema
- `.github/copilot-instructions.md` - project architecture, security, coding, and testing guidance"# WorkSphere" 
