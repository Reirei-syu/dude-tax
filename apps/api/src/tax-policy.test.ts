import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, beforeEach, test } from "node:test";
import Fastify from "fastify";
import type { UpsertEmployeeMonthRecordPayload } from "../../../packages/core/src/index.js";

const testDatabasePath = path.join(process.cwd(), "data", "test", "tax-policy.test.db");
process.env.DUDE_TAX_DB_PATH = testDatabasePath;

const modulesPromise = Promise.all([
  import("./routes/calculations.js"),
  import("./routes/tax-policy.js"),
  import("./repositories/unit-repository.js"),
  import("./repositories/employee-repository.js"),
  import("./repositories/month-record-repository.js"),
  import("./db/database.js"),
]);

const createMonthRecordPayload = (
  overrides: Partial<UpsertEmployeeMonthRecordPayload> = {},
): UpsertEmployeeMonthRecordPayload => ({
  status: "completed",
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

before(() => {
  fs.mkdirSync(path.dirname(testDatabasePath), { recursive: true });
  fs.rmSync(testDatabasePath, { force: true });
});

beforeEach(async () => {
  const [, , , , , { database }] = await modulesPromise;
  database.exec(`
    DELETE FROM annual_tax_results;
    DELETE FROM annual_calculation_runs;
    DELETE FROM employee_month_records;
    DELETE FROM employees;
    DELETE FROM units;
    DELETE FROM app_preferences;
  `);
});

after(async () => {
  const [, , , , , { closeDatabase }] = await modulesPromise;
  closeDatabase();
  fs.rmSync(testDatabasePath, { force: true });
});

test("读取税标接口返回当前配置与默认配置", async () => {
  const [{}, { registerTaxPolicyRoutes }] = await modulesPromise;

  const app = Fastify({ logger: false });
  await registerTaxPolicyRoutes(app);

  const response = await app.inject({
    method: "GET",
    url: "/api/tax-policy",
  });

  assert.equal(response.statusCode, 200);

  const body = response.json() as Record<string, unknown>;
  assert.equal(body.isCustomized, false);
  assert.equal(body.currentNotes, "");
  assert.equal(body.notesCustomized, false);
  assert.equal(
    (body.currentSettings as Record<string, unknown>).basicDeductionAmount,
    5_000,
  );
  assert.equal(
    ((body.currentSettings as Record<string, unknown>).comprehensiveTaxBrackets as unknown[]).length,
    7,
  );

  await app.close();
});

test("仅保存说明时不应清空年度结果与重算记录", async () => {
  const [
    { registerCalculationRoutes },
    { registerTaxPolicyRoutes },
    { unitRepository },
    { employeeRepository },
    { monthRecordRepository },
  ] = await modulesPromise;

  const app = Fastify({ logger: false });
  await registerCalculationRoutes(app);
  await registerTaxPolicyRoutes(app);

  const unit = unitRepository.create({
    unitName: "税标说明测试单位",
    remark: "",
  });
  const employee = employeeRepository.create(unit.id, {
    employeeCode: "EMP-TAX-002",
    employeeName: "说明测试员工",
    idNumber: "110101199001018888",
    hireDate: null,
    leaveDate: null,
    remark: "",
  });

  monthRecordRepository.upsert(
    unit.id,
    employee.id,
    2026,
    1,
    createMonthRecordPayload(),
  );

  await app.inject({
    method: "POST",
    url: `/api/units/${unit.id}/years/2026/calculation-statuses/recalculate`,
    payload: {},
  });

  const currentPolicyResponse = await app.inject({
    method: "GET",
    url: "/api/tax-policy",
  });

  const currentPolicy = currentPolicyResponse.json() as Record<string, unknown>;

  const saveResponse = await app.inject({
    method: "PUT",
    url: "/api/tax-policy",
    payload: {
      ...(currentPolicy.currentSettings as Record<string, unknown>),
      maintenanceNotes: "当前说明已更新，但税标口径未发生变化。",
    },
  });

  assert.equal(saveResponse.statusCode, 200);
  const saveBody = saveResponse.json() as Record<string, unknown>;
  assert.equal(saveBody.invalidatedResults, false);
  assert.equal(saveBody.currentNotes, "当前说明已更新，但税标口径未发生变化。");
  assert.equal(saveBody.notesCustomized, true);

  const resultsResponse = await app.inject({
    method: "GET",
    url: `/api/units/${unit.id}/years/2026/annual-results`,
  });
  assert.equal(resultsResponse.statusCode, 200);
  assert.equal((resultsResponse.json() as unknown[]).length, 1);

  const statusesResponse = await app.inject({
    method: "GET",
    url: `/api/units/${unit.id}/years/2026/calculation-statuses`,
  });
  assert.equal(statusesResponse.statusCode, 200);
  const statuses = statusesResponse.json() as Array<Record<string, unknown>>;
  assert.equal(statuses.length, 1);
  assert.equal(typeof statuses[0]?.lastCalculatedAt, "string");

  await app.close();
});

test("保存税标后会清空年度结果与重算记录", async () => {
  const [
    { registerCalculationRoutes },
    { registerTaxPolicyRoutes },
    { unitRepository },
    { employeeRepository },
    { monthRecordRepository },
  ] = await modulesPromise;

  const app = Fastify({ logger: false });
  await registerCalculationRoutes(app);
  await registerTaxPolicyRoutes(app);

  const unit = unitRepository.create({
    unitName: "税标维护测试单位",
    remark: "",
  });
  const employee = employeeRepository.create(unit.id, {
    employeeCode: "EMP-TAX-001",
    employeeName: "税标测试员工",
    idNumber: "110101199001019999",
    hireDate: null,
    leaveDate: null,
    remark: "",
  });

  monthRecordRepository.upsert(
    unit.id,
    employee.id,
    2026,
    1,
    createMonthRecordPayload(),
  );

  const recalculateResponse = await app.inject({
    method: "POST",
    url: `/api/units/${unit.id}/years/2026/calculation-statuses/recalculate`,
    payload: {},
  });

  assert.equal(recalculateResponse.statusCode, 200);

  const saveResponse = await app.inject({
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

  assert.equal(saveResponse.statusCode, 200);
  const saveBody = saveResponse.json() as Record<string, unknown>;
  assert.equal(saveBody.invalidatedResults, true);
  assert.equal(saveBody.isCustomized, true);

  const resultsResponse = await app.inject({
    method: "GET",
    url: `/api/units/${unit.id}/years/2026/annual-results`,
  });
  assert.equal(resultsResponse.statusCode, 200);
  assert.equal((resultsResponse.json() as unknown[]).length, 0);

  const statusesResponse = await app.inject({
    method: "GET",
    url: `/api/units/${unit.id}/years/2026/calculation-statuses`,
  });
  assert.equal(statusesResponse.statusCode, 200);
  const statuses = statusesResponse.json() as Array<Record<string, unknown>>;
  assert.equal(statuses.length, 1);
  assert.equal(statuses[0]?.preparationStatus, "ready");
  assert.equal(statuses[0]?.lastCalculatedAt, null);

  await app.close();
});
