export class EmployeeNotFoundError extends Error {
  constructor() {
    super("Employee not found.");
    this.name = "EmployeeNotFoundError";
  }
}

export class EmployeeConflictError extends Error {
  constructor(message = "Employee ID or work email is already in use.") {
    super(message);
    this.name = "EmployeeConflictError";
  }
}

export class EmployeeReferenceError extends Error {
  constructor(message = "A department, designation, or manager reference is invalid or inactive.") {
    super(message);
    this.name = "EmployeeReferenceError";
  }
}

export class EmployeeManagerError extends Error {
  constructor(message = "The reporting manager would create an invalid reporting relationship.") {
    super(message);
    this.name = "EmployeeManagerError";
  }
}

export class EmployeeCatalogConflictError extends Error {
  constructor(message = "The catalog item is already in use or conflicts with an existing item.") {
    super(message);
    this.name = "EmployeeCatalogConflictError";
  }
}