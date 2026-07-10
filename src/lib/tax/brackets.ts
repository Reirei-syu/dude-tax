/**
 * 个人所得税税率表（硬编码）
 * 政策版本：2026 年规则
 * 年终奖单独计税优惠延续至 2027-12-31（财政部税务总局公告 2023 年第 30 号）
 */

export interface TaxBracket {
  /** 上限（含），Infinity 表示无上限；单位：元 */
  upTo: number;
  /** 税率 */
  rate: number;
  /** 速算扣除数（元） */
  quick: number;
}

/** 年度综合所得税率表（累计预扣 / 并入综合所得用） */
export const ANNUAL_BRACKETS: TaxBracket[] = [
  { upTo: 36_000, rate: 0.03, quick: 0 },
  { upTo: 144_000, rate: 0.1, quick: 2_520 },
  { upTo: 300_000, rate: 0.2, quick: 16_920 },
  { upTo: 420_000, rate: 0.25, quick: 31_920 },
  { upTo: 660_000, rate: 0.3, quick: 52_920 },
  { upTo: 960_000, rate: 0.35, quick: 85_920 },
  { upTo: Infinity, rate: 0.45, quick: 181_920 },
];

/**
 * 按月换算的综合所得税率表（年终奖单独计税用）
 * 以「年终奖 / 12」查表
 */
export const MONTHLY_BONUS_BRACKETS: TaxBracket[] = [
  { upTo: 3_000, rate: 0.03, quick: 0 },
  { upTo: 12_000, rate: 0.1, quick: 210 },
  { upTo: 25_000, rate: 0.2, quick: 1_410 },
  { upTo: 35_000, rate: 0.25, quick: 2_660 },
  { upTo: 55_000, rate: 0.3, quick: 4_410 },
  { upTo: 80_000, rate: 0.35, quick: 7_160 },
  { upTo: Infinity, rate: 0.45, quick: 15_160 },
];

export const BASIC_DEDUCTION_PER_MONTH = 5_000;

export const POLICY_VERSION_BANNER =
  '基于 2026 年规则（年终奖单独计税优惠至 2027-12-31）';

/** 查年度档（内部以分为单位的应纳税所得额） */
export function getAnnualBracketFen(taxableFen: number): TaxBracket {
  const yuan = taxableFen / 100;
  for (const b of ANNUAL_BRACKETS) {
    if (yuan <= b.upTo) return b;
  }
  return ANNUAL_BRACKETS[ANNUAL_BRACKETS.length - 1]!;
}

/** 查按月换算档（年终奖/12，元） */
export function getMonthlyBonusBracket(monthlyAvgYuan: number): TaxBracket {
  for (const b of MONTHLY_BONUS_BRACKETS) {
    if (monthlyAvgYuan <= b.upTo) return b;
  }
  return MONTHLY_BONUS_BRACKETS[MONTHLY_BONUS_BRACKETS.length - 1]!;
}
