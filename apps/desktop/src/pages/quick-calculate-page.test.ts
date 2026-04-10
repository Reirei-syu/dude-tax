import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const quickCalculatePageSource = fs.readFileSync(
  path.join(process.cwd(), "src", "pages", "QuickCalculatePage.tsx"),
  "utf8",
);

test("快速计算页不再显示全年月份按钮和旧摘要卡", () => {
  assert.equal(quickCalculatePageSource.includes("month-selector-panel"), false);
  assert.equal(quickCalculatePageSource.includes("所选月份预扣税额合计"), false);
  assert.equal(quickCalculatePageSource.includes("预览方案"), false);
  assert.equal(quickCalculatePageSource.includes("未编辑月份"), false);
});

test("快速计算页工作台隐藏预扣税额输入并渲染逐月预扣轨迹表", () => {
  assert.equal(quickCalculatePageSource.includes("CollapsibleSectionCard"), true);
  assert.equal(quickCalculatePageSource.includes('title="快速计算"'), true);
  assert.equal(quickCalculatePageSource.includes('hiddenFieldKeys={["withheldTax"]}'), true);
  assert.equal(quickCalculatePageSource.includes("本月应预扣额"), true);
  assert.equal(quickCalculatePageSource.includes("本月累计应预扣额"), true);
  assert.equal(quickCalculatePageSource.includes("累计已预扣额"), true);
  assert.equal(quickCalculatePageSource.includes("适用税率"), true);
  assert.equal(
    quickCalculatePageSource.includes(
      'className="primary-button table-action-button quick-calc-edit-button"',
    ),
    true,
  );
});

test("快速计算页隐藏首次取得工资累计选项并显示另一方案税额", () => {
  assert.equal(quickCalculatePageSource.includes('mode !== "first_salary_month_cumulative"'), true);
  assert.equal(quickCalculatePageSource.includes("另一方案年累计应交税额"), true);
  assert.equal(quickCalculatePageSource.includes("summary-card-secondary"), true);
});

test("快速计算页在年终奖单独计税方案下展示年终奖税额和税率", () => {
  assert.equal(quickCalculatePageSource.includes("年终奖应扣税额"), true);
  assert.equal(quickCalculatePageSource.includes("年终奖适用税率"), true);
  assert.equal(
    quickCalculatePageSource.includes('result.selectedScheme === "separate_bonus"'),
    true,
  );
  assert.equal(quickCalculatePageSource.includes("selectedSchemeResult?.annualBonusTax"), true);
  assert.equal(quickCalculatePageSource.includes("selectedBonusRate"), true);
  assert.equal(quickCalculatePageSource.includes('title="试算结果"'), true);
});
