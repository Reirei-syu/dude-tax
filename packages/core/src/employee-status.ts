import type { Employee, EmployeeGeneralStatus, EmployeeMonthStatus } from "./index.js";

const parseYearMonth = (dateString: string | null | undefined) => {
  if (!dateString) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString.trim());
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }

  return { year, month };
};

export const deriveEmployeeGeneralStatus = (
  employee: Pick<Employee, "leaveDate">,
): EmployeeGeneralStatus => (employee.leaveDate ? "left" : "active");

export const deriveEmployeeMonthStatus = (
  employee: Pick<Employee, "leaveDate">,
  taxYear: number,
  taxMonth: number,
): EmployeeMonthStatus => {
  const leaveYearMonth = parseYearMonth(employee.leaveDate);
  if (!leaveYearMonth) {
    return "active";
  }

  const currentKey = taxYear * 100 + taxMonth;
  const leaveKey = leaveYearMonth.year * 100 + leaveYearMonth.month;

  if (currentKey < leaveKey) {
    return "active";
  }

  if (currentKey === leaveKey) {
    return "left_this_month";
  }

  return "left";
};
