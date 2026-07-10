import { describe, expect, it } from 'vitest';
import { buildAllStaffTaxTable } from './all-staff-table';
import type { Employee, MonthCalcResult } from '../../types';

function fakeCalc(tax: number): MonthCalcResult[] {
  return Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    cumIncome: 0,
    cumFreeIncome: 0,
    cumBasicDeduction: 0,
    cumSocialDeduct: 0,
    cumSpecialAddl: 0,
    cumOtherDeduct: 0,
    cumTaxable: 0,
    thisMonthTax: tax,
    cumTax: tax * (i + 1),
    employmentMonthsUsed: i + 1,
    rate: 0.03,
    quickDeduction: 0,
    salary: 0,
    freeIncome: 0,
    socialDeduct: 0,
    specialAddl: 0,
    otherDeduct: 0,
    taxReduction: 0,
    treatyReduction: 0,
  }));
}

describe('buildAllStaffTaxTable', () => {
  it('aggregates multi-employee monthly totals', () => {
    const list: Employee[] = [
      {
        id: 'a',
        workspaceId: 'w',
        name: 'A',
        hireDate: null,
        leaveDate: null,
        isFirstTime: false,
      },
      {
        id: 'b',
        workspaceId: 'w',
        name: 'B',
        hireDate: null,
        leaveDate: null,
        isFirstTime: false,
      },
    ];
    const t = buildAllStaffTaxTable(list, (id) =>
      fakeCalc(id === 'a' ? 10 : 20),
    );
    expect(t.colTotals.every((c) => c === 30)).toBe(true);
    expect(t.grandTotal).toBe(360);
  });
});
