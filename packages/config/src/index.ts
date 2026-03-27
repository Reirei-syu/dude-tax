export const DEFAULT_TAX_YEAR = new Date().getFullYear();

export const getSelectableYears = () => {
  const years: number[] = [];
  for (let year = DEFAULT_TAX_YEAR - 3; year <= DEFAULT_TAX_YEAR + 2; year += 1) {
    years.push(year);
  }
  return years;
};

export const MODULE_NAV_ITEMS = [
  { path: "/", label: "首页", isPlaceholder: false },
  { path: "/units", label: "单位管理", isPlaceholder: false },
  { path: "/employees", label: "员工信息", isPlaceholder: false },
  { path: "/entry", label: "月度数据录入", isPlaceholder: false },
  { path: "/import", label: "批量导入", isPlaceholder: false },
  { path: "/quick-calc", label: "快速计算", isPlaceholder: false },
  { path: "/calculation", label: "计算中心", isPlaceholder: false },
  { path: "/results", label: "结果中心", isPlaceholder: false },
  { path: "/history", label: "历史查询", isPlaceholder: false },
  { path: "/maintenance", label: "系统维护", isPlaceholder: false },
] as const;

export const DEFAULT_BASIC_DEDUCTION_AMOUNT = 5000;

export const COMPREHENSIVE_TAX_BRACKETS = [
  { level: 1, rangeText: "不超过 36,000 元", maxAnnualIncome: 36_000, rate: 3, quickDeduction: 0 },
  {
    level: 2,
    rangeText: "36,000 - 144,000 元",
    maxAnnualIncome: 144_000,
    rate: 10,
    quickDeduction: 2520,
  },
  {
    level: 3,
    rangeText: "144,000 - 300,000 元",
    maxAnnualIncome: 300_000,
    rate: 20,
    quickDeduction: 16920,
  },
  {
    level: 4,
    rangeText: "300,000 - 420,000 元",
    maxAnnualIncome: 420_000,
    rate: 25,
    quickDeduction: 31920,
  },
  {
    level: 5,
    rangeText: "420,000 - 660,000 元",
    maxAnnualIncome: 660_000,
    rate: 30,
    quickDeduction: 52920,
  },
  {
    level: 6,
    rangeText: "660,000 - 960,000 元",
    maxAnnualIncome: 960_000,
    rate: 35,
    quickDeduction: 85920,
  },
  {
    level: 7,
    rangeText: "超过 960,000 元",
    maxAnnualIncome: null,
    rate: 45,
    quickDeduction: 181920,
  },
] as const;

export const BONUS_TAX_BRACKETS = [
  {
    level: 1,
    rangeText: "不超过 3,000 元",
    maxAverageMonthlyIncome: 3_000,
    rate: 3,
    quickDeduction: 0,
  },
  {
    level: 2,
    rangeText: "3,000 - 12,000 元",
    maxAverageMonthlyIncome: 12_000,
    rate: 10,
    quickDeduction: 210,
  },
  {
    level: 3,
    rangeText: "12,000 - 25,000 元",
    maxAverageMonthlyIncome: 25_000,
    rate: 20,
    quickDeduction: 1410,
  },
  {
    level: 4,
    rangeText: "25,000 - 35,000 元",
    maxAverageMonthlyIncome: 35_000,
    rate: 25,
    quickDeduction: 2660,
  },
  {
    level: 5,
    rangeText: "35,000 - 55,000 元",
    maxAverageMonthlyIncome: 55_000,
    rate: 30,
    quickDeduction: 4410,
  },
  {
    level: 6,
    rangeText: "55,000 - 80,000 元",
    maxAverageMonthlyIncome: 80_000,
    rate: 35,
    quickDeduction: 7160,
  },
  {
    level: 7,
    rangeText: "超过 80,000 元",
    maxAverageMonthlyIncome: null,
    rate: 45,
    quickDeduction: 15160,
  },
] as const;
