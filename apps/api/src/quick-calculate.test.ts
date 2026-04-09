import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, beforeEach, test } from "node:test";
import Fastify from "fastify";

const testDatabasePath = path.join(process.cwd(), "data", "test", "quick-calculate.test.db");
process.env.DUDE_TAX_DB_PATH = testDatabasePath;

const modulesPromise = Promise.all([
  import("./routes/calculations.js"),
  import("./routes/tax-policy.js"),
  import("./repositories/unit-repository.js"),
  import("./db/database.js"),
]);

before(() => {
  fs.mkdirSync(path.dirname(testDatabasePath), { recursive: true });
  fs.rmSync(testDatabasePath, { force: true });
});

beforeEach(async () => {
  const [, , , { database }] = await modulesPromise;
  database.exec(`
    DELETE FROM annual_tax_results;
    DELETE FROM annual_calculation_runs;
    DELETE FROM employee_month_records;
    DELETE FROM employees;
    DELETE FROM tax_policy_scopes;
    DELETE FROM tax_policy_versions;
    DELETE FROM units;
    DELETE FROM app_preferences;
  `);
});

after(async () => {
  const [, , , { closeDatabase }] = await modulesPromise;
  closeDatabase();
  fs.rmSync(testDatabasePath, { force: true });
});

test("快速计算接口按当前单位年度作用域税率返回不落库结果，并带逐月预扣轨迹", async () => {
  const [{ registerCalculationRoutes }, { registerTaxPolicyRoutes }, { unitRepository }] =
    await modulesPromise;

  const app = Fastify({ logger: false });
  await registerCalculationRoutes(app);
  await registerTaxPolicyRoutes(app);

  const unit = unitRepository.create({
    unitName: "快速计算测试单位",
    remark: "",
  });

  await app.inject({
    method: "PUT",
    url: "/api/tax-policy",
    payload: {
      basicDeductionAmount: 6_000,
      comprehensiveTaxBrackets: [
        { level: 1, maxAnnualIncome: 36_000, rate: 3, quickDeduction: 0 },
        { level: 2, maxAnnualIncome: 144_000, rate: 10, quickDeduction: 2520 },
        { level: 3, maxAnnualIncome: 300_000, rate: 20, quickDeduction: 16920 },
        { level: 4, maxAnnualIncome: 420_000, rate: 25, quickDeduction: 31920 },
        { level: 5, maxAnnualIncome: 660_000, rate: 30, quickDeduction: 52920 },
        { level: 6, maxAnnualIncome: 960_000, rate: 35, quickDeduction: 85920 },
        { level: 7, maxAnnualIncome: null, rate: 45, quickDeduction: 181920 },
      ],
      bonusTaxBrackets: [
        { level: 1, maxAverageMonthlyIncome: 3_000, rate: 3, quickDeduction: 0 },
        { level: 2, maxAverageMonthlyIncome: 12_000, rate: 10, quickDeduction: 210 },
        { level: 3, maxAverageMonthlyIncome: 25_000, rate: 20, quickDeduction: 1410 },
        { level: 4, maxAverageMonthlyIncome: 35_000, rate: 25, quickDeduction: 2660 },
        { level: 5, maxAverageMonthlyIncome: 55_000, rate: 30, quickDeduction: 4410 },
        { level: 6, maxAverageMonthlyIncome: 80_000, rate: 35, quickDeduction: 7160 },
        { level: 7, maxAverageMonthlyIncome: null, rate: 45, quickDeduction: 15160 },
      ],
    },
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/quick-calculate",
    payload: {
      unitId: unit.id,
      taxYear: 2026,
      records: [
        {
          taxMonth: 1,
          salaryIncome: 10_000,
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
        },
      ],
    },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json() as Record<string, unknown>;
  assert.equal(body.basicDeductionTotal, 6_000);
  assert.equal(body.annualTaxPayable, 120);

  const withholdingTraceItems = body.withholdingTraceItems as Array<Record<string, unknown>>;
  assert.equal(withholdingTraceItems.length, 1);
  assert.equal(withholdingTraceItems[0]?.cumulativeExpectedWithheldTax, 120);
  assert.equal(withholdingTraceItems[0]?.cumulativeActualWithheldTaxBeforeCurrentMonth, 0);
  assert.equal(withholdingTraceItems[0]?.appliedRate, 3);

  const resultsResponse = await app.inject({
    method: "GET",
    url: `/api/units/${unit.id}/years/2026/annual-results`,
  });
  assert.equal(resultsResponse.statusCode, 200);
  assert.equal((resultsResponse.json() as unknown[]).length, 0);

  await app.close();
});

test("快速计算接口支持显式传入预扣规则模式", async () => {
  const [{ registerCalculationRoutes }, { registerTaxPolicyRoutes }, { unitRepository }] =
    await modulesPromise;

  const app = Fastify({ logger: false });
  await registerCalculationRoutes(app);
  await registerTaxPolicyRoutes(app);

  const unit = unitRepository.create({
    unitName: "快速计算预扣模式测试单位",
    remark: "",
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/quick-calculate",
    payload: {
      unitId: unit.id,
      taxYear: 2026,
      withholdingContext: {
        mode: "annual_60000_upfront",
      },
      records: [
        {
          taxMonth: 1,
          salaryIncome: 10_000,
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
        },
      ],
    },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json() as Record<string, unknown>;
  const withholdingSummary = body.withholdingSummary as Record<string, unknown>;
  assert.equal(withholdingSummary.withholdingMode, "annual_60000_upfront");
  assert.equal(withholdingSummary.expectedWithheldTaxTotal, 0);

  await app.close();
});
