import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, beforeEach, test } from "node:test";
import Fastify from "fastify";

const testDatabasePath = path.join(process.cwd(), "data", "test", "unit-years.test.db");
process.env.DUDE_TAX_DB_PATH = testDatabasePath;

const modulesPromise = Promise.all([
  import("./routes/units.js"),
  import("./routes/context.js"),
  import("./repositories/unit-repository.js"),
  import("./repositories/employee-repository.js"),
  import("./repositories/month-record-repository.js"),
  import("./db/database.js"),
]);

before(() => {
  fs.mkdirSync(path.dirname(testDatabasePath), { recursive: true });
  fs.rmSync(testDatabasePath, { force: true });
});

beforeEach(async () => {
  const [, , , , , { database }] = await modulesPromise;
  database.exec(`
    DELETE FROM annual_tax_result_versions;
    DELETE FROM annual_tax_results;
    DELETE FROM annual_calculation_runs;
    DELETE FROM employee_month_records;
    DELETE FROM employees;
    DELETE FROM tax_policy_scopes;
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

test("新增单位时只创建起始年份，并将其作为单位可用年份返回", async () => {
  const [{ registerUnitRoutes }] = await modulesPromise;

  const app = Fastify({ logger: false });
  await registerUnitRoutes(app);

  const response = await app.inject({
    method: "POST",
    url: "/api/units",
    payload: {
      unitName: "年份测试单位",
      remark: "",
      startYear: 2030,
    },
  });

  assert.equal(response.statusCode, 201);
  const body = response.json() as Record<string, unknown>;
  assert.deepEqual(body.availableTaxYears, [2030]);

  await app.close();
});

test("单位支持手动新增年份，并在上下文中显示该单位可用年份", async () => {
  const [{ registerUnitRoutes }, { registerContextRoutes }, { unitRepository }] =
    await modulesPromise;

  const app = Fastify({ logger: false });
  await registerUnitRoutes(app);
  await registerContextRoutes(app);

  const unit = unitRepository.create({
    unitName: "新增年份测试单位",
    remark: "",
    startYear: 2026,
  });

  const addYearResponse = await app.inject({
    method: "POST",
    url: `/api/units/${unit.id}/years`,
    payload: {
      taxYear: 2035,
    },
  });

  assert.equal(addYearResponse.statusCode, 200);
  const addYearBody = addYearResponse.json() as Record<string, unknown>;
  assert.deepEqual(addYearBody.availableTaxYears, [2026, 2035]);

  const contextResponse = await app.inject({
    method: "GET",
    url: "/api/context",
  });
  assert.equal(contextResponse.statusCode, 200);
  const contextBody = contextResponse.json() as Record<string, unknown>;
  const units = contextBody.units as Array<Record<string, unknown>>;
  const currentUnit = units.find((item) => item.id === unit.id);
  assert.deepEqual(currentUnit?.availableTaxYears, [2026, 2035]);

  await app.close();
});

test("删除有业务数据的年份会被阻止", async () => {
  const [
    { registerUnitRoutes },
    ,
    { unitRepository },
    { employeeRepository },
    { monthRecordRepository },
  ] = await modulesPromise;

  const app = Fastify({ logger: false });
  await registerUnitRoutes(app);

  const unit = unitRepository.create({
    unitName: "删除年份约束测试单位",
    remark: "",
    startYear: 2026,
  });
  unitRepository.addYear(unit.id, 2027);

  const employee = employeeRepository.create(unit.id, {
    employeeCode: "EMP001",
    employeeName: "张三",
    idNumber: "110101199001011234",
    hireDate: null,
    leaveDate: null,
    remark: "",
  });

  monthRecordRepository.upsert(unit.id, employee.id, 2027, 1, {
    status: "completed",
    salaryIncome: 8000,
    annualBonus: 0,
    pensionInsurance: 0,
    medicalInsurance: 0,
    occupationalAnnuity: 0,
    housingFund: 0,
    supplementaryHousingFund: 0,
    unemploymentInsurance: 0,
    workInjuryInsurance: 0,
    withheldTax: 100,
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
  });

  const deleteResponse = await app.inject({
    method: "DELETE",
    url: `/api/units/${unit.id}/years/2027`,
  });

  assert.equal(deleteResponse.statusCode, 409);
  const deleteBody = deleteResponse.json() as Record<string, unknown>;
  assert.match(String(deleteBody.message), /已有业务数据/);

  await app.close();
});
