import assert from "node:assert/strict";
import test from "node:test";
import type {
  AnnualTaxCalculation,
  AnnualTaxWithholdingTrace,
  EmployeeMonthRecord,
  TaxPolicySettings,
} from "./index.js";
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
  return calculator as (
    records: EmployeeMonthRecord[],
    taxPolicy?: TaxPolicySettings,
    withholdingContext?: Record<string, unknown>,
  ) => AnnualTaxCalculation;
};

test("导出年度个税计算函数", () => {
  assert.equal(typeof Reflect.get(coreModule, "calculateEmployeeAnnualTax"), "function");
  assert.equal(typeof Reflect.get(coreModule, "buildMonthlyWithholdingTrace"), "function");
  assert.equal(typeof Reflect.get(coreModule, "getSalaryIncomeForWithholding"), "function");
  assert.equal(typeof Reflect.get(coreModule, "getActualWithheldTaxForWithholding"), "function");
  assert.equal(typeof Reflect.get(coreModule, "hasSupplementaryAdjustments"), "function");
});

const getWithholdingTraceBuilder = () => {
  const builder = Reflect.get(coreModule, "buildMonthlyWithholdingTrace");
  assert.equal(typeof builder, "function");
  return builder as (
    records: EmployeeMonthRecord[],
    context?: Record<string, unknown>,
    taxPolicy?: TaxPolicySettings,
  ) => AnnualTaxWithholdingTrace;
};

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
  assert.equal(result.withholdingSummary.actualWithheldTaxTotal, 0);
  assert.equal(result.withholdingSummary.expectedWithheldTaxTotal, 150);
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

test("支持传入自定义税率并影响年度计算结果", () => {
  const calculateEmployeeAnnualTax = getCalculator();

  const result = calculateEmployeeAnnualTax(
    [createMonthRecord(1, { salaryIncome: 10_000 })],
    {
      basicDeductionAmount: 6_000,
      comprehensiveTaxBrackets: [
        {
          level: 1,
          rangeText: "不超过 36,000 元",
          maxAnnualIncome: 36_000,
          rate: 3,
          quickDeduction: 0,
        },
        {
          level: 2,
          rangeText: "36,000 - 144,000 元",
          maxAnnualIncome: 144_000,
          rate: 10,
          quickDeduction: 2520,
        },
        {
          level: 3,
          rangeText: "144,000 - 300,000 元",
          maxAnnualIncome: 300_000,
          rate: 20,
          quickDeduction: 16920,
        },
        {
          level: 4,
          rangeText: "300,000 - 420,000 元",
          maxAnnualIncome: 420_000,
          rate: 25,
          quickDeduction: 31920,
        },
        {
          level: 5,
          rangeText: "420,000 - 660,000 元",
          maxAnnualIncome: 660_000,
          rate: 30,
          quickDeduction: 52920,
        },
        {
          level: 6,
          rangeText: "660,000 - 960,000 元",
          maxAnnualIncome: 960_000,
          rate: 35,
          quickDeduction: 85920,
        },
        {
          level: 7,
          rangeText: "超过 960,000 元",
          maxAnnualIncome: null,
          rate: 45,
          quickDeduction: 181920,
        },
      ],
      bonusTaxBrackets: [
        {
          level: 1,
          rangeText: "不超过 3,000 元",
          maxAverageMonthlyIncome: 3_000,
          rate: 3,
          quickDeduction: 0,
        },
        {
          level: 2,
          rangeText: "3,000 - 12,000 元",
          maxAverageMonthlyIncome: 12_000,
          rate: 10,
          quickDeduction: 210,
        },
        {
          level: 3,
          rangeText: "12,000 - 25,000 元",
          maxAverageMonthlyIncome: 25_000,
          rate: 20,
          quickDeduction: 1410,
        },
        {
          level: 4,
          rangeText: "25,000 - 35,000 元",
          maxAverageMonthlyIncome: 35_000,
          rate: 25,
          quickDeduction: 2660,
        },
        {
          level: 5,
          rangeText: "35,000 - 55,000 元",
          maxAverageMonthlyIncome: 55_000,
          rate: 30,
          quickDeduction: 4410,
        },
        {
          level: 6,
          rangeText: "55,000 - 80,000 元",
          maxAverageMonthlyIncome: 80_000,
          rate: 35,
          quickDeduction: 7160,
        },
        {
          level: 7,
          rangeText: "超过 80,000 元",
          maxAverageMonthlyIncome: null,
          rate: 45,
          quickDeduction: 15160,
        },
      ],
    },
  );

  assert.equal(result.basicDeductionTotal, 6_000);
  assert.equal(result.selectedTaxAmount, 120);
  assert.equal(result.annualTaxPayable, 120);
});

test("标准累计预扣模式按已处理月份累计减除费用", () => {
  const buildMonthlyWithholdingTrace = getWithholdingTraceBuilder();

  const trace = buildMonthlyWithholdingTrace([
    createMonthRecord(7, {
      salaryIncome: 10_000,
    }),
    createMonthRecord(8, {
      salaryIncome: 10_000,
      withheldTax: 200,
    }),
  ]);

  assert.equal(trace.mode, "standard_cumulative");
  assert.equal(trace.items[0]?.cumulativeBasicDeduction, 5_000);
  assert.equal(trace.items[0]?.currentMonthExpectedWithheldTax, 150);
  assert.equal(trace.items[1]?.cumulativeBasicDeduction, 10_000);
  assert.equal(trace.items[1]?.currentMonthExpectedWithheldTax, 150);
  assert.equal(trace.summary.expectedWithheldTaxTotal, 300);
  assert.equal(trace.summary.actualWithheldTaxTotal, 200);
  assert.equal(trace.summary.withholdingVariance, -100);
});

test("首次取得工资模式按自然月累计减除费用", () => {
  const buildMonthlyWithholdingTrace = getWithholdingTraceBuilder();

  const trace = buildMonthlyWithholdingTrace(
    [
      createMonthRecord(7, {
        salaryIncome: 10_000,
      }),
      createMonthRecord(8, {
        salaryIncome: 10_000,
      }),
    ],
    {
      firstSalaryMonthInYear: 7,
    },
  );

  assert.equal(trace.mode, "first_salary_month_cumulative");
  assert.equal(trace.items[0]?.cumulativeBasicDeduction, 35_000);
  assert.equal(trace.items[0]?.currentMonthExpectedWithheldTax, 0);
  assert.equal(trace.items[1]?.cumulativeBasicDeduction, 40_000);
  assert.equal(trace.items[1]?.currentMonthExpectedWithheldTax, 0);
});

test("上年收入不超过6万元模式可直接采用全年累计减除费用", () => {
  const buildMonthlyWithholdingTrace = getWithholdingTraceBuilder();

  const trace = buildMonthlyWithholdingTrace(
    [
      createMonthRecord(1, {
        salaryIncome: 30_000,
      }),
      createMonthRecord(2, {
        salaryIncome: 40_000,
        withheldTax: 500,
      }),
    ],
    {
      previousYearIncomeUnder60k: true,
    },
  );

  assert.equal(trace.mode, "annual_60000_upfront");
  assert.equal(trace.items[0]?.cumulativeBasicDeduction, 60_000);
  assert.equal(trace.items[0]?.currentMonthExpectedWithheldTax, 0);
  assert.equal(trace.items[1]?.cumulativeBasicDeduction, 60_000);
  assert.equal(trace.items[1]?.currentMonthExpectedWithheldTax, 300);
  assert.equal(trace.items[1]?.currentMonthWithholdingVariance, 200);
});

test("补发补扣辅助函数会把补发收入和补扣税并入当月金额", () => {
  const getSalaryIncomeForWithholding = Reflect.get(
    coreModule,
    "getSalaryIncomeForWithholding",
  ) as (record: EmployeeMonthRecord) => number;
  const getActualWithheldTaxForWithholding = Reflect.get(
    coreModule,
    "getActualWithheldTaxForWithholding",
  ) as (record: EmployeeMonthRecord) => number;
  const hasSupplementaryAdjustments = Reflect.get(
    coreModule,
    "hasSupplementaryAdjustments",
  ) as (record: EmployeeMonthRecord) => boolean;

  const record = createMonthRecord(3, {
    salaryIncome: 10_000,
    withheldTax: 300,
    supplementarySalaryIncome: 2_500,
    supplementaryWithheldTaxAdjustment: -50,
    supplementarySourcePeriodLabel: "2026-01",
    supplementaryRemark: "补发绩效差额",
  });

  assert.equal(getSalaryIncomeForWithholding(record), 12_500);
  assert.equal(getActualWithheldTaxForWithholding(record), 250);
  assert.equal(hasSupplementaryAdjustments(record), true);
});

test("未填写补发补扣字段时辅助函数保持兼容默认值", () => {
  const getSalaryIncomeForWithholding = Reflect.get(
    coreModule,
    "getSalaryIncomeForWithholding",
  ) as (record: EmployeeMonthRecord) => number;
  const getActualWithheldTaxForWithholding = Reflect.get(
    coreModule,
    "getActualWithheldTaxForWithholding",
  ) as (record: EmployeeMonthRecord) => number;
  const hasSupplementaryAdjustments = Reflect.get(
    coreModule,
    "hasSupplementaryAdjustments",
  ) as (record: EmployeeMonthRecord) => boolean;

  const record = createMonthRecord(4, {
    salaryIncome: 8_000,
    withheldTax: 100,
  });

  assert.equal(getSalaryIncomeForWithholding(record), 8_000);
  assert.equal(getActualWithheldTaxForWithholding(record), 100);
  assert.equal(hasSupplementaryAdjustments(record), false);
});

test("补发工资与补扣税会并入预扣轨迹", () => {
  const buildMonthlyWithholdingTrace = getWithholdingTraceBuilder();

  const trace = buildMonthlyWithholdingTrace([
    createMonthRecord(1, {
      salaryIncome: 10_000,
      withheldTax: 100,
      supplementarySalaryIncome: 2_000,
      supplementaryWithheldTaxAdjustment: 50,
    }),
  ]);

  assert.equal(trace.items[0]?.salaryIncome, 12_000);
  assert.equal(trace.items[0]?.actualWithheldTax, 150);
  assert.equal(trace.items[0]?.cumulativeSalaryIncome, 12_000);
  assert.equal(trace.summary.actualWithheldTaxTotal, 150);
});

test("补发工资会并入年度汇算收入，补扣税会并入年度已预扣税额", () => {
  const calculateEmployeeAnnualTax = getCalculator();

  const result = calculateEmployeeAnnualTax([
    createMonthRecord(1, {
      salaryIncome: 10_000,
      withheldTax: 100,
      supplementarySalaryIncome: 2_000,
      supplementaryWithheldTaxAdjustment: 50,
    }),
  ]);

  assert.equal(result.salaryIncomeTotal, 12_000);
  assert.equal(result.annualTaxWithheld, 150);
  assert.equal(result.withholdingSummary.actualWithheldTaxTotal, 150);
  assert.equal(result.withholdingSummary.expectedWithheldTaxTotal, 210);
  assert.equal(result.annualTaxPayable, 210);
  assert.equal(result.annualTaxSettlement, 60);
});

