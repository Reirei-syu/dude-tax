import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, beforeEach, test } from "node:test";
import Fastify from "fastify";
import {
  buildDefaultTaxPolicySettings,
  buildTaxPolicySignature,
  type UpsertEmployeeMonthRecordPayload,
} from "../../../packages/core/src/index.js";
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
  const defaultSettings = buildDefaultTaxPolicySettings();
  const now = new Date().toISOString();
  database.exec(
    `     DELETE FROM tax_policy_audit_logs;     DELETE FROM tax_policy_scopes;     DELETE FROM annual_tax_result_versions;     DELETE FROM annual_tax_results;     DELETE FROM annual_calculation_runs;     DELETE FROM employee_month_records;     DELETE FROM employees;     DELETE FROM units;     DELETE FROM app_preferences;     DELETE FROM tax_policy_versions;   `,
  );
  const insertResult = database
    .prepare(
      `       INSERT INTO tax_policy_versions (         version_name,         policy_signature,         settings_json,         maintenance_notes,         is_active,         created_at,         activated_at,         updated_at       )       VALUES (?, ?, ?, '', 1, ?, ?, ?)     `,
    )
    .run(
      "初始税率版本",
      buildTaxPolicySignature(defaultSettings),
      JSON.stringify(defaultSettings),
      now,
      now,
      now,
    );
  database
    .prepare(`       INSERT INTO app_preferences (key, value)       VALUES (?, ?)     `)
    .run("active_tax_policy_version_id", String(insertResult.lastInsertRowid));
});
after(async () => {
  const [, , , , { closeDatabase }] = await modulesPromise;
  closeDatabase();
  fs.rmSync(testDatabasePath, { force: true });
});
test("重算后可读取年度结果列表，并返回默认采用方案", async () => {
  const [
    { registerCalculationRoutes },
    { unitRepository },
    { employeeRepository },
    { monthRecordRepository },
    { closeDatabase },
  ] = await modulesPromise;
  const app = Fastify({ logger: false });
  await registerCalculationRoutes(app);
  const unit = unitRepository.create({ unitName: "测试单位", remark: "" });
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
  const [
    { registerCalculationRoutes },
    { unitRepository },
    { employeeRepository },
    { monthRecordRepository },
    { closeDatabase },
  ] = await modulesPromise;
  const app = Fastify({ logger: false });
  await registerCalculationRoutes(app);
  const unit = unitRepository.create({ unitName: "测试单位-方案切换", remark: "" });
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
      createMonthRecordPayload({ salaryIncome: 19_000, annualBonus: taxMonth === 1 ? 40_000 : 0 }),
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
    payload: { selectedScheme: "combined_bonus" },
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
  const [
    { registerCalculationRoutes },
    { unitRepository },
    { employeeRepository },
    { monthRecordRepository },
  ] = await modulesPromise;
  const app = Fastify({ logger: false });
  await registerCalculationRoutes(app);
  const unit = unitRepository.create({ unitName: "测试单位-导出预览", remark: "" });
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
    payload: { selectedScheme: "combined_bonus" },
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
  const [
    { registerCalculationRoutes },
    { unitRepository },
    { employeeRepository },
    { monthRecordRepository },
  ] = await modulesPromise;
  const app = Fastify({ logger: false });
  await registerCalculationRoutes(app);
  const unitA = unitRepository.create({ unitName: "历史单位-A", remark: "" });
  const unitB = unitRepository.create({ unitName: "历史单位-B", remark: "" });
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
      createMonthRecordPayload({ salaryIncome: 10_000, withheldTax: 100 }),
    );
    monthRecordRepository.upsert(
      unitA.id,
      employeeB.id,
      2025,
      taxMonth,
      createMonthRecordPayload({ salaryIncome: 10_000, withheldTax: 1_000 }),
    );
    monthRecordRepository.upsert(
      unitB.id,
      employeeC.id,
      2024,
      taxMonth,
      createMonthRecordPayload({ salaryIncome: 10_000, withheldTax: 0 }),
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
test("历史结果重算对比接口返回当前重算结果与差异项", async () => {
  const [
    { registerCalculationRoutes },
    { unitRepository },
    { employeeRepository },
    { monthRecordRepository },
    { database },
  ] = await modulesPromise;
  const app = Fastify({ logger: false });
  await registerCalculationRoutes(app);
  const unit = unitRepository.create({ unitName: "历史重算对比测试单位", remark: "" });
  const employee = employeeRepository.create(unit.id, {
    employeeCode: "EMP-HIS-COMP-001",
    employeeName: "历史对比员工",
    idNumber: "110101199001015555",
    hireDate: null,
    leaveDate: null,
    remark: "",
  });
  monthRecordRepository.upsert(
    unit.id,
    employee.id,
    2026,
    1,
    createMonthRecordPayload({ salaryIncome: 10_000, withheldTax: 0 }),
  );
  const recalculateResponse = await app.inject({
    method: "POST",
    url: `/api/units/${unit.id}/years/2026/calculation-statuses/recalculate`,
    payload: {},
  });
  assert.equal(recalculateResponse.statusCode, 200);
  const nextSettings = {
    ...buildDefaultTaxPolicySettings(),
    basicDeductionAmount: 6_000,
  };
  const now = new Date().toISOString();
  database.prepare("UPDATE tax_policy_versions SET is_active = 0").run();
  const insertResult = database
    .prepare(
      `       INSERT INTO tax_policy_versions (         version_name,         policy_signature,         settings_json,         maintenance_notes,         is_active,         created_at,         activated_at,         updated_at       )       VALUES (?, ?, ?, '', 1, ?, ?, ?)     `,
    )
    .run(
      "历史对比测试税率版本",
      buildTaxPolicySignature(nextSettings),
      JSON.stringify(nextSettings),
      now,
      now,
      now,
    );
  database
    .prepare("UPDATE app_preferences SET value = ? WHERE key = ?")
    .run(String(insertResult.lastInsertRowid), "active_tax_policy_version_id");
  const comparisonResponse = await app.inject({
    method: "POST",
    url: "/api/history-results/recalculate",
    payload: {
      unitId: unit.id,
      taxYear: 2026,
      employeeId: employee.id,
    },
  });
  assert.equal(comparisonResponse.statusCode, 200);
  const comparisonBody = comparisonResponse.json() as Record<string, unknown>;
  assert.equal(comparisonBody.invalidatedReason, "tax_policy_changed");
  const snapshotResult = comparisonBody.snapshotResult as Record<string, unknown>;
  const recalculatedResult = comparisonBody.recalculatedResult as Record<string, unknown>;
  const comparisonItems = comparisonBody.comparisonItems as Array<Record<string, unknown>>;
  assert.equal(snapshotResult.employeeId, employee.id);
  assert.equal(snapshotResult.annualTaxPayable, 150);
  assert.equal(recalculatedResult.annualTaxPayable, 120);
  assert.equal(comparisonItems.length, 8);
  assert.equal(comparisonItems[0]?.label, "预扣模式");
  assert.equal(comparisonItems[2]?.label, "年度应纳税额");
  assert.equal(comparisonItems[2]?.deltaValue, "-30.00");
  await app.close();
});
test("returns recalculation version history for the selected employee and year", async () => {
  const [
    { registerCalculationRoutes },
    { unitRepository },
    { employeeRepository },
    { monthRecordRepository },
  ] = await modulesPromise;
  const app = Fastify({ logger: false });
  await registerCalculationRoutes(app);
  const unit = unitRepository.create({ unitName: "版本历史单位", remark: "" });
  const employee = employeeRepository.create(unit.id, {
    employeeCode: "EMP-V-001",
    employeeName: "版本员工",
    idNumber: "110101199001019999",
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
        withheldTax: 1_000,
      }),
    );
  }
  const firstRecalculateResponse = await app.inject({
    method: "POST",
    url: `/api/units/${unit.id}/years/2026/calculation-statuses/recalculate`,
    payload: {},
  });
  assert.equal(firstRecalculateResponse.statusCode, 200);
  monthRecordRepository.upsert(
    unit.id,
    employee.id,
    2026,
    1,
    createMonthRecordPayload({ salaryIncome: 25_000, annualBonus: 0, withheldTax: 1_000 }),
  );
  const secondRecalculateResponse = await app.inject({
    method: "POST",
    url: `/api/units/${unit.id}/years/2026/calculation-statuses/recalculate`,
    payload: {},
  });
  assert.equal(secondRecalculateResponse.statusCode, 200);
  const versionsResponse = await app.inject({
    method: "GET",
    url: `/api/units/${unit.id}/years/2026/employees/${employee.id}/annual-result-versions`,
  });
  assert.equal(versionsResponse.statusCode, 200);
  const versions = versionsResponse.json() as Array<Record<string, unknown>>;
  assert.equal(versions.length, 2);
  assert.equal(versions[0]?.versionSequence, 2);
  assert.equal(versions[1]?.versionSequence, 1);
  assert.equal(typeof versions[0]?.calculatedAt, "string");
  assert.equal(typeof versions[1]?.calculatedAt, "string");
  assert.notEqual(versions[0]?.selectedTaxAmount, versions[1]?.selectedTaxAmount);
  await app.close();
});
test("does not append recalculation version history when result snapshot is unchanged", async () => {
  const [
    { registerCalculationRoutes },
    { unitRepository },
    { employeeRepository },
    { monthRecordRepository },
  ] = await modulesPromise;
  const app = Fastify({ logger: false });
  await registerCalculationRoutes(app);
  const unit = unitRepository.create({ unitName: "版本历史单位-重复重算", remark: "" });
  const employee = employeeRepository.create(unit.id, {
    employeeCode: "EMP-V-REPEAT-001",
    employeeName: "版本员工-重复重算",
    idNumber: "110101199001017778",
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
        withheldTax: 1_000,
      }),
    );
  }
  const firstRecalculateResponse = await app.inject({
    method: "POST",
    url: `/api/units/${unit.id}/years/2026/calculation-statuses/recalculate`,
    payload: {},
  });
  assert.equal(firstRecalculateResponse.statusCode, 200);

  const firstResultsResponse = await app.inject({
    method: "GET",
    url: `/api/units/${unit.id}/years/2026/annual-results`,
  });
  assert.equal(firstResultsResponse.statusCode, 200);
  const firstResults = firstResultsResponse.json() as Array<Record<string, unknown>>;
  const firstCalculatedAt = String(firstResults[0]?.calculatedAt ?? "");

  const firstStatusesResponse = await app.inject({
    method: "GET",
    url: `/api/units/${unit.id}/years/2026/calculation-statuses`,
  });
  assert.equal(firstStatusesResponse.statusCode, 200);
  const firstStatuses = firstStatusesResponse.json() as Array<Record<string, unknown>>;
  const firstLastCalculatedAt = String(firstStatuses[0]?.lastCalculatedAt ?? "");

  await new Promise((resolve) => setTimeout(resolve, 20));

  const secondRecalculateResponse = await app.inject({
    method: "POST",
    url: `/api/units/${unit.id}/years/2026/calculation-statuses/recalculate`,
    payload: {},
  });
  assert.equal(secondRecalculateResponse.statusCode, 200);

  const versionsResponse = await app.inject({
    method: "GET",
    url: `/api/units/${unit.id}/years/2026/employees/${employee.id}/annual-result-versions`,
  });
  assert.equal(versionsResponse.statusCode, 200);
  const versions = versionsResponse.json() as Array<Record<string, unknown>>;
  assert.equal(versions.length, 1);
  assert.equal(versions[0]?.versionSequence, 1);

  const secondResultsResponse = await app.inject({
    method: "GET",
    url: `/api/units/${unit.id}/years/2026/annual-results`,
  });
  assert.equal(secondResultsResponse.statusCode, 200);
  const secondResults = secondResultsResponse.json() as Array<Record<string, unknown>>;
  assert.equal(secondResults.length, 1);
  assert.notEqual(String(secondResults[0]?.calculatedAt ?? ""), firstCalculatedAt);

  const secondStatusesResponse = await app.inject({
    method: "GET",
    url: `/api/units/${unit.id}/years/2026/calculation-statuses`,
  });
  assert.equal(secondStatusesResponse.statusCode, 200);
  const secondStatuses = secondStatusesResponse.json() as Array<Record<string, unknown>>;
  assert.notEqual(String(secondStatuses[0]?.lastCalculatedAt ?? ""), firstLastCalculatedAt);

  await app.close();
});
test("does not create recalculation history when only switching selected scheme", async () => {
  const [
    { registerCalculationRoutes },
    { unitRepository },
    { employeeRepository },
    { monthRecordRepository },
  ] = await modulesPromise;
  const app = Fastify({ logger: false });
  await registerCalculationRoutes(app);
  const unit = unitRepository.create({ unitName: "版本历史单位-方案切换", remark: "" });
  const employee = employeeRepository.create(unit.id, {
    employeeCode: "EMP-V-002",
    employeeName: "版本员工-方案切换",
    idNumber: "110101199001018888",
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
      createMonthRecordPayload({ salaryIncome: 19_000, annualBonus: taxMonth === 1 ? 40_000 : 0 }),
    );
  }
  const recalculateResponse = await app.inject({
    method: "POST",
    url: `/api/units/${unit.id}/years/2026/calculation-statuses/recalculate`,
    payload: {},
  });
  assert.equal(recalculateResponse.statusCode, 200);
  const switchResponse = await app.inject({
    method: "PUT",
    url: `/api/units/${unit.id}/years/2026/annual-results/${employee.id}/selected-scheme`,
    payload: { selectedScheme: "combined_bonus" },
  });
  assert.equal(switchResponse.statusCode, 200);
  const versionsResponse = await app.inject({
    method: "GET",
    url: `/api/units/${unit.id}/years/2026/employees/${employee.id}/annual-result-versions`,
  });
  assert.equal(versionsResponse.statusCode, 200);
  const versions = versionsResponse.json() as Array<Record<string, unknown>>;
  assert.equal(versions.length, 1);
  assert.equal(versions[0]?.versionSequence, 1);
  await app.close();
});
test("marks older recalculation versions invalid when month data changes", async () => {
  const [
    { registerCalculationRoutes },
    { unitRepository },
    { employeeRepository },
    { monthRecordRepository },
  ] = await modulesPromise;
  const app = Fastify({ logger: false });
  await registerCalculationRoutes(app);
  const unit = unitRepository.create({ unitName: "数据失效测试单位", remark: "" });
  const employee = employeeRepository.create(unit.id, {
    employeeCode: "EMP-DATA-001",
    employeeName: "数据失效测试员工",
    idNumber: "110101199001017777",
    hireDate: null,
    leaveDate: null,
    remark: "",
  });
  for (let taxMonth = 1; taxMonth <= 3; taxMonth += 1) {
    monthRecordRepository.upsert(
      unit.id,
      employee.id,
      2026,
      taxMonth,
      createMonthRecordPayload({ salaryIncome: 12_000, withheldTax: 200 }),
    );
  }
  const firstRecalculateResponse = await app.inject({
    method: "POST",
    url: `/api/units/${unit.id}/years/2026/calculation-statuses/recalculate`,
    payload: {},
  });
  assert.equal(firstRecalculateResponse.statusCode, 200);
  monthRecordRepository.upsert(
    unit.id,
    employee.id,
    2026,
    2,
    createMonthRecordPayload({ salaryIncome: 18_000, withheldTax: 500 }),
  );
  const secondRecalculateResponse = await app.inject({
    method: "POST",
    url: `/api/units/${unit.id}/years/2026/calculation-statuses/recalculate`,
    payload: {},
  });
  assert.equal(secondRecalculateResponse.statusCode, 200);
  const versionsResponse = await app.inject({
    method: "GET",
    url: `/api/units/${unit.id}/years/2026/employees/${employee.id}/annual-result-versions`,
  });
  assert.equal(versionsResponse.statusCode, 200);
  const versions = versionsResponse.json() as Array<Record<string, unknown>>;
  assert.equal(versions.length, 2);
  assert.equal(versions[0]?.isInvalidated, false);
  assert.equal(versions[0]?.invalidatedReason, null);
  assert.equal(versions[1]?.isInvalidated, true);
  assert.equal(versions[1]?.invalidatedReason, "month_record_changed");
  await app.close();
});
test("treats blank data signatures as recalculation-needed for migration compatibility", async () => {
  const [
    { registerCalculationRoutes },
    { unitRepository },
    { employeeRepository },
    { monthRecordRepository },
    { database },
  ] = await modulesPromise;
  const app = Fastify({ logger: false });
  await registerCalculationRoutes(app);
  const unit = unitRepository.create({ unitName: "空签名兼容测试单位", remark: "" });
  const employee = employeeRepository.create(unit.id, {
    employeeCode: "EMP-DATA-002",
    employeeName: "空签名兼容测试员工",
    idNumber: "110101199001016666",
    hireDate: null,
    leaveDate: null,
    remark: "",
  });
  monthRecordRepository.upsert(
    unit.id,
    employee.id,
    2026,
    1,
    createMonthRecordPayload({ salaryIncome: 10_000, withheldTax: 100 }),
  );
  const recalculateResponse = await app.inject({
    method: "POST",
    url: `/api/units/${unit.id}/years/2026/calculation-statuses/recalculate`,
    payload: {},
  });
  assert.equal(recalculateResponse.statusCode, 200);
  database
    .prepare(
      `UPDATE annual_calculation_runs SET data_signature = '' WHERE unit_id = ? AND employee_id = ? AND tax_year = ?`,
    )
    .run(unit.id, employee.id, 2026);
  database
    .prepare(
      `UPDATE annual_tax_results SET data_signature = '' WHERE unit_id = ? AND employee_id = ? AND tax_year = ?`,
    )
    .run(unit.id, employee.id, 2026);
  database
    .prepare(
      `UPDATE annual_tax_result_versions SET data_signature = '' WHERE unit_id = ? AND employee_id = ? AND tax_year = ?`,
    )
    .run(unit.id, employee.id, 2026);
  const statusesResponse = await app.inject({
    method: "GET",
    url: `/api/units/${unit.id}/years/2026/calculation-statuses`,
  });
  assert.equal(statusesResponse.statusCode, 200);
  const statuses = statusesResponse.json() as Array<Record<string, unknown>>;
  assert.equal(statuses[0]?.isInvalidated, true);
  assert.equal(statuses[0]?.invalidatedReason, "month_record_changed");
  const resultsResponse = await app.inject({
    method: "GET",
    url: `/api/units/${unit.id}/years/2026/annual-results`,
  });
  assert.equal(resultsResponse.statusCode, 200);
  assert.equal((resultsResponse.json() as unknown[]).length, 0);
  const historyResponse = await app.inject({
    method: "GET",
    url: `/api/history-results?unitId=${unit.id}&taxYear=2026&resultStatus=invalidated`,
  });
  assert.equal(historyResponse.statusCode, 200);
  const invalidatedRows = historyResponse.json() as Array<Record<string, unknown>>;
  assert.equal(invalidatedRows.length, 1);
  assert.equal(invalidatedRows[0]?.invalidatedReason, "month_record_changed");
  await app.close();
});
test("重算接口支持传入预扣规则模式并写入结果快照", async () => {
  const [
    { registerCalculationRoutes },
    { unitRepository },
    { employeeRepository },
    { monthRecordRepository },
  ] = await modulesPromise;
  const app = Fastify({ logger: false });
  await registerCalculationRoutes(app);
  const unit = unitRepository.create({ unitName: "预扣模式重算测试单位", remark: "" });
  const employee = employeeRepository.create(unit.id, {
    employeeCode: "EMP-WITHHOLD-001",
    employeeName: "预扣模式员工",
    idNumber: "110101199001010099",
    hireDate: null,
    leaveDate: null,
    remark: "",
  });
  monthRecordRepository.upsert(
    unit.id,
    employee.id,
    2026,
    1,
    createMonthRecordPayload({ salaryIncome: 10_000, withheldTax: 0 }),
  );
  const recalculateResponse = await app.inject({
    method: "POST",
    url: `/api/units/${unit.id}/years/2026/calculation-statuses/recalculate`,
    payload: { withholdingContext: { mode: "annual_60000_upfront" } },
  });
  assert.equal(recalculateResponse.statusCode, 200);
  const resultsResponse = await app.inject({
    method: "GET",
    url: `/api/units/${unit.id}/years/2026/annual-results`,
  });
  assert.equal(resultsResponse.statusCode, 200);
  const results = resultsResponse.json() as Array<Record<string, unknown>>;
  assert.equal(results.length, 1);
  const withholdingSummary = results[0]?.withholdingSummary as Record<string, unknown>;
  assert.equal(withholdingSummary.withholdingMode, "annual_60000_upfront");
  assert.equal(withholdingSummary.expectedWithheldTaxTotal, 0);
  await app.close();
});
test("跨单位前置月份会影响当前单位结果的预扣轨迹摘要", async () => {
  const [
    { registerCalculationRoutes },
    { unitRepository },
    { employeeRepository },
    { monthRecordRepository },
  ] = await modulesPromise;
  const app = Fastify({ logger: false });
  await registerCalculationRoutes(app);
  const unitA = unitRepository.create({ unitName: "当前单位", remark: "" });
  const unitB = unitRepository.create({ unitName: "前序单位", remark: "" });
  const employeeA = employeeRepository.create(unitA.id, {
    employeeCode: "EMP-BRIDGE-A",
    employeeName: "跨单位员工",
    idNumber: "110101199001010188",
    hireDate: "2026-07-01",
    leaveDate: null,
    remark: "",
  });
  const employeeB = employeeRepository.create(unitB.id, {
    employeeCode: "EMP-BRIDGE-B",
    employeeName: "跨单位员工-前单位",
    idNumber: "110101199001010188",
    hireDate: "2026-01-01",
    leaveDate: "2026-06-30",
    remark: "",
  });
  for (let taxMonth = 1; taxMonth <= 6; taxMonth += 1) {
    monthRecordRepository.upsert(
      unitB.id,
      employeeB.id,
      2026,
      taxMonth,
      createMonthRecordPayload({ salaryIncome: 20_000, withheldTax: 1_000 }),
    );
  }
  monthRecordRepository.upsert(
    unitA.id,
    employeeA.id,
    2026,
    7,
    createMonthRecordPayload({ salaryIncome: 20_000, withheldTax: 0 }),
  );
  const recalculateResponse = await app.inject({
    method: "POST",
    url: `/api/units/${unitA.id}/years/2026/calculation-statuses/recalculate`,
    payload: {},
  });
  assert.equal(recalculateResponse.statusCode, 200);
  const resultsResponse = await app.inject({
    method: "GET",
    url: `/api/units/${unitA.id}/years/2026/annual-results`,
  });
  assert.equal(resultsResponse.statusCode, 200);
  const results = resultsResponse.json() as Array<Record<string, unknown>>;
  assert.equal(results.length, 1);
  const withholdingSummary = results[0]?.withholdingSummary as Record<string, unknown>;
  assert.equal(withholdingSummary.withholdingMode, "standard_cumulative");
  assert.equal(withholdingSummary.expectedWithheldTaxTotal, 1500);
  assert.equal(withholdingSummary.actualWithheldTaxTotal, 0);
  await app.close();
});
