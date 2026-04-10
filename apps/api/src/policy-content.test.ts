import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, beforeEach, test } from "node:test";
import Fastify from "fastify";
import { buildDefaultTaxPolicySettings, buildTaxPolicySignature } from "@dude-tax/core";

const testDatabasePath = path.join(process.cwd(), "data", "test", "policy-content.test.db");
process.env.DUDE_TAX_DB_PATH = testDatabasePath;

const modulesPromise = Promise.all([import("./routes/tax-policy.js"), import("./db/database.js")]);

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

const createScopedTaxPolicyVersion = async () => {
  const [{ registerTaxPolicyRoutes }, { database }] = await modulesPromise;
  const app = Fastify({ logger: false });
  await registerTaxPolicyRoutes(app);

  const defaultSettings = buildDefaultTaxPolicySettings();
  const currentPolicyResponse = await app.inject({
    method: "GET",
    url: "/api/tax-policy",
  });
  const currentPolicy = currentPolicyResponse.json() as Record<string, unknown>;

  const saveResponse = await app.inject({
    method: "PUT",
    url: "/api/tax-policy",
    payload: {
      ...(currentPolicy.currentSettings as Record<string, unknown>),
      basicDeductionAmount: 6500,
    },
  });

  const saveBody = saveResponse.json() as Record<string, unknown>;
  const versions = saveBody.versions as Array<Record<string, unknown>>;
  const initialVersion = versions.find(
    (version) => version.policySignature === buildTaxPolicySignature(defaultSettings),
  );
  const scopedVersionId = Number(initialVersion?.id);
  return { app, database, scopedVersionId };
};

test("税率接口支持读写多条结构化当前政策内容，且不触发结果失效", async () => {
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
      policyItems: [
        {
          id: "policy-item-1",
          title: "专项附加扣除说明",
          body: "## 子女教育\n- 按月扣除",
          illustrationDataUrl: "data:image/png;base64,ZmFrZQ==",
        },
        {
          id: "policy-item-2",
          title: "住房租金说明",
          body: "> 以当前生效政策口径为准",
          illustrationDataUrl: "",
        },
      ],
    },
  });

  assert.equal(saveResponse.statusCode, 200);
  const saveBody = saveResponse.json() as Record<string, unknown>;
  assert.equal(saveBody.invalidatedResults, false);
  assert.equal(saveBody.policyTitle, "专项附加扣除说明");
  assert.equal(saveBody.policyBody, "## 子女教育\n- 按月扣除");
  assert.equal(saveBody.policyIllustrationDataUrl, "data:image/png;base64,ZmFrZQ==");
  assert.equal((saveBody.policyItems as unknown[]).length, 2);

  await app.close();
});

test("税率接口可保存并重新读取超过旧限制长度的政策插图", async () => {
  const [{ registerTaxPolicyRoutes }] = await modulesPromise;

  const app = Fastify({ logger: false });
  await registerTaxPolicyRoutes(app);

  const largeIllustrationDataUrl = `data:image/png;base64,${"A".repeat(2_100_000)}`;
  const currentPolicyResponse = await app.inject({
    method: "GET",
    url: "/api/tax-policy",
  });
  const currentPolicy = currentPolicyResponse.json() as Record<string, unknown>;

  const saveResponse = await app.inject({
    method: "PUT",
    url: "/api/tax-policy",
    payload: {
      ...(currentPolicy.currentSettings as Record<string, unknown>),
      policyItems: [
        {
          id: "policy-item-large-image",
          title: "大图说明",
          body: "用于验证插图可持久化",
          illustrationDataUrl: largeIllustrationDataUrl,
        },
      ],
    },
  });

  assert.equal(saveResponse.statusCode, 200);
  const saveBody = saveResponse.json() as Record<string, unknown>;
  assert.equal(
    ((saveBody.policyItems as Array<Record<string, unknown>>)[0]?.illustrationDataUrl as string)
      .length,
    largeIllustrationDataUrl.length,
  );

  const readBackResponse = await app.inject({
    method: "GET",
    url: "/api/tax-policy",
  });
  assert.equal(readBackResponse.statusCode, 200);
  const readBackBody = readBackResponse.json() as Record<string, unknown>;
  assert.equal(
    ((readBackBody.policyItems as Array<Record<string, unknown>>)[0]?.illustrationDataUrl as string)
      .length,
    largeIllustrationDataUrl.length,
  );

  await app.close();
});

test("税率接口可兼容读取旧单条政策说明结构", async () => {
  const [{ registerTaxPolicyRoutes }, { database }] = await modulesPromise;
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
        VALUES (?, ?, ?, ?, 1, ?, ?, ?)
      `,
    )
    .run(
      "初始税率版本",
      buildTaxPolicySignature(defaultSettings),
      JSON.stringify(defaultSettings),
      JSON.stringify({
        policyTitle: "旧结构标题",
        policyBody: "旧结构正文",
        policyIllustrationDataUrl: "data:image/png;base64,bGVnYWN5",
      }),
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

  const app = Fastify({ logger: false });
  await registerTaxPolicyRoutes(app);

  const response = await app.inject({
    method: "GET",
    url: "/api/tax-policy",
  });

  assert.equal(response.statusCode, 200);
  const body = response.json() as Record<string, unknown>;
  assert.equal(body.policyTitle, "旧结构标题");
  assert.equal(body.policyBody, "旧结构正文");
  assert.equal((body.policyItems as unknown[]).length, 1);

  await app.close();
});

test("当前作用域已绑定版本时，保存政策条目会更新绑定版本而非全局版本", async () => {
  const [{}, { database }] = await modulesPromise;
  const { app, scopedVersionId } = await createScopedTaxPolicyVersion();

  database
    .prepare(
      `
        INSERT INTO units (
          unit_name,
          remark,
          is_archived,
          created_at,
          updated_at
        )
        VALUES (?, '', 0, ?, ?)
      `,
    )
    .run("作用域测试单位", new Date().toISOString(), new Date().toISOString());

  database
    .prepare(
      `
        INSERT INTO tax_policy_scopes (
          scope_type,
          unit_id,
          tax_year,
          tax_policy_version_id,
          created_at,
          updated_at
        )
        VALUES ('unit_year', 1, 2026, ?, ?, ?)
      `,
    )
    .run(scopedVersionId, new Date().toISOString(), new Date().toISOString());

  const scopedGetResponse = await app.inject({
    method: "GET",
    url: "/api/tax-policy?unitId=1&taxYear=2026",
  });
  const scopedPolicy = scopedGetResponse.json() as Record<string, unknown>;
  assert.equal(scopedPolicy.currentVersionId, scopedVersionId);

  const saveResponse = await app.inject({
    method: "PUT",
    url: "/api/tax-policy",
    payload: {
      ...(scopedPolicy.currentSettings as Record<string, unknown>),
      unitId: 1,
      taxYear: 2026,
      policyItems: [
        {
          id: "scope-item-1",
          title: "作用域说明",
          body: "仅当前单位年度可见",
          illustrationDataUrl: "",
        },
      ],
    },
  });

  assert.equal(saveResponse.statusCode, 200);
  const saveBody = saveResponse.json() as Record<string, unknown>;
  assert.equal(saveBody.currentVersionId, scopedVersionId);
  assert.equal((saveBody.policyItems as unknown[]).length, 1);

  const scopedReadBack = await app.inject({
    method: "GET",
    url: "/api/tax-policy?unitId=1&taxYear=2026",
  });
  const scopedBody = scopedReadBack.json() as Record<string, unknown>;
  assert.equal((scopedBody.policyItems as Array<Record<string, unknown>>)[0]?.title, "作用域说明");

  const globalReadBack = await app.inject({
    method: "GET",
    url: "/api/tax-policy",
  });
  const globalBody = globalReadBack.json() as Record<string, unknown>;
  assert.equal((globalBody.policyItems as unknown[]).length, 0);

  await app.close();
});
