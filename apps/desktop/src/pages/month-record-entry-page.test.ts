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
  assert.equal(monthRecordEntryPageSource.includes("月度数据批量导入"), true);
  assert.equal(monthRecordEntryPageSource.includes("月度批量导入工作区"), true);
  assert.equal(
    monthRecordEntryPageSource.includes("默认收起，展开后处理模板下载、导入预览和导入回执。"),
    true,
  );
  assert.equal(monthRecordEntryPageSource.includes("defaultCollapsed={true}"), true);
  assert.equal(monthRecordEntryPageSource.includes("下载月度模板"), true);
});

test("月度数据录入页包含可折叠的员工编辑列表和计算结果汇总区", () => {
  assert.equal(monthRecordEntryPageSource.includes("CollapsibleSectionCard"), true);
  assert.equal(monthRecordEntryPageSource.includes('title="月度数据录入"'), true);
  assert.equal(monthRecordEntryPageSource.includes("员工编辑列表"), true);
  assert.equal(monthRecordEntryPageSource.includes("计算结果汇总"), true);
  assert.equal(monthRecordEntryPageSource.includes("明细"), true);
  assert.equal(monthRecordEntryPageSource.includes("本年税额"), true);
  assert.equal(monthRecordEntryPageSource.includes("末月税率"), true);
  assert.equal(monthRecordEntryPageSource.includes("另一方案应扣税额"), true);
  assert.equal(monthRecordEntryPageSource.includes("年终奖税额"), true);
  assert.equal(monthRecordEntryPageSource.includes("年终奖税率"), true);
  assert.equal(monthRecordEntryPageSource.includes('aria-label="明细操作"'), true);
  assert.equal(
    monthRecordEntryPageSource.includes(
      'localeCompare(right.employeeCode, "zh-CN", { numeric: true })',
    ),
    true,
  );
  assert.equal(monthRecordEntryPageSource.includes("导入预览"), true);
  assert.equal(monthRecordEntryPageSource.includes("导入回执"), true);
  assert.equal(monthRecordEntryPageSource.includes("下载模板"), false);
  assert.equal(monthRecordEntryPageSource.includes("导出当前结果"), true);
});
