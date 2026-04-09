import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, beforeEach, test } from "node:test";
import Fastify from "fastify";

const testDatabasePath = path.join(process.cwd(), "data", "test", "month-records.test.db");
process.env.DUDE_TAX_DB_PATH = testDatabasePath;

const modulesPromise = Promise.all([
  import("./routes/month-records.js"),
  import("./repositories/unit-repository.js"),
  import("./repositories/employee-repository.js"),
  import("./repositories/month-confirmation-repository.js"),
  import("./db/database.js"),
]);

before(() => {
  fs.mkdirSync(path.dirname(testDatabasePath), { recursive: true });
  fs.rmSync(testDatabasePath, { force: true });
});

beforeEach(async () => {
  const [, , , , { database }] = await modulesPromise;
  database.exec(`
    DELETE FROM month_confirmations;
    DELETE FROM annual_tax_results;
    DELETE FROM annual_calculation_runs;
    DELETE FROM employee_month_records;
    DELETE FROM employees;
    DELETE FROM units;
    DELETE FROM app_preferences;
    DELETE FROM tax_policy_scopes;
    DELETE FROM tax_policy_versions;
  `);
});

after(async () => {
  const [, , , , { closeDatabase }] = await modulesPromise;
  closeDatabase();
  fs.rmSync(testDatabasePath, { force: true });
});

test("月度录入接口可保存并回读其他收入字段", async () => {
  const [
    { registerMonthRecordRoutes },
    { unitRepository },
    { employeeRepository },
  ] = await modulesPromise;

  const app = Fastify({ logger: false });
  await registerMonthRecordRoutes(app);

  const unit = unitRepository.create({
    unitName: "其他收入测试单位",
    remark: "",
  });

  const employee = employeeRepository.create(unit.id, {
    employeeCode: "EMP-INC-001",
    employeeName: "其他收入员工",
    idNumber: "110101199001019999",
    hireDate: null,
    leaveDate: null,
    remark: "",
  });

  const saveResponse = await app.inject({
    method: "PUT",
    url: `/api/units/${unit.id}/years/2026/employees/${employee.id}/month-records/3`,
    payload: {
      salaryIncome: 10_000,
      annualBonus: 0,
      pensionInsurance: 0,
      medicalInsurance: 0,
      occupationalAnnuity: 0,
      housingFund: 0,
      supplementaryHousingFund: 0,
      unemploymentInsurance: 0,
      workInjuryInsurance: 0,
      withheldTax: 320,
      otherIncome: 2_500,
      otherIncomeRemark: "季度补差",
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
  });

  assert.equal(saveResponse.statusCode, 200);

  const listResponse = await app.inject({
    method: "GET",
    url: `/api/units/${unit.id}/years/2026/employees/${employee.id}/month-records`,
  });

  assert.equal(listResponse.statusCode, 200);

  const records = listResponse.json() as Array<Record<string, unknown>>;
  const marchRecord = records.find((record) => record.taxMonth === 3);
  assert.equal(marchRecord?.otherIncome, 2_500);
  assert.equal(marchRecord?.otherIncomeRemark, "季度补差");

  await app.close();
});

test("单月保存接口会阻止修改已确认月份", async () => {
  const [
    { registerMonthRecordRoutes },
    { unitRepository },
    { employeeRepository },
    { monthConfirmationRepository },
  ] = await modulesPromise;

  const app = Fastify({ logger: false });
  await registerMonthRecordRoutes(app);

  const unit = unitRepository.create({
    unitName: "单月保存确认锁测试单位",
    remark: "",
  });

  const employee = employeeRepository.create(unit.id, {
    employeeCode: "EMP-LOCK-002",
    employeeName: "锁定员工",
    idNumber: "110101199001018888",
    hireDate: "2026-01-01",
    leaveDate: null,
    remark: "",
  });

  monthConfirmationRepository.confirm(unit.id, 2026, 1);

  const response = await app.inject({
    method: "PUT",
    url: `/api/units/${unit.id}/years/2026/employees/${employee.id}/month-records/1`,
    payload: {
      salaryIncome: 9_000,
      annualBonus: 0,
      pensionInsurance: 0,
      medicalInsurance: 0,
      occupationalAnnuity: 0,
      housingFund: 0,
      supplementaryHousingFund: 0,
      unemploymentInsurance: 0,
      workInjuryInsurance: 0,
      withheldTax: 100,
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
  });

  assert.equal(response.statusCode, 409);

  await app.close();
});
