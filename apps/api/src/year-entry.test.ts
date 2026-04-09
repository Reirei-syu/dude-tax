import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, beforeEach, test } from "node:test";
import Fastify from "fastify";
import type { UpsertEmployeeMonthRecordPayload } from "@dude-tax/core";

const testDatabasePath = path.join(process.cwd(), "data", "test", "year-entry.test.db");
process.env.DUDE_TAX_DB_PATH = testDatabasePath;

const modulesPromise = Promise.all([
  import("./routes/year-entry.js"),
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
  const [, , , , { database }] = await modulesPromise;
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
  const [, , , , { closeDatabase }] = await modulesPromise;
  closeDatabase();
  fs.rmSync(testDatabasePath, { force: true });
});

test("年度录入总览会返回本年度在职员工、方案和未编辑月份", async () => {
  const [
    { registerYearEntryRoutes },
    { unitRepository },
    { employeeRepository },
    { monthRecordRepository },
  ] = await modulesPromise;

  const app = Fastify({ logger: false });
  await registerYearEntryRoutes(app);

  const unit = unitRepository.create({ unitName: "年度总览测试单位", remark: "" });
  const activeEmployee = employeeRepository.create(unit.id, {
    employeeCode: "EMP-001",
    employeeName: "张三",
    idNumber: "110101199001010001",
    hireDate: "2026-01-01",
    leaveDate: null,
    remark: "",
  });
  const leftEmployee = employeeRepository.create(unit.id, {
    employeeCode: "EMP-002",
    employeeName: "李四",
    idNumber: "110101199001010002",
    hireDate: "2025-01-01",
    leaveDate: "2026-06-30",
    remark: "",
  });
  employeeRepository.create(unit.id, {
    employeeCode: "EMP-003",
    employeeName: "王五",
    idNumber: "110101199001010003",
    hireDate: "2027-01-01",
    leaveDate: null,
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
    createMonthRecordPayload({ status: "incomplete", salaryIncome: 12_000, withheldTax: 120 }),
  );
  monthRecordRepository.upsert(
    unit.id,
    leftEmployee.id,
    2026,
    1,
    createMonthRecordPayload({ salaryIncome: 8_000, annualBonus: 24_000, withheldTax: 200 }),
  );

  const response = await app.inject({
    method: "GET",
    url: `/api/units/${unit.id}/years/2026/year-entry-overview?months=1,2`,
  });

  assert.equal(response.statusCode, 200);
  const body = response.json() as {
    selectedMonths: number[];
    totalWithheldTax: number;
    employees: Array<Record<string, unknown>>;
  };

  assert.deepEqual(body.selectedMonths, [1, 2]);
  assert.equal(body.totalWithheldTax, 420);
  assert.equal(body.employees.length, 2);

  const activeRow = body.employees.find((employee) => employee.employeeCode === "EMP-001");
  const leftRow = body.employees.find((employee) => employee.employeeCode === "EMP-002");

  assert.deepEqual(activeRow?.uneditedMonths, [3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.equal(leftRow?.optimalScheme, "separate_bonus");

  await app.close();
});

test("确认月份必须顺序推进，确认后月份禁止修改", async () => {
  const [
    { registerYearEntryRoutes },
    { unitRepository },
    { employeeRepository },
    { monthRecordRepository },
  ] = await modulesPromise;

  const app = Fastify({ logger: false });
  await registerYearEntryRoutes(app);

  const unit = unitRepository.create({ unitName: "确认锁测试单位", remark: "" });
  const employee = employeeRepository.create(unit.id, {
    employeeCode: "EMP-LOCK-001",
    employeeName: "赵六",
    idNumber: "110101199001010004",
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
    createMonthRecordPayload({ salaryIncome: 10_000, withheldTax: 100 }),
  );

  const confirmMonthTwoResponse = await app.inject({
    method: "POST",
    url: `/api/units/${unit.id}/years/2026/month-confirmations/2/confirm`,
  });
  assert.equal(confirmMonthTwoResponse.statusCode, 409);

  const confirmMonthOneResponse = await app.inject({
    method: "POST",
    url: `/api/units/${unit.id}/years/2026/month-confirmations/1/confirm`,
  });
  assert.equal(confirmMonthOneResponse.statusCode, 200);

  const workspaceResponse = await app.inject({
    method: "GET",
    url: `/api/units/${unit.id}/years/2026/employees/${employee.id}/year-record-workspace`,
  });
  assert.equal(workspaceResponse.statusCode, 200);
  const workspace = workspaceResponse.json() as { lockedMonths: number[] };
  assert.deepEqual(workspace.lockedMonths, [1]);

  const lockedSaveResponse = await app.inject({
    method: "PUT",
    url: `/api/units/${unit.id}/years/2026/employees/${employee.id}/year-record-workspace`,
    payload: {
      months: [
        {
          taxMonth: 1,
          ...createMonthRecordPayload({ salaryIncome: 20_000, withheldTax: 200 }),
        },
      ],
    },
  });
  assert.equal(lockedSaveResponse.statusCode, 409);

  const unlockedResponse = await app.inject({
    method: "POST",
    url: `/api/units/${unit.id}/years/2026/month-confirmations/1/unconfirm`,
  });
  assert.equal(unlockedResponse.statusCode, 200);

  const saveResponse = await app.inject({
    method: "PUT",
    url: `/api/units/${unit.id}/years/2026/employees/${employee.id}/year-record-workspace`,
    payload: {
      months: [
        {
          taxMonth: 1,
          ...createMonthRecordPayload({ salaryIncome: 20_000, withheldTax: 200 }),
        },
      ],
    },
  });
  assert.equal(saveResponse.statusCode, 200);

  await app.close();
});

test("取消确认会级联解除当前月及其后续月份", async () => {
  const [
    { registerYearEntryRoutes },
    { unitRepository },
    { employeeRepository },
    { monthRecordRepository },
  ] = await modulesPromise;

  const app = Fastify({ logger: false });
  await registerYearEntryRoutes(app);

  const unit = unitRepository.create({ unitName: "取消确认测试单位", remark: "" });
  const employee = employeeRepository.create(unit.id, {
    employeeCode: "EMP-UNLOCK-001",
    employeeName: "孙七",
    idNumber: "110101199001010005",
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
    createMonthRecordPayload({ salaryIncome: 10_000, withheldTax: 100 }),
  );

  await app.inject({
    method: "POST",
    url: `/api/units/${unit.id}/years/2026/month-confirmations/1/confirm`,
  });
  await app.inject({
    method: "POST",
    url: `/api/units/${unit.id}/years/2026/month-confirmations/2/confirm`,
  });

  const unconfirmResponse = await app.inject({
    method: "POST",
    url: `/api/units/${unit.id}/years/2026/month-confirmations/1/unconfirm`,
  });
  assert.equal(unconfirmResponse.statusCode, 200);

  const stateResponse = await app.inject({
    method: "GET",
    url: `/api/units/${unit.id}/years/2026/month-confirmations`,
  });
  assert.equal(stateResponse.statusCode, 200);
  const state = stateResponse.json() as {
    lastConfirmedMonth: number;
    months: Array<{ taxMonth: number; isConfirmed: boolean }>;
  };

  assert.equal(state.lastConfirmedMonth, 0);
  assert.equal(state.months.find((item) => item.taxMonth === 1)?.isConfirmed, false);
  assert.equal(state.months.find((item) => item.taxMonth === 2)?.isConfirmed, false);

  await app.close();
});
