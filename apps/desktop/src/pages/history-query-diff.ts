import type {
  AnnualTaxCalculation,
  HistoryAnnualTaxResult,
  TaxCalculationScheme,
  TaxSettlementDirection,
} from "../../../../packages/core/src/index";
import { annualTaxWithholdingModeLabelMap } from "./annual-tax-withholding-summary";

export type HistoryQueryComparisonItem = {
  label: string;
  snapshotValue: string;
  currentValue: string;
  deltaValue: string;
};

const schemeLabelMap: Record<TaxCalculationScheme, string> = {
  separate_bonus: "年终奖单独计税",
  combined_bonus: "并入综合所得",
};

const settlementDirectionLabelMap: Record<TaxSettlementDirection, string> = {
  payable: "应补税",
  refund: "应退税",
  balanced: "已平",
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

export const buildHistoryQueryComparisonItems = (
  snapshot: HistoryAnnualTaxResult,
  current: AnnualTaxCalculation,
): HistoryQueryComparisonItem[] => [
  {
    label: "预扣模式",
    snapshotValue: annualTaxWithholdingModeLabelMap[snapshot.withholdingSummary.withholdingMode],
    currentValue: annualTaxWithholdingModeLabelMap[current.withholdingSummary.withholdingMode],
    deltaValue:
      snapshot.withholdingSummary.withholdingMode === current.withholdingSummary.withholdingMode
        ? "无变化"
        : "已变化",
  },
  {
    label: "采用方案",
    snapshotValue: schemeLabelMap[snapshot.selectedScheme],
    currentValue: schemeLabelMap[current.selectedScheme],
    deltaValue: snapshot.selectedScheme === current.selectedScheme ? "无变化" : "已变化",
  },
  {
    label: "年度应纳税额",
    snapshotValue: formatCurrency(snapshot.annualTaxPayable),
    currentValue: formatCurrency(current.annualTaxPayable),
    deltaValue: formatDelta(current.annualTaxPayable - snapshot.annualTaxPayable),
  },
  {
    label: "全年已预扣税额",
    snapshotValue: formatCurrency(snapshot.annualTaxWithheld),
    currentValue: formatCurrency(current.annualTaxWithheld),
    deltaValue: formatDelta(current.annualTaxWithheld - snapshot.annualTaxWithheld),
  },
  {
    label: "应补/应退税额",
    snapshotValue: formatCurrency(snapshot.annualTaxSettlement),
    currentValue: formatCurrency(current.annualTaxSettlement),
    deltaValue: formatDelta(current.annualTaxSettlement - snapshot.annualTaxSettlement),
  },
  {
    label: "结算方向",
    snapshotValue: settlementDirectionLabelMap[snapshot.settlementDirection],
    currentValue: settlementDirectionLabelMap[current.settlementDirection],
    deltaValue:
      snapshot.settlementDirection === current.settlementDirection ? "无变化" : "已变化",
  },
  {
    label: "减除费用合计",
    snapshotValue: formatCurrency(snapshot.basicDeductionTotal),
    currentValue: formatCurrency(current.basicDeductionTotal),
    deltaValue: formatDelta(current.basicDeductionTotal - snapshot.basicDeductionTotal),
  },
  {
    label: "专项附加扣除",
    snapshotValue: formatCurrency(snapshot.specialAdditionalDeductionTotal),
    currentValue: formatCurrency(current.specialAdditionalDeductionTotal),
    deltaValue: formatDelta(
      current.specialAdditionalDeductionTotal - snapshot.specialAdditionalDeductionTotal,
    ),
  },
];
