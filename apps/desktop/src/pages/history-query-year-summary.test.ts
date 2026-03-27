import assert from "node:assert/strict";
import test from "node:test";
import type { HistoryAnnualTaxResult } from "../../../../packages/core/src/index";
import { buildHistoryQueryYearSummaries } from "./history-query-year-summary";

const createHistoryResult = (
  taxYear: number,
  overrides: Partial<HistoryAnnualTaxResult> = {},
): HistoryAnnualTaxResult => ({
  unitId: 1,
  unitName: "测试单位",
  employeeId: taxYear,
  employeeCode: `EMP-${taxYear}`,
  employeeName: `员工-${taxYear}`,
  taxYear,
  completedMonthCount: 12,
  salaryIncomeTotal: 120000,
  annualBonusTotal: 0,
  insuranceAndHousingFundTotal: 12000,
  specialAdditionalDeductionTotal: 24000,
  otherDeductionTotal: 0,
  basicDeductionTotal: 60000,
  taxReductionExemptionTotal: 0,
  selectedScheme: "separate_bonus",
  selectedTaxAmount: 3000,
  annualTaxPayable: 3000,
  annualTaxWithheld: 2000,
  annualTaxSettlement: 1000,
  settlementDirection: "payable",
  withholdingSummary: {
    withholdingMode: "standard_cumulative",
    expectedWithheldTaxTotal: 2000,
    actualWithheldTaxTotal: 2000,
    withholdingVariance: 0,
    traceCount: 12,
  },
  calculatedAt: "2026-03-25T14:30:00.000Z",
  schemeResults: {
    separateBonus: {
      scheme: "separate_bonus",
      taxableComprehensiveIncome: 48000,
      comprehensiveIncomeTax: 2280,
      annualBonusTax: 720,
      grossTax: 3000,
      taxReductionExemptionTotal: 0,
      finalTax: 3000,
      comprehensiveBracketLevel: 2,
      bonusBracketLevel: 2,
    },
    combinedBonus: {
      scheme: "combined_bonus",
      taxableComprehensiveIncome: 72000,
      comprehensiveIncomeTax: 4680,
      annualBonusTax: 0,
      grossTax: 4680,
      taxReductionExemptionTotal: 0,
      finalTax: 4680,
      comprehensiveBracketLevel: 2,
      bonusBracketLevel: null,
    },
  },
  isInvalidated: false,
  invalidatedReason: null,
  ...overrides,
});

test("按年度汇总历史结果并按年份倒序输出", () => {
  const summaries = buildHistoryQueryYearSummaries([
    createHistoryResult(2025, { settlementDirection: "payable" }),
    createHistoryResult(2026, { settlementDirection: "refund", isInvalidated: true, invalidatedReason: "tax_policy_changed" }),
    createHistoryResult(2026, { employeeId: 2, employeeCode: "EMP-2", employeeName: "员工-2", settlementDirection: "balanced" }),
  ]);

  assert.equal(summaries.length, 2);
  assert.deepEqual(summaries[0], {
    taxYear: 2026,
    total: 2,
    current: 1,
    invalidated: 1,
    payable: 0,
    refund: 1,
    balanced: 1,
  });
  assert.deepEqual(summaries[1], {
    taxYear: 2025,
    total: 1,
    current: 1,
    invalidated: 0,
    payable: 1,
    refund: 0,
    balanced: 0,
  });
});
