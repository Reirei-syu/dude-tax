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
    DELETE FROM units;
    DELETE FROM app_preferences;
    DELETE FROM tax_policy_scopes;
    DELETE FROM tax_policy_versions;
  `);
});

after(async () => {
  const [, , , { closeDatabase }] = await modulesPromise;
  closeDatabase();
  fs.rmSync(testDatabasePath, { force: true });
});

test("月度录入接口可保存并回读补发补扣字段", async () => {
  const [
    { registerMonthRecordRoutes },
    { unitRepository },
    { employeeRepository },
  ] = await modulesPromise;

  const app = Fastify({ logger: false });
  await registerMonthRecordRoutes(app);

  const unit = unitRepository.create({
    unitName: "补发补扣测试单位",
    remark: "",
  });

  const employee = employeeRepository.create(unit.id, {
    employeeCode: "EMP-SUP-001",
    employeeName: "补发员工",
    idNumber: "110101199001019999",
    hireDate: null,
    leaveDate: null,
    remark: "",
  });

  const saveResponse = await app.inject({
    method: "PUT",
    url: `/api/units/${unit.id}/years/2026/employees/${employee.id}/month-records/3`,
    payload: {
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
      withheldTax: 320,
      supplementarySalaryIncome: 2_500,
      supplementaryWithheldTaxAdjustment: 120,
      supplementarySourcePeriodLabel: "2026-01",
      supplementaryRemark: "补发绩效差额",
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
  assert.equal(marchRecord?.supplementarySalaryIncome, 2_500);
  assert.equal(marchRecord?.supplementaryWithheldTaxAdjustment, 120);
  assert.equal(marchRecord?.supplementarySourcePeriodLabel, "2026-01");
  assert.equal(marchRecord?.supplementaryRemark, "补发绩效差额");

  await app.close();
});
