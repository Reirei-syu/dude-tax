import { beforeEach, describe, expect, it } from 'vitest';
import { emptyYearMonths } from '../../types';
import { createIsolatedStoreState, useTaxStore } from './useTaxStore';

function seedEmployee() {
  createIsolatedStoreState();
  useTaxStore.getState().bootstrapDefault('测试单位', 2026);
  const s = useTaxStore.getState();
  const empId = s.selectedEmployeeId!;
  // fill all months with 10000
  for (let m = 1; m <= 12; m++) {
    useTaxStore.getState().updateMonthSalary(empId, m, 10_000);
  }
  return empId;
}

describe('hire/leave confirm state machine', () => {
  beforeEach(() => {
    createIsolatedStoreState();
  });

  it('setLeaveDate creates pendingConfirm without zeroing months', () => {
    const empId = seedEmployee();
    useTaxStore.getState().setLeaveDate(empId, '2026-08-15');

    const s = useTaxStore.getState();
    expect(s.pendingConfirm).toEqual({
      employeeId: empId,
      type: 'leave',
      targetMonth: 8,
      proposedDate: '2026-08-15',
    });

    // months not yet zeroed
    for (let m = 0; m < 12; m++) {
      expect(s.monthlyRecords[empId]![m]!.salary).toBe(10_000);
    }
    // leave_date not applied yet
    expect(s.employees[empId]!.leaveDate).toBeNull();
  });

  it('cancel leaves data unchanged', () => {
    const empId = seedEmployee();
    useTaxStore.getState().setLeaveDate(empId, '2026-08-15');
    useTaxStore.getState().cancelPendingAction();

    const s = useTaxStore.getState();
    expect(s.pendingConfirm).toBeNull();
    for (let m = 0; m < 12; m++) {
      expect(s.monthlyRecords[empId]![m]!.salary).toBe(10_000);
    }
    expect(s.employees[empId]!.leaveDate).toBeNull();
  });

  it('confirm leave zeros months after leave and clears pending', () => {
    const empId = seedEmployee();
    useTaxStore.getState().setLeaveDate(empId, '2026-08-15');
    useTaxStore.getState().confirmPendingAction();

    const s = useTaxStore.getState();
    expect(s.pendingConfirm).toBeNull();
    expect(s.employees[empId]!.leaveDate).toBe('2026-08-15');
    // Aug still has salary
    expect(s.monthlyRecords[empId]![7]!.salary).toBe(10_000);
    // Sep–Dec zeroed
    for (let m = 8; m < 12; m++) {
      expect(s.monthlyRecords[empId]![m]!.salary).toBe(0);
      expect(s.monthlyRecords[empId]![m]!.social.pension).toBe(0);
    }
    expect(s.statusBanner).toContain('8 月离职');

    // recompute → zero tax for zeroed months
    const calc = s.getEmployeeCalc(empId);
    for (let m = 8; m < 12; m++) {
      expect(calc[m]!.thisMonthTax).toBe(0);
      expect(calc[m]!.salary).toBe(0);
    }
    expect(calc[7]!.thisMonthTax).toBeGreaterThan(0);
  });

  it('confirm hire zeros months before hire', () => {
    const empId = seedEmployee();
    useTaxStore.getState().setHireDate(empId, '2026-06-01');
    // still pending
    expect(useTaxStore.getState().monthlyRecords[empId]![0]!.salary).toBe(
      10_000,
    );
    useTaxStore.getState().confirmPendingAction();

    const s = useTaxStore.getState();
    expect(s.employees[empId]!.hireDate).toBe('2026-06-01');
    for (let m = 0; m < 5; m++) {
      expect(s.monthlyRecords[empId]![m]!.salary).toBe(0);
    }
    expect(s.monthlyRecords[empId]![5]!.salary).toBe(10_000);
    expect(s.statusBanner).toContain('6 月入职');

    const calc = s.getEmployeeCalc(empId);
    for (let m = 0; m < 5; m++) {
      expect(calc[m]!.thisMonthTax).toBe(0);
    }
  });

  it('empty months helper works', () => {
    expect(emptyYearMonths()).toHaveLength(12);
  });

  it('copyMonthToFollowing copies salary and deduct details', () => {
    const empId = seedEmployee();
    useTaxStore.getState().updateMonthSalary(empId, 3, 15_000);
    useTaxStore.getState().updateMonthSocial(empId, 3, 'pension', 800);
    useTaxStore.getState().updateMonthSpecialAddl(empId, 3, 'elderlySupport', 2_000);
    useTaxStore.getState().copyMonthToFollowing(empId, 3);

    const months = useTaxStore.getState().monthlyRecords[empId]!;
    for (let m = 3; m <= 12; m++) {
      expect(months[m - 1]!.salary).toBe(15_000);
      expect(months[m - 1]!.social.pension).toBe(800);
      expect(months[m - 1]!.specialAddl.elderlySupport).toBe(2_000);
    }
    // 之前月份不受影响（seed 为 10000）
    expect(months[0]!.salary).toBe(10_000);
  });

  it('copyMonthToFollowing does not overwrite target payrollTaxWithheld', () => {
    const empId = seedEmployee();
    useTaxStore.getState().updateMonthPayrollTaxWithheld(empId, 3, 500);
    useTaxStore.getState().updateMonthPayrollTaxWithheld(empId, 5, 120);
    useTaxStore.getState().updateMonthPayrollTaxWithheld(empId, 8, 80);
    useTaxStore.getState().updateMonthSalary(empId, 3, 15_000);
    useTaxStore.getState().copyMonthToFollowing(empId, 3);

    const months = useTaxStore.getState().monthlyRecords[empId]!;
    expect(months[2]!.payrollTaxWithheld).toBe(500);
    // 源月扣缴不得覆盖后续月
    expect(months[4]!.payrollTaxWithheld).toBe(120);
    expect(months[7]!.payrollTaxWithheld).toBe(80);
    // 未录入的后续月保持 null
    expect(months[3]!.payrollTaxWithheld).toBeNull();
    expect(months[5]!.payrollTaxWithheld).toBeNull();
    // 工资已复制
    expect(months[4]!.salary).toBe(15_000);
  });
});
