# WorkSphere HRMS Copilot Instructions

## Project Architecture
- Keep the React + TypeScript + Vite application in `frontend/` and the Node.js + Express + TypeScript API in `backend/`.
- Keep database schema and Prisma-owned code in `backend/prisma/`; use PostgreSQL through Prisma rather than issuing ad hoc SQL from route handlers.
- Keep HTTP routing, domain logic, persistence, and shared validation concerns in distinct modules as business features are introduced. Do not add business modules until explicitly requested.
- Use npm workspaces and root scripts for common development, build, test, and database tasks.
- Keep configuration and secrets outside source control. Read runtime settings from environment variables and document new variables in `.env.example` using placeholders only.

## Coding Standards
- Use strict TypeScript; avoid `any`, unsafe casts, and unvalidated request data.
- Prefer small, focused modules and explicit types at API and persistence boundaries.
- Use semantic HTML and accessible labels, keyboard behavior, and contrast in the frontend.
- Keep dependencies purposeful and follow the existing package and formatting conventions.
- Never commit generated output, credentials, personal data, or local environment files.

## Security
- Validate and normalize all untrusted input at the API boundary; use parameterized Prisma operations.
- Do not expose secrets, stack traces, database details, or sensitive personal information in responses or logs.
- Apply least privilege to database credentials and keep production secrets in the deployment environment, never in source files.
- Add authentication, authorization, and audit controls before introducing endpoints that expose or mutate employee data.
- Configure CORS, security headers, rate limits, and request-size limits when exposing the API beyond local development.

## Testing and Verification
- Add focused Vitest tests for frontend logic and backend behavior; use Supertest for HTTP API tests.
- Cover validation failures, authorization boundaries, and sensitive-data handling when those behaviors are implemented.
- Run `npm run check` and `npm run build` before proposing changes; run Prisma validation and generation when changing the schema.
- Tests must be deterministic, isolated from real employee data, and must not require production credentials.