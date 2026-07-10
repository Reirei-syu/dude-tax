import { describe, expect, it } from 'vitest';
import type { MonthInput } from '../../types';
import { emptyMonth } from '../../types';
import {
  annualTaxFromTaxableYuan,
  computeFullEmployeeCalc,
  computeMonthlyPrewithhold,
  employmentMonthsUsed,
} from './engine';
import { yuanToFen, fenToYuan } from './fen';

function monthsOf(salary: number, n = 12): MonthInput[] {
  return Array.from({ length: n }, () => ({ ...emptyMonth(), salary }));
}

describe('fen arithmetic', () => {
  it('rounds to fen integers', () => {
    expect(yuanToFen(10.005)).toBe(1001);
    expect(fenToYuan(15000)).toBe(150);
  });
});

describe('employmentMonthsUsed', () => {
  it('first-time uses calendar month', () => {
    expect(employmentMonthsUsed(6, 6, undefined, true)).toBe(6);
    expect(employmentMonthsUsed(1, 1, undefined, true)).toBe(1);
  });

  it('non-first-time counts from hire', () => {
    expect(employmentMonthsUsed(6, 6, undefined, false)).toBe(1);
    expect(employmentMonthsUsed(8, 6, undefined, false)).toBe(3);
  });
});

describe('computeMonthlyPrewithhold — full year fixed salary', () => {
  it('10k/month no extra deductions full employment', () => {
    const rows = computeMonthlyPrewithhold({
      hireMonth: 1,
      isFirstTime: false,
      months: monthsOf(10_000),
    });

    // Month 1: taxable 5000, tax 150
    expect(rows[0]!.cumTaxable).toBeCloseTo(5_000, 2);
    expect(rows[0]!.thisMonthTax).toBeCloseTo(150, 2);
    expect(rows[0]!.cumTax).toBeCloseTo(150, 2);
    expect(rows[0]!.employmentMonthsUsed).toBe(1);

    // Month 7: taxable 35000 still 3%
    expect(rows[6]!.cumTaxable).toBeCloseTo(35_000, 2);
    expect(rows[6]!.rate).toBe(0.03);
    expect(rows[6]!.cumTax).toBeCloseTo(1_050, 2);

    // Month 8: taxable 40000 → 10%, quick 2520 → cumTax 1480
    expect(rows[7]!.cumTaxable).toBeCloseTo(40_000, 2);
    expect(rows[7]!.rate).toBe(0.1);
    expect(rows[7]!.cumTax).toBeCloseTo(1_480, 2);
    expect(rows[7]!.thisMonthTax).toBeCloseTo(430, 2);

    // Year total: taxable 60000 → 60000*0.1-2520=3480
    expect(rows[11]!.cumTaxable).toBeCloseTo(60_000, 2);
    expect(rows[11]!.cumTax).toBeCloseTo(3_480, 2);

    // Sum of monthly taxes equals cumulative
    const sum = rows.reduce((s, r) => s + r.thisMonthTax, 0);
    expect(sum).toBeCloseTo(rows[11]!.cumTax, 2);
  });

  it('handles zero income months with zero tax', () => {
    const months = monthsOf(0);
    const rows = computeMonthlyPrewithhold({
      hireMonth: 1,
      isFirstTime: false,
      months,
    });
    for (const r of rows) {
      expect(r.thisMonthTax).toBe(0);
      expect(r.cumTax).toBe(0);
    }
  });
});

describe('first-time wage earner (公告 2020 年第 13 号)', () => {
  it('June hire + isFirstTime → basic deduction 6×5000 in June', () => {
    const months = monthsOf(0);
    // only June has salary
    months[5] = { ...emptyMonth(), salary: 12_000 };
    const rows = computeMonthlyPrewithhold({
      hireMonth: 6,
      isFirstTime: true,
      months,
    });

    // Jan–May not employed
    for (let i = 0; i < 5; i++) {
      expect(rows[i]!.salary).toBe(0);
      expect(rows[i]!.thisMonthTax).toBe(0);
      expect(rows[i]!.employmentMonthsUsed).toBe(0);
    }

    // June: employment months = 6 (calendar), basic = 30000
    expect(rows[5]!.employmentMonthsUsed).toBe(6);
    expect(rows[5]!.cumBasicDeduction).toBeCloseTo(30_000, 2);
    // taxable = 12000 - 30000 = 0
    expect(rows[5]!.cumTaxable).toBeCloseTo(0, 2);
    expect(rows[5]!.thisMonthTax).toBeCloseTo(0, 2);
  });

  it('June hire without first-time uses 1×5000', () => {
    const months = monthsOf(0);
    months[5] = { ...emptyMonth(), salary: 12_000 };
    const rows = computeMonthlyPrewithhold({
      hireMonth: 6,
      isFirstTime: false,
      months,
    });
    expect(rows[5]!.employmentMonthsUsed).toBe(1);
    expect(rows[5]!.cumBasicDeduction).toBeCloseTo(5_000, 2);
    expect(rows[5]!.cumTaxable).toBeCloseTo(7_000, 2);
    expect(rows[5]!.thisMonthTax).toBeCloseTo(210, 2);
  });
});

describe('leave month handling', () => {
  it('August leave → months 9–12 tax 0 and salary treated as 0', () => {
    const months = monthsOf(10_000);
    const rows = computeMonthlyPrewithhold({
      hireMonth: 1,
      leaveMonth: 8,
      isFirstTime: false,
      months,
    });

    // August still employed
    expect(rows[7]!.salary).toBeCloseTo(10_000, 2);
    expect(rows[7]!.thisMonthTax).toBeGreaterThan(0);

    // Sep–Dec zero
    for (let m = 8; m < 12; m++) {
      expect(rows[m]!.salary).toBe(0);
      expect(rows[m]!.thisMonthTax).toBe(0);
    }

    // Cumulative tax frozen at August level
    expect(rows[11]!.cumTax).toBeCloseTo(rows[7]!.cumTax, 2);
  });
});

describe('bracket boundaries', () => {
  it('exactly 36000 taxable stays at 3%', () => {
    // Need taxable = 36000: salary such that sum(s-5000)=36000 over months
    // 1 month: salary 41000 → taxable 36000
    const months = monthsOf(0);
    months[0] = { ...emptyMonth(), salary: 41_000 };
    const rows = computeMonthlyPrewithhold({
      hireMonth: 1,
      isFirstTime: false,
      months,
    });
    expect(rows[0]!.cumTaxable).toBeCloseTo(36_000, 2);
    expect(rows[0]!.rate).toBe(0.03);
    expect(rows[0]!.thisMonthTax).toBeCloseTo(1_080, 2);
  });

  it('36001 enters 10%', () => {
    const months = monthsOf(0);
    months[0] = { ...emptyMonth(), salary: 41_001 };
    const rows = computeMonthlyPrewithhold({
      hireMonth: 1,
      isFirstTime: false,
      months,
    });
    expect(rows[0]!.cumTaxable).toBeCloseTo(36_001, 2);
    expect(rows[0]!.rate).toBe(0.1);
    // 36001*0.1 - 2520 = 1080.1
    expect(rows[0]!.thisMonthTax).toBeCloseTo(1_080.1, 2);
  });
});

describe('cumulative tax freeze when due falls (STA 预扣不退税)', () => {
  it('M1 high salary then M2 large specialAddl: 本期=0 and 累计已预扣 frozen', () => {
    const months = monthsOf(0);
    months[0] = { ...emptyMonth(), salary: 50_000 };
    months[1] = {
      ...emptyMonth(),
      specialAddl: {
        ...emptyMonth().specialAddl,
        childEducation: 50_000,
      },
    };
    const rows = computeMonthlyPrewithhold({
      hireMonth: 1,
      isFirstTime: false,
      months,
    });

    // M1: taxable 45000 → 10% → 45000*0.1-2520 = 1980
    expect(rows[0]!.thisMonthTax).toBeCloseTo(1_980, 2);
    expect(rows[0]!.cumTax).toBeCloseTo(1_980, 2);

    // M2: large specialAddl drives formula due down, but 预扣不退税
    expect(rows[1]!.thisMonthTax).toBe(0);
    expect(rows[1]!.cumTax).toBeCloseTo(1_980, 2);

    // 各月本期之和 === 累计已预扣
    const sum = rows.reduce((s, r) => s + r.thisMonthTax, 0);
    expect(sum).toBeCloseTo(rows[11]!.cumTax, 2);
    expect(rows[11]!.cumTax).toBeCloseTo(1_980, 2);
  });
});

describe('prior-year hire via resolveTaxYearEmployment path', () => {
  it('hire month forced to 1 behaves like full-year from January', () => {
    // 模拟 store 对「往年入职」的结果：hireMonth=1, isFirstTime=false
    const rows = computeMonthlyPrewithhold({
      hireMonth: 1,
      isFirstTime: false,
      months: monthsOf(10_000),
    });
    expect(rows[0]!.employmentMonthsUsed).toBe(1);
    expect(rows[5]!.employmentMonthsUsed).toBe(6);
    expect(rows[0]!.cumBasicDeduction).toBeCloseTo(5_000, 2);
  });
});

describe('computeFullEmployeeCalc', () => {
  it('returns months and optional bonus compare', () => {
    const r = computeFullEmployeeCalc({
      hireMonth: 1,
      isFirstTime: false,
      months: monthsOf(10_000),
      bonus: 36_000,
    });
    expect(r.months).toHaveLength(12);
    expect(r.bonusCompare).not.toBeNull();
    expect(r.bonusCompare!.bonus).toBe(36_000);
  });
});

describe('annualTaxFromTaxableYuan', () => {
  it('matches annual brackets', () => {
    expect(annualTaxFromTaxableYuan(36_000)).toBeCloseTo(1_080, 2);
    expect(annualTaxFromTaxableYuan(144_000)).toBeCloseTo(11_880, 2); // 144000*0.1-2520
  });
});
