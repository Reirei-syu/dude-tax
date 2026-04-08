import type { AnnualTaxResultVersion } from "@dude-tax/core";
import { taxCalculationSchemeLabelMap, taxSettlementDirectionLabelMap } from "@dude-tax/core";

export type AnnualResultVersionComparisonItem = {
  label: string;
  baselineValue: string;
  targetValue: string;
  deltaValue: string;
};

const formatCurrency = (value: number) =>
  value.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatDelta = (value: number) => {
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}${formatCurrency(Math.abs(value))}`;
};

const formatChange = (baselineValue: string, targetValue: string) =>
  baselineValue === targetValue ? "无变化" : "已变化";

export const buildAnnualResultVersionComparisonItems = (
  baselineVersion: AnnualTaxResultVersion,
  targetVersion: AnnualTaxResultVersion,
): AnnualResultVersionComparisonItem[] => [
  {
    label: "当前方案",
    baselineValue: taxCalculationSchemeLabelMap[baselineVersion.selectedScheme],
    targetValue: taxCalculationSchemeLabelMap[targetVersion.selectedScheme],
    deltaValue: formatChange(
      taxCalculationSchemeLabelMap[baselineVersion.selectedScheme],
      taxCalculationSchemeLabelMap[targetVersion.selectedScheme],
    ),
  },
  {
    label: "年度应纳税额",
    baselineValue: formatCurrency(baselineVersion.annualTaxPayable),
    targetValue: formatCurrency(targetVersion.annualTaxPayable),
    deltaValue: formatDelta(targetVersion.annualTaxPayable - baselineVersion.annualTaxPayable),
  },
  {
    label: "全年已预扣税额",
    baselineValue: formatCurrency(baselineVersion.annualTaxWithheld),
    targetValue: formatCurrency(targetVersion.annualTaxWithheld),
    deltaValue: formatDelta(targetVersion.annualTaxWithheld - baselineVersion.annualTaxWithheld),
  },
  {
    label: "应补/应退税额",
    baselineValue: formatCurrency(baselineVersion.annualTaxSettlement),
    targetValue: formatCurrency(targetVersion.annualTaxSettlement),
    deltaValue: formatDelta(
      targetVersion.annualTaxSettlement - baselineVersion.annualTaxSettlement,
    ),
  },
  {
    label: "结算方向",
    baselineValue: taxSettlementDirectionLabelMap[baselineVersion.settlementDirection],
    targetValue: taxSettlementDirectionLabelMap[targetVersion.settlementDirection],
    deltaValue: formatChange(
      taxSettlementDirectionLabelMap[baselineVersion.settlementDirection],
      taxSettlementDirectionLabelMap[targetVersion.settlementDirection],
    ),
  },
  {
    label: "工资收入合计",
    baselineValue: formatCurrency(baselineVersion.salaryIncomeTotal),
    targetValue: formatCurrency(targetVersion.salaryIncomeTotal),
    deltaValue: formatDelta(targetVersion.salaryIncomeTotal - baselineVersion.salaryIncomeTotal),
  },
  {
    label: "年终奖合计",
    baselineValue: formatCurrency(baselineVersion.annualBonusTotal),
    targetValue: formatCurrency(targetVersion.annualBonusTotal),
    deltaValue: formatDelta(targetVersion.annualBonusTotal - baselineVersion.annualBonusTotal),
  },
  {
    label: "减除费用合计",
    baselineValue: formatCurrency(baselineVersion.basicDeductionTotal),
    targetValue: formatCurrency(targetVersion.basicDeductionTotal),
    deltaValue: formatDelta(
      targetVersion.basicDeductionTotal - baselineVersion.basicDeductionTotal,
    ),
  },
  {
    label: "专项附加扣除",
    baselineValue: formatCurrency(baselineVersion.specialAdditionalDeductionTotal),
    targetValue: formatCurrency(targetVersion.specialAdditionalDeductionTotal),
    deltaValue: formatDelta(
      targetVersion.specialAdditionalDeductionTotal -
        baselineVersion.specialAdditionalDeductionTotal,
    ),
  },
  {
    label: "其他扣除",
    baselineValue: formatCurrency(baselineVersion.otherDeductionTotal),
    targetValue: formatCurrency(targetVersion.otherDeductionTotal),
    deltaValue: formatDelta(
      targetVersion.otherDeductionTotal - baselineVersion.otherDeductionTotal,
    ),
  },
];
