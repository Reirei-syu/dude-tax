import assert from "node:assert/strict";
import test from "node:test";
import type { QuickCalculateMonthInput } from "../../../../packages/core/src/index";
import {
  applyQuickCalcTemplateToMonths,
  clearQuickCalcMonths,
  createDefaultQuickCalcRecords,
  createEmptyQuickCalcRecord,
  toggleQuickCalcTemplateMonthSelection,
} from "./quick-calculate-template";

const createRecord = (
  taxMonth: number,
  overrides: Partial<QuickCalculateMonthInput> = {},
): QuickCalculateMonthInput => ({
  ...createEmptyQuickCalcRecord(taxMonth),
  ...overrides,
  taxMonth,
});

test("快速计算模板月份选择可切换并保持升序", () => {
  let selectedMonths = toggleQuickCalcTemplateMonthSelection([], 6);
  selectedMonths = toggleQuickCalcTemplateMonthSelection(selectedMonths, 2);
  selectedMonths = toggleQuickCalcTemplateMonthSelection(selectedMonths, 6);

  assert.deepEqual(selectedMonths, [2]);
});

test("快速计算模板可批量套用当前月份内容并保留目标月份编号", () => {
  const records = createDefaultQuickCalcRecords();
  const result = applyQuickCalcTemplateToMonths(
    records,
    [2, 4],
    createRecord(1, {
      status: "completed",
      salaryIncome: 12000,
      withheldTax: 500,
      supplementarySalaryIncome: 2000,
      supplementaryWithheldTaxAdjustment: 80,
      supplementarySourcePeriodLabel: "2026-01",
      supplementaryRemark: "补发绩效",
      remark: "模板备注",
    }),
  );

  assert.equal(result[1]?.taxMonth, 2);
  assert.equal(result[1]?.salaryIncome, 12000);
  assert.equal(result[1]?.supplementarySalaryIncome, 2000);
  assert.equal(result[3]?.taxMonth, 4);
  assert.equal(result[3]?.supplementaryRemark, "补发绩效");
});

test("快速计算可清空所选月份模板内容", () => {
  const result = clearQuickCalcMonths(
    [
      createRecord(1, { salaryIncome: 10000 }),
      createRecord(2, { salaryIncome: 8000, supplementarySalaryIncome: 1000 }),
    ],
    [2],
  );

  assert.equal(result[0]?.salaryIncome, 10000);
  assert.equal(result[1]?.salaryIncome, 0);
  assert.equal(result[1]?.supplementarySalaryIncome, 0);
  assert.equal(result[1]?.taxMonth, 2);
});
