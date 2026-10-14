# WorkSphere HRMS: Two-Laptop Windows Setup

This guide keeps the WorkSphere source synchronized between an office Windows laptop and a personal Windows laptop. GitHub synchronizes code, not PostgreSQL records or local environment secrets.

## Project Stack

- Repository: https://github.com/romy-developer/WorkSphere.git
- Branch: `main`
- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: Node.js, Express, TypeScript
- Database: PostgreSQL 18 with Prisma; `package-lock.json` resolves Prisma 6.19.3 (`package.json` declares `^6.19.0`)
- Tests: Vitest and Supertest
- Minimum Node.js version: 20.19 (`package.json`)

Run commands below from PowerShell unless otherwise noted. On Windows, use `npm.cmd` if PowerShell blocks the `npm.ps1` shim.

## Office Laptop: Review and Push

Before changing or staging anything, go to the repository root and inspect the current state. Keep existing local changes; do not reset, clean, or overwrite them.

```powershell
Set-Location D:\project
git status --short
git branch --show-current
```

Verify the local `.env` is ignored and is not in Git's tracked index. Do not open, display, or stage its contents. `.env.example` is the tracked placeholder template; `.env` is local-only.

```powershell
git check-ignore -v -- .env
if ($LASTEXITCODE -ne 0) { throw ".env is not ignored; stop and fix the ignore configuration." }

git ls-files --error-unmatch -- .env 2>$null
if ($LASTEXITCODE -eq 0) { throw ".env is tracked; do not commit or push." }

git status --short --ignored -- .env
```

The final status should mark `.env` ignored (normally `!! .env`), and the tracked-file check should fail to find it. If `.env` is already tracked, stop and have it removed from the index through a reviewed change; do not print or commit it.

Run the repository's existing checks and build from the root:

```powershell
npm.cmd ci
npm.cmd run check
npm.cmd run build
npm.cmd run db:validate
```

`npm ci` uses the root lockfile and installs both workspaces. These checks do not initialize PostgreSQL data. `db:validate` validates the schema; it is not a migration. Do not set `RUN_DATABASE_AUTH_TESTS=1` during this routine unless the dedicated test database in the isolated-testing section is already prepared and verified.

Review changes before staging. Stage only intentional paths, not the entire repository by default:

```powershell
git diff --check
git diff
git add README.md docs/WORKSPHERE_LAPTOP_SETUP_GUIDE.md
git diff --cached --check
git diff --cached --name-status
git diff --cached
```

Adjust the `git add` path list to the specific intended work. Confirm `.env`, database backups, generated secrets, and unrelated work are absent from the staged list. If `.env` appears, stop and unstage it without printing it:

```powershell
$stagedFiles = git diff --cached --name-only
if ($stagedFiles -contains ".env") { throw "Refusing to commit .env." }
```

Commit and push only after reviewing the staged diff. Confirm the branch is `main` first:

```powershell
git branch --show-current
git status --short
git commit -m "Document two-laptop setup"
git push origin main
```

If working on a feature branch, push that branch and use the project's reviewed merge process instead; do not push unrelated work to `main`.

## Personal Laptop: Install and Sync

Install these from their official Windows downloads:

- Git for Windows: https://git-scm.com/download/win
- Node.js 20.19 or newer (use a supported LTS release): https://nodejs.org/en/download
- PostgreSQL 18 for Windows: https://www.postgresql.org/download/windows/
- Visual Studio Code: https://code.visualstudio.com/Download

Open a new PowerShell window after installation and verify command availability:

```powershell
git --version
node --version
npm.cmd --version
psql --version
```

If this is the first checkout, clone the repository and install exactly from the lockfile:

```powershell
git clone https://github.com/romy-developer/WorkSphere.git D:\project
Set-Location D:\project
npm.cmd ci
```

If the project directory already exists, inspect it before pulling. Preserve all uncommitted changes; commit them on the correct branch or save them safely before updating. Do not discard or overwrite them to make a pull succeed.

```powershell
Set-Location D:\project
git status --short
git branch --show-current
```

Once the working tree is clean and the intended branch is `main`, fast-forward from the shared remote:

```powershell
git switch main
git pull --ff-only origin main
npm.cmd ci
```

If local work is present, stop before pulling and preserve it. Resolve any branch divergence deliberately; do not use `git reset --hard`, `git clean`, force-push, or commands that discard local changes.

## Local Environment

Create `.env` from the placeholder file only if a local `.env` does not already exist:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Edit the local `.env` using a trusted editor. Set a separate PostgreSQL application role/password and a different random `AUTH_TOKEN_SECRET` on each laptop. Never copy secrets between laptops, put real credentials in tracked files, or paste secrets into chat or command history. `.env` and `.env.*` are ignored; `.env.example` is tracked and must contain placeholders only.

Generate a unique token secret locally on each laptop and enter the result directly into that laptop's `.env` without sharing it:

```powershell
[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

The backend requires at least 32 bytes and rejects the documented placeholder value. Confirm `FRONTEND_ORIGIN` is `http://localhost:5173`; the example API ports are 3000 and 5173. Set `DATABASE_URL` in the local `.env` to the local application role and database, following the placeholder format already in `.env.example`:

```dotenv
DATABASE_URL="postgresql://DB_USER:DB_PASSWORD@localhost:5432/worksphere?schema=public"
```

Replace those placeholders only in the ignored local `.env`, never in `.env.example`. If a password contains reserved URL characters, percent-encode them in the PostgreSQL connection URL.

## PostgreSQL and Prisma Setup

Each laptop has its own local PostgreSQL server and database. The repository does not provide a database-creation npm script. First confirm PostgreSQL 18 is installed and running, then use a local PostgreSQL administrator to create a least-privilege application role and the local `worksphere` database if they do not already exist. Never point these commands at a shared, office, or production server by accident.

For example, connect to the local PostgreSQL maintenance database as its administrator:

```powershell
psql -h localhost -U postgres -d postgres
```

At the `psql` prompt, create the local application role only if it does not already exist. Set its password using the interactive `\password` command so the password is not included in SQL text or shell history, then create the owned database if absent:

```sql
CREATE ROLE worksphere_app LOGIN;
\password worksphere_app
CREATE DATABASE worksphere OWNER worksphere_app;
\q
```

If the role or database already exists, inspect its ownership and privileges rather than recreating it. Configure `DATABASE_URL` in that laptop's `.env` for `localhost:5432/worksphere` and the local application role. Do not put the password in this guide, Git, or a shared backup.

Before any migration, verify the target database name and host through a local trusted PostgreSQL client without printing the connection URL. Inspect the existing migration `backend/prisma/migrations/20261014000100_auth_rbac_init/migration.sql`; it creates the auth/RBAC tables, enum, indexes, and foreign keys. The commands below are separate: validation/generation are not data initialization, but migration deployment changes the database schema and must only follow target verification and approval.

```powershell
npm.cmd run db:validate
npm.cmd run db:generate
```

Only if this is the intended local database and the migration is approved, deploy pending migrations:

```powershell
npm.cmd run db:migrate:deploy
npm.cmd run db:generate
```

Never run `prisma migrate reset` or reset/recreate a database to fix a setup problem. Do not edit an applied migration; create and review a new migration when schema changes are approved.

## Fresh Database: RBAC and Super Admin

The existing `initialize:rbac` script initializes only the approved `SUPER_ADMIN` role, its seven permissions and their links. It is additive/idempotent, runs transactionally, and does not create users or seed the other roles. On a fresh local database, run it only after the auth/RBAC migration has been applied and the target is verified:

```powershell
npm.cmd run initialize:rbac --workspace backend
```

Then, only if no Super Admin account already exists and the account is appropriate for this laptop's local database, set `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` in the ignored `.env` and run:

```powershell
npm.cmd run bootstrap:admin --workspace backend
```

The initial password must be 14–128 characters and contain a lowercase letter, uppercase letter, digit, and symbol. It is hashed with Argon2id. Bootstrap does not overwrite or elevate an existing account; an existing Super Admin makes it a no-op, while an email belonging to a non-admin is rejected. Do not run bootstrap on every laptop as a way to synchronize users: each local database is separate. The password-reset script also exists as `npm.cmd run reset:admin-password --workspace backend`; run it only intentionally for the existing Super Admin on the verified local database.

## Isolated Integration Testing

Never run database integration tests against the development `worksphere` database. The opt-in auth DB test is enabled only by `RUN_DATABASE_AUTH_TESTS=1` and requires a distinct local database named exactly `worksphere_test` through `WORKSPHERE_TEST_DATABASE_URL`. It rejects missing/malformed URLs, remote hosts, production mode, other database names, and a test target matching `DATABASE_URL`. Its Prisma client is explicitly constructed with the validated test URL. The current integration test is read-only; any future test that writes must keep the same isolation guard and use only this disposable test database.

Use a dedicated test-only PostgreSQL role and password, with no application or production data privileges. The placeholder is shown in `.env.example`; configure the actual test URL only in the ignored `.env`. URL-encode reserved password characters. The role must exist before creating the test DB; the DB and schema must be explicitly approved before creation/migration. The exact PowerShell target validation and migration procedure is documented in the [README isolated database test setup](../README.md#common-commands); review it before use. Never fall back to `DATABASE_URL` for the test client.

After the approved test database exists and has the reviewed migrations, run the read-only opt-in test:

```powershell
$env:RUN_DATABASE_AUTH_TESTS = "1"
npm.cmd run test --workspace backend -- test/auth.database.test.ts
Remove-Item Env:RUN_DATABASE_AUTH_TESTS
```

If test configuration is missing or fails validation, stop; do not point the test at `worksphere` as a workaround.

## Daily Two-Laptop Workflow

1. Before starting work on either laptop, inspect `git status --short`. Preserve or commit local work before pulling.
2. Pull shared code only after confirming the intended branch and a clean/safely preserved working tree: `git pull --ff-only origin main`.
3. Work on one laptop at a time for the same branch/task. Run `npm.cmd run check` and `npm.cmd run build` for code changes.
4. Review staged files and `git diff --cached`; never stage `.env`, backups, credentials, generated secrets, or unrelated changes.
5. Commit and push intentional work before switching laptops. On the other laptop, pull with `--ff-only` before continuing.
6. If Git reports a conflict, inspect the conflicting files, preserve both sets of intended edits, resolve in the editor, review the diff, and rerun checks. Never force-push or delete local changes to make the histories appear clean.

GitHub synchronizes repository files only. Each laptop's PostgreSQL data, roles/passwords, and backups remain local unless separately transferred through a secure, authorized process.

## Database Records and Backups

Keep laptop databases independent by default. Do not copy production/office employee data to a personal laptop unless explicitly authorized and protected under company policy. Git does not back up database records.

When a backup or restore is authorized, verify the source and destination database names first, use PostgreSQL's `pg_dump`/`pg_restore` tools, store the backup outside the repository in an access-controlled encrypted location, and verify the restore into an approved destination. Do not commit or upload database dumps to GitHub. Do not use destructive restore flags against an existing database without explicit approval and a verified recovery plan.

## Troubleshooting

### Git conflicts or unexpected local changes

Run `git status --short`, `git diff`, and `git diff --cached` to see what is changed. Keep the files, resolve conflicts deliberately, and commit/push only after reviewing. Do not use `git reset --hard`, `git clean`, `git checkout --`, or force-push to clear conflicts.

### Node.js or npm not found

Check `node --version`, `npm.cmd --version`, `Get-Command node`, and `Get-Command npm.cmd`. Confirm Node.js is 20.19 or newer and reopen PowerShell after installation so PATH refreshes. If `npm` invokes a blocked PowerShell script, use the repository commands with `npm.cmd`. Run `npm.cmd ci` from the repository root; do not delete or regenerate `package-lock.json` to fix PATH issues.

### PostgreSQL connection refused or authentication fails

Confirm the local PostgreSQL 18 Windows service is running and listening on localhost/port 5432. Check `Get-Service *postgres*` or, if installed, `pg_isready -h localhost -p 5432`. Verify the intended local database and role exist, then check `DATABASE_URL` privately in `.env`; never paste it into logs or chat. Do not change the URL to a shared/production host or reset the database as troubleshooting.

### Prisma Client or schema errors

From the repository root, run `npm.cmd ci`, `npm.cmd run db:validate`, then `npm.cmd run db:generate`. These do not apply migrations. Before `npm.cmd run db:migrate:deploy`, verify the local target and inspect pending migration SQL. If migration state or schema drift is reported, stop and review with the database owner; do not run `migrate reset` or edit an applied migration.

### Login/API unavailable

Run the full app from the repository root with `npm.cmd run dev`. The frontend is `http://localhost:5173` and the backend is `http://localhost:3000`; the backend requires a valid laptop-specific `AUTH_TOKEN_SECRET` of at least 32 bytes. Keep the secret private. Confirm `/health` responds before diagnosing credentials; an API startup/configuration failure is not fixed by changing database records.

## Repository Commands

These are the current scripts defined by the root and backend package files:

```powershell
npm.cmd run dev
npm.cmd run check
npm.cmd run build
npm.cmd test
npm.cmd run db:validate
npm.cmd run db:generate
npm.cmd run db:migrate:deploy
npm.cmd run initialize:rbac --workspace backend
npm.cmd run bootstrap:admin --workspace backend
npm.cmd run reset:admin-password --workspace backend
```

The migration, RBAC initialization, bootstrap, and password-reset commands write to the selected local database. Verify the target and obtain any required approval before using them.