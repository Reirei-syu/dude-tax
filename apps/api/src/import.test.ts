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
  assert.match(response.body, /工号,姓名,证件号/);

  await app.close();
});

test("预览接口可识别员工工号冲突", async () => {
  const [{ registerImportRoutes }, , , { unitRepository }, { employeeRepository }] =
    await modulesPromise;

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
      csvText:
        "employeeCode,employeeName,idNumber,hireDate,leaveDate,remark\nEMP001,张三,110101199001012222,,,",
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
        "employeeCode,taxYear,taxMonth,status,salaryIncome,annualBonus,pensionInsurance,medicalInsurance,occupationalAnnuity,housingFund,supplementaryHousingFund,unemploymentInsurance,workInjuryInsurance,withheldTax,supplementarySalaryIncome,supplementaryWithheldTaxAdjustment,supplementarySourcePeriodLabel,supplementaryRemark,infantCareDeduction,childEducationDeduction,continuingEducationDeduction,housingLoanInterestDeduction,housingRentDeduction,elderCareDeduction,otherDeduction,taxReductionExemption,remark\nEMP100,2026,1,completed,8000,0,0,0,0,0,0,0,0,100,2500,80,2026-01,补发绩效,0,0,0,0,0,0,0,0,覆盖导入",
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
  assert.equal(firstMonthRecord?.supplementarySalaryIncome, 2500);
  assert.equal(firstMonthRecord?.supplementaryWithheldTaxAdjustment, 80);
  assert.equal(firstMonthRecord?.supplementarySourcePeriodLabel, "2026-01");
  assert.equal(firstMonthRecord?.supplementaryRemark, "补发绩效");
  assert.equal(firstMonthRecord?.remark, "覆盖导入");

  const summaryResponse = await app.inject({
    method: "GET",
    url: `/api/import/summary?unitId=${unit.id}`,
  });
  assert.equal(summaryResponse.statusCode, 200);
  assert.equal(summaryResponse.body, "null");

  await app.close();
});

test("存在冲突时提交不会部分成功写入其他月度记录", async () => {
  const [
    { registerImportRoutes },
    ,
    { registerMonthRecordRoutes },
    { unitRepository },
    { employeeRepository },
    { monthRecordRepository },
  ] = await modulesPromise;

  const app = Fastify({ logger: false });
  await registerImportRoutes(app);
  await registerMonthRecordRoutes(app);

  const unit = unitRepository.create({
    unitName: "全成功提交测试单位",
    remark: "",
  });

  const employee = employeeRepository.create(unit.id, {
    employeeCode: "EMP600",
    employeeName: "全成功提交员工",
    idNumber: "110101199001019191",
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
        "employeeCode,taxYear,taxMonth,status,salaryIncome,annualBonus,pensionInsurance,medicalInsurance,occupationalAnnuity,housingFund,supplementaryHousingFund,unemploymentInsurance,workInjuryInsurance,withheldTax,supplementarySalaryIncome,supplementaryWithheldTaxAdjustment,supplementarySourcePeriodLabel,supplementaryRemark,infantCareDeduction,childEducationDeduction,continuingEducationDeduction,housingLoanInterestDeduction,housingRentDeduction,elderCareDeduction,otherDeduction,taxReductionExemption,remark\nEMP600,2026,1,completed,8000,0,0,0,0,0,0,0,0,100,0,0,,,0,0,0,0,0,0,0,0,冲突记录\nEMP600,2026,2,completed,9000,0,0,0,0,0,0,0,0,120,0,0,,,0,0,0,0,0,0,0,0,本应成功但需回滚",
      conflictStrategy: "skip",
    },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json() as Record<string, unknown>;
  assert.equal(body.successCount, 0);
  assert.equal(body.failureCount, 1);
  assert.equal(body.skippedCount, 0);

  const listResponse = await app.inject({
    method: "GET",
    url: `/api/units/${unit.id}/years/2026/employees/${employee.id}/month-records`,
  });
  assert.equal(listResponse.statusCode, 200);
  const records = listResponse.json() as Array<Record<string, unknown>>;
  const firstMonthRecord = records.find((record) => record.taxMonth === 1);
  const secondMonthRecord = records.find((record) => record.taxMonth === 2);
  assert.equal(firstMonthRecord?.salaryIncome, 5000);
  assert.equal(secondMonthRecord?.id, null);
  assert.equal(secondMonthRecord?.salaryIncome, 0);

  await app.close();
});

test("预览接口可识别同一份员工 CSV 内的重复工号", async () => {
  const [{ registerImportRoutes }, , , { unitRepository }] = await modulesPromise;

  const app = Fastify({ logger: false });
  await registerImportRoutes(app);

  const unit = unitRepository.create({
    unitName: "员工重复导入测试单位",
    remark: "",
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/import/preview",
    payload: {
      importType: "employee",
      unitId: unit.id,
      csvText:
        "employeeCode,employeeName,idNumber,hireDate,leaveDate,remark\nEMP009,张三,110101199001014444,,,\nEMP009,李四,110101199001015555,,,",
    },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json() as Record<string, unknown>;
  const rows = body.rows as Array<Record<string, unknown>>;
  assert.equal(body.errorRows, 1);
  assert.equal(rows[1]?.status, "error");
  assert.match(String((rows[1]?.errors as string[])[0]), /同一导入文件内工号重复/);

  await app.close();
});

test("月度导入预览会限制在当前年份作用域内", async () => {
  const [{ registerImportRoutes }, , , { unitRepository }, { employeeRepository }] =
    await modulesPromise;

  const app = Fastify({ logger: false });
  await registerImportRoutes(app);

  const unit = unitRepository.create({
    unitName: "年份围栏测试单位",
    remark: "",
  });

  employeeRepository.create(unit.id, {
    employeeCode: "EMP200",
    employeeName: "年份测试员工",
    idNumber: "110101199001016666",
    hireDate: null,
    leaveDate: null,
    remark: "",
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/import/preview",
    payload: {
      importType: "month_record",
      unitId: unit.id,
      scopeTaxYear: 2026,
      csvText:
        "employeeCode,taxYear,taxMonth,status,salaryIncome,annualBonus,pensionInsurance,medicalInsurance,occupationalAnnuity,housingFund,supplementaryHousingFund,unemploymentInsurance,workInjuryInsurance,withheldTax,supplementarySalaryIncome,supplementaryWithheldTaxAdjustment,supplementarySourcePeriodLabel,supplementaryRemark,infantCareDeduction,childEducationDeduction,continuingEducationDeduction,housingLoanInterestDeduction,housingRentDeduction,elderCareDeduction,otherDeduction,taxReductionExemption,remark\nEMP200,2025,1,completed,8000,0,0,0,0,0,0,0,0,100,0,0,,,0,0,0,0,0,0,0,0,跨年导入",
    },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json() as Record<string, unknown>;
  const rows = body.rows as Array<Record<string, unknown>>;
  assert.equal(body.errorRows, 1);
  assert.equal(rows[0]?.status, "error");
  assert.match(String((rows[0]?.errors as string[])[0]), /当前年份为/);

  await app.close();
});

test("月度导入预览可识别同一文件内重复月份记录", async () => {
  const [{ registerImportRoutes }, , , { unitRepository }, { employeeRepository }] =
    await modulesPromise;

  const app = Fastify({ logger: false });
  await registerImportRoutes(app);

  const unit = unitRepository.create({
    unitName: "重复月份导入测试单位",
    remark: "",
  });

  employeeRepository.create(unit.id, {
    employeeCode: "EMP300",
    employeeName: "重复月份员工",
    idNumber: "110101199001017777",
    hireDate: null,
    leaveDate: null,
    remark: "",
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/import/preview",
    payload: {
      importType: "month_record",
      unitId: unit.id,
      scopeTaxYear: 2026,
      csvText:
        "employeeCode,taxYear,taxMonth,status,salaryIncome,annualBonus,pensionInsurance,medicalInsurance,occupationalAnnuity,housingFund,supplementaryHousingFund,unemploymentInsurance,workInjuryInsurance,withheldTax,supplementarySalaryIncome,supplementaryWithheldTaxAdjustment,supplementarySourcePeriodLabel,supplementaryRemark,infantCareDeduction,childEducationDeduction,continuingEducationDeduction,housingLoanInterestDeduction,housingRentDeduction,elderCareDeduction,otherDeduction,taxReductionExemption,remark\nEMP300,2026,1,completed,8000,0,0,0,0,0,0,0,0,100,0,0,,,0,0,0,0,0,0,0,0,首次导入\nEMP300,2026,1,completed,9000,0,0,0,0,0,0,0,0,120,0,0,,,0,0,0,0,0,0,0,0,重复导入",
    },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json() as Record<string, unknown>;
  const rows = body.rows as Array<Record<string, unknown>>;
  assert.equal(body.errorRows, 1);
  assert.equal(rows[1]?.status, "error");
  assert.match(String((rows[1]?.errors as string[])[0]), /重复的员工年度月份记录/);

  await app.close();
});

test("执行导入可正确解析带引号、逗号和换行的员工字段", async () => {
  const [{ registerImportRoutes }, , , { unitRepository }, { employeeRepository }] =
    await modulesPromise;

  const app = Fastify({ logger: false });
  await registerImportRoutes(app);

  const unit = unitRepository.create({
    unitName: "复杂 CSV 导入测试单位",
    remark: "",
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/import/commit",
    payload: {
      importType: "employee",
      unitId: unit.id,
      conflictStrategy: "abort",
      csvText:
        'employeeCode,employeeName,idNumber,hireDate,leaveDate,remark\nEMP500,王五,110101199001018888,,,\"第一行备注\n第二行备注，带逗号\"',
    },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json() as Record<string, unknown>;
  assert.equal(body.successCount, 1);
  assert.equal(body.failureCount, 0);

  const employees = employeeRepository.listByUnitId(unit.id);
  assert.equal(employees.length, 1);
  assert.equal(employees[0]?.remark, "第一行备注\n第二行备注，带逗号");

  await app.close();
});
