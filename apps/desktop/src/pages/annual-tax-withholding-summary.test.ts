import assert from "node:assert/strict";
import test from "node:test";
import {
  annualTaxWithholdingModeLabelMap,
  buildAnnualTaxWithholdingExplanation,
} from "./annual-tax-withholding-summary";

test("预扣模式文案映射完整", () => {
  assert.equal(annualTaxWithholdingModeLabelMap.standard_cumulative, "标准累计预扣");
  assert.equal(annualTaxWithholdingModeLabelMap.annual_60000_upfront, "6万元优化预扣");
  assert.equal(
    annualTaxWithholdingModeLabelMap.first_salary_month_cumulative,
    "首次取得工资累计",
  );
});

test("6万元优化预扣说明可生成对应解释", () => {
  const explanation = buildAnnualTaxWithholdingExplanation({
    withholdingMode: "annual_60000_upfront",
    expectedWithheldTaxTotal: 0,
    actualWithheldTaxTotal: 0,
    withholdingVariance: 0,
    traceCount: 1,
  });

  assert.equal(explanation.title, "6万元优化预扣说明");
  assert.match(explanation.summary, /全年 6 万元减除费用/);
});

test("标准累计预扣说明会解释预扣差异方向", () => {
  const explanation = buildAnnualTaxWithholdingExplanation({
    withholdingMode: "standard_cumulative",
    expectedWithheldTaxTotal: 300,
    actualWithheldTaxTotal: 100,
    withholdingVariance: -200,
    traceCount: 2,
  });

  assert.equal(explanation.title, "标准累计预扣说明");
  assert.equal(explanation.detailLines.some((line) => /更偏向补税/.test(line)), true);
});
