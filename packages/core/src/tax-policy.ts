import {
  BONUS_TAX_BRACKETS,
  COMPREHENSIVE_TAX_BRACKETS,
  DEFAULT_BASIC_DEDUCTION_AMOUNT,
} from "@dude-tax/config";
import type {
  BonusTaxBracket,
  BonusTaxBracketInput,
  ComprehensiveTaxBracket,
  ComprehensiveTaxBracketInput,
  TaxPolicySettings,
  TaxPolicySettingsInput,
} from "./index.js";

const formatCurrencyThreshold = (value: number) => value.toLocaleString("zh-CN");

const buildComprehensiveRangeText = (
  maxAnnualIncome: number | null,
  previousMaxAnnualIncome: number | null,
) => {
  if (maxAnnualIncome === null) {
    return `超过 ${formatCurrencyThreshold(previousMaxAnnualIncome ?? 0)} 元`;
  }

  if (previousMaxAnnualIncome === null) {
    return `不超过 ${formatCurrencyThreshold(maxAnnualIncome)} 元`;
  }

  return `${formatCurrencyThreshold(previousMaxAnnualIncome)} - ${formatCurrencyThreshold(
    maxAnnualIncome,
  )} 元`;
};

const buildBonusRangeText = (
  maxAverageMonthlyIncome: number | null,
  previousMaxAverageMonthlyIncome: number | null,
) => {
  if (maxAverageMonthlyIncome === null) {
    return `超过 ${formatCurrencyThreshold(previousMaxAverageMonthlyIncome ?? 0)} 元`;
  }

  if (previousMaxAverageMonthlyIncome === null) {
    return `不超过 ${formatCurrencyThreshold(maxAverageMonthlyIncome)} 元`;
  }

  return `${formatCurrencyThreshold(previousMaxAverageMonthlyIncome)} - ${formatCurrencyThreshold(
    maxAverageMonthlyIncome,
  )} 元`;
};

export const normalizeComprehensiveTaxBrackets = (
  brackets: ComprehensiveTaxBracketInput[],
): ComprehensiveTaxBracket[] => {
  let previousMaxAnnualIncome: number | null = null;

  return brackets.map((bracket, index) => {
    const normalizedBracket: ComprehensiveTaxBracket = {
      level: bracket.level ?? index + 1,
      maxAnnualIncome: bracket.maxAnnualIncome,
      rate: bracket.rate,
      quickDeduction: bracket.quickDeduction,
      rangeText: buildComprehensiveRangeText(bracket.maxAnnualIncome, previousMaxAnnualIncome),
    };

    previousMaxAnnualIncome = bracket.maxAnnualIncome;
    return normalizedBracket;
  });
};

export const normalizeBonusTaxBrackets = (
  brackets: BonusTaxBracketInput[],
): BonusTaxBracket[] => {
  let previousMaxAverageMonthlyIncome: number | null = null;

  return brackets.map((bracket, index) => {
    const normalizedBracket: BonusTaxBracket = {
      level: bracket.level ?? index + 1,
      maxAverageMonthlyIncome: bracket.maxAverageMonthlyIncome,
      rate: bracket.rate,
      quickDeduction: bracket.quickDeduction,
      rangeText: buildBonusRangeText(
        bracket.maxAverageMonthlyIncome,
        previousMaxAverageMonthlyIncome,
      ),
    };

    previousMaxAverageMonthlyIncome = bracket.maxAverageMonthlyIncome;
    return normalizedBracket;
  });
};

export const normalizeTaxPolicySettings = (
  settings: TaxPolicySettingsInput,
): TaxPolicySettings => ({
  basicDeductionAmount: settings.basicDeductionAmount,
  comprehensiveTaxBrackets: normalizeComprehensiveTaxBrackets(settings.comprehensiveTaxBrackets),
  bonusTaxBrackets: normalizeBonusTaxBrackets(settings.bonusTaxBrackets),
});

export const buildDefaultTaxPolicySettings = (): TaxPolicySettings => ({
  basicDeductionAmount: DEFAULT_BASIC_DEDUCTION_AMOUNT,
  comprehensiveTaxBrackets: COMPREHENSIVE_TAX_BRACKETS.map((bracket) => ({ ...bracket })),
  bonusTaxBrackets: BONUS_TAX_BRACKETS.map((bracket) => ({ ...bracket })),
});

export const buildTaxPolicySignature = (settings: TaxPolicySettingsInput | TaxPolicySettings) =>
  JSON.stringify(normalizeTaxPolicySettings(settings));

export const isSameTaxPolicySettings = (
  left: TaxPolicySettingsInput,
  right: TaxPolicySettingsInput,
) =>
  buildTaxPolicySignature(left) === buildTaxPolicySignature(right);
