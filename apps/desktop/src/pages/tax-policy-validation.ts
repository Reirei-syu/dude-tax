import type {
  BonusTaxBracket,
  ComprehensiveTaxBracket,
  TaxPolicyItem,
  TaxPolicySettings,
} from "@dude-tax/core";

export type TaxPolicyValidationIssue = {
  section: "basic" | "policyItems" | "comprehensive" | "bonus";
  message: string;
  rowIndex?: number;
};

const isNonNegativeNumber = (value: number) => Number.isFinite(value) && value >= 0;
const isPercentage = (value: number) => Number.isFinite(value) && value >= 0 && value <= 100;

const validateBracketGroup = <T extends ComprehensiveTaxBracket | BonusTaxBracket>(
  brackets: T[],
  options: {
    section: "comprehensive" | "bonus";
    sectionLabel: string;
    getMaxValue: (bracket: T) => number | null;
  },
): TaxPolicyValidationIssue[] => {
  const issues: TaxPolicyValidationIssue[] = [];
  let previousValue: number | null = null;

  brackets.forEach((bracket, index) => {
    const currentValue = options.getMaxValue(bracket);
    const isLast = index === brackets.length - 1;

    if (!isPercentage(bracket.rate)) {
      issues.push({
        section: options.section,
        rowIndex: index,
        message: `${options.sectionLabel}第 ${index + 1} 档税率必须在 0 到 100 之间`,
      });
    }

    if (!isNonNegativeNumber(bracket.quickDeduction)) {
      issues.push({
        section: options.section,
        rowIndex: index,
        message: `${options.sectionLabel}第 ${index + 1} 档速算扣除数不能小于 0`,
      });
    }

    if (!isLast && (currentValue === null || !Number.isInteger(currentValue) || currentValue <= 0)) {
      issues.push({
        section: options.section,
        rowIndex: index,
        message: `${options.sectionLabel}第 ${index + 1} 档封顶值必须为大于 0 的整数`,
      });
    }

    if (isLast && currentValue !== null) {
      issues.push({
        section: options.section,
        rowIndex: index,
        message: `${options.sectionLabel}最后一档必须为不封顶`,
      });
    }

    if (currentValue !== null && previousValue !== null && currentValue <= previousValue) {
      issues.push({
        section: options.section,
        rowIndex: index,
        message: `${options.sectionLabel}阈值必须递增`,
      });
    }

    previousValue = currentValue;
  });

  return issues;
};

export const validateTaxPolicyDraft = (
  settings: TaxPolicySettings,
  policyItems: TaxPolicyItem[],
): TaxPolicyValidationIssue[] => {
  const issues: TaxPolicyValidationIssue[] = [];

  if (!isNonNegativeNumber(settings.basicDeductionAmount)) {
    issues.push({
      section: "basic",
      message: "基本减除费用不能小于 0",
    });
  }

  policyItems.forEach((item, index) => {
    if (item.title.length > 100) {
      issues.push({
        section: "policyItems",
        rowIndex: index,
        message: `第 ${index + 1} 条说明标题不能超过 100 字`,
      });
    }

    if (item.body.length > 2000) {
      issues.push({
        section: "policyItems",
        rowIndex: index,
        message: `第 ${index + 1} 条说明正文不能超过 2000 字`,
      });
    }
  });

  issues.push(
    ...validateBracketGroup(settings.comprehensiveTaxBrackets, {
      section: "comprehensive",
      sectionLabel: "综合所得税率表",
      getMaxValue: (bracket) => bracket.maxAnnualIncome,
    }),
  );

  issues.push(
    ...validateBracketGroup(settings.bonusTaxBrackets, {
      section: "bonus",
      sectionLabel: "年终奖税率表",
      getMaxValue: (bracket) => bracket.maxAverageMonthlyIncome,
    }),
  );

  return issues;
};
