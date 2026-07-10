import { describe, expect, it } from 'vitest';
import {
  groupSalaryCsvRows,
  parseAmountOptional,
  parseSalaryCsv,
} from './salaryCsv';
import {
  createIsolatedStoreState,
  resetPersistQueueForTests,
  useTaxStore,
} from '../store/useTaxStore';

describe('parseAmountOptional', () => {
  it('blank is undefined, explicit zero is 0', () => {
    expect(parseAmountOptional('')).toBeUndefined();
    expect(parseAmountOptional('  ')).toBeUndefined();
    expect(parseAmountOptional('0')).toBe(0);
    expect(parseAmountOptional('1,200.5')).toBe(1200.5);
  });
});

describe('CSV blank cells non-destructive import', () => {
  it('blank salary cells do not zero existing monthly salary on apply', () => {
    resetPersistQueueForTests();
    createIsolatedStoreState();
    useTaxStore.getState().bootstrapDefault('导入单位', 2026);
    const empId = useTaxStore.getState().selectedEmployeeId!;
    // 设姓名便于 CSV 匹配
    useTaxStore.setState((s) => ({
      employees: {
        ...s.employees,
        [empId]: { ...s.employees[empId]!, name: '张三' },
      },
    }));
    for (let m = 1; m <= 12; m++) {
      useTaxStore.getState().updateMonthSalary(empId, m, 15_000);
    }

    // 仅 3 月有姓名/月份，工资列留空
    const csv = `\uFEFF姓名,月份,本期收入,本期免税收入
张三,3,
张三,1,16000
`;
    const parsed = parseSalaryCsv(csv);
    expect(parsed.rows.length).toBeGreaterThanOrEqual(1);
    const plan = groupSalaryCsvRows(parsed.rows);
    const result = useTaxStore.getState().applySalaryImport(plan, {
      createMissing: false,
    });
    expect(result.updated).toBe(1);

    const months = useTaxStore.getState().monthlyRecords[empId]!;
    // 1 月显式 16000
    expect(months[0]!.salary).toBe(16_000);
    // 3 月空白 → 保持 15000
    expect(months[2]!.salary).toBe(15_000);
    // 未出现的 2 月仍 15000
    expect(months[1]!.salary).toBe(15_000);
  });
});
