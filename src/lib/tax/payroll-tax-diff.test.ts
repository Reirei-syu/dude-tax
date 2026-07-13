import { describe, expect, it } from 'vitest';
import {
  describePayrollTaxDiff,
  formatPayrollDiffCell,
  formatPayrollWithheldCell,
  payrollTaxDiffYuan,
  sumPayrollTaxDiffs,
} from './payroll-tax-diff';

describe('payrollTaxDiffYuan', () => {
  it('null withheld → null (does not treat as 0)', () => {
    expect(payrollTaxDiffYuan(null, 100)).toBeNull();
    expect(payrollTaxDiffYuan(undefined, 100)).toBeNull();
  });

  it('positive = over-withheld on payroll', () => {
    expect(payrollTaxDiffYuan(1000, 900)).toBe(100);
  });

  it('negative = under-withheld on payroll', () => {
    expect(payrollTaxDiffYuan(1000, 1100)).toBe(-100);
  });

  it('zero when equal; 0 withheld is valid', () => {
    expect(payrollTaxDiffYuan(500, 500)).toBe(0);
    expect(payrollTaxDiffYuan(0, 80)).toBe(-80);
  });

  it('uses fen math for 0.01 stability', () => {
    expect(payrollTaxDiffYuan(0.1 + 0.2, 0.3)).toBe(0);
  });
});

describe('sumPayrollTaxDiffs', () => {
  it('all empty → sum null', () => {
    expect(sumPayrollTaxDiffs([null, null, undefined])).toEqual({
      sum: null,
      monthsWithData: 0,
    });
  });

  it('sums only months with data', () => {
    expect(sumPayrollTaxDiffs([100, null, -30, 0])).toEqual({
      sum: 70,
      monthsWithData: 3,
    });
  });
});

describe('describe / format', () => {
  it('describes over and under', () => {
    expect(describePayrollTaxDiff(12.5)).toContain('多扣');
    expect(describePayrollTaxDiff(-8)).toContain('少扣');
    expect(describePayrollTaxDiff(0)).toContain('一致');
    expect(describePayrollTaxDiff(null)).toBeNull();
  });

  it('format cells use em dash when empty', () => {
    expect(formatPayrollDiffCell(null)).toBe('—');
    expect(formatPayrollWithheldCell(null)).toBe('—');
    expect(formatPayrollWithheldCell(12)).toBe('12.00');
  });
});
