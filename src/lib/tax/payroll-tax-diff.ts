/**
 * 工资单个税扣缴 vs 本期应预扣差异（对照台账，不参与累计预扣引擎）
 *
 * 差异 = 工资单扣缴 − 本期应预扣
 * 正数 = 多扣（可未来少扣/退发）；负数 = 少扣（建议未来扣回）
 * 未录入扣缴 → null，不参与汇总
 */

import { fenToYuan, yuanToFen } from './fen';

/** 单月差异（元）；未录入 → null */
export function payrollTaxDiffYuan(
  withheld: number | null | undefined,
  dueYuan: number,
): number | null {
  if (withheld == null || !Number.isFinite(withheld)) return null;
  const due = Number.isFinite(dueYuan) ? dueYuan : 0;
  return fenToYuan(yuanToFen(withheld) - yuanToFen(due));
}

export interface PayrollDiffSum {
  /** 已录入月份差异合计；无一笔录入 → null */
  sum: number | null;
  /** 已录入扣缴的月份数 */
  monthsWithData: number;
}

/** 仅对非 null 差异求和 */
export function sumPayrollTaxDiffs(
  monthly: ReadonlyArray<number | null | undefined>,
): PayrollDiffSum {
  let sumFen = 0;
  let monthsWithData = 0;
  for (const d of monthly) {
    if (d == null || !Number.isFinite(d)) continue;
    sumFen += yuanToFen(d);
    monthsWithData += 1;
  }
  if (monthsWithData === 0) return { sum: null, monthsWithData: 0 };
  return { sum: fenToYuan(sumFen), monthsWithData };
}

/** 通俗说明文案（无数据时 null） */
export function describePayrollTaxDiff(diff: number | null): string | null {
  if (diff == null || !Number.isFinite(diff)) return null;
  if (diff > 0) {
    return `多扣 ${diff.toFixed(2)} 元，可在未来工资单少扣或退发`;
  }
  if (diff < 0) {
    return `少扣 ${Math.abs(diff).toFixed(2)} 元，建议在未来工资单扣回`;
  }
  return '与本期应预扣一致';
}

/** 展示用：null → — */
export function formatPayrollDiffCell(diff: number | null): string {
  if (diff == null || !Number.isFinite(diff)) return '—';
  return diff.toFixed(2);
}

/** 展示用：扣缴 null → — */
export function formatPayrollWithheldCell(
  withheld: number | null | undefined,
): string {
  if (withheld == null || !Number.isFinite(withheld)) return '—';
  return withheld.toFixed(2);
}

/**
 * 差异单元格样式提示：多扣偏中性、少扣警示
 * 返回 CSS 类名片段
 */
export function payrollDiffToneClass(diff: number | null): string {
  if (diff == null || !Number.isFinite(diff) || diff === 0) return '';
  if (diff > 0) return 'payroll-diff-over';
  return 'payroll-diff-under';
}
