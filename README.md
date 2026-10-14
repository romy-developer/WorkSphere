# WorkSphere HRMS

WorkSphere is a TypeScript monorepo for an HR management system. Module 1 provides cookie-based authentication and RBAC using a React + Vite frontend, an Express API, PostgreSQL through Prisma, and Vitest/Supertest testing. Employee management, attendance, leave, and payroll modules are not included.

## Requirements

- Windows 10/11
- Node.js 20.19 or newer and npm
- PostgreSQL 18 running locally or reachable from this machine

## Setup

Run these commands from the repository root in PowerShell:

```powershell
Copy-Item .env.example .env
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

## Initial Administrator

After the migration is explicitly approved and applied, set `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` in the ignored root `.env`, then run:

```powershell
npm run bootstrap:admin --workspace backend
```

The password must be at least 14 characters with upper-case, lower-case, numeric, and symbol characters. It is hashed with Argon2id. Bootstrap seeds the standard roles and permissions transactionally, creates the first Super Admin once, and never replaces a password when any Super Admin already exists.

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
npm run bootstrap:admin --workspace backend # Create initial Super Admin (database-changing)
```

Prisma validation and generation use `DATABASE_URL` from the root `.env`; they do not connect to or alter database contents. Migration deployment and administrator bootstrap do write to PostgreSQL and must be reviewed before execution.

## Workspace Layout

- `frontend/` - React, TypeScript, Vite, and Tailwind CSS
- `backend/` - Express API, TypeScript, Vitest, Supertest, and Prisma schema
- `.github/copilot-instructions.md` - project architecture, security, coding, and testing guidance