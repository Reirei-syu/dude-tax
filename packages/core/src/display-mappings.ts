import type {
  AnnualTaxWithholdingMode,
  TaxCalculationScheme,
  TaxSettlementDirection,
} from "./index.js";

export const taxCalculationSchemeLabelMap: Record<TaxCalculationScheme, string> = {
  separate_bonus: "年终奖单独计税",
  combined_bonus: "并入综合所得",
};

export const taxSettlementDirectionLabelMap: Record<TaxSettlementDirection, string> = {
  payable: "应补税",
  refund: "应退税",
  balanced: "已平",
};

export const annualTaxWithholdingModeLabelMap: Record<AnnualTaxWithholdingMode, string> = {
  standard_cumulative: "标准累计预扣",
  annual_60000_upfront: "6万元优化预扣",
  first_salary_month_cumulative: "首次取得工资累计",
};
