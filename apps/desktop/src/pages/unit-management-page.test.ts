import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const unitManagementPageSource = fs.readFileSync(
  path.join(process.cwd(), "src", "pages", "UnitManagementPage.tsx"),
  "utf8",
);

test("单位管理页工作区卡片接入共享折叠组件", () => {
  assert.equal(unitManagementPageSource.includes("CollapsibleSectionCard"), true);
  assert.equal(unitManagementPageSource.includes('title="单位管理"'), true);
  assert.equal(unitManagementPageSource.includes('title="单位列表"'), true);
  assert.equal(unitManagementPageSource.includes('title="年份管理"'), true);
  assert.equal(unitManagementPageSource.includes('title="删除单位认证"'), true);
});
