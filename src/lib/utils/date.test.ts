import { describe, expect, it } from 'vitest';
import {
  dateToMonth,
  formatChineseDate,
  parseToYmd,
  resolveTaxYearEmployment,
  toIsoDate,
} from './date';

describe('Chinese date helpers', () => {
  it('formats ISO to 中文年月日', () => {
    expect(formatChineseDate('2026-08-15')).toBe('2026年8月15日');
    expect(formatChineseDate('2026-01-01')).toBe('2026年1月1日');
    expect(formatChineseDate(null)).toBe('—');
  });

  it('parses Chinese and ISO', () => {
    expect(parseToYmd('2026年6月1日')).toEqual({
      year: 2026,
      month: 6,
      day: 1,
    });
    expect(toIsoDate(parseToYmd('2026年6月1日'))).toBe('2026-06-01');
    expect(dateToMonth('2026年8月15日')).toBe(8);
    expect(dateToMonth('2026-08-15')).toBe(8);
  });
});

describe('resolveTaxYearEmployment', () => {
  it('往年入职：本税年从 1 月起算，不展示首次', () => {
    const r = resolveTaxYearEmployment('2024-06-01', null, 2026, true);
    expect(r.hireMonth).toBe(1);
    expect(r.isFirstTime).toBe(false);
    expect(r.showFirstTimeOption).toBe(false);
  });

  it('当年度入职：保留首次选项', () => {
    const r = resolveTaxYearEmployment('2026-06-01', null, 2026, true);
    expect(r.hireMonth).toBe(6);
    expect(r.isFirstTime).toBe(true);
    expect(r.showFirstTimeOption).toBe(true);
  });

  it('当年度入职未勾选首次', () => {
    const r = resolveTaxYearEmployment('2026-06-01', null, 2026, false);
    expect(r.hireMonth).toBe(6);
    expect(r.isFirstTime).toBe(false);
    expect(r.showFirstTimeOption).toBe(true);
  });
});
