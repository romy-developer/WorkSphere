import type {
  EmploymentStatus,
  EmploymentType,
} from "@prisma/client";
import type {
  CreateDepartmentInput,
  CreateDesignationInput,
  ListEmployeesQuery,
  UpdateDepartmentInput,
  UpdateDesignationInput,
} from "./validation.js";

export interface EmployeeCatalogSummary {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
}

export interface DesignationCatalogSummary {
  id: string;
  title: string;
  code: string | null;
  isActive: boolean;
}

export interface EmployeeManagerSummary {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
}

export interface EmployeeRecord {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  workEmail: string;
  mobile: string | null;
  employmentType: EmploymentType;
  employmentStatus: EmploymentStatus;
  joiningDate: Date;
  deactivatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  userLinked: boolean;
  department: EmployeeCatalogSummary;
  designation: DesignationCatalogSummary;
  reportingManager: EmployeeManagerSummary | null;
}

export interface EmployeePage {
  employees: EmployeeRecord[];
  page: number;
  pageSize: number;
  total: number;
}

export interface EmployeeRepository {
  listEmployees(query: ListEmployeesQuery): Promise<EmployeePage>;
  findEmployee(id: string, includeDeactivated?: boolean): Promise<EmployeeRecord | null>;
  createEmployee(input: CreateEmployeeInput): Promise<EmployeeRecord>;
  updateEmployee(id: string, input: import("./validation.js").UpdateEmployeeInput): Promise<EmployeeRecord>;
  deactivateEmployee(id: string): Promise<EmployeeRecord>;
  reactivateEmployee(id: string): Promise<EmployeeRecord>;
  linkExistingUser(employeeId: string, userId: string): Promise<EmployeeRecord>;
  listDepartments(includeInactive?: boolean): Promise<EmployeeCatalogSummary[]>;
  createDepartment(input: CreateDepartmentInput): Promise<EmployeeCatalogSummary>;
  updateDepartment(id: string, input: UpdateDepartmentInput): Promise<EmployeeCatalogSummary>;
  listDesignations(includeInactive?: boolean): Promise<DesignationCatalogSummary[]>;
  createDesignation(input: CreateDesignationInput): Promise<DesignationCatalogSummary>;
  updateDesignation(id: string, input: UpdateDesignationInput): Promise<DesignationCatalogSummary>;
}