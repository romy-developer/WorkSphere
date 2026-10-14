import type { EmployeeRepository } from "./types.js";
import type {
  CreateDepartmentInput,
  CreateDesignationInput,
  CreateEmployeeInput,
  ListEmployeesQuery,
  UpdateDepartmentInput,
  UpdateDesignationInput,
  UpdateEmployeeInput,
} from "./validation.js";

export class EmployeeService {
  constructor(private readonly repository: EmployeeRepository) {}

  list(query: ListEmployeesQuery) {
    return this.repository.listEmployees(query);
  }

  findById(id: string, includeDeactivated = false) {
    return this.repository.findEmployee(id, includeDeactivated);
  }

  create(input: CreateEmployeeInput) {
    return this.repository.createEmployee(input);
  }

  update(id: string, input: UpdateEmployeeInput) {
    return this.repository.updateEmployee(id, input);
  }

  deactivate(id: string) {
    return this.repository.deactivateEmployee(id);
  }

  reactivate(id: string) {
    return this.repository.reactivateEmployee(id);
  }

  linkExistingUser(employeeId: string, userId: string) {
    return this.repository.linkExistingUser(employeeId, userId);
  }

  listDepartments(includeInactive = false) {
    return this.repository.listDepartments(includeInactive);
  }

  createDepartment(input: CreateDepartmentInput) {
    return this.repository.createDepartment(input);
  }

  updateDepartment(id: string, input: UpdateDepartmentInput) {
    return this.repository.updateDepartment(id, input);
  }

  listDesignations(includeInactive = false) {
    return this.repository.listDesignations(includeInactive);
  }

  createDesignation(input: CreateDesignationInput) {
    return this.repository.createDesignation(input);
  }

  updateDesignation(id: string, input: UpdateDesignationInput) {
    return this.repository.updateDesignation(id, input);
  }
}