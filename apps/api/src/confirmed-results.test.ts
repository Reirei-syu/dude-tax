import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, beforeEach, test } from "node:test";
import Fastify from "fastify";
import type { UpsertEmployeeMonthRecordPayload } from "@dude-tax/core";

const testDatabasePath = path.join(process.cwd(), "data", "test", "confirmed-results.test.db");
process.env.DUDE_TAX_DB_PATH = testDatabasePath;

const modulesPromise = Promise.all([
  import("./routes/confirmed-results.js"),
  import("./repositories/unit-repository.js"),
  import("./repositories/employee-repository.js"),
  import("./repositories/month-record-repository.js"),
  import("./repositories/month-confirmation-repository.js"),
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
  supplementarySalaryIncome: 0,
  supplementaryWithheldTaxAdjustment: 0,
  supplementarySourcePeriodLabel: "",
  supplementaryRemark: "",
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
    DELETE FROM month_confirmations;
    DELETE FROM annual_tax_result_versions;
    DELETE FROM annual_tax_results;
    DELETE FROM annual_calculation_runs;
    DELETE FROM employee_month_records;
    DELETE FROM employees;
    DELETE FROM tax_policy_audit_logs;
    DELETE FROM tax_policy_scopes;
    DELETE FROM tax_policy_versions;
    DELETE FROM unit_years;
    DELETE FROM units;
    DELETE FROM app_preferences;
  `);
});

after(async () => {
  const [, , , , , { closeDatabase }] = await modulesPromise;
  closeDatabase();
  fs.rmSync(testDatabasePath, { force: true });
});

test("结果确认列表会按已确认月份范围即时计算员工结果", async () => {
  const [
    { registerConfirmedResultRoutes },
    { unitRepository },
    { employeeRepository },
    { monthRecordRepository },
    { monthConfirmationRepository },
  ] = await modulesPromise;

  const app = Fastify({ logger: false });
  await registerConfirmedResultRoutes(app);

  const unit = unitRepository.create({ unitName: "结果确认测试单位", remark: "" });
  const employee = employeeRepository.create(unit.id, {
    employeeCode: "EMP-CONF-001",
    employeeName: "张三",
    idNumber: "110101199001010101",
    hireDate: "2026-01-01",
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
  monthRecordRepository.upsert(
    unit.id,
    employee.id,
    2026,
    2,
    createMonthRecordPayload({ salaryIncome: 10_000, annualBonus: 12_000, withheldTax: 100 }),
  );
  monthRecordRepository.upsert(
    unit.id,
    employee.id,
    2026,
    3,
    createMonthRecordPayload({ salaryIncome: 10_000, withheldTax: 100 }),
  );

  monthConfirmationRepository.confirm(unit.id, 2026, 1);
  monthConfirmationRepository.confirm(unit.id, 2026, 2);

  const throughMonthOneResponse = await app.inject({
    method: "GET",
    url: `/api/units/${unit.id}/years/2026/confirmed-results?throughMonth=1`,
  });
  assert.equal(throughMonthOneResponse.statusCode, 200);
  const throughMonthOneResults = throughMonthOneResponse.json() as Array<Record<string, unknown>>;
  assert.equal(throughMonthOneResults.length, 1);
  assert.deepEqual(throughMonthOneResults[0]?.confirmedMonths, [1]);
  assert.equal(throughMonthOneResults[0]?.confirmedMonthCount, 1);
  assert.equal(throughMonthOneResults[0]?.annualTaxWithheld, 100);

  const throughMonthTwoResponse = await app.inject({
    method: "GET",
    url: `/api/units/${unit.id}/years/2026/confirmed-results`,
  });
  assert.equal(throughMonthTwoResponse.statusCode, 200);
  const throughMonthTwoResults = throughMonthTwoResponse.json() as Array<Record<string, unknown>>;
  assert.deepEqual(throughMonthTwoResults[0]?.confirmedMonths, [1, 2]);
  assert.equal(throughMonthTwoResults[0]?.confirmedMonthCount, 2);
  assert.equal(throughMonthTwoResults[0]?.annualTaxWithheld, 200);

  await app.close();
});

test("结果确认明细只返回已确认月份数据", async () => {
  const [
    { registerConfirmedResultRoutes },
    { unitRepository },
    { employeeRepository },
    { monthRecordRepository },
    { monthConfirmationRepository },
  ] = await modulesPromise;

  const app = Fastify({ logger: false });
  await registerConfirmedResultRoutes(app);

  const unit = unitRepository.create({ unitName: "结果确认明细测试单位", remark: "" });
  const employee = employeeRepository.create(unit.id, {
    employeeCode: "EMP-CONF-002",
    employeeName: "李四",
    idNumber: "110101199001010102",
    hireDate: "2026-01-01",
    leaveDate: null,
    remark: "",
  });

  monthRecordRepository.upsert(
    unit.id,
    employee.id,
    2026,
    1,
    createMonthRecordPayload({ salaryIncome: 8_000, withheldTax: 80 }),
  );
  monthRecordRepository.upsert(
    unit.id,
    employee.id,
    2026,
    2,
    createMonthRecordPayload({ salaryIncome: 8_000, withheldTax: 80 }),
  );
  monthRecordRepository.upsert(
    unit.id,
    employee.id,
    2026,
    3,
    createMonthRecordPayload({ salaryIncome: 8_000, withheldTax: 80 }),
  );

  monthConfirmationRepository.confirm(unit.id, 2026, 1);
  monthConfirmationRepository.confirm(unit.id, 2026, 2);

  const detailResponse = await app.inject({
    method: "GET",
    url: `/api/units/${unit.id}/years/2026/confirmed-results/${employee.id}`,
  });

  assert.equal(detailResponse.statusCode, 200);
  const detail = detailResponse.json() as {
    confirmedMonths: number[];
    months: Array<{ taxMonth: number }>;
  };

  assert.deepEqual(detail.confirmedMonths, [1, 2]);
  assert.deepEqual(
    detail.months.map((month) => month.taxMonth),
    [1, 2],
  );

  await app.close();
});

test("结果确认列表与明细在多员工、多确认月份下保持既有语义", async () => {
  const [
    { registerConfirmedResultRoutes },
    { unitRepository },
    { employeeRepository },
    { monthRecordRepository },
    { monthConfirmationRepository },
  ] = await modulesPromise;

  const app = Fastify({ logger: false });
  await registerConfirmedResultRoutes(app);

  const unit = unitRepository.create({ unitName: "结果确认多员工测试单位", remark: "" });
  const activeEmployee = employeeRepository.create(unit.id, {
    employeeCode: "EMP-CONF-101",
    employeeName: "张一",
    idNumber: "110101199001010201",
    hireDate: "2026-01-01",
    leaveDate: null,
    remark: "",
  });
  const partialEmployee = employeeRepository.create(unit.id, {
    employeeCode: "EMP-CONF-102",
    employeeName: "张二",
    idNumber: "110101199001010202",
    hireDate: "2026-01-01",
    leaveDate: null,
    remark: "",
  });
  employeeRepository.create(unit.id, {
    employeeCode: "EMP-CONF-103",
    employeeName: "张三",
    idNumber: "110101199001010203",
    hireDate: "2024-01-01",
    leaveDate: "2025-12-31",
    remark: "",
  });

  monthRecordRepository.upsert(
    unit.id,
    activeEmployee.id,
    2026,
    1,
    createMonthRecordPayload({ salaryIncome: 10_000, withheldTax: 100 }),
  );
  monthRecordRepository.upsert(
    unit.id,
    activeEmployee.id,
    2026,
    2,
    createMonthRecordPayload({ salaryIncome: 11_000, withheldTax: 110 }),
  );
  monthRecordRepository.upsert(
    unit.id,
    partialEmployee.id,
    2026,
    1,
    createMonthRecordPayload({ salaryIncome: 8_000, withheldTax: 80 }),
  );

  monthConfirmationRepository.confirm(unit.id, 2026, 1);
  monthConfirmationRepository.confirm(unit.id, 2026, 2);

  const listResponse = await app.inject({
    method: "GET",
    url: `/api/units/${unit.id}/years/2026/confirmed-results`,
  });

  assert.equal(listResponse.statusCode, 200);
  const results = listResponse.json() as Array<Record<string, unknown>>;
  assert.equal(results.length, 2);

  const activeRow = results.find((row) => row.employeeCode === "EMP-CONF-101");
  const partialRow = results.find((row) => row.employeeCode === "EMP-CONF-102");

  assert.deepEqual(activeRow?.confirmedMonths, [1, 2]);
  assert.equal(activeRow?.confirmedMonthCount, 2);
  assert.deepEqual(partialRow?.confirmedMonths, [1]);
  assert.equal(partialRow?.confirmedMonthCount, 1);

  const detailResponse = await app.inject({
    method: "GET",
    url: `/api/units/${unit.id}/years/2026/confirmed-results/${partialEmployee.id}`,
  });

  assert.equal(detailResponse.statusCode, 200);
  const detail = detailResponse.json() as {
    confirmedMonths: number[];
    months: Array<{ taxMonth: number }>;
  };
  assert.deepEqual(detail.confirmedMonths, [1]);
  assert.deepEqual(
    detail.months.map((month) => month.taxMonth),
    [1],
  );

  await app.close();
});
