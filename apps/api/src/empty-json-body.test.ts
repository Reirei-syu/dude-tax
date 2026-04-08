import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, beforeEach, test } from "node:test";
import Fastify from "fastify";
import { buildDefaultTaxPolicySettings, buildTaxPolicySignature } from "@dude-tax/core";

const testDatabasePath = path.join(process.cwd(), "data", "test", "empty-json-body.test.db");
process.env.DUDE_TAX_DB_PATH = testDatabasePath;

const modulesPromise = Promise.all([
  import("./routes/units.js"),
  import("./routes/employees.js"),
  import("./routes/tax-policy.js"),
  import("./repositories/unit-repository.js"),
  import("./repositories/employee-repository.js"),
  import("./db/database.js"),
]);

const seedDefaultTaxPolicyVersion = async () => {
  const [, , , , , { database }] = await modulesPromise;
  const defaultSettings = buildDefaultTaxPolicySettings();
  const now = new Date().toISOString();

  const insertResult = database
    .prepare(
      `
        INSERT INTO tax_policy_versions (
          version_name,
          policy_signature,
          settings_json,
          maintenance_notes,
          is_active,
          created_at,
          activated_at,
          updated_at
        )
        VALUES (?, ?, ?, '', 1, ?, ?, ?)
      `,
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
    .prepare(
      `
        INSERT INTO app_preferences (key, value)
        VALUES (?, ?)
      `,
    )
    .run("active_tax_policy_version_id", String(insertResult.lastInsertRowid));

  return Number(insertResult.lastInsertRowid);
};

before(() => {
  fs.mkdirSync(path.dirname(testDatabasePath), { recursive: true });
  fs.rmSync(testDatabasePath, { force: true });
});

beforeEach(async () => {
  const [, , , , , { database }] = await modulesPromise;
  database.exec(`
    DELETE FROM tax_policy_audit_logs;
    DELETE FROM tax_policy_scopes;
    DELETE FROM annual_tax_result_versions;
    DELETE FROM annual_tax_results;
    DELETE FROM annual_calculation_runs;
    DELETE FROM employee_month_records;
    DELETE FROM employees;
    DELETE FROM units;
    DELETE FROM app_preferences;
    DELETE FROM tax_policy_versions;
  `);

  await seedDefaultTaxPolicyVersion();
});

after(async () => {
  const [, , , , , { closeDatabase }] = await modulesPromise;
  closeDatabase();
  fs.rmSync(testDatabasePath, { force: true });
});

test("生成删除认证路由支持无 body 的 POST 请求", async () => {
  const [{ registerUnitRoutes }, , , { unitRepository }] = await modulesPromise;

  const app = Fastify({ logger: false });
  await registerUnitRoutes(app);

  const unit = unitRepository.create({
    unitName: "无 Body 删除认证测试单位",
    remark: "",
  });

  const response = await app.inject({
    method: "POST",
    url: `/api/units/${unit.id}/delete-challenge`,
  });

  assert.equal(response.statusCode, 200);
  const body = response.json() as Record<string, unknown>;
  assert.equal(typeof body.challengeId, "string");
  assert.equal(typeof body.confirmationCode, "string");

  await app.close();
});

test("删除员工路由支持无 body 的 DELETE 请求", async () => {
  const [, { registerEmployeeRoutes }, , { unitRepository }, { employeeRepository }] =
    await modulesPromise;

  const app = Fastify({ logger: false });
  await registerEmployeeRoutes(app);

  const unit = unitRepository.create({
    unitName: "无 Body 删除员工测试单位",
    remark: "",
  });
  const employee = employeeRepository.create(unit.id, {
    employeeCode: "EMP-NO-BODY-001",
    employeeName: "删除员工测试",
    idNumber: "110101199001018765",
    hireDate: null,
    leaveDate: null,
    remark: "",
  });

  const response = await app.inject({
    method: "DELETE",
    url: `/api/employees/${employee.id}`,
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { success: true });
  assert.equal(employeeRepository.getById(employee.id), null);

  await app.close();
});

test("激活税率版本路由支持无 body 的 POST 请求", async () => {
  const [, , { registerTaxPolicyRoutes }, , , { database }] = await modulesPromise;

  const app = Fastify({ logger: false });
  await registerTaxPolicyRoutes(app);

  const versionId = database
    .prepare("SELECT id FROM tax_policy_versions WHERE is_active = 1 LIMIT 1")
    .get() as { id: number };

  const response = await app.inject({
    method: "POST",
    url: `/api/tax-policy/versions/${versionId.id}/activate`,
  });

  assert.equal(response.statusCode, 200);
  const body = response.json() as Record<string, unknown>;
  assert.equal(body.currentVersionId, versionId.id);

  await app.close();
});
