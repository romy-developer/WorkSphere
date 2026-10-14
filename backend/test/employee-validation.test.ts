import { describe, expect, it } from "vitest";
import {
  createEmployeeSchema,
  listEmployeesQuerySchema,
  updateEmployeeSchema,
} from "../src/employees/validation.js";

const validEmployee = {
  firstName: " Avery ",
  lastName: "Patel",
  workEmail: " AVERY@EXAMPLE.TEST ",
  mobile: " +1 555 0100 ",
  departmentId: "fdd60dcc-aed6-49e3-aa64-ccca718261bf",
  designationId: "e4716a4c-0785-43f1-8eba-fdd25e767abe",
  employmentType: "FULL_TIME",
  joiningDate: "2026-10-14",
  reportingManagerId: null,
};

describe("employee request validation", () => {
  it("normalizes names and work email and defaults employment status", () => {
    const result = createEmployeeSchema.parse(validEmployee);

    expect(result.firstName).toBe("Avery");
    expect(result.workEmail).toBe("avery@example.test");
    expect(result.employmentStatus).toBe("ACTIVE");
  });

  it("allows optional mobile and reporting manager fields", () => {
    const { mobile: _mobile, reportingManagerId: _managerId, ...employee } = validEmployee;

    expect(createEmployeeSchema.safeParse(employee).success).toBe(true);
  });

  it("rejects invalid email, date, and catalog identifiers", () => {
    expect(createEmployeeSchema.safeParse({ ...validEmployee, workEmail: "not-an-email" }).success).toBe(false);
    expect(createEmployeeSchema.safeParse({ ...validEmployee, joiningDate: "2026-02-30" }).success).toBe(false);
    expect(createEmployeeSchema.safeParse({ ...validEmployee, departmentId: "department-1" }).success).toBe(false);
  });

  it("rejects client-supplied employee IDs and login fields", () => {
    expect(createEmployeeSchema.safeParse({ ...validEmployee, employeeId: "EMP0001" }).success).toBe(false);
    expect(createEmployeeSchema.safeParse({ ...validEmployee, userId: "fdd60dcc-aed6-49e3-aa64-ccca718261bf" }).success).toBe(false);
  });

  it("requires a nonempty update and validates provided fields", () => {
    expect(updateEmployeeSchema.safeParse({}).success).toBe(false);
    expect(updateEmployeeSchema.safeParse({ firstName: "Updated" }).success).toBe(true);
    expect(updateEmployeeSchema.safeParse({ joiningDate: "2026-13-01" }).success).toBe(false);
  });

  it("applies safe pagination defaults, bounds, filters, and search normalization", () => {
    const defaults = listEmployeesQuerySchema.parse({});
    expect(defaults).toMatchObject({ page: 1, pageSize: 25, includeDeactivated: false });

    const query = listEmployeesQuerySchema.parse({ page: "2", pageSize: "50", search: "  Avery  ", includeDeactivated: "true" });
    expect(query).toMatchObject({ page: 2, pageSize: 50, search: "Avery", includeDeactivated: true });
    expect(listEmployeesQuerySchema.safeParse({ pageSize: "101" }).success).toBe(false);
    expect(listEmployeesQuerySchema.safeParse({ page: "0" }).success).toBe(false);
  });
});