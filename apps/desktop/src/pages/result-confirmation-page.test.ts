import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const resultConfirmationPageSource = fs.readFileSync(
  path.join(process.cwd(), "src", "pages", "ResultConfirmationPage.tsx"),
  "utf8",
);

test("结果确认页改为读取当前待确认结果而非已确认历史结果", () => {
  assert.equal(resultConfirmationPageSource.includes("listAnnualResults"), true);
  assert.equal(resultConfirmationPageSource.includes("listConfirmedResults"), false);
  assert.equal(resultConfirmationPageSource.includes("待确认结果"), true);
});

test("结果确认页会在结果未覆盖全部有效员工时显示阻断提示", () => {
  assert.equal(resultConfirmationPageSource.includes("CollapsibleSectionCard"), true);
  assert.equal(resultConfirmationPageSource.includes('title="结果确认"'), true);
  assert.equal(resultConfirmationPageSource.includes("当前计算结果未覆盖全部有效员工"), true);
  assert.equal(resultConfirmationPageSource.includes("确认当前月份"), true);
});
