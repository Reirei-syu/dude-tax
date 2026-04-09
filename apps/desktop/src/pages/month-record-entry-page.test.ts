import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const monthRecordEntryPageSource = fs.readFileSync(
  path.join(process.cwd(), "src", "pages", "MonthRecordEntryPage.tsx"),
  "utf8",
);

test("月度数据录入页取消月份按钮并新增全年计算入口", () => {
  assert.equal(monthRecordEntryPageSource.includes("month-selector-panel"), false);
  assert.equal(monthRecordEntryPageSource.includes("所选月份"), false);
  assert.equal(monthRecordEntryPageSource.includes("选择员工"), true);
  assert.equal(monthRecordEntryPageSource.includes("执行计算"), true);
  assert.equal(monthRecordEntryPageSource.includes("预扣模式"), true);
});

test("月度数据录入页包含可折叠的员工编辑列表和计算结果汇总区", () => {
  assert.equal(monthRecordEntryPageSource.includes("员工编辑列表"), true);
  assert.equal(monthRecordEntryPageSource.includes("计算结果汇总"), true);
  assert.equal(monthRecordEntryPageSource.includes("明细"), true);
  assert.equal(monthRecordEntryPageSource.includes("最后一个月适用税率"), true);
  assert.equal(monthRecordEntryPageSource.includes("另一方案应扣税额"), true);
});
