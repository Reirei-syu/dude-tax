import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { after, before, test } from "node:test";
import { getDefaultPolicyContent } from "./default-policy-content.js";

const seedDatabasePath = path.join(process.cwd(), "data", "test", "default-policy-content.test.db");

before(() => {
  fs.mkdirSync(path.dirname(seedDatabasePath), { recursive: true });
  fs.rmSync(seedDatabasePath, { force: true });
});

after(() => {
  fs.rmSync(seedDatabasePath, { force: true });
});

test("内置默认政策内容包含 7 条说明条目", () => {
  const content = getDefaultPolicyContent();

  assert.equal(content.policyItems.length, 7);
  assert.deepEqual(
    content.policyItems.map((item) => item.title),
    ["赡养老人", "子女教育", "3岁以下婴幼儿照护", "贷款利息", "住房租金", "继续教育", "大病医疗"],
  );
  assert.equal(
    content.policyItems.every((item) => item.illustrationDataUrl.startsWith("data:image/")),
    true,
  );
});

test("新数据库初始化时会写入内置默认政策内容", () => {
  fs.rmSync(seedDatabasePath, { force: true });

  const script = `
    const { database, closeDatabase } = await import('./src/db/database.ts');
    const row = database.prepare(
      'SELECT maintenance_notes FROM tax_policy_versions WHERE is_active = 1 ORDER BY activated_at DESC, created_at DESC, id DESC LIMIT 1'
    ).get();
    const parsed = JSON.parse(row.maintenance_notes);
    console.log(JSON.stringify({
      count: parsed.policyItems.length,
      firstTitle: parsed.policyItems[0]?.title,
      allHaveIllustration: parsed.policyItems.every((item) => item.illustrationDataUrl.startsWith('data:image/')),
    }));
    closeDatabase();
  `;

  const output = execFileSync(process.execPath, ["--import", "tsx", "--eval", script], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DUDE_TAX_DB_PATH: seedDatabasePath,
    },
    encoding: "utf8",
  }).trim();

  const parsed = JSON.parse(output) as {
    count: number;
    firstTitle: string;
    allHaveIllustration: boolean;
  };

  assert.equal(parsed.count, 7);
  assert.equal(parsed.firstTitle, "赡养老人");
  assert.equal(parsed.allHaveIllustration, true);
});
