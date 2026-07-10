/**
 * 智能解释生成器：为什么这个月税多了 / 年终奖推荐理由等
 */

import type { BonusCompareResult, MonthCalcResult } from '../../types';
import { formatYuan } from './fen';

function ratePct(rate: number): string {
  return `${(rate * 100).toFixed(0)}%`;
}

/** 对比相邻两月，生成「为什么这个月税…」解释 */
export function generateWhyThisMonth(
  prev: MonthCalcResult | null,
  curr: MonthCalcResult,
): string {
  if (curr.salary === 0 && curr.thisMonthTax === 0) {
    if (curr.employmentMonthsUsed === 0) {
      return `${curr.month} 月尚未入职或未在职，收入与预扣税额均为 0。`;
    }
    return `${curr.month} 月无应税工资收入，本期应预扣税额为 0。离职后累计不再增加，后续月份本期应预扣税额自动为 0。`;
  }

  const parts: string[] = [];
  parts.push(
    `${curr.month} 月累计应纳税所得额 ${formatYuan(curr.cumTaxable)} 元，适用预扣率 ${ratePct(curr.rate)}（速算扣除数 ${formatYuan(curr.quickDeduction)} 元），本期应预扣 ${formatYuan(curr.thisMonthTax)} 元。`,
  );

  if (prev && prev.rate !== curr.rate) {
    parts.push(
      `税率档由 ${ratePct(prev.rate)} 升至 ${ratePct(curr.rate)}（上月累计应纳税所得额 ${formatYuan(prev.cumTaxable)} 元），速算扣除数同步调整。`,
    );
  } else if (prev && curr.thisMonthTax > prev.thisMonthTax + 0.005) {
    parts.push(
      `本期税额较上月增加 ${formatYuan(curr.thisMonthTax - prev.thisMonthTax)} 元，主要因累计收入与任职月数增加推高了累计应纳税所得额。`,
    );
  } else if (prev && curr.thisMonthTax < prev.thisMonthTax - 0.005) {
    parts.push(
      `本期税额较上月减少 ${formatYuan(prev.thisMonthTax - curr.thisMonthTax)} 元，可能与扣除增加或收入下降有关。`,
    );
  }

  parts.push(
    `本月任职受雇月份数按 ${curr.employmentMonthsUsed} 月计，累计减除费用 ${formatYuan(curr.cumBasicDeduction)} 元。`,
  );

  return parts.join('');
}

/** 年终奖对比拆解说明 */
export function generateBonusExplanation(cmp: BonusCompareResult): string[] {
  const lines: string[] = [];
  lines.push(
    `年终奖金额 ${formatYuan(cmp.bonus)} 元。单独计税：按奖金÷12=${formatYuan(cmp.monthlyAvg)} 元查按月换算表，税率 ${ratePct(cmp.separateRate)}、速算扣除 ${formatYuan(cmp.separateQuick)} 元，应纳税额 ${formatYuan(cmp.separateTax)} 元。`,
  );
  lines.push(
    `工资累计应纳税所得额 ${formatYuan(cmp.wageTaxableOnly)} 元，无奖金全年预扣税约 ${formatYuan(cmp.annualTaxWithoutBonus)} 元。`,
  );
  lines.push(
    `并入综合所得：应纳税所得额变为 ${formatYuan(cmp.wageTaxableOnly + cmp.bonus)} 元，全年总税约 ${formatYuan(cmp.annualTaxWithBonus)} 元（奖金边际税额约 ${formatYuan(cmp.mergeIncrementalTax)} 元）。`,
  );

  const separateTotal = cmp.annualTaxWithoutBonus + cmp.separateTax;
  const mergeTotal = cmp.annualTaxWithBonus;
  if (cmp.recommended === 'separate') {
    lines.push(
      `推荐「单独计税」：工资税+奖金单独税合计 ${formatYuan(separateTotal)} 元，比并入方案（${formatYuan(mergeTotal)} 元）少缴约 ${formatYuan(cmp.savings)} 元。`,
    );
  } else {
    lines.push(
      `推荐「并入综合所得」：全年总税 ${formatYuan(mergeTotal)} 元，比单独计税合计（${formatYuan(separateTotal)} 元）少缴约 ${formatYuan(cmp.savings)} 元。`,
    );
  }
  lines.push(
    `以上为预估参考，请以税务机关官方扣缴计算器与最终汇算清缴为准。`,
  );
  return lines;
}

/** 为全年各月生成解释列表 */
export function generateMonthlyInsights(months: MonthCalcResult[]): string[] {
  return months.map((curr, i) =>
    generateWhyThisMonth(i > 0 ? months[i - 1]! : null, curr),
  );
}
