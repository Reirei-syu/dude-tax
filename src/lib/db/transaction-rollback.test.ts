import { describe, expect, it } from 'vitest';
import { emptyYearMonths } from '../../types';
import { FailAfterSqlClient } from './sql-client';
import { SqlJsClient } from './sqljs-client';
import { TaxRepository } from './repository';

describe('saveSnapshot atomicity (sql.js client)', () => {
  it('rolls back mid-write failure so no half-updated employee set remains', async () => {
    const base = await SqlJsClient.createInMemory();
    const good = TaxRepository.createWithClient(base);
    const { organization, workspace } = await good.ensureOrgAndWorkspace(
      '事务单位',
      2026,
    );

    await good.saveSnapshot({
      organization,
      workspace,
      employees: [
        {
          id: 'emp_ok',
          workspaceId: workspace.id,
          name: '原员工',
          hireDate: '2026-01-01',
          leaveDate: null,
          isFirstTime: false,
        },
      ],
      monthlyRecords: {
        emp_ok: emptyYearMonths().map((m) => ({ ...m, salary: 8_000 })),
      },
      bonusRecords: { emp_ok: 0 },
      boardLayout: { nodes: [] },
    });

    const before = await good.loadWorkspace(workspace.id);
    expect(before!.employees).toHaveLength(1);
    expect(before!.employees[0]!.name).toBe('原员工');

    // 失败客户端：业务写超过 2 次后抛错
    const failing = new FailAfterSqlClient(base, 2);
    const badRepo = TaxRepository.createWithClient(failing);

    await expect(
      badRepo.saveSnapshot({
        organization,
        workspace,
        employees: [
          {
            id: 'emp_a',
            workspaceId: workspace.id,
            name: '新员工A',
            hireDate: '2026-01-01',
            leaveDate: null,
            isFirstTime: false,
          },
          {
            id: 'emp_b',
            workspaceId: workspace.id,
            name: '新员工B',
            hireDate: '2026-01-01',
            leaveDate: null,
            isFirstTime: false,
          },
        ],
        monthlyRecords: {
          emp_a: emptyYearMonths(),
          emp_b: emptyYearMonths(),
        },
        bonusRecords: { emp_a: 0, emp_b: 0 },
        boardLayout: { nodes: [] },
      }),
    ).rejects.toThrow(/injected write failure/);

    // 同一底层库：应回滚到失败前状态
    const after = await good.loadWorkspace(workspace.id);
    expect(after).not.toBeNull();
    expect(after!.employees.map((e) => e.name)).toEqual(['原员工']);
    expect(after!.monthlyRecords['emp_ok']![0]!.salary).toBe(8_000);
    expect(after!.employees.find((e) => e.id === 'emp_a')).toBeUndefined();
  });
});
