import type { AnnualTaxRuleSourceSummary, EmployeeAnnualTaxResult } from "@dude-tax/core";

type RuleSourceExplanation = {
  title: string;
  summary: string;
  detailLines: string[];
};

const buildDetailLines = (summary: AnnualTaxRuleSourceSummary) => {
  const lines: string[] = [];

  if (summary.hasCrossUnitCarryIn) {
    lines.push(
      `已引用其他单位的前置月份记录，共 ${summary.crossUnitRecordCount} 条，涉及 ${summary.crossUnitUnitCount} 个外部单位。`,
    );
  }

  if (summary.usedPreviousYearIncomeReference) {
    lines.push(
      `已参考上一年度收入口径，上一年度收入不超过 6 万元判定：${
        summary.previousYearIncomeUnder60k ? "是" : "否"
      }。`,
    );
  }

  if (summary.usedFirstSalaryMonthReference) {
    lines.push(
      `已参考年度首次发薪月份，当前判定的首次发薪月为 ${
        summary.firstSalaryMonthInYear ?? "未识别"
      } 月。`,
    );
  }

  if (!lines.length) {
    lines.push("当前结果仅使用本单位、本年度的已完成月份数据进行计算。");
  }

  return lines;
};

export const buildAnnualTaxRuleSourceExplanation = (
  result: Pick<EmployeeAnnualTaxResult, "ruleSourceSummary">,
): RuleSourceExplanation => {
  const summary = result.ruleSourceSummary ?? null;
  if (!summary) {
    return {
      title: "规则来源",
      summary: "当前结果未写入额外规则来源摘要，默认按当前单位 / 年度自身数据解释。",
      detailLines: ["如需跨单位 / 跨年规则说明，请重新执行年度重算后查看。"],
    };
  }

  const detailLines = buildDetailLines(summary);
  const usedExternalRule =
    summary.hasCrossUnitCarryIn ||
    summary.usedPreviousYearIncomeReference ||
    summary.usedFirstSalaryMonthReference;

  return {
    title: usedExternalRule ? "当前结果引用了外部规则上下文" : "当前结果仅使用当前单位数据",
    summary: usedExternalRule
      ? "该结果不是完全基于当前单位的孤立数据计算，系统已按预扣规则引用了跨单位或跨年度上下文。"
      : "该结果仅依赖当前单位、本年度已完成月份数据，没有引用外部单位或上一年度规则上下文。",
    detailLines,
  };
};
