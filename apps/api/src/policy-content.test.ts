import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, beforeEach, test } from "node:test";
import Fastify from "fastify";
import { buildDefaultTaxPolicySettings, buildTaxPolicySignature } from "@dude-tax/core";

const testDatabasePath = path.join(process.cwd(), "data", "test", "policy-content.test.db");
process.env.DUDE_TAX_DB_PATH = testDatabasePath;

const modulesPromise = Promise.all([
  import("./routes/tax-policy.js"),
  import("./db/database.js"),
]);

before(() => {
  fs.mkdirSync(path.dirname(testDatabasePath), { recursive: true });
  fs.rmSync(testDatabasePath, { force: true });
});

beforeEach(async () => {
  const [, { database }] = await modulesPromise;
  const defaultSettings = buildDefaultTaxPolicySettings();
  const now = new Date().toISOString();
  database.exec(`
    DELETE FROM tax_policy_audit_logs;
    DELETE FROM tax_policy_scopes;
    DELETE FROM tax_policy_versions;
    DELETE FROM app_preferences;
  `);
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
});

after(async () => {
  const [, { closeDatabase }] = await modulesPromise;
  closeDatabase();
  fs.rmSync(testDatabasePath, { force: true });
});

test("税率接口支持读写结构化当前政策内容，且不触发结果失效", async () => {
  const [{ registerTaxPolicyRoutes }] = await modulesPromise;

  const app = Fastify({ logger: false });
  await registerTaxPolicyRoutes(app);

  const getResponse = await app.inject({
    method: "GET",
    url: "/api/tax-policy",
  });
  assert.equal(getResponse.statusCode, 200);

  const currentPolicy = getResponse.json() as Record<string, unknown>;
  const saveResponse = await app.inject({
    method: "PUT",
    url: "/api/tax-policy",
    payload: {
      ...(currentPolicy.currentSettings as Record<string, unknown>),
      policyTitle: "专项附加扣除说明",
      policyBody: "## 子女教育\n- 按月扣除",
      policyIllustrationDataUrl: "data:image/png;base64,ZmFrZQ==",
    },
  });

  assert.equal(saveResponse.statusCode, 200);
  const saveBody = saveResponse.json() as Record<string, unknown>;
  assert.equal(saveBody.invalidatedResults, false);
  assert.equal(saveBody.policyTitle, "专项附加扣除说明");
  assert.equal(saveBody.policyBody, "## 子女教育\n- 按月扣除");
  assert.equal(saveBody.policyIllustrationDataUrl, "data:image/png;base64,ZmFrZQ==");

  await app.close();
});
