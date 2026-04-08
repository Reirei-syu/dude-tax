import type {
  AnnualTaxSchemeResult,
  AnnualTaxResultVersion,
  EmployeeAnnualTaxResult,
  TaxCalculationScheme,
} from "@dude-tax/core";
import { taxCalculationSchemeLabelMap, taxSettlementDirectionLabelMap } from "@dude-tax/core";

export const schemeLabelMap: Record<TaxCalculationScheme, string> = taxCalculationSchemeLabelMap;
export const settlementDirectionLabelMap = taxSettlementDirectionLabelMap;

export const formatCurrency = (value: number) =>
  value.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("zh-CN", {
    hour12: false,
  });

export const getSelectedSchemeResult = (result: EmployeeAnnualTaxResult): AnnualTaxSchemeResult =>
  result.selectedScheme === "separate_bonus"
    ? result.schemeResults.separateBonus
    : result.schemeResults.combinedBonus;

export const buildVersionOptions = (resultVersions: AnnualTaxResultVersion[]) =>
  resultVersions.map((version) => ({
    value: version.versionId,
    label: `V${version.versionSequence}（${formatDateTime(version.calculatedAt)}）`,
  }));
