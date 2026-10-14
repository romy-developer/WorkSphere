export const ROLE_NAMES = [
  "SUPER_ADMIN",
  "HR_ADMIN",
  "MANAGER",
  "EMPLOYEE",
] as const;

export type RoleName = (typeof ROLE_NAMES)[number];

export const PERMISSION_DESCRIPTIONS = {
  "users.read": "View user accounts and assignments",
  "users.create": "Create user accounts",
  "users.update": "Update user accounts",
  "roles.manage": "Manage roles and permission assignments",
  "employees.read": "View employee records",
  "employees.manage": "Manage employee records",
  "dashboard.view": "View the authenticated dashboard",
} as const;

export type PermissionKey = keyof typeof PERMISSION_DESCRIPTIONS;

export const ROLE_DESCRIPTIONS: Record<RoleName, string> = {
  SUPER_ADMIN: "Full administrative access",
  HR_ADMIN: "HR administration without role-management privileges",
  MANAGER: "Read access to employee information and the dashboard",
  EMPLOYEE: "Self-service foundation and dashboard access",
};

export const ROLE_PERMISSION_MATRIX: Record<RoleName, readonly PermissionKey[]> = {
  SUPER_ADMIN: [
    "users.read",
    "users.create",
    "users.update",
    "roles.manage",
    "employees.read",
    "employees.manage",
    "dashboard.view",
  ],
  HR_ADMIN: [
    "users.read",
    "users.create",
    "users.update",
    "employees.read",
    "employees.manage",
    "dashboard.view",
  ],
  MANAGER: ["employees.read", "dashboard.view"],
  EMPLOYEE: ["dashboard.view"],
};

export function hasPermission(
  permissions: readonly string[],
  requiredPermission: PermissionKey,
): boolean {
  return permissions.includes(requiredPermission);
}