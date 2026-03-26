import assert from "node:assert/strict";
import test from "node:test";
import type {
  EmployeeMonthRecord,
  UpsertEmployeeMonthRecordPayload,
} from "../../../../packages/core/src/index";
import {
  applyBatchEditDrafts,
  buildEffectiveMonthRecords,
  clearBatchEditDrafts,
  getBatchSaveTargetMonths,
  toggleBatchMonthSelection,
} from "./month-record-batch-edit";

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

const createPayload = (
  overrides: Partial<UpsertEmployeeMonthRecordPayload> = {},
): UpsertEmployeeMonthRecordPayload => ({
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
  ...overrides,
});

test("批量月份选择可切换并保持升序", () => {
  let selectedMonths = toggleBatchMonthSelection([], 3);
  selectedMonths = toggleBatchMonthSelection(selectedMonths, 1);
  selectedMonths = toggleBatchMonthSelection(selectedMonths, 3);

  assert.deepEqual(selectedMonths, [1]);
});

test("批量编辑草稿可应用到多个目标月份", () => {
  const drafts = applyBatchEditDrafts(
    {},
    [2, 4],
    createPayload({ salaryIncome: 12000, withheldTax: 300, remark: "批量草稿" }),
  );

  assert.equal(drafts[2]?.salaryIncome, 12000);
  assert.equal(drafts[4]?.withheldTax, 300);
  assert.equal(drafts[4]?.remark, "批量草稿");
});

test("清空批量草稿仅影响目标月份", () => {
  const drafts = clearBatchEditDrafts(
    {
      2: createPayload({ salaryIncome: 1000 }),
      3: createPayload({ salaryIncome: 2000 }),
    },
    [2],
  );

  assert.equal(drafts[2], undefined);
  assert.equal(drafts[3]?.salaryIncome, 2000);
});

test("有效月份记录会合并本地草稿用于整年视图和切月展示", () => {
  const records = [
    createMonthRecord({ taxMonth: 1, salaryIncome: 5000 }),
    createMonthRecord({ taxMonth: 2 }),
  ];

  const effectiveRecords = buildEffectiveMonthRecords(records, {
    2: createPayload({ salaryIncome: 8000, status: "completed", remark: "批量填充" }),
  });

  assert.equal(effectiveRecords[1]?.salaryIncome, 8000);
  assert.equal(effectiveRecords[1]?.status, "completed");
  assert.equal(effectiveRecords[1]?.remark, "批量填充");
  assert.equal(effectiveRecords[1]?.taxMonth, 2);
});

test("批量保存目标月份只包含已选且存在草稿的月份", () => {
  const targetMonths = getBatchSaveTargetMonths(
    [4, 2, 6],
    {
      2: createPayload({ salaryIncome: 2000 }),
      6: createPayload({ salaryIncome: 6000 }),
    },
  );

  assert.deepEqual(targetMonths, [2, 6]);
});
