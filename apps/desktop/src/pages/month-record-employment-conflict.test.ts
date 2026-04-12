import assert from "node:assert/strict";
import test from "node:test";
import type { EmployeeYearRecordWorkspace, YearRecordUpsertItem } from "@dude-tax/core";
import {
  buildEmploymentConflictDialogMessage,
  collectWorkspaceEmploymentConflictMonths,
  filterRowsByTaxMonths,
} from "./month-record-employment-conflict";

const buildWorkspace = (
  overrides: Partial<EmployeeYearRecordWorkspace> = {},
): EmployeeYearRecordWorkspace => ({
  unitId: 1,
  employeeId: 1,
  employeeCode: "EMP001",
  employeeName: "张三",
  hireDate: "2026-07-01",
  leaveDate: "2026-09-30",
  taxYear: 2026,
  lockedMonths: [],
  months: [],
  ...overrides,
});

const buildRow = (taxMonth: number, overrides: Partial<YearRecordUpsertItem> = {}): YearRecordUpsertItem => ({
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

test("工作台可识别入职前与离职后收入冲突月份", () => {
  const result = collectWorkspaceEmploymentConflictMonths(
    buildWorkspace(),
    [
      buildRow(6, { salaryIncome: 5_000 }),
      buildRow(8, { salaryIncome: 5_000 }),
      buildRow(10, { otherIncome: 1_000 }),
    ],
  );

  assert.deepEqual(result.conflictMonths, [6, 10]);
  assert.deepEqual(result.beforeHireMonths, [6]);
  assert.deepEqual(result.afterLeaveMonths, [10]);
});

test("可按月份过滤掉异常保存/复制目标", () => {
  const rows = [
    buildRow(6, { salaryIncome: 5_000 }),
    buildRow(8, { salaryIncome: 5_000 }),
    buildRow(10, { otherIncome: 1_000 }),
  ];

  const filteredRows = filterRowsByTaxMonths(rows, [8]);

  assert.deepEqual(
    filteredRows.map((row) => row.taxMonth),
    [8],
  );
});

test("强提示文案会带出入职离职日期与异常月份", () => {
  const message = buildEmploymentConflictDialogMessage(
    buildWorkspace(),
    {
      conflictMonths: [6, 10],
      beforeHireMonths: [6],
      afterLeaveMonths: [10],
    },
    "save",
  );

  assert.match(message.title, /保存当前改动前确认/);
  assert.match(message.description, /入职日期 2026-07-01/);
  assert.match(message.description, /离职日期 2026-09-30/);
  assert.match(message.description, /6 月/);
  assert.match(message.description, /10 月/);
});
