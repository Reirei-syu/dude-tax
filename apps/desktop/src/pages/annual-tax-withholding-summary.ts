import type {
  AnnualTaxWithholdingMode,
  AnnualTaxWithholdingSummary,
} from "../../../../packages/core/src/index";

export const annualTaxWithholdingModeLabelMap: Record<AnnualTaxWithholdingMode, string> = {
  standard_cumulative: "标准累计预扣",
  annual_60000_upfront: "6万元优化预扣",
  first_salary_month_cumulative: "首次取得工资累计",
};

export type AnnualTaxWithholdingExplanation = {
  title: string;
  summary: string;
  detailLines: string[];
};

const formatCurrency = (value: number) =>
  value.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const buildVarianceLine = (summary: AnnualTaxWithholdingSummary) => {
  if (summary.withholdingVariance > 0) {
    return `实际已预扣比规则应预扣多 ${formatCurrency(summary.withholdingVariance)} 元，后续年度汇算可能更偏向退税。`;
  }

  if (summary.withholdingVariance < 0) {
    return `实际已预扣比规则应预扣少 ${formatCurrency(Math.abs(summary.withholdingVariance))} 元，后续年度汇算可能更偏向补税。`;
  }

  return "实际已预扣与规则应预扣一致，当前预扣口径与录入数据没有差异。";
};

export const buildAnnualTaxWithholdingExplanation = (
  summary: AnnualTaxWithholdingSummary,
): AnnualTaxWithholdingExplanation => {
  const commonDetailLines = [
    `当前结果按「${annualTaxWithholdingModeLabelMap[summary.withholdingMode]}」生成预扣摘要。`,
    `规则应预扣合计 ${formatCurrency(summary.expectedWithheldTaxTotal)} 元，实际已预扣合计 ${formatCurrency(summary.actualWithheldTaxTotal)} 元。`,
    buildVarianceLine(summary),
  ];

  if (summary.withholdingMode === "annual_60000_upfront") {
    return {
      title: "6万元优化预扣说明",
      summary: "该模式按全年 6 万元减除费用口径预扣，适用于上年收入不超过 6 万元的简便预扣场景。",
      detailLines: [
        "在累计收入未超过 6 万元前，规则应预扣税额可能为 0。",
        ...commonDetailLines,
      ],
    };
  }

  if (summary.withholdingMode === "first_salary_month_cumulative") {
    return {
      title: "首次取得工资累计说明",
      summary: "该模式按首次取得工资当月起到当前自然月累计减除费用，适用于年度中途首次发薪场景。",
      detailLines: [
        "累计减除费用会跟随自然月推进，而不是仅按已发薪月份推进。",
        ...commonDetailLines,
      ],
    };
  }

  return {
    title: "标准累计预扣说明",
    summary: "该模式按已处理月份逐月累计收入、扣除和减除费用，生成标准累计预扣结果。",
    detailLines: [
      "累计减除费用按已处理月份数乘以月减除费用计算。",
      ...commonDetailLines,
    ],
  };
};
