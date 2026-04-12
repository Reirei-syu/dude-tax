import assert from "node:assert/strict";
import { test } from "node:test";
import {
  collectEmploymentIncomeConflictMonths,
  detectEmploymentIncomeConflictType,
  deriveEmployeeGeneralStatus,
  deriveEmployeeMonthStatus,
  isEmployeeActiveInTaxMonth,
  isEmployeeActiveInTaxYear,
  type Employee,
  type YearRecordUpsertItem,
} from "./index.js";

const buildEmployee = (leaveDate: string | null): Employee => ({
  id: 1,
  unitId: 1,
  employeeCode: "EMP001",
  employeeName: "张三",
  idNumber: "110101199001011234",
  hireDate: "2024-01-01",
  leaveDate,
  remark: "",
  createdAt: "2026-04-08T00:00:00.000Z",
  updatedAt: "2026-04-08T00:00:00.000Z",
});

test("未填写离职日期的员工通用状态与月度状态均为在职", () => {
  const employee = buildEmployee(null);

  assert.equal(deriveEmployeeGeneralStatus(employee), "active");
  assert.equal(deriveEmployeeMonthStatus(employee, 2026, 4), "active");
});

test("填写离职日期的员工在员工页显示离职", () => {
  const employee = buildEmployee("2026-06-30");

  assert.equal(deriveEmployeeGeneralStatus(employee), "left");
});

test("填写离职日期的员工在离职当月显示本月离职本月，后续月份显示离职", () => {
  const employee = buildEmployee("2026-06-30");

  assert.equal(deriveEmployeeMonthStatus(employee, 2026, 5), "active");
  assert.equal(deriveEmployeeMonthStatus(employee, 2026, 6), "left_this_month");
  assert.equal(deriveEmployeeMonthStatus(employee, 2026, 7), "left");
});

test("税年在职判定会纳入当年曾经在职的员工", () => {
  const employee: Employee = {
    ...buildEmployee("2026-03-31"),
    hireDate: "2026-01-01",
  };

  assert.equal(isEmployeeActiveInTaxYear(employee, 2026), true);
});

test("税年在职判定会排除全年未在职的员工", () => {
  const employee: Employee = {
    ...buildEmployee("2025-12-31"),
    hireDate: "2024-01-01",
  };

  assert.equal(isEmployeeActiveInTaxYear(employee, 2026), false);
});

test("税年在职判定会排除次年才入职的员工", () => {
  const employee: Employee = {
    ...buildEmployee(null),
    hireDate: "2027-01-01",
  };

  assert.equal(isEmployeeActiveInTaxYear(employee, 2026), false);
});

test("税月在职判定会排除入职前月份并纳入入职当月", () => {
  const employee: Employee = {
    ...buildEmployee(null),
    hireDate: "2026-07-01",
  };

  assert.equal(isEmployeeActiveInTaxMonth(employee, 2026, 6), false);
  assert.equal(isEmployeeActiveInTaxMonth(employee, 2026, 7), true);
});

test("税月在职判定会排除离职后月份并纳入离职当月", () => {
  const employee: Employee = {
    ...buildEmployee("2026-06-30"),
    hireDate: "2026-01-01",
  };

  assert.equal(isEmployeeActiveInTaxMonth(employee, 2026, 6), true);
  assert.equal(isEmployeeActiveInTaxMonth(employee, 2026, 7), false);
});

const buildYearRow = (
  taxMonth: number,
  overrides: Partial<YearRecordUpsertItem> = {},
): YearRecordUpsertItem => ({
  taxMonth,
  salaryIncome: 0,
  annualBonus: 0,
  pensionInsurance: 0,
  medicalInsurance: 0,
  occupationalAnnuity: 0,
  housingFund: 0,
  supplementaryHousingFund: 0,
  unemploymentInsurance: 0,
  workInjuryInsurance: 0,
  withheldTax: 0,
  otherIncome: 0,
  otherIncomeRemark: "",
  infantCareDeduction: 0,
  childEducationDeduction: 0,
  continuingEducationDeduction: 0,
  housingLoanInterestDeduction: 0,
  housingRentDeduction: 0,
  elderCareDeduction: 0,
  otherDeduction: 0,
  taxReductionExemption: 0,
  remark: "",
  ...overrides,
});

test("入职前有收入会识别为 before_hire 冲突", () => {
  const employee: Employee = {
    ...buildEmployee(null),
    hireDate: "2026-07-01",
  };

  assert.equal(
    detectEmploymentIncomeConflictType(employee, 2026, buildYearRow(6, { salaryIncome: 8_000 })),
    "before_hire",
  );
  assert.equal(
    detectEmploymentIncomeConflictType(employee, 2026, buildYearRow(7, { salaryIncome: 8_000 })),
    null,
  );
});

test("离职后有收入会识别为 after_leave 冲突", () => {
  const employee: Employee = {
    ...buildEmployee("2026-06-30"),
    hireDate: "2026-01-01",
  };

  assert.equal(
    detectEmploymentIncomeConflictType(employee, 2026, buildYearRow(7, { annualBonus: 3_000 })),
    "after_leave",
  );
  assert.equal(
    detectEmploymentIncomeConflictType(employee, 2026, buildYearRow(6, { annualBonus: 3_000 })),
    null,
  );
});

test("只有扣除项或备注时不触发就业月份收入冲突", () => {
  const employee: Employee = {
    ...buildEmployee(null),
    hireDate: "2026-07-01",
  };

  assert.equal(
    detectEmploymentIncomeConflictType(
      employee,
      2026,
      buildYearRow(6, { childEducationDeduction: 1_000, remark: "仅补扣除" }),
    ),
    null,
  );
});

test("可汇总一组月份中的入职前与离职后收入冲突月份", () => {
  const employee: Employee = {
    ...buildEmployee("2026-06-30"),
    hireDate: "2026-03-01",
  };

  const result = collectEmploymentIncomeConflictMonths(employee, 2026, [
    buildYearRow(1, { salaryIncome: 5_000 }),
    buildYearRow(3, { salaryIncome: 5_000 }),
    buildYearRow(8, { otherIncome: 2_000 }),
  ]);

  assert.deepEqual(result.conflictMonths, [1, 8]);
  assert.deepEqual(result.beforeHireMonths, [1]);
  assert.deepEqual(result.afterLeaveMonths, [8]);
});
