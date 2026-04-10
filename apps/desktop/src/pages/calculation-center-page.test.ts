import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const calculationCenterPageSource = fs.readFileSync(
  path.join(process.cwd(), "src", "pages", "CalculationCenterPage.tsx"),
  "utf8",
);

test("计算中心页默认折叠员工计算准备状态卡片", () => {
  assert.equal(calculationCenterPageSource.includes("CollapsibleSectionCard"), true);
  assert.equal(calculationCenterPageSource.includes('title="计算中心"'), true);
  assert.equal(calculationCenterPageSource.includes('title="员工计算准备状态"'), true);
  assert.equal(calculationCenterPageSource.includes("defaultCollapsed"), true);
  assert.equal(calculationCenterPageSource.includes("triggerRecalculate(status.employeeId)"), true);
});
