import type { Employee, EmployeeGeneralStatus, EmployeeMonthStatus } from "./index.js";

const parseDateOnly = (dateString: string | null | undefined) => {
  if (!dateString) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString.trim());
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day));
};

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

export const isEmployeeActiveInTaxYear = (
  employee: Pick<Employee, "hireDate" | "leaveDate">,
  taxYear: number,
) => {
  const yearStart = new Date(Date.UTC(taxYear, 0, 1));
  const yearEnd = new Date(Date.UTC(taxYear, 11, 31));
  const hireDate = parseDateOnly(employee.hireDate);
  const leaveDate = parseDateOnly(employee.leaveDate);

  if (hireDate && hireDate > yearEnd) {
    return false;
  }

  if (leaveDate && leaveDate < yearStart) {
    return false;
  }

  return true;
};

export const isEmployeeActiveInTaxMonth = (
  employee: Pick<Employee, "hireDate" | "leaveDate">,
  taxYear: number,
  taxMonth: number,
) => {
  const monthStart = new Date(Date.UTC(taxYear, taxMonth - 1, 1));
  const monthEnd = new Date(Date.UTC(taxYear, taxMonth, 0));
  const hireDate = parseDateOnly(employee.hireDate);
  const leaveDate = parseDateOnly(employee.leaveDate);

  if (hireDate && hireDate > monthEnd) {
    return false;
  }

  if (leaveDate && leaveDate < monthStart) {
    return false;
  }

  return true;
};

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
