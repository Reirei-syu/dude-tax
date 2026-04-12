import type { Employee } from "@dude-tax/core";
import { deriveEmployeeRosterStatus, type EmployeeRosterStatusKind } from "@dude-tax/core";

export const buildEmployeeRosterStatusLabel = (employee: Employee, taxYear: number) => {
  const status = deriveEmployeeRosterStatus(employee, taxYear);

  switch (status) {
    case "hired_this_year":
      return `${employee.hireDate ?? ""}入职`;
    case "left_this_year":
      return `${employee.leaveDate ?? ""}离职`;
    case "left":
      return "已离职";
    case "active":
    default:
      return "在职";
  }
};

export const buildEmployeeRosterStatusTagClass = (status: EmployeeRosterStatusKind) =>
  status === "left" || status === "left_this_year" ? "tag tag-warning" : "tag";

export const filterEmployeeListByFormerEmployeeVisibility = (
  employees: Employee[],
  taxYear: number,
  hideFormerEmployees: boolean,
) => {
  if (!hideFormerEmployees) {
    return employees;
  }

  return employees.filter((employee) => deriveEmployeeRosterStatus(employee, taxYear) !== "left");
};
