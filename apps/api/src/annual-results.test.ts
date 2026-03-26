import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, beforeEach, test } from "node:test";
import Fastify from "fastify";
import type { UpsertEmployeeMonthRecordPayload } from "../../../packages/core/src/index.js";

const testDatabasePath = path.join(process.cwd(), "data", "test", "annual-results.test.db");
process.env.DUDE_TAX_DB_PATH = testDatabasePath;

const modulesPromise = Promise.all([
  import("./routes/calculations.js"),
  import("./repositories/unit-repository.js"),
  import("./repositories/employee-repository.js"),
  import("./repositories/month-record-repository.js"),
  import("./db/database.js"),
]);

const createMonthRecordPayload = (
  overrides: Partial<UpsertEmployeeMonthRecordPayload> = {},
): UpsertEmployeeMonthRecordPayload => ({
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
  ...overrides,
});

before(() => {
  fs.mkdirSync(path.dirname(testDatabasePath), { recursive: true });
  fs.rmSync(testDatabasePath, { force: true });
});

beforeEach(async () => {
  const [, , , , { database }] = await modulesPromise;
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
  const [, , , , { closeDatabase }] = await modulesPromise;
  closeDatabase();
  fs.rmSync(testDatabasePath, { force: true });
});

test("重算后可读取年度结果列表，并返回默认采用方案", async () => {
  const [{ registerCalculationRoutes }, { unitRepository }, { employeeRepository }, { monthRecordRepository }, { closeDatabase }] =
    await modulesPromise;

  const app = Fastify({ logger: false });
  await registerCalculationRoutes(app);

  const unit = unitRepository.create({
    unitName: "测试单位",
    remark: "",
  });
  const employee = employeeRepository.create(unit.id, {
    employeeCode: "EMP-001",
    employeeName: "张三",
    idNumber: "110101199001010011",
    hireDate: null,
    leaveDate: null,
    remark: "",
  });

  for (let taxMonth = 1; taxMonth <= 10; taxMonth += 1) {
    monthRecordRepository.upsert(
      unit.id,
      employee.id,
      2026,
      taxMonth,
      createMonthRecordPayload({
        salaryIncome: 19_000,
        annualBonus: taxMonth === 1 ? 40_000 : 0,
        withheldTax: taxMonth <= 5 ? 1_000 : 0,
      }),
    );
  }

  const recalculateResponse = await app.inject({
    method: "POST",
    url: `/api/units/${unit.id}/years/2026/calculation-statuses/recalculate`,
    payload: {},
  });

  assert.equal(recalculateResponse.statusCode, 200);

  const resultsResponse = await app.inject({
    method: "GET",
    url: `/api/units/${unit.id}/years/2026/annual-results`,
  });

  assert.equal(resultsResponse.statusCode, 200);

  const results = resultsResponse.json() as Array<Record<string, unknown>>;
  assert.equal(results.length, 1);
  assert.equal(results[0]?.employeeId, employee.id);
  assert.equal(results[0]?.selectedScheme, "separate_bonus");
  assert.equal(results[0]?.selectedTaxAmount, 15_270);
  assert.equal(results[0]?.annualTaxPayable, 15_270);
  assert.equal(results[0]?.annualTaxWithheld, 5_000);
  assert.equal(results[0]?.annualTaxSettlement, 10_270);
  assert.equal(results[0]?.settlementDirection, "payable");
  assert.equal(typeof results[0]?.calculatedAt, "string");

  await app.close();
});

test("支持手动切换结果方案，并在后续重算后保留手动选择", async () => {
  const [{ registerCalculationRoutes }, { unitRepository }, { employeeRepository }, { monthRecordRepository }, { closeDatabase }] =
    await modulesPromise;

  const app = Fastify({ logger: false });
  await registerCalculationRoutes(app);

  const unit = unitRepository.create({
    unitName: "测试单位-方案切换",
    remark: "",
  });
  const employee = employeeRepository.create(unit.id, {
    employeeCode: "EMP-002",
    employeeName: "李四",
    idNumber: "110101199001010022",
    hireDate: null,
    leaveDate: null,
    remark: "",
  });

  for (let taxMonth = 1; taxMonth <= 10; taxMonth += 1) {
    monthRecordRepository.upsert(
      unit.id,
      employee.id,
      2026,
      taxMonth,
      createMonthRecordPayload({
        salaryIncome: 19_000,
        annualBonus: taxMonth === 1 ? 40_000 : 0,
      }),
    );
  }

  await app.inject({
    method: "POST",
    url: `/api/units/${unit.id}/years/2026/calculation-statuses/recalculate`,
    payload: {},
  });

  const switchResponse = await app.inject({
    method: "PUT",
    url: `/api/units/${unit.id}/years/2026/annual-results/${employee.id}/selected-scheme`,
    payload: {
      selectedScheme: "combined_bonus",
    },
  });

  assert.equal(switchResponse.statusCode, 200);

  const switchedResultsResponse = await app.inject({
    method: "GET",
    url: `/api/units/${unit.id}/years/2026/annual-results`,
  });

  assert.equal(switchedResultsResponse.statusCode, 200);
  const switchedResults = switchedResultsResponse.json() as Array<Record<string, unknown>>;
  assert.equal(switchedResults[0]?.selectedScheme, "combined_bonus");
  assert.equal(switchedResults[0]?.selectedTaxAmount, 19_080);

  const recalculateResponse = await app.inject({
    method: "POST",
    url: `/api/units/${unit.id}/years/2026/calculation-statuses/recalculate`,
    payload: {},
  });

  assert.equal(recalculateResponse.statusCode, 200);

  const recalculatedResultsResponse = await app.inject({
    method: "GET",
    url: `/api/units/${unit.id}/years/2026/annual-results`,
  });

  assert.equal(recalculatedResultsResponse.statusCode, 200);
  const recalculatedResults = recalculatedResultsResponse.json() as Array<Record<string, unknown>>;
  assert.equal(recalculatedResults[0]?.selectedScheme, "combined_bonus");
  assert.equal(recalculatedResults[0]?.selectedTaxAmount, 19_080);

  await app.close();
});

test("导出预览接口返回扁平化导出字段，并跟随当前选定方案", async () => {
  const [{ registerCalculationRoutes }, { unitRepository }, { employeeRepository }, { monthRecordRepository }] =
    await modulesPromise;

  const app = Fastify({ logger: false });
  await registerCalculationRoutes(app);

  const unit = unitRepository.create({
    unitName: "测试单位-导出预览",
    remark: "",
  });
  const employee = employeeRepository.create(unit.id, {
    employeeCode: "EMP-003",
    employeeName: "王五",
    idNumber: "110101199001010033",
    hireDate: null,
    leaveDate: null,
    remark: "",
  });

  for (let taxMonth = 1; taxMonth <= 10; taxMonth += 1) {
    monthRecordRepository.upsert(
      unit.id,
      employee.id,
      2026,
      taxMonth,
      createMonthRecordPayload({
        salaryIncome: 19_000,
        annualBonus: taxMonth === 1 ? 40_000 : 0,
        withheldTax: 2_500,
      }),
    );
  }

  await app.inject({
    method: "POST",
    url: `/api/units/${unit.id}/years/2026/calculation-statuses/recalculate`,
    payload: {},
  });

  await app.inject({
    method: "PUT",
    url: `/api/units/${unit.id}/years/2026/annual-results/${employee.id}/selected-scheme`,
    payload: {
      selectedScheme: "combined_bonus",
    },
  });

  const exportPreviewResponse = await app.inject({
    method: "GET",
    url: `/api/units/${unit.id}/years/2026/annual-results/export-preview`,
  });

  assert.equal(exportPreviewResponse.statusCode, 200);

  const exportRows = exportPreviewResponse.json() as Array<Record<string, unknown>>;
  assert.equal(exportRows.length, 1);
  assert.equal(exportRows[0]?.unitName, "测试单位-导出预览");
  assert.equal(exportRows[0]?.employeeCode, "EMP-003");
  assert.equal(exportRows[0]?.employeeName, "王五");
  assert.equal(exportRows[0]?.selectedScheme, "combined_bonus");
  assert.equal(exportRows[0]?.selectedSchemeLabel, "并入综合所得");
  assert.equal(exportRows[0]?.selectedTaxableComprehensiveIncome, 180_000);
  assert.equal(exportRows[0]?.selectedComprehensiveIncomeTax, 19_080);
  assert.equal(exportRows[0]?.selectedAnnualBonusTax, 0);
  assert.equal(exportRows[0]?.selectedGrossTax, 19_080);
  assert.equal(exportRows[0]?.annualTaxPayable, 19_080);
  assert.equal(exportRows[0]?.annualTaxWithheld, 25_000);
  assert.equal(exportRows[0]?.annualTaxSettlement, -5_920);
  assert.equal(exportRows[0]?.settlementDirection, "refund");
  assert.equal(exportRows[0]?.settlementDirectionLabel, "应退税");
  assert.equal(typeof exportRows[0]?.calculatedAt, "string");

  await app.close();
});

test("历史查询接口支持按单位、年份和结算方向过滤年度结果", async () => {
  const [{ registerCalculationRoutes }, { unitRepository }, { employeeRepository }, { monthRecordRepository }] =
    await modulesPromise;

  const app = Fastify({ logger: false });
  await registerCalculationRoutes(app);

  const unitA = unitRepository.create({
    unitName: "历史单位-A",
    remark: "",
  });
  const unitB = unitRepository.create({
    unitName: "历史单位-B",
    remark: "",
  });

  const employeeA = employeeRepository.create(unitA.id, {
    employeeCode: "EMP-HIS-1",
    employeeName: "历史员工甲",
    idNumber: "110101199001010101",
    hireDate: null,
    leaveDate: null,
    remark: "",
  });
  const employeeB = employeeRepository.create(unitA.id, {
    employeeCode: "EMP-HIS-2",
    employeeName: "历史员工乙",
    idNumber: "110101199001010102",
    hireDate: null,
    leaveDate: null,
    remark: "",
  });
  const employeeC = employeeRepository.create(unitB.id, {
    employeeCode: "EMP-HIS-3",
    employeeName: "历史员工丙",
    idNumber: "110101199001010103",
    hireDate: null,
    leaveDate: null,
    remark: "",
  });

  for (let taxMonth = 1; taxMonth <= 3; taxMonth += 1) {
    monthRecordRepository.upsert(
      unitA.id,
      employeeA.id,
      2025,
      taxMonth,
      createMonthRecordPayload({
        salaryIncome: 10_000,
        withheldTax: 100,
      }),
    );
    monthRecordRepository.upsert(
      unitA.id,
      employeeB.id,
      2025,
      taxMonth,
      createMonthRecordPayload({
        salaryIncome: 10_000,
        withheldTax: 1_000,
      }),
    );
    monthRecordRepository.upsert(
      unitB.id,
      employeeC.id,
      2024,
      taxMonth,
      createMonthRecordPayload({
        salaryIncome: 10_000,
        withheldTax: 0,
      }),
    );
  }

  await app.inject({
    method: "POST",
    url: `/api/units/${unitA.id}/years/2025/calculation-statuses/recalculate`,
    payload: {},
  });
  await app.inject({
    method: "POST",
    url: `/api/units/${unitB.id}/years/2024/calculation-statuses/recalculate`,
    payload: {},
  });

  const response = await app.inject({
    method: "GET",
    url: `/api/history-results?unitId=${unitA.id}&taxYear=2025&settlementDirection=payable`,
  });

  assert.equal(response.statusCode, 200);
  const results = response.json() as Array<Record<string, unknown>>;
  assert.equal(results.length, 1);
  assert.equal(results[0]?.unitName, "历史单位-A");
  assert.equal(results[0]?.employeeId, employeeA.id);
  assert.equal(results[0]?.employeeCode, "EMP-HIS-1");
  assert.equal(results[0]?.settlementDirection, "payable");
  assert.equal(results[0]?.annualTaxSettlement, 150);

  await app.close();
});
