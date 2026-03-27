import type { AnnualTaxWithholdingMode } from "../../../../packages/core/src/index";

export const annualTaxWithholdingModeLabelMap: Record<AnnualTaxWithholdingMode, string> = {
  standard_cumulative: "标准累计预扣",
  annual_60000_upfront: "6万元优化预扣",
  first_salary_month_cumulative: "首次取得工资累计",
};
