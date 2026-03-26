import assert from "node:assert/strict";
import test from "node:test";
import type { EmployeeMonthRecord } from "../../../../packages/core/src/index";
import { buildMonthRecordSummary, getMonthProgressStatus } from "./month-record-progress";

const createMonthRecord = (
  overrides: Partial<EmployeeMonthRecord> = {},
): EmployeeMonthRecord => ({
  id: null,
  unitId: 1,
  employeeId: 1,
  taxYear: 2026,
  taxMonth: 1,
  status: "incomplete",
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
  infantCareDeduction: 0,
  childEducationDeduction: 0,
  continuingEducationDeduction: 0,
  housingLoanInterestDeduction: 0,
  housingRentDeduction: 0,
  elderCareDeduction: 0,
  otherDeduction: 0,
  taxReductionExemption: 0,
  remark: "",
  createdAt: null,
  updatedAt: null,
  ...overrides,
});

test("月份状态可识别为未开始、待补录和已完成", () => {
  assert.equal(getMonthProgressStatus(createMonthRecord()), "not_started");
  assert.equal(getMonthProgressStatus(createMonthRecord({ salaryIncome: 12000 })), "draft");
  assert.equal(getMonthProgressStatus(createMonthRecord({ status: "completed" })), "completed");
});

test("月份完成度统计可汇总录入和完成数量", () => {
  const summary = buildMonthRecordSummary([
    createMonthRecord({ status: "completed" }),
    createMonthRecord({ taxMonth: 2, salaryIncome: 8000 }),
    createMonthRecord({ taxMonth: 3 }),
    createMonthRecord({ taxMonth: 4, status: "completed" }),
  ]);

  assert.deepEqual(summary, {
    total: 4,
    completed: 2,
    draft: 1,
    notStarted: 1,
    recorded: 3,
    completionRate: 50,
  });
});
