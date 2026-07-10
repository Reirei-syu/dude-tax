import { describe, expect, it } from 'vitest';
import { monthsToZeroOnEmploymentConfirm } from './hire-leave-zero';
import {
  createIsolatedStoreState,
  resetPersistQueueForTests,
  useTaxStore,
} from '../store/useTaxStore';

describe('monthsToZeroOnEmploymentConfirm', () => {
  it('prior-year hire does not zero months in tax year (employed from Jan)', () => {
    const z = monthsToZeroOnEmploymentConfirm('hire', '2025-06-01', 2026);
    expect(z).toEqual([]);
  });

  it('same-year hire zeros months before hire month', () => {
    expect(monthsToZeroOnEmploymentConfirm('hire', '2026-06-01', 2026)).toEqual(
      [1, 2, 3, 4, 5],
    );
  });

  it('next-year leave does not zero months in current tax year', () => {
    const z = monthsToZeroOnEmploymentConfirm(
      'leave',
      '2027-08-15',
      2026,
      '2025-01-01',
    );
    expect(z).toEqual([]);
  });

  it('same-year leave zeros months after leave month', () => {
    expect(
      monthsToZeroOnEmploymentConfirm('leave', '2026-08-15', 2026, '2026-01-01'),
    ).toEqual([9, 10, 11, 12]);
  });
});

describe('confirmPendingAction tax-year window (store)', () => {
  it('hire date in prior year does not zero Jan–May salaries', () => {
    resetPersistQueueForTests();
    createIsolatedStoreState();
    useTaxStore.getState().bootstrapDefault('税年单位', 2026);
    const empId = useTaxStore.getState().selectedEmployeeId!;
    for (let m = 1; m <= 12; m++) {
      useTaxStore.getState().updateMonthSalary(empId, m, 10_000);
    }
    useTaxStore.getState().setHireDate(empId, '2025-06-01');
    useTaxStore.getState().confirmPendingAction();
    const months = useTaxStore.getState().monthlyRecords[empId]!;
    for (let m = 0; m < 12; m++) {
      expect(months[m]!.salary).toBe(10_000);
    }
    expect(useTaxStore.getState().employees[empId]!.hireDate).toBe(
      '2025-06-01',
    );
  });

  it('leave date next year does not zero Sep–Dec', () => {
    resetPersistQueueForTests();
    createIsolatedStoreState();
    useTaxStore.getState().bootstrapDefault('税年单位2', 2026);
    const empId = useTaxStore.getState().selectedEmployeeId!;
    for (let m = 1; m <= 12; m++) {
      useTaxStore.getState().updateMonthSalary(empId, m, 10_000);
    }
    useTaxStore.getState().setLeaveDate(empId, '2027-08-15');
    useTaxStore.getState().confirmPendingAction();
    const months = useTaxStore.getState().monthlyRecords[empId]!;
    for (let m = 0; m < 12; m++) {
      expect(months[m]!.salary).toBe(10_000);
    }
    expect(useTaxStore.getState().employees[empId]!.leaveDate).toBe(
      '2027-08-15',
    );
  });
});
