/**
 * 个人所得税累计预扣预缴 + 年终奖对比引擎（纯函数）
 * 公式对齐国家税务总局累计预扣法与年终奖单独计税规则
 */

import type {
  BonusCompareResult,
  EmployeeCalcInput,
  MonthCalcResult,
  MonthInput,
} from '../../types';
import { emptyMonth, monthDeductTotals } from '../../types';
import {
  BASIC_DEDUCTION_PER_MONTH,
  getAnnualBracketFen,
  getMonthlyBonusBracket,
} from './brackets';
import { clampNonNegFen, fenToYuan, yuanToFen } from './fen';

function isEmployedInMonth(
  month: number,
  hireMonth: number,
  leaveMonth?: number,
): boolean {
  if (month < hireMonth) return false;
  if (leaveMonth !== undefined && month > leaveMonth) return false;
  return true;
}

/**
 * 任职受雇月份数：
 * - 首次取得工资薪金：日历月数（公告 2020 年第 13 号）
 * - 否则：本单位自入职起至本月（含），离职后不再增加
 */
export function employmentMonthsUsed(
  month: number,
  hireMonth: number,
  leaveMonth: number | undefined,
  isFirstTime: boolean,
): number {
  if (month < hireMonth) return 0;
  if (leaveMonth !== undefined && month > leaveMonth) {
    // 离职后月份不计入新的任职月，返回离职月对应的累计任职月数
    return employmentMonthsUsed(leaveMonth, hireMonth, leaveMonth, isFirstTime);
  }
  if (isFirstTime) {
    return month; // 日历月
  }
  return month - hireMonth + 1;
}

/** 对单月金额做在职过滤 */
function effectiveMonth(
  m: MonthInput,
  month: number,
  hireMonth: number,
  leaveMonth?: number,
): MonthInput {
  if (!isEmployedInMonth(month, hireMonth, leaveMonth)) {
    return emptyMonth();
  }
  return m;
}

/**
 * 计算 1–12 月累计预扣结果（严格官方公式，内部以分运算）
 *
 * 累计预扣预缴应纳税所得额 =
 *   累计收入 - 累计免税收入 - 累计减除费用 - 累计专项扣除
 *   - 累计专项附加扣除 - 累计依法确定的其他扣除
 *
 * 本期应预扣预缴税额 =
 *   (累计应纳税所得额 × 预扣率 - 速算扣除数) - 累计已预扣预缴税额
 *
 * 累计减除费用 = 5000 × 任职受雇月份数
 */
export function computeMonthlyPrewithhold(
  input: EmployeeCalcInput,
): MonthCalcResult[] {
  const hireMonth = Math.min(12, Math.max(1, input.hireMonth || 1));
  const leaveMonth = input.leaveMonth;
  const results: MonthCalcResult[] = [];

  let cumIncomeFen = 0;
  let cumFreeIncomeFen = 0;
  let cumSocialFen = 0;
  let cumSpecialFen = 0;
  let cumOtherFen = 0;
  let cumTaxReductionFen = 0;
  let cumTaxFen = 0;

  for (let month = 1; month <= 12; month++) {
    const raw = input.months[month - 1] ?? emptyMonth();
    const eff = effectiveMonth(raw, month, hireMonth, leaveMonth);
    const totals = monthDeductTotals(eff);

    const salaryFen = yuanToFen(eff.salary);
    const freeFen = yuanToFen(totals.freeIncome);
    const socialFen = yuanToFen(totals.socialDeduct);
    const specialFen = yuanToFen(totals.specialAddl);
    const otherFen = yuanToFen(totals.otherDeduct);
    const taxRedFen = yuanToFen(totals.taxReduction + totals.treatyReduction);

    cumIncomeFen += salaryFen;
    cumFreeIncomeFen += freeFen;
    cumSocialFen += socialFen;
    cumSpecialFen += specialFen;
    cumOtherFen += otherFen;
    cumTaxReductionFen += taxRedFen;

    const empMonths = employmentMonthsUsed(
      month,
      hireMonth,
      leaveMonth,
      input.isFirstTime,
    );
    const basicFen = yuanToFen(BASIC_DEDUCTION_PER_MONTH) * empMonths;

    const afterLeave =
      leaveMonth !== undefined && month > leaveMonth;

    let cumTaxableFen = 0;
    let rate = 0;
    let quickYuan = 0;
    let thisMonthTaxFen = 0;

    if (!afterLeave && empMonths > 0) {
      // 累计应纳税所得额 = 累计收入 - 累计免税收入 - 累计减除费用
      //   - 累计专项扣除 - 累计专项附加等累计扣除 - 累计其他扣除
      cumTaxableFen = clampNonNegFen(
        cumIncomeFen -
          cumFreeIncomeFen -
          basicFen -
          cumSocialFen -
          cumSpecialFen -
          cumOtherFen,
      );
      const bracket = getAnnualBracketFen(cumTaxableFen);
      rate = bracket.rate;
      quickYuan = bracket.quick;
      const quickFen = yuanToFen(quickYuan);
      const taxBeforeQuick = Math.round(cumTaxableFen * rate);
      // 累计应扣 = max(0, 所得×税率 - 速算 - 累计减免税额)
      const cumulativeTaxDueFen = clampNonNegFen(
        taxBeforeQuick - quickFen - cumTaxReductionFen,
      );
      // 本期 = max(0, 累计应扣 − 累计已预扣)；公式应扣下降时不退税
      thisMonthTaxFen = clampNonNegFen(cumulativeTaxDueFen - cumTaxFen);
      cumTaxFen = cumTaxFen + thisMonthTaxFen;
    } else if (afterLeave) {
      thisMonthTaxFen = 0;
      if (results.length > 0) {
        const last = results[results.length - 1]!;
        cumTaxableFen = yuanToFen(last.cumTaxable);
        rate = last.rate;
        quickYuan = last.quickDeduction;
      }
    }

    results.push({
      month,
      cumIncome: fenToYuan(cumIncomeFen),
      cumFreeIncome: fenToYuan(cumFreeIncomeFen),
      cumBasicDeduction: fenToYuan(basicFen),
      cumSocialDeduct: fenToYuan(cumSocialFen),
      cumSpecialAddl: fenToYuan(cumSpecialFen),
      cumOtherDeduct: fenToYuan(cumOtherFen),
      cumTaxable: fenToYuan(cumTaxableFen),
      thisMonthTax: fenToYuan(thisMonthTaxFen),
      cumTax: fenToYuan(cumTaxFen),
      employmentMonthsUsed: empMonths,
      rate,
      quickDeduction: quickYuan,
      salary: fenToYuan(salaryFen),
      freeIncome: fenToYuan(freeFen),
      socialDeduct: fenToYuan(socialFen),
      specialAddl: fenToYuan(specialFen),
      otherDeduct: fenToYuan(otherFen),
      taxReduction: fenToYuan(yuanToFen(totals.taxReduction)),
      treatyReduction: fenToYuan(yuanToFen(totals.treatyReduction)),
    });
  }

  return results;
}

/** 年终奖单独计税：奖金 × 税率 - 速算扣除数（税率按 奖金/12 查月表） */
export function computeBonusSeparateTax(bonusYuan: number): {
  tax: number;
  rate: number;
  quick: number;
  monthlyAvg: number;
} {
  const bonusFen = yuanToFen(Math.max(0, bonusYuan));
  if (bonusFen === 0) {
    return { tax: 0, rate: 0.03, quick: 0, monthlyAvg: 0 };
  }
  const monthlyAvg = fenToYuan(bonusFen) / 12;
  const bracket = getMonthlyBonusBracket(monthlyAvg);
  const taxBefore = Math.round(bonusFen * bracket.rate);
  const taxFen = clampNonNegFen(taxBefore - yuanToFen(bracket.quick));
  return {
    tax: fenToYuan(taxFen),
    rate: bracket.rate,
    quick: bracket.quick,
    monthlyAvg,
  };
}

/** 按年度应纳税所得额计算全年税（分） */
export function annualTaxFromTaxableYuan(taxableYuan: number): number {
  const fen = yuanToFen(Math.max(0, taxableYuan));
  const bracket = getAnnualBracketFen(fen);
  const taxFen = clampNonNegFen(
    Math.round(fen * bracket.rate) - yuanToFen(bracket.quick),
  );
  return fenToYuan(taxFen);
}

/**
 * 年终奖两种计税方式对比并推荐较低税负方案
 */
export function compareBonusMethods(
  monthlyResults: MonthCalcResult[],
  bonusYuan: number,
): BonusCompareResult {
  const bonus = Math.max(0, bonusYuan);
  const separate = computeBonusSeparateTax(bonus);

  // 工资部分：取 12 月累计应纳税所得额与累计税
  const last = monthlyResults[11];
  const wageTaxableOnly = last?.cumTaxable ?? 0;
  const annualTaxWithoutBonus = last?.cumTax ?? 0;

  // 并入：工资累计应纳税所得额 + 奖金（奖金不再重复扣基本减除，直接加在应纳税所得额上）
  // 实务中并入综合所得时奖金计入综合收入，年度汇算时统一扣除；预估简化：
  // 并入后年度税 ≈ tax(wageTaxable + bonus)
  const taxableWithBonus = wageTaxableOnly + bonus;
  const annualTaxWithBonus = annualTaxFromTaxableYuan(taxableWithBonus);
  const mergeIncrementalTax = Math.max(
    0,
    fenToYuan(yuanToFen(annualTaxWithBonus) - yuanToFen(annualTaxWithoutBonus)),
  );

  // 单独计税总税负 = 工资预扣税 + 奖金单独税
  const separateTotal = annualTaxWithoutBonus + separate.tax;
  // 并入总税负 = 并入后全年税
  const mergeTotal = annualTaxWithBonus;

  const recommended: 'separate' | 'merge' =
    separateTotal <= mergeTotal ? 'separate' : 'merge';
  const taxDelta = fenToYuan(
    yuanToFen(separateTotal) - yuanToFen(mergeTotal),
  ); // 正 = 单独更贵
  const savings = Math.abs(taxDelta);

  return {
    bonus,
    separateTax: separate.tax,
    separateRate: separate.rate,
    separateQuick: separate.quick,
    monthlyAvg: separate.monthlyAvg,
    wageTaxableOnly,
    annualTaxWithoutBonus,
    annualTaxWithBonus,
    mergeIncrementalTax,
    recommended,
    taxDelta,
    savings,
  };
}

/** 便捷：从 EmployeeCalcInput 完整计算 */
export function computeFullEmployeeCalc(input: EmployeeCalcInput): {
  months: MonthCalcResult[];
  bonusCompare: BonusCompareResult | null;
} {
  const months = computeMonthlyPrewithhold(input);
  const bonusCompare =
    input.bonus !== undefined && input.bonus > 0
      ? compareBonusMethods(months, input.bonus)
      : input.bonus === 0
        ? compareBonusMethods(months, 0)
        : null;
  return { months, bonusCompare };
}
