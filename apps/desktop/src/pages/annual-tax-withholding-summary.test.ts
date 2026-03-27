import assert from "node:assert/strict";
import test from "node:test";
import { annualTaxWithholdingModeLabelMap } from "./annual-tax-withholding-summary";

test("预扣模式文案映射完整", () => {
  assert.equal(annualTaxWithholdingModeLabelMap.standard_cumulative, "标准累计预扣");
  assert.equal(annualTaxWithholdingModeLabelMap.annual_60000_upfront, "6万元优化预扣");
  assert.equal(
    annualTaxWithholdingModeLabelMap.first_salary_month_cumulative,
    "首次取得工资累计",
  );
});
