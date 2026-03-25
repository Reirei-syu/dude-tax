import assert from "node:assert/strict";
import test from "node:test";
import type { EmployeeMonthRecord } from "./index.js";
import * as coreModule from "./index.js";

const createMonthRecord = (
  taxMonth: number,
  overrides: Partial<EmployeeMonthRecord> = {},
): EmployeeMonthRecord => ({
  id: null,
  unitId: 1,
  employeeId: 1,
  taxYear: 2026,
  taxMonth,
  status: "completed",
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

const getCalculator = () => {
  const calculator = Reflect.get(coreModule, "calculateEmployeeAnnualTax");
  assert.equal(typeof calculator, "function");
  return calculator as (records: EmployeeMonthRecord[]) => Record<string, unknown>;
};

test("导出年度个税计算函数", () => {
  assert.equal(typeof Reflect.get(coreModule, "calculateEmployeeAnnualTax"), "function");
});

test("在无年终奖时按综合所得计算并汇总基础抵扣", () => {
  const calculateEmployeeAnnualTax = getCalculator();

  const result = calculateEmployeeAnnualTax([createMonthRecord(1, { salaryIncome: 10_000 })]);

  assert.equal(result.completedMonthCount, 1);
  assert.equal(result.salaryIncomeTotal, 10_000);
  assert.equal(result.basicDeductionTotal, 5_000);
  assert.equal(result.selectedScheme, "separate_bonus");
  assert.equal(result.selectedTaxAmount, 150);
  assert.equal(result.annualTaxPayable, 150);
  assert.equal(result.annualTaxWithheld, 0);
  assert.equal(result.annualTaxSettlement, 150);
  assert.equal(result.settlementDirection, "payable");
});

test("当合并计税税额更低时默认采用合并计税方案", () => {
  const calculateEmployeeAnnualTax = getCalculator();

  const result = calculateEmployeeAnnualTax([
    createMonthRecord(1, {
      salaryIncome: 5_000,
      annualBonus: 100_000,
    }),
  ]);

  const schemeResults = result.schemeResults as Record<string, Record<string, unknown>>;

  assert.equal(result.selectedScheme, "combined_bonus");
  assert.equal(result.selectedTaxAmount, 7_480);
  assert.equal(schemeResults.separateBonus.finalTax, 9_790);
  assert.equal(schemeResults.combinedBonus.finalTax, 7_480);
});

test("当单独计税税额更低时默认采用年终奖单独计税方案", () => {
  const calculateEmployeeAnnualTax = getCalculator();

  const result = calculateEmployeeAnnualTax([
    ...Array.from({ length: 10 }, (_, index) =>
      createMonthRecord(index + 1, {
        salaryIncome: 19_000,
        annualBonus: index === 0 ? 40_000 : 0,
      }),
    ),
    createMonthRecord(11, { status: "incomplete" }),
    createMonthRecord(12, { status: "incomplete" }),
  ]);

  const schemeResults = result.schemeResults as Record<string, Record<string, unknown>>;

  assert.equal(result.completedMonthCount, 10);
  assert.equal(result.salaryIncomeTotal, 190_000);
  assert.equal(result.annualBonusTotal, 40_000);
  assert.equal(result.selectedScheme, "separate_bonus");
  assert.equal(result.selectedTaxAmount, 15_270);
  assert.equal(schemeResults.separateBonus.finalTax, 15_270);
  assert.equal(schemeResults.combinedBonus.finalTax, 19_080);
});

test("税额减免超过应纳税额时结果归零", () => {
  const calculateEmployeeAnnualTax = getCalculator();

  const result = calculateEmployeeAnnualTax([
    createMonthRecord(1, {
      salaryIncome: 10_000,
      taxReductionExemption: 200,
    }),
  ]);

  const schemeResults = result.schemeResults as Record<string, Record<string, unknown>>;

  assert.equal(result.selectedTaxAmount, 0);
  assert.equal(schemeResults.separateBonus.finalTax, 0);
  assert.equal(schemeResults.combinedBonus.finalTax, 0);
  assert.equal(result.annualTaxPayable, 0);
  assert.equal(result.annualTaxWithheld, 0);
  assert.equal(result.annualTaxSettlement, 0);
  assert.equal(result.settlementDirection, "balanced");
});

test("存在已预扣税额时应计算应退税结果", () => {
  const calculateEmployeeAnnualTax = getCalculator();

  const result = calculateEmployeeAnnualTax([
    createMonthRecord(1, {
      salaryIncome: 10_000,
      withheldTax: 300,
    }),
  ]);

  assert.equal(result.selectedTaxAmount, 150);
  assert.equal(result.annualTaxPayable, 150);
  assert.equal(result.annualTaxWithheld, 300);
  assert.equal(result.annualTaxSettlement, -150);
  assert.equal(result.settlementDirection, "refund");
});
