import { describe, expect, it } from 'vitest';
import {
  ALL_MONTHS,
  loadBatchPayrollMonths,
  normalizeMonthSelection,
  saveBatchPayrollMonths,
} from './batch-payroll-months-pref';

describe('normalizeMonthSelection', () => {
  it('defaults to all 12 when empty or invalid', () => {
    expect(normalizeMonthSelection(null)).toEqual([...ALL_MONTHS]);
    expect(normalizeMonthSelection([])).toEqual([...ALL_MONTHS]);
    expect(normalizeMonthSelection(['x'])).toEqual([...ALL_MONTHS]);
  });

  it('dedupes and sorts valid months', () => {
    expect(normalizeMonthSelection([3, 1, 3, 12])).toEqual([1, 3, 12]);
  });
});

describe('load/save batch months pref', () => {
  it('first use (no key) → all months', () => {
    const mem = new Map<string, string>();
    const storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v);
      },
    };
    expect(loadBatchPayrollMonths(storage)).toEqual([...ALL_MONTHS]);
  });

  it('remembers last selection', () => {
    const mem = new Map<string, string>();
    const storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v);
      },
    };
    saveBatchPayrollMonths([6, 7], storage);
    expect(loadBatchPayrollMonths(storage)).toEqual([6, 7]);
  });
});
