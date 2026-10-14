import { z } from "zod";

export const EMPLOYMENT_TYPES = [
  "FULL_TIME",
  "PART_TIME",
  "CONTRACT",
  "TEMPORARY",
  "INTERN",
] as const;

export const EMPLOYMENT_STATUSES = [
  "ACTIVE",
  "ON_LEAVE",
  "TERMINATED",
] as const;

const employeeNameSchema = z.string().trim().min(1).max(100);
const workEmailSchema = z.string().trim().toLowerCase().email().max(320);
const optionalMobileSchema = z.string().trim().min(1).max(32).optional();
const idSchema = z.string().uuid();
const dateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isCalendarDate, "Expected a valid YYYY-MM-DD date.");

const employeeFields = {
  firstName: employeeNameSchema,
  lastName: employeeNameSchema,
  workEmail: workEmailSchema,
  mobile: optionalMobileSchema,
  departmentId: idSchema,
  designationId: idSchema,
  employmentType: z.enum(EMPLOYMENT_TYPES),
  employmentStatus: z.enum(EMPLOYMENT_STATUSES).default("ACTIVE"),
  joiningDate: dateSchema,
  reportingManagerId: idSchema.nullable().optional(),
};

export const createEmployeeSchema = z.object(employeeFields).strict();

export const updateEmployeeSchema = z.object({
  ...employeeFields,
  employmentStatus: z.enum(EMPLOYMENT_STATUSES).optional(),
}).partial().strict().refine(
  (value) => Object.keys(value).length > 0,
  "At least one employee field must be provided.",
);

export const listEmployeesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(100).optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
  employmentStatus: z.enum(EMPLOYMENT_STATUSES).optional(),
  departmentId: idSchema.optional(),
  designationId: idSchema.optional(),
  reportingManagerId: idSchema.optional(),
  includeDeactivated: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
}).strict();

const catalogNameSchema = z.string().trim().min(1).max(100);
const catalogCodeSchema = z.string().trim().toUpperCase().min(1).max(32).optional();

export const createDepartmentSchema = z.object({
  name: catalogNameSchema,
  code: catalogCodeSchema,
}).strict();

export const updateDepartmentSchema = z.object({
  name: catalogNameSchema.optional(),
  code: catalogCodeSchema.nullable().optional(),
  isActive: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

export const createDesignationSchema = z.object({
  title: catalogNameSchema,
  code: catalogCodeSchema,
}).strict();

export const updateDesignationSchema = z.object({
  title: catalogNameSchema.optional(),
  code: catalogCodeSchema.nullable().optional(),
  isActive: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

export const linkEmployeeUserSchema = z.object({ userId: idSchema }).strict();

export type CreateEmployeeInput = z.output<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.output<typeof updateEmployeeSchema>;
export type ListEmployeesQuery = z.output<typeof listEmployeesQuerySchema>;
export type CreateDepartmentInput = z.output<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.output<typeof updateDepartmentSchema>;
export type CreateDesignationInput = z.output<typeof createDesignationSchema>;
export type UpdateDesignationInput = z.output<typeof updateDesignationSchema>;

function isCalendarDate(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}