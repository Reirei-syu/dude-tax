import { describe, expect, it } from 'vitest';
import type { MonthInput } from '../../types';
import { emptyMonth } from '../../types';
import {
  compareBonusMethods,
  computeBonusSeparateTax,
  computeMonthlyPrewithhold,
} from './engine';
import { generateBonusExplanation } from './explanations';

function monthsOf(salary: number): MonthInput[] {
  return Array.from({ length: 12 }, () => ({ ...emptyMonth(), salary }));
}

describe('computeBonusSeparateTax', () => {
  it('36k bonus: avg 3000 → 3%', () => {
    const r = computeBonusSeparateTax(36_000);
    expect(r.monthlyAvg).toBeCloseTo(3_000, 2);
    expect(r.rate).toBe(0.03);
    expect(r.tax).toBeCloseTo(1_080, 2); // 36000*0.03
  });

  it('36k+1 enters 10% monthly bracket', () => {
    const r = computeBonusSeparateTax(36_001);
    expect(r.monthlyAvg).toBeCloseTo(3_000.0833, 2);
    expect(r.rate).toBe(0.1);
    // 36001*0.1 - 210 = 3390.1
    expect(r.tax).toBeCloseTo(3_390.1, 2);
  });

  it('144k: avg 12000 → 10%', () => {
    const r = computeBonusSeparateTax(144_000);
    expect(r.monthlyAvg).toBeCloseTo(12_000, 2);
    expect(r.rate).toBe(0.1);
    expect(r.tax).toBeCloseTo(14_190, 2); // 144000*0.1 - 210
  });

  it('zero bonus → zero tax', () => {
    expect(computeBonusSeparateTax(0).tax).toBe(0);
  });
});

describe('compareBonusMethods recommendation', () => {
  it('surfaces both methods, delta sign, and recommendation', () => {
    const months = computeMonthlyPrewithhold({
      hireMonth: 1,
      isFirstTime: false,
      months: monthsOf(10_000),
    });
    // wage taxable 60000, wage tax 3480
    const cmp = compareBonusMethods(months, 36_000);

    expect(cmp.separateTax).toBeCloseTo(1_080, 2);
    expect(cmp.annualTaxWithoutBonus).toBeCloseTo(3_480, 2);

    // merge: taxable 96000 → 96000*0.1-2520=7080
    expect(cmp.annualTaxWithBonus).toBeCloseTo(7_080, 2);
    expect(cmp.mergeIncrementalTax).toBeCloseTo(3_600, 2);

    // separate total 3480+1080=4560 < merge 7080 → recommend separate
    expect(cmp.recommended).toBe('separate');
    expect(cmp.taxDelta).toBeLessThan(0); // separate cheaper
    expect(cmp.savings).toBeCloseTo(2_520, 2);

    const lines = generateBonusExplanation(cmp);
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines.some((l) => l.includes('单独计税'))).toBe(true);
  });

  it('large bonus may prefer merge when wage taxable is low', () => {
    // Low wage: 5000/month → taxable 0 all year
    const months = computeMonthlyPrewithhold({
      hireMonth: 1,
      isFirstTime: false,
      months: monthsOf(5_000),
    });
    expect(months[11]!.cumTaxable).toBeCloseTo(0, 2);

    // Very large bonus: separate hits 45%; merge may differ
    const big = compareBonusMethods(months, 1_000_000);
    expect(big.separateTax).toBeGreaterThan(0);
    expect(big.annualTaxWithBonus).toBeGreaterThan(0);
    expect(['separate', 'merge']).toContain(big.recommended);
    // delta sign consistent with recommendation
    if (big.recommended === 'separate') {
      expect(big.annualTaxWithoutBonus + big.separateTax).toBeLessThanOrEqual(
        big.annualTaxWithBonus + 0.01,
      );
    } else {
      expect(big.annualTaxWithBonus).toBeLessThanOrEqual(
        big.annualTaxWithoutBonus + big.separateTax + 0.01,
      );
    }
  });

  it('144k scale effect on separate rate', () => {
    const months = computeMonthlyPrewithhold({
      hireMonth: 1,
      isFirstTime: false,
      months: monthsOf(8_000),
    });
    const at = compareBonusMethods(months, 144_000);
    const over = compareBonusMethods(months, 144_012); // avg > 12000
    expect(at.separateRate).toBe(0.1);
    expect(over.separateRate).toBe(0.2);
    expect(over.separateTax).toBeGreaterThan(at.separateTax);
  });
});
