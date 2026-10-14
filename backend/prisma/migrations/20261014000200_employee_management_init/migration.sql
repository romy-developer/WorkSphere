-- Employee Management tables only. This migration is not applied as part of planning.
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'TEMPORARY', 'INTERN');
CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'TERMINATED');

CREATE SEQUENCE "EmployeeIdSequence" AS BIGINT START WITH 1 INCREMENT BY 1 NO CYCLE;

CREATE TABLE "Department" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(32),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Designation" (
    "id" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "code" VARCHAR(32),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "Designation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Employee" (
    "id" UUID NOT NULL,
    "employeeId" VARCHAR(32) NOT NULL,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "workEmail" VARCHAR(320) NOT NULL,
    "mobile" VARCHAR(32),
    "departmentId" UUID NOT NULL,
    "designationId" UUID NOT NULL,
    "employmentType" "EmploymentType" NOT NULL,
    "employmentStatus" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "joiningDate" DATE NOT NULL,
    "reportingManagerId" UUID,
    "userId" UUID,
    "deactivatedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Employee_workEmail_canonical_check" CHECK ("workEmail" = lower(btrim("workEmail")))
);

CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");
CREATE UNIQUE INDEX "Designation_title_key" ON "Designation"("title");
CREATE UNIQUE INDEX "Designation_code_key" ON "Designation"("code");
CREATE UNIQUE INDEX "Employee_employeeId_key" ON "Employee"("employeeId");
CREATE UNIQUE INDEX "Employee_workEmail_key" ON "Employee"("workEmail");
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");
CREATE INDEX "Employee_departmentId_idx" ON "Employee"("departmentId");
CREATE INDEX "Employee_designationId_idx" ON "Employee"("designationId");
CREATE INDEX "Employee_reportingManagerId_idx" ON "Employee"("reportingManagerId");
CREATE INDEX "Employee_employmentStatus_deactivatedAt_idx" ON "Employee"("employmentStatus", "deactivatedAt");
CREATE INDEX "Employee_joiningDate_idx" ON "Employee"("joiningDate");
CREATE INDEX "Employee_lastName_firstName_id_idx" ON "Employee"("lastName", "firstName", "id");

ALTER TABLE "Employee"
    ADD CONSTRAINT "Employee_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Employee"
    ADD CONSTRAINT "Employee_designationId_fkey"
    FOREIGN KEY ("designationId") REFERENCES "Designation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Employee"
    ADD CONSTRAINT "Employee_reportingManagerId_fkey"
    FOREIGN KEY ("reportingManagerId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Employee"
    ADD CONSTRAINT "Employee_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;