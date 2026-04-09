import assert from "node:assert/strict";
import test from "node:test";
import type { YearRecordUpsertItem } from "@dude-tax/core";
import {
  applyWorkspaceMonthToFutureMonths,
  applyWorkspaceMonthToNextMonth,
  getDirtyWorkspaceMonths,
  getVisibleYearRecordIncomeFields,
  hasWorkspaceMonthContent,
} from "./year-record-workspace";

const createRow = (taxMonth: number, overrides: Partial<YearRecordUpsertItem> = {}): YearRecordUpsertItem => ({
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

test("支持将当前月数据应用到下月", () => {
  const rows = [
    createRow(1, { salaryIncome: 12_000, withheldTax: 120 }),
    createRow(2),
    createRow(3),
  ];

  const nextRows = applyWorkspaceMonthToNextMonth(rows, 1);

  assert.equal(nextRows[1]?.salaryIncome, 12_000);
  assert.equal(nextRows[1]?.withheldTax, 120);
  assert.equal(nextRows[2]?.salaryIncome, 0);
});

test("支持将当前月数据应用到后续月份", () => {
  const rows = [
    createRow(1, { salaryIncome: 15_000, annualBonus: 3_000 }),
    createRow(2),
    createRow(3),
  ];

  const nextRows = applyWorkspaceMonthToFutureMonths(rows, 1);

  assert.equal(nextRows[1]?.salaryIncome, 15_000);
  assert.equal(nextRows[2]?.salaryIncome, 15_000);
  assert.equal(nextRows[2]?.annualBonus, 3_000);
});

test("只返回发生变更的月份脏数据", () => {
  const originalRows = [createRow(1), createRow(2)];
  const currentRows = [createRow(1, { salaryIncome: 10_000 }), createRow(2)];

  const dirtyMonths = getDirtyWorkspaceMonths(originalRows, currentRows);

  assert.equal(dirtyMonths.length, 1);
  assert.equal(dirtyMonths[0]?.taxMonth, 1);
  assert.equal(dirtyMonths[0]?.salaryIncome, 10_000);
});

test("月份有实际录入内容时视为已编辑", () => {
  assert.equal(hasWorkspaceMonthContent(createRow(1)), false);
  assert.equal(hasWorkspaceMonthContent(createRow(1, { otherIncome: 500 })), true);
  assert.equal(hasWorkspaceMonthContent(createRow(1, { otherIncomeRemark: "奖金补差" })), true);
});

test("共享工作台支持按配置隐藏预扣税额列", () => {
  const visibleFields = getVisibleYearRecordIncomeFields(["withheldTax"]);
  assert.equal(visibleFields.some((field) => field.key === "withheldTax"), false);
  assert.equal(visibleFields.some((field) => field.key === "salaryIncome"), true);
  assert.equal(visibleFields.some((field) => field.key === "otherIncome"), true);
});
