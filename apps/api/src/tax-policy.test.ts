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

test("读取税率接口返回当前配置与默认配置", async () => {
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
  assert.equal(typeof body.currentVersionId, "number");
  assert.equal(typeof body.currentVersionName, "string");
  assert.equal((body.versions as unknown[]).length, 1);
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
    unitName: "税率说明测试单位",
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
      maintenanceNotes: "当前说明已更新，但税率口径未发生变化。",
    },
  });

  assert.equal(saveResponse.statusCode, 200);
  const saveBody = saveResponse.json() as Record<string, unknown>;
  assert.equal(saveBody.invalidatedResults, false);
  assert.equal(saveBody.currentNotes, "当前说明已更新，但税率口径未发生变化。");
  assert.equal(saveBody.notesCustomized, true);
  assert.equal((saveBody.versions as unknown[]).length, 1);

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
  assert.equal(statuses[0]?.isInvalidated, false);
  assert.equal(statuses[0]?.invalidatedReason, null);

  await app.close();
});

test("保存税率后会使旧税率结果逻辑失效", async () => {
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
    unitName: "税率维护测试单位",
    remark: "",
  });
  const employee = employeeRepository.create(unit.id, {
    employeeCode: "EMP-TAX-001",
    employeeName: "税率测试员工",
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

  const initialPolicyResponse = await app.inject({
    method: "GET",
    url: "/api/tax-policy",
  });
  const initialPolicy = initialPolicyResponse.json() as Record<string, unknown>;
  const initialVersionId = Number(initialPolicy.currentVersionId);

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
  assert.equal((saveBody.versions as unknown[]).length, 2);

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
  assert.equal(typeof statuses[0]?.lastCalculatedAt, "string");
  assert.equal(statuses[0]?.isInvalidated, true);
  assert.equal(statuses[0]?.invalidatedReason, "tax_policy_changed");

  const historyResponse = await app.inject({
    method: "GET",
    url: `/api/history-results?unitId=${unit.id}&taxYear=2026`,
  });
  assert.equal(historyResponse.statusCode, 200);
  assert.equal((historyResponse.json() as unknown[]).length, 0);

  const invalidatedHistoryResponse = await app.inject({
    method: "GET",
    url: `/api/history-results?unitId=${unit.id}&taxYear=2026&resultStatus=invalidated`,
  });
  assert.equal(invalidatedHistoryResponse.statusCode, 200);
  const invalidatedRows = invalidatedHistoryResponse.json() as Array<Record<string, unknown>>;
  assert.equal(invalidatedRows.length, 1);
  assert.equal(invalidatedRows[0]?.isInvalidated, true);
  assert.equal(invalidatedRows[0]?.invalidatedReason, "tax_policy_changed");

  const allHistoryResponse = await app.inject({
    method: "GET",
    url: `/api/history-results?unitId=${unit.id}&taxYear=2026&resultStatus=all`,
  });
  assert.equal(allHistoryResponse.statusCode, 200);
  assert.equal((allHistoryResponse.json() as unknown[]).length, 1);

  const activateResponse = await app.inject({
    method: "POST",
    url: `/api/tax-policy/versions/${initialVersionId}/activate`,
  });

  assert.equal(activateResponse.statusCode, 200);
  const activateBody = activateResponse.json() as Record<string, unknown>;
  assert.equal(activateBody.invalidatedResults, true);
  assert.equal(
    (activateBody.currentSettings as Record<string, unknown>).basicDeductionAmount,
    5_000,
  );

  const restoredResultsResponse = await app.inject({
    method: "GET",
    url: `/api/units/${unit.id}/years/2026/annual-results`,
  });
  assert.equal(restoredResultsResponse.statusCode, 200);
  assert.equal((restoredResultsResponse.json() as unknown[]).length, 1);

  const restoredStatusesResponse = await app.inject({
    method: "GET",
    url: `/api/units/${unit.id}/years/2026/calculation-statuses`,
  });
  const restoredStatuses = restoredStatusesResponse.json() as Array<Record<string, unknown>>;
  assert.equal(restoredStatuses[0]?.isInvalidated, false);
  assert.equal(restoredStatuses[0]?.invalidatedReason, null);

  await app.close();
});

test("税率超过 100 时接口返回参数校验错误", async () => {
  const [{}, { registerTaxPolicyRoutes }] = await modulesPromise;

  const app = Fastify({ logger: false });
  await registerTaxPolicyRoutes(app);

  const response = await app.inject({
    method: "PUT",
    url: "/api/tax-policy",
    payload: {
      basicDeductionAmount: 5_000,
      comprehensiveTaxBrackets: [
        { level: 1, maxAnnualIncome: 36_000, rate: 120, quickDeduction: 0 },
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

  assert.equal(response.statusCode, 400);
  const body = response.json() as Record<string, unknown>;
  assert.equal(body.message, "税率参数不合法");

  await app.close();
});

