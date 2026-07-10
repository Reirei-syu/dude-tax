import { describe, expect, it } from 'vitest';
import { buildAllStaffTaxTable } from '../tax/all-staff-table';
import { TaxRepository } from '../db/repository';
import {
  createIsolatedStoreState,
  getDirtyEmployeeIdsForTests,
  getTaxCalcInvokeCount,
  resetPersistQueueForTests,
  resetTaxCalcInvokeCounts,
  useTaxStore,
} from './useTaxStore';

describe('many-employees performance paths', () => {
  it('editing employee A does not re-invoke engine for employee B', () => {
    resetPersistQueueForTests();
    createIsolatedStoreState();
    useTaxStore.getState().bootstrapDefault('多人单位', 2026);
    const a = useTaxStore.getState().selectedEmployeeId!;
    const b = useTaxStore.getState().addEmployee('乙员工');
    for (let m = 1; m <= 12; m++) {
      useTaxStore.getState().updateMonthSalary(a, m, 10_000);
      useTaxStore.getState().updateMonthSalary(b, m, 8_000);
    }

    resetTaxCalcInvokeCounts();
    // 预热缓存
    useTaxStore.getState().getEmployeeCalc(a);
    useTaxStore.getState().getEmployeeCalc(b);
    expect(getTaxCalcInvokeCount(a)).toBe(1);
    expect(getTaxCalcInvokeCount(b)).toBe(1);

    // 仅改 A
    useTaxStore.getState().updateMonthSalary(a, 1, 20_000);
    useTaxStore.getState().getEmployeeCalc(a);
    useTaxStore.getState().getEmployeeCalc(b);

    expect(getTaxCalcInvokeCount(a)).toBe(2); // A 重算
    expect(getTaxCalcInvokeCount(b)).toBe(1); // B 缓存命中
    const aCalc = useTaxStore.getState().getEmployeeCalc(a);
    expect(aCalc[0]!.salary).toBe(20_000);
  });

  it('dirty persist only saveMonthly for edited employee', async () => {
    resetPersistQueueForTests();
    createIsolatedStoreState();
    const repo = await TaxRepository.createInMemory();
    useTaxStore.getState().setRepo(repo);
    useTaxStore.getState().bootstrapDefault('增量单位', 2026);
    await useTaxStore.getState().persistNow();

    const a = useTaxStore.getState().selectedEmployeeId!;
    const b = useTaxStore.getState().addEmployee('未改员工');
    for (let m = 1; m <= 12; m++) {
      useTaxStore.getState().updateMonthSalary(a, m, 5_000);
      useTaxStore.getState().updateMonthSalary(b, m, 6_000);
    }
    await useTaxStore.getState().persistNow();

    const monthlyCalls: string[] = [];
    const orig = repo.saveMonthly.bind(repo);
    repo.saveMonthly = async (employeeId, months) => {
      monthlyCalls.push(employeeId);
      return orig(employeeId, months);
    };

    useTaxStore.getState().updateMonthSalary(a, 3, 9_999);
    expect(getDirtyEmployeeIdsForTests()).toContain(a);
    expect(getDirtyEmployeeIdsForTests()).not.toContain(b);

    await useTaxStore.getState().flushPersist();

    expect(monthlyCalls).toEqual([a]);
    expect(monthlyCalls).not.toContain(b);

    const wsId = useTaxStore.getState().workspace!.id;
    const loaded = await repo.loadWorkspace(wsId);
    expect(loaded!.monthlyRecords[a]![2]!.salary).toBe(9_999);
    expect(loaded!.monthlyRecords[b]![0]!.salary).toBe(6_000);
  });

  it('buildAllStaffTaxTable sums columns correctly without map stringify', () => {
    const emps = [
      {
        id: 'e1',
        workspaceId: 'w',
        name: '甲',
        hireDate: '2026-01-01',
        leaveDate: null,
        isFirstTime: false,
      },
      {
        id: 'e2',
        workspaceId: 'w',
        name: '乙',
        hireDate: '2026-01-01',
        leaveDate: null,
        isFirstTime: false,
      },
    ];
    const table = buildAllStaffTaxTable(emps, (id) => {
      const tax = id === 'e1' ? 100 : 50;
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
    });
    expect(table.colTotals[0]).toBe(150);
    expect(table.grandTotal).toBe(150 * 12);
    expect(table.rows).toHaveLength(2);
  });
});

describe('AllStaffTaxCard source avoids full monthlyRecords stringify', () => {
  it('source file does not JSON.stringify full monthlyRecords map', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const src = readFileSync(
      join(process.cwd(), 'src/components/cards/AllStaffTaxCard.tsx'),
      'utf8',
    );
    expect(src).not.toMatch(/JSON\.stringify\(\s*\{[^}]*monthlyRecords/);
    expect(src).not.toMatch(/m:\s*monthlyRecords/);
    expect(src).toMatch(/dataEpoch/);
    expect(src).toMatch(/buildAllStaffTaxTable/);
  });
});
