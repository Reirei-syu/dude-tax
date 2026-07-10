import { describe, expect, it } from 'vitest';
import {
  emptyMonth,
  emptyYearMonths,
  type Employee,
  type MonthInput,
} from '../../types';
import {
  buildNextYearSnapshot,
  fillYearFromSnapshot,
  isEmployedAtYearEnd,
  monthHasAmounts,
  pickYearEndMonthSnapshot,
} from './year-roll';

function emp(
  partial: Partial<Employee> & Pick<Employee, 'id' | 'name'>,
): Employee {
  return {
    workspaceId: 'ws_src',
    hireDate: '2025-01-01',
    leaveDate: null,
    isFirstTime: true,
    ...partial,
  };
}

describe('isEmployedAtYearEnd', () => {
  it('no leave → employed', () => {
    expect(isEmployedAtYearEnd({ leaveDate: null }, 2025)).toBe(true);
  });

  it('left during source year → not employed at year end', () => {
    expect(
      isEmployedAtYearEnd({ leaveDate: '2025-06-30' }, 2025),
    ).toBe(false);
  });

  it('left in previous year → not', () => {
    expect(
      isEmployedAtYearEnd({ leaveDate: '2024-12-31' }, 2025),
    ).toBe(false);
  });

  it('leave in next year → still employed at source year end', () => {
    expect(
      isEmployedAtYearEnd({ leaveDate: '2026-03-15' }, 2025),
    ).toBe(true);
  });
});

describe('pickYearEndMonthSnapshot', () => {
  it('prefers December when filled', () => {
    const months = emptyYearMonths();
    months[10] = { ...emptyMonth(), salary: 8_000 };
    months[11] = { ...emptyMonth(), salary: 12_000 };
    expect(pickYearEndMonthSnapshot(months).salary).toBe(12_000);
  });

  it('walks back when December empty', () => {
    const months = emptyYearMonths();
    months[5] = { ...emptyMonth(), salary: 9_000 };
    expect(pickYearEndMonthSnapshot(months).salary).toBe(9_000);
  });

  it('monthHasAmounts detects social', () => {
    const m: MonthInput = {
      ...emptyMonth(),
      social: {
        pension: 100,
        medical: 0,
        unemployment: 0,
        housingFund: 0,
      },
    };
    expect(monthHasAmounts(m)).toBe(true);
  });
});

describe('buildNextYearSnapshot', () => {
  it('inherits active employees with year-end month and clears first-time/bonus', () => {
    const monthsA = emptyYearMonths();
    monthsA[11] = {
      ...emptyMonth(),
      salary: 15_000,
      social: {
        pension: 1_200,
        medical: 300,
        unemployment: 50,
        housingFund: 1_500,
      },
      specialAddl: {
        childEducation: 1_000,
        continuingEdu: 0,
        housingLoan: 0,
        housingRent: 0,
        elderlySupport: 0,
        infantCare: 0,
        personalPension: 0,
      },
    };
    const monthsB = emptyYearMonths();
    monthsB[2] = { ...emptyMonth(), salary: 5_000 };

    let n = 0;
    const result = buildNextYearSnapshot({
      sourceYear: 2025,
      nextYear: 2026,
      organization: {
        id: 'org1',
        name: '测试单位',
        createdAt: '2025-01-01',
      },
      sourceWorkspaceId: 'ws_src',
      nextWorkspaceId: 'ws_next',
      employees: [
        emp({ id: 'a', name: '在职甲', isFirstTime: true }),
        emp({
          id: 'b',
          name: '已离职乙',
          leaveDate: '2025-08-01',
        }),
        emp({
          id: 'c',
          name: '下年离职丙',
          leaveDate: '2026-04-01',
        }),
      ],
      monthlyRecords: {
        a: monthsA,
        b: monthsB,
        c: emptyYearMonths().map((m) => ({ ...m, salary: 10_000 })),
      },
      boardLayout: {
        nodes: [
          {
            id: 'node_roster',
            type: 'roster',
            position: { x: 0, y: 0 },
            data: { employeeId: 'a', label: '花名册' },
          },
        ],
      },
      newEmployeeId: () => `emp_${++n}`,
    });

    expect(result.inheritedEmployeeCount).toBe(2);
    expect(result.skippedEmployeeCount).toBe(1);
    expect(result.snapshot.workspace.year).toBe(2026);

    const names = result.snapshot.employees.map((e) => e.name).sort();
    expect(names).toEqual(['下年离职丙', '在职甲']);

    const active = result.snapshot.employees.find((e) => e.name === '在职甲')!;
    expect(active.isFirstTime).toBe(false);
    expect(active.workspaceId).toBe('ws_next');
    expect(result.snapshot.bonusRecords[active.id]).toBe(0);

    const jan = result.snapshot.monthlyRecords[active.id]![0]!;
    const dec = result.snapshot.monthlyRecords[active.id]![11]!;
    expect(jan.salary).toBe(15_000);
    expect(dec.salary).toBe(15_000);
    expect(jan.social.pension).toBe(1_200);
    expect(jan.specialAddl.childEducation).toBe(1_000);

    const leaving = result.snapshot.employees.find((e) => e.name === '下年离职丙')!;
    expect(leaving.leaveDate).toBe('2026-04-01');

    // 布局复制且清掉员工 id 绑定
    expect(result.snapshot.boardLayout.nodes[0]!.data.employeeId).toBeUndefined();
  });

  it('fillYearFromSnapshot clones independently', () => {
    const snap = { ...emptyMonth(), salary: 1 };
    const year = fillYearFromSnapshot(snap);
    year[0]!.salary = 99;
    expect(year[1]!.salary).toBe(1);
  });
});
