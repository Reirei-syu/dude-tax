import { describe, expect, it } from 'vitest';
import { emptyMonth, emptyYearMonths } from '../../types';
import {
  buildSalaryCsv,
  buildSalaryImportTemplate,
  groupSalaryCsvRows,
  parseCsvLine,
  parseSalaryCsv,
} from './salaryCsv';

describe('parseCsvLine', () => {
  it('handles quotes and commas', () => {
    expect(parseCsvLine('张三,1,1000')).toEqual(['张三', '1', '1000']);
    expect(parseCsvLine('"李,四",2,"1,200.50"')).toEqual([
      '李,四',
      '2',
      '1,200.50',
    ]);
  });
});

describe('salary csv roundtrip', () => {
  it('export then import preserves key fields', () => {
    const months = emptyYearMonths();
    months[0] = {
      ...emptyMonth(),
      salary: 12_000,
      freeIncome: 500,
      social: {
        pension: 960,
        medical: 240,
        unemployment: 60,
        housingFund: 1_200,
      },
      specialAddl: {
        childEducation: 1_000,
        continuingEdu: 0,
        housingLoan: 0,
        housingRent: 0,
        elderlySupport: 2_000,
        infantCare: 0,
        personalPension: 0,
      },
      other: {
        enterpriseAnnuity: 100,
        commercialHealth: 0,
        deferredPension: 0,
        officialTransport: 0,
        communication: 0,
        lawyerFees: 0,
      },
      donation: 0,
      taxReduction: 0,
      treatyReduction: 0,
    };
    months[1] = { ...emptyMonth(), salary: 12_500 };

    const csv = buildSalaryCsv([
      { name: '王五', months, bonus: 36_000 },
    ]);
    expect(csv.startsWith('\uFEFF')).toBe(true);

    const parsed = parseSalaryCsv(csv);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows.length).toBe(12);

    const jan = parsed.rows.find((r) => r.month === 1)!;
    expect(jan.name).toBe('王五');
    expect(jan.data.salary).toBe(12_000);
    expect(jan.data.social.housingFund).toBe(1_200);
    expect(jan.data.specialAddl.elderlySupport).toBe(2_000);
    expect(jan.data.other.enterpriseAnnuity).toBe(100);
    expect(jan.bonus).toBe(36_000);

    const plan = groupSalaryCsvRows(parsed.rows);
    expect(plan.names).toEqual(['王五']);
    expect(plan.byEmployeeName.get('王五')!.months[1]!.salary).toBe(12_000);
    expect(plan.byEmployeeName.get('王五')!.months[2]!.salary).toBe(12_500);
    expect(plan.byEmployeeName.get('王五')!.bonus).toBe(36_000);
  });

  it('rejects missing required headers', () => {
    const r = parseSalaryCsv('本期收入,月份\n1000,1\n');
    expect(r.rows).toHaveLength(0);
    expect(r.errors.some((e) => e.includes('姓名'))).toBe(true);
  });
});

describe('buildSalaryImportTemplate', () => {
  it('provides sample employee when no roster', () => {
    const csv = buildSalaryImportTemplate();
    const parsed = parseSalaryCsv(csv);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toHaveLength(12);
    expect(parsed.rows[0]!.name).toBe('示例员工');
    expect(parsed.rows.find((r) => r.month === 1)!.data.salary).toBe(10_000);
    expect(parsed.rows.find((r) => r.month === 2)!.data.salary).toBe(0);
  });

  it('prefills roster names with empty months', () => {
    const csv = buildSalaryImportTemplate(['甲', '乙']);
    const parsed = parseSalaryCsv(csv);
    expect(parsed.rows).toHaveLength(24);
    const names = new Set(parsed.rows.map((r) => r.name));
    expect(names).toEqual(new Set(['甲', '乙']));
    expect(parsed.rows.every((r) => r.data.salary === 0)).toBe(true);
  });
});
