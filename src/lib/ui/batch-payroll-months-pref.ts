/**
 * 「批量填入工资单扣缴数」月份多选记忆（localStorage）
 * 首次使用：默认全选 1–12 月
 */

export const BATCH_PAYROLL_MONTHS_LS_KEY =
  'dude-tax-batch-payroll-months';

export const ALL_MONTHS: readonly number[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
];

/** 规范化为 1–12 去重升序；空/非法 → 全选 */
export function normalizeMonthSelection(
  raw: unknown,
): number[] {
  if (!Array.isArray(raw)) return [...ALL_MONTHS];
  const set = new Set<number>();
  for (const v of raw) {
    const n = typeof v === 'number' ? v : Number(v);
    if (Number.isInteger(n) && n >= 1 && n <= 12) set.add(n);
  }
  if (set.size === 0) return [...ALL_MONTHS];
  return [...set].sort((a, b) => a - b);
}

export function loadBatchPayrollMonths(
  storage: Pick<Storage, 'getItem'> | null | undefined = typeof localStorage !==
  'undefined'
    ? localStorage
    : null,
): number[] {
  if (!storage) return [...ALL_MONTHS];
  try {
    const raw = storage.getItem(BATCH_PAYROLL_MONTHS_LS_KEY);
    if (raw == null || raw === '') return [...ALL_MONTHS];
    return normalizeMonthSelection(JSON.parse(raw));
  } catch {
    return [...ALL_MONTHS];
  }
}

export function saveBatchPayrollMonths(
  months: number[],
  storage: Pick<Storage, 'setItem'> | null | undefined = typeof localStorage !==
  'undefined'
    ? localStorage
    : null,
): number[] {
  const normalized = normalizeMonthSelection(months);
  if (!storage) return normalized;
  try {
    storage.setItem(BATCH_PAYROLL_MONTHS_LS_KEY, JSON.stringify(normalized));
  } catch {
    // ignore quota / private mode
  }
  return normalized;
}
