import type {
  Employee,
  EmployeeGeneralStatus,
  EmployeeMonthStatus,
  EmploymentIncomeConflictMonths,
  EmploymentIncomeConflictType,
  YearRecordUpsertItem,
} from "./index.js";

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

const hasEmploymentIncome = (
  row: Pick<YearRecordUpsertItem, "salaryIncome" | "annualBonus" | "otherIncome">,
) =>
  Number(row.salaryIncome ?? 0) > 0 ||
  Number(row.annualBonus ?? 0) > 0 ||
  Number(row.otherIncome ?? 0) > 0;

const getTaxYearHireMonth = (
  employee: Pick<Employee, "hireDate">,
  taxYear: number,
) => {
  const hireYearMonth = parseYearMonth(employee.hireDate);
  if (!hireYearMonth || hireYearMonth.year !== taxYear) {
    return null;
  }

  return hireYearMonth.month;
};

const getTaxYearLeaveMonth = (
  employee: Pick<Employee, "leaveDate">,
  taxYear: number,
) => {
  const leaveYearMonth = parseYearMonth(employee.leaveDate);
  if (!leaveYearMonth || leaveYearMonth.year !== taxYear) {
    return null;
  }

  return leaveYearMonth.month;
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

export const detectEmploymentIncomeConflictType = (
  employee: Pick<Employee, "hireDate" | "leaveDate">,
  taxYear: number,
  row: Pick<YearRecordUpsertItem, "taxMonth" | "salaryIncome" | "annualBonus" | "otherIncome">,
): EmploymentIncomeConflictType | null => {
  if (!hasEmploymentIncome(row)) {
    return null;
  }

  const hireMonth = getTaxYearHireMonth(employee, taxYear);
  if (hireMonth !== null && row.taxMonth < hireMonth) {
    return "before_hire";
  }

  const leaveMonth = getTaxYearLeaveMonth(employee, taxYear);
  if (leaveMonth !== null && row.taxMonth > leaveMonth) {
    return "after_leave";
  }

  return null;
};

export const collectEmploymentIncomeConflictMonths = (
  employee: Pick<Employee, "hireDate" | "leaveDate">,
  taxYear: number,
  rows: Array<
    Pick<YearRecordUpsertItem, "taxMonth" | "salaryIncome" | "annualBonus" | "otherIncome">
  >,
): EmploymentIncomeConflictMonths => {
  const beforeHireMonths: number[] = [];
  const afterLeaveMonths: number[] = [];

  rows.forEach((row) => {
    const conflictType = detectEmploymentIncomeConflictType(employee, taxYear, row);
    if (conflictType === "before_hire" && !beforeHireMonths.includes(row.taxMonth)) {
      beforeHireMonths.push(row.taxMonth);
    }
    if (conflictType === "after_leave" && !afterLeaveMonths.includes(row.taxMonth)) {
      afterLeaveMonths.push(row.taxMonth);
    }
  });

  beforeHireMonths.sort((left, right) => left - right);
  afterLeaveMonths.sort((left, right) => left - right);

  return {
    conflictMonths: [...beforeHireMonths, ...afterLeaveMonths].sort((left, right) => left - right),
    beforeHireMonths,
    afterLeaveMonths,
  };
};
