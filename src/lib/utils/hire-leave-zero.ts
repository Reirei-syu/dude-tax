/**
 * 入职/离职确认时：按「工作年度」就业窗口决定清零哪些月份
 */

import { resolveTaxYearEmployment } from './date';

export type HireLeaveConfirmType = 'hire' | 'leave';

/**
 * 返回应清零的月份列表（1–12）。
 * - hire：税年内入职月之前的月份；往年入职则无清零；入职在税年后则 1–12 全清（本税年未在职）
 * - leave：税年内离职月之后的月份；离职在税年后则无清零；税年前已离职则 1–12 全清
 */
export function monthsToZeroOnEmploymentConfirm(
  type: HireLeaveConfirmType,
  proposedDate: string,
  taxYear: number,
  /** 另一侧日期：入职确认时传现有 leave；离职确认时传现有 hire */
  otherDate: string | null | undefined = null,
): number[] {
  const hireDate = type === 'hire' ? proposedDate : otherDate;
  const leaveDate = type === 'leave' ? proposedDate : otherDate;
  const scope = resolveTaxYearEmployment(
    hireDate,
    leaveDate,
    taxYear,
    false,
  );

  const out: number[] = [];

  if (type === 'hire') {
    if (scope.hireMonth >= 13) {
      // 本税年从未在职
      for (let m = 1; m <= 12; m++) out.push(m);
      return out;
    }
    for (let m = 1; m < scope.hireMonth; m++) out.push(m);
    return out;
  }

  // leave
  if (scope.hireMonth >= 13 && scope.leaveMonth === undefined) {
    // 税年前已离职（或从未在职）
    for (let m = 1; m <= 12; m++) out.push(m);
    return out;
  }
  if (scope.leaveMonth === undefined) {
    // 本税年无离职截断
    return out;
  }
  for (let m = scope.leaveMonth + 1; m <= 12; m++) out.push(m);
  return out;
}
