import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, beforeEach, test } from "node:test";
import Fastify from "fastify";

const testDatabasePath = path.join(process.cwd(), "data", "test", "import.test.db");
process.env.DUDE_TAX_DB_PATH = testDatabasePath;

const modulesPromise = Promise.all([
  import("./routes/import.js"),
  import("./routes/employees.js"),
  import("./routes/month-records.js"),
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
  const [, , , , , , { database }] = await modulesPromise;
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
  const [, , , , , , { closeDatabase }] = await modulesPromise;
  closeDatabase();
  fs.rmSync(testDatabasePath, { force: true });
});

test("导入模板接口返回员工 CSV 模板", async () => {
  const [{ registerImportRoutes }] = await modulesPromise;

  const app = Fastify({ logger: false });
  await registerImportRoutes(app);

  const response = await app.inject({
    method: "GET",
    url: "/api/import/templates/employee",
  });

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /employeeCode,employeeName,idNumber/);

  await app.close();
});

test("预览接口可识别员工工号冲突", async () => {
  const [{ registerImportRoutes }, , , { unitRepository }, { employeeRepository }] = await modulesPromise;

  const app = Fastify({ logger: false });
  await registerImportRoutes(app);

  const unit = unitRepository.create({
    unitName: "导入测试单位",
    remark: "",
  });

  employeeRepository.create(unit.id, {
    employeeCode: "EMP001",
    employeeName: "已存在员工",
    idNumber: "110101199001011111",
    hireDate: null,
    leaveDate: null,
    remark: "",
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/import/preview",
    payload: {
      importType: "employee",
      unitId: unit.id,
      csvText: "employeeCode,employeeName,idNumber,hireDate,leaveDate,remark\nEMP001,张三,110101199001012222,,,",
    },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json() as Record<string, unknown>;
  const rows = body.rows as Array<Record<string, unknown>>;
  assert.equal(body.conflictRows, 1);
  assert.equal(rows[0]?.status, "conflict");
  assert.equal(rows[0]?.conflictType, "employee_code_conflict");

  const summaryResponse = await app.inject({
    method: "GET",
    url: `/api/import/summary?unitId=${unit.id}`,
  });
  assert.equal(summaryResponse.statusCode, 200);
  const summaryBody = summaryResponse.json() as Record<string, unknown>;
  assert.equal(summaryBody.conflictRows, 1);

  await app.close();
});

test("执行导入接口可导入月度数据并支持覆盖策略", async () => {
  const [
    { registerImportRoutes },
    { registerEmployeeRoutes },
    { registerMonthRecordRoutes },
    { unitRepository },
    { employeeRepository },
    { monthRecordRepository },
  ] = await modulesPromise;

  const app = Fastify({ logger: false });
  await registerImportRoutes(app);
  await registerEmployeeRoutes(app);
  await registerMonthRecordRoutes(app);

  const unit = unitRepository.create({
    unitName: "月度导入测试单位",
    remark: "",
  });

  const employee = employeeRepository.create(unit.id, {
    employeeCode: "EMP100",
    employeeName: "导入员工",
    idNumber: "110101199001013333",
    hireDate: null,
    leaveDate: null,
    remark: "",
  });

  monthRecordRepository.upsert(unit.id, employee.id, 2026, 1, {
    status: "completed",
    salaryIncome: 5000,
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
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/import/commit",
    payload: {
      importType: "month_record",
      unitId: unit.id,
      csvText:
        "employeeCode,taxYear,taxMonth,status,salaryIncome,annualBonus,pensionInsurance,medicalInsurance,occupationalAnnuity,housingFund,supplementaryHousingFund,unemploymentInsurance,workInjuryInsurance,withheldTax,infantCareDeduction,childEducationDeduction,continuingEducationDeduction,housingLoanInterestDeduction,housingRentDeduction,elderCareDeduction,otherDeduction,taxReductionExemption,remark\nEMP100,2026,1,completed,8000,0,0,0,0,0,0,0,0,100,0,0,0,0,0,0,0,0,覆盖导入",
      conflictStrategy: "overwrite",
    },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json() as Record<string, unknown>;
  assert.equal(body.successCount, 1);
  assert.equal(body.failureCount, 0);

  const listResponse = await app.inject({
    method: "GET",
    url: `/api/units/${unit.id}/years/2026/employees/${employee.id}/month-records`,
  });
  assert.equal(listResponse.statusCode, 200);
  const records = listResponse.json() as Array<Record<string, unknown>>;
  const firstMonthRecord = records.find((record) => record.taxMonth === 1);
  assert.equal(firstMonthRecord?.salaryIncome, 8000);
  assert.equal(firstMonthRecord?.withheldTax, 100);
  assert.equal(firstMonthRecord?.remark, "覆盖导入");

  await app.close();
});
