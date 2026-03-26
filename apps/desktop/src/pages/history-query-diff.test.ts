import assert from "node:assert/strict";
import test from "node:test";
import type { AnnualTaxCalculation, HistoryAnnualTaxResult } from "../../../../packages/core/src/index";
import { buildHistoryQueryComparisonItems } from "./history-query-diff";

const snapshotResult: HistoryAnnualTaxResult = {
  unitId: 1,
  unitName: "测试单位",
  employeeId: 1,
  employeeCode: "EMP-001",
  employeeName: "张三",
  taxYear: 2026,
  completedMonthCount: 12,
  salaryIncomeTotal: 120000,
  annualBonusTotal: 24000,
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
  isInvalidated: true,
  invalidatedReason: "tax_policy_changed",
};

const currentCalculation: AnnualTaxCalculation = {
  completedMonthCount: 12,
  salaryIncomeTotal: 120000,
  annualBonusTotal: 24000,
  insuranceAndHousingFundTotal: 12000,
  specialAdditionalDeductionTotal: 24000,
  otherDeductionTotal: 0,
  basicDeductionTotal: 72000,
  taxReductionExemptionTotal: 0,
  selectedScheme: "combined_bonus",
  selectedTaxAmount: 2400,
  annualTaxPayable: 2400,
  annualTaxWithheld: 2000,
  annualTaxSettlement: 400,
  settlementDirection: "payable",
  schemeResults: {
    separateBonus: {
      scheme: "separate_bonus",
      taxableComprehensiveIncome: 36000,
      comprehensiveIncomeTax: 1080,
      annualBonusTax: 720,
      grossTax: 1800,
      taxReductionExemptionTotal: 0,
      finalTax: 1800,
      comprehensiveBracketLevel: 1,
      bonusBracketLevel: 2,
    },
    combinedBonus: {
      scheme: "combined_bonus",
      taxableComprehensiveIncome: 60000,
      comprehensiveIncomeTax: 2400,
      annualBonusTax: 0,
      grossTax: 2400,
      taxReductionExemptionTotal: 0,
      finalTax: 2400,
      comprehensiveBracketLevel: 2,
      bonusBracketLevel: null,
    },
  },
};

test("历史结果差异对比包含方案、税额和扣除差异", () => {
  const items = buildHistoryQueryComparisonItems(snapshotResult, currentCalculation);

  assert.equal(items.length, 7);
  assert.deepEqual(items[0], {
    label: "采用方案",
    snapshotValue: "年终奖单独计税",
    currentValue: "并入综合所得",
    deltaValue: "已变化",
  });
  assert.deepEqual(items[1], {
    label: "年度应纳税额",
    snapshotValue: "3,000.00",
    currentValue: "2,400.00",
    deltaValue: "-600.00",
  });
  assert.deepEqual(items[5], {
    label: "减除费用合计",
    snapshotValue: "60,000.00",
    currentValue: "72,000.00",
    deltaValue: "+12,000.00",
  });
});
