/**
 * 与 UI 绑定同一计算路径的已知夹具：全年 10000/月
 * 用于启动/回归核对（非 mock）
 */
import { describe, expect, it } from 'vitest';
import { computeFullEmployeeCalc, computeMonthlyPrewithhold } from './engine';
import { POLICY_VERSION_BANNER } from './brackets';
import type { MonthInput } from '../../types';
import { emptyMonth } from '../../types';

const months10k: MonthInput[] = Array.from({ length: 12 }, () => ({
  ...emptyMonth(),
  salary: 10_000,
}));

describe('UI-bound fixture path', () => {
  it('full-year 10k matches known tax figures', () => {
    const rows = computeMonthlyPrewithhold({
      hireMonth: 1,
      isFirstTime: false,
      months: months10k,
    });
    // 与 TaxSummaryCard / store.getEmployeeCalc 同一引擎
    expect(rows[0]!.thisMonthTax).toBeCloseTo(150, 2);
    expect(rows[7]!.thisMonthTax).toBeCloseTo(430, 2);
    expect(rows[11]!.cumTax).toBeCloseTo(3_480, 2);
    // eslint-disable-next-line no-console
    console.log(
      'FIXTURE',
      JSON.stringify({
        m1: rows[0]!.thisMonthTax,
        m8: rows[7]!.thisMonthTax,
        year: rows[11]!.cumTax,
        banner: POLICY_VERSION_BANNER,
      }),
    );
  });

  it('bonus path wired through computeFullEmployeeCalc', () => {
    const full = computeFullEmployeeCalc({
      hireMonth: 1,
      isFirstTime: false,
      months: months10k,
      bonus: 36_000,
    });
    expect(full.bonusCompare!.recommended).toBe('separate');
    expect(full.bonusCompare!.separateTax).toBeCloseTo(1_080, 2);
  });
});
