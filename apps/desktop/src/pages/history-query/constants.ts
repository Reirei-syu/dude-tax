import type {
  HistoryResultStatus,
  TaxCalculationScheme,
  TaxSettlementDirection,
} from "@dude-tax/core";
import { taxCalculationSchemeLabelMap, taxSettlementDirectionLabelMap } from "@dude-tax/core";

export const settlementDirectionLabelMap: Record<TaxSettlementDirection, string> =
  taxSettlementDirectionLabelMap;

export const historyResultStatusLabelMap: Record<HistoryResultStatus, string> = {
  current: "当前有效",
  invalidated: "已失效",
  all: "全部结果",
};

export const schemeLabelMap: Record<TaxCalculationScheme, string> = taxCalculationSchemeLabelMap;

export const formatCurrency = (value: number) =>
  value.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("zh-CN", {
    hour12: false,
  });

export const buildHistoryQueryExportScopeLabel = (
  unitName: string | undefined,
  taxYear: number | undefined,
  resultStatus: HistoryResultStatus | undefined,
) => {
  const unitPart = unitName ?? "全部单位";
  const yearPart = taxYear ? `${taxYear}` : "全部年份";
  const statusPart = historyResultStatusLabelMap[resultStatus ?? "current"];

  return `${unitPart}_${yearPart}_${statusPart}`;
};
