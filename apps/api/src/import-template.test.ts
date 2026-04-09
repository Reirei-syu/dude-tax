import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, beforeEach, test } from "node:test";
import Fastify from "fastify";

const testDatabasePath = path.join(process.cwd(), "data", "test", "import-template.test.db");
process.env.DUDE_TAX_DB_PATH = testDatabasePath;

const modulesPromise = Promise.all([
  import("./routes/import.js"),
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
    DELETE FROM import_preview_summaries;
    DELETE FROM employees;
    DELETE FROM unit_years;
    DELETE FROM units;
    DELETE FROM app_preferences;
  `);
});

after(async () => {
  const [, , , { closeDatabase }] = await modulesPromise;
  closeDatabase();
  fs.rmSync(testDatabasePath, { force: true });
});

test("导入模板接口返回简体中文表头", async () => {
  const [{ registerImportRoutes }] = await modulesPromise;

  const app = Fastify({ logger: false });
  await registerImportRoutes(app);

  const response = await app.inject({
    method: "GET",
    url: "/api/import/templates/employee",
  });

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /工号,姓名,证件号,入职日期,离职日期,备注/);

  await app.close();
});

test("员工导入预览兼容简体中文模板表头", async () => {
  const [{ registerImportRoutes }, { unitRepository }] = await modulesPromise;

  const app = Fastify({ logger: false });
  await registerImportRoutes(app);

  const unit = unitRepository.create({
    unitName: "中文模板导入测试单位",
    remark: "",
    startYear: 2026,
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/import/preview",
    payload: {
      importType: "employee",
      unitId: unit.id,
      csvText:
        "工号,姓名,证件号,入职日期,离职日期,备注\nEMP001,张三,110101199001011234,2026-01-01,,中文模板预览",
    },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json() as Record<string, unknown>;
  assert.equal(body.readyRows, 1);
  const rows = body.rows as Array<Record<string, unknown>>;
  assert.equal(rows[0]?.status, "ready");

  await app.close();
});

test("月度数据模板下载会带出当前单位员工参考信息", async () => {
  const [{ registerImportRoutes }, { unitRepository }, { employeeRepository }] =
    await modulesPromise;

  const app = Fastify({ logger: false });
  await registerImportRoutes(app);

  const unit = unitRepository.create({
    unitName: "月度模板带员工测试单位",
    remark: "",
    startYear: 2026,
  });

  employeeRepository.create(unit.id, {
    employeeCode: "EMP001",
    employeeName: "张三",
    idNumber: "110101199001011234",
    hireDate: null,
    leaveDate: null,
    remark: "",
  });
  employeeRepository.create(unit.id, {
    employeeCode: "EMP002",
    employeeName: "李四",
    idNumber: "110101199001011235",
    hireDate: "2025-01-01",
    leaveDate: "2025-12-31",
    remark: "",
  });

  const response = await app.inject({
    method: "GET",
    url: `/api/import/templates/month_record?unitId=${unit.id}&taxYear=2026`,
  });

  assert.equal(response.statusCode, 200);
  const lines = response.body.trim().split(/\r?\n/);
  assert.match(lines[0] ?? "", /工号,姓名,证件号,年度,月份,工资收入/);
  assert.equal(lines.length, 13);
  assert.match(lines[1] ?? "", /EMP001,张三,110101199001011234,2026,1,/);
  assert.match(lines[12] ?? "", /EMP001,张三,110101199001011234,2026,12,/);
  assert.equal(response.body.includes("EMP002"), false);

  await app.close();
});
