/** 金额以「分」为单位的整数运算，避免浮点误差 */

/** 元 → 分（四舍五入到分） */
export function yuanToFen(yuan: number): number {
  if (!Number.isFinite(yuan)) return 0;
  return Math.round(yuan * 100);
}

/** 分 → 元 */
export function fenToYuan(fen: number): number {
  return fen / 100;
}

/** 分金额格式化为两位小数字符串 */
export function formatYuan(yuan: number): string {
  return yuan.toFixed(2);
}

/** 安全非负 */
export function clampNonNegFen(fen: number): number {
  return Math.max(0, fen);
}
