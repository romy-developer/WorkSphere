import { describe, expect, it } from "vitest";
import { hasPermission } from "./permissions";
import type { AuthenticatedUser } from "./types";

const employee: AuthenticatedUser = {
  id: "employee-1",
  email: "employee@example.test",
  name: "Employee",
  roles: ["EMPLOYEE"],
  permissions: ["dashboard.view"],
};

describe("permission-aware navigation", () => {
  it("shows features only when the API user has the permission", () => {
    expect(hasPermission(employee, "dashboard.view")).toBe(true);
    expect(hasPermission(employee, "roles.manage")).toBe(false);
  });
});