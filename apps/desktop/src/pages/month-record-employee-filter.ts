import type { Employee } from "@dude-tax/core";
import { deriveEmployeeMonthStatus } from "@dude-tax/core";

export const filterVisibleEmployeesForMonth = (
  employees: Employee[],
  taxYear: number,
  taxMonth: number,
) =>
  employees.filter(
    (employee) => deriveEmployeeMonthStatus(employee, taxYear, taxMonth) !== "left",
  );
