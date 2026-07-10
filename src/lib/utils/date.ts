/** 日期工具：内部统一 YYYY-MM-DD，展示/录入用中文习惯 */

export function dateToMonth(dateStr: string): number {
  if (!dateStr) return 1;
  const ymd = parseToYmd(dateStr);
  if (ymd) return ymd.month;
  const parts = dateStr.split('-');
  if (parts.length >= 2) {
    const m = parseInt(parts[1]!, 10);
    if (m >= 1 && m <= 12) return m;
  }
  const n = parseInt(dateStr, 10);
  if (n >= 1 && n <= 12) return n;
  return 1;
}

export function monthLabel(month: number): string {
  return `${month}月`;
}

export interface Ymd {
  year: number;
  month: number;
  day: number;
}

/** 解析 YYYY-MM-DD 或中文「2026年6月1日」 */
export function parseToYmd(dateStr: string | null | undefined): Ymd | null {
  if (!dateStr) return null;
  const s = dateStr.trim();
  if (!s) return null;

  // 2026-06-01
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (iso) {
    return clampYmd({
      year: parseInt(iso[1]!, 10),
      month: parseInt(iso[2]!, 10),
      day: parseInt(iso[3]!, 10),
    });
  }

  // 2026年6月1日 / 2026年06月01日
  const zh = /^(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?$/.exec(s);
  if (zh) {
    return clampYmd({
      year: parseInt(zh[1]!, 10),
      month: parseInt(zh[2]!, 10),
      day: parseInt(zh[3]!, 10),
    });
  }

  // 2026/6/1
  const slash = /^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/.exec(s);
  if (slash) {
    return clampYmd({
      year: parseInt(slash[1]!, 10),
      month: parseInt(slash[2]!, 10),
      day: parseInt(slash[3]!, 10),
    });
  }

  return null;
}

export function daysInMonthSafe(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function daysInMonth(year: number, month: number): number {
  return daysInMonthSafe(year, month);
}

function clampYmd(y: Ymd): Ymd {
  const year = Math.min(2100, Math.max(1970, y.year));
  const month = Math.min(12, Math.max(1, y.month));
  const maxDay = daysInMonth(year, month);
  const day = Math.min(maxDay, Math.max(1, y.day));
  return { year, month, day };
}

/** 输出内部存储格式 YYYY-MM-DD */
export function toIsoDate(y: Ymd | null): string {
  if (!y) return '';
  const c = clampYmd(y);
  const mm = String(c.month).padStart(2, '0');
  const dd = String(c.day).padStart(2, '0');
  return `${c.year}-${mm}-${dd}`;
}

/** 中文展示：2026年6月1日 */
export function formatChineseDate(
  dateStr: string | null | undefined,
): string {
  const ymd = parseToYmd(dateStr);
  if (!ymd) return '—';
  return `${ymd.year}年${ymd.month}月${ymd.day}日`;
}

export function ymdFromIso(dateStr: string | null | undefined): Ymd | null {
  return parseToYmd(dateStr);
}

export interface TaxYearEmployment {
  /** 本税年内用于计算的有效入职月（1–12；13 表示本税年从未在职） */
  hireMonth: number;
  leaveMonth?: number;
  /** 本税年是否适用「首次」规则 */
  isFirstTime: boolean;
  /** UI 是否展示「首次」勾选（仅当年度入职时） */
  showFirstTimeOption: boolean;
}

/**
 * 将入职/离职日期映射到「工作年度」内的计算口径，简化操作：
 * - 入职早于本工作年度 → 从 1 月起在职，不需要也不适用「首次」
 * - 入职在本工作年度 → 从入职月起算；可勾选「首次」
 * - 离职晚于本工作年度 → 本税年无离职截断
 */
export function resolveTaxYearEmployment(
  hireDate: string | null | undefined,
  leaveDate: string | null | undefined,
  taxYear: number,
  isFirstTimeFlag: boolean,
): TaxYearEmployment {
  const hire = parseToYmd(hireDate);
  const leave = parseToYmd(leaveDate);

  // 默认：本税年 1 月起在职
  let hireMonth = 1;
  let showFirstTimeOption = false;
  let isFirstTime = false;

  if (!hire) {
    hireMonth = 1;
    showFirstTimeOption = false;
    isFirstTime = false;
  } else if (hire.year < taxYear) {
    // 往年已入职：全年从 1 月计减除，无需操作「首次」
    hireMonth = 1;
    showFirstTimeOption = false;
    isFirstTime = false;
  } else if (hire.year > taxYear) {
    // 入职在税年之后：本税年未在职
    hireMonth = 13;
    showFirstTimeOption = false;
    isFirstTime = false;
  } else {
    // 当年度入职：可勾选首次
    hireMonth = hire.month;
    showFirstTimeOption = true;
    isFirstTime = isFirstTimeFlag;
  }

  let leaveMonth: number | undefined;
  if (leave) {
    if (leave.year < taxYear) {
      // 税年前已离职
      hireMonth = 13;
      leaveMonth = undefined;
      showFirstTimeOption = false;
      isFirstTime = false;
    } else if (leave.year === taxYear) {
      leaveMonth = leave.month;
    }
    // leave.year > taxYear：本税年仍在职，无截断
  }

  return { hireMonth, leaveMonth, isFirstTime, showFirstTimeOption };
}
