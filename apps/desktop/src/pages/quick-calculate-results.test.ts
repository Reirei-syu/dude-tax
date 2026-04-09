import assert from "node:assert/strict";
import test from "node:test";
import type { AnnualTaxWithholdingTraceItem } from "@dude-tax/core";
import { buildQuickCalculateTraceDisplayRows } from "./quick-calculate-results";

const createTraceItem = (
  taxMonth: number,
  cumulativeExpectedWithheldTax: number,
  appliedRate = 3,
): AnnualTaxWithholdingTraceItem => ({
  taxMonth,
  withholdingMode: "standard_cumulative",
  salaryIncome: 12_000,
  actualWithheldTax: 0,
  cumulativeActualWithheldTaxBeforeCurrentMonth: 0,
  cumulativeSalaryIncome: 12_000 * taxMonth,
  cumulativeBasicDeduction: 5_000 * taxMonth,
  cumulativeInsuranceAndHousingFund: 0,
  cumulativeSpecialAdditionalDeduction: 0,
  cumulativeOtherDeduction: 0,
  cumulativeTaxReductionExemption: 0,
  cumulativeTaxableIncome: 7_000 * taxMonth,
  cumulativeExpectedWithheldTax,
  currentMonthExpectedWithheldTax: cumulativeExpectedWithheldTax,
  currentMonthWithholdingVariance: -cumulativeExpectedWithheldTax,
  appliedRate,
});

test("快速计算结果区按上月累计应预扣额推导累计已预扣额和本月应预扣额", () => {
  const rows = buildQuickCalculateTraceDisplayRows([
    createTraceItem(1, 210, 3),
    createTraceItem(2, 420, 3),
    createTraceItem(3, 630, 3),
    createTraceItem(6, 1680, 10),
  ]);

  assert.deepEqual(rows[0], {
    taxMonth: 1,
    currentMonthPayableTax: 210,
    cumulativePayableTax: 210,
    cumulativeWithheldTax: 0,
    appliedRate: 3,
  });
  assert.deepEqual(rows[1], {
    taxMonth: 2,
    currentMonthPayableTax: 210,
    cumulativePayableTax: 420,
    cumulativeWithheldTax: 210,
    appliedRate: 3,
  });
  assert.deepEqual(rows[2], {
    taxMonth: 3,
    currentMonthPayableTax: 210,
    cumulativePayableTax: 630,
    cumulativeWithheldTax: 420,
    appliedRate: 3,
  });
  assert.deepEqual(rows[3], {
    taxMonth: 6,
    currentMonthPayableTax: 1050,
    cumulativePayableTax: 1680,
    cumulativeWithheldTax: 630,
    appliedRate: 10,
  });
});
