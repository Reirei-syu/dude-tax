import { describe, expect, it } from 'vitest';
import { emptyYearMonths } from '../../types';
import {
  BackupFormatError,
  collectFullBackup,
  decodeBackup,
  encodeBackup,
  exportBackupBytes,
  restoreBackupBytes,
} from './backup';
import { TaxRepository } from './repository';

async function seedRepo() {
  const repo = await TaxRepository.createInMemory();
  const { organization, workspace } = await repo.ensureOrgAndWorkspace(
    '备份单位',
    2026,
  );
  const months = emptyYearMonths();
  months[0] = { ...months[0]!, salary: 12_345 };
  await repo.saveSnapshot({
    organization,
    workspace,
    employees: [
      {
        id: 'emp_bak',
        workspaceId: workspace.id,
        name: '备份员工',
        hireDate: '2026-01-01',
        leaveDate: null,
        isFirstTime: false,
      },
    ],
    monthlyRecords: { emp_bak: months },
    bonusRecords: { emp_bak: 50_000 },
    boardLayout: { nodes: [] },
  });
  return { repo, organization, workspace };
}

describe('backup export / restore (real repository)', () => {
  it('export → restore → load preserves salary and workspace year', async () => {
    const { repo, workspace } = await seedRepo();
    const bytes = await exportBackupBytes(repo);

    // 污染 live 数据
    await repo.saveSnapshot({
      organization: (await repo.loadWorkspace(workspace.id))!.organization,
      workspace,
      employees: [
        {
          id: 'emp_other',
          workspaceId: workspace.id,
          name: '污染',
          hireDate: '2026-01-01',
          leaveDate: null,
          isFirstTime: false,
        },
      ],
      monthlyRecords: {
        emp_other: emptyYearMonths().map((m) => ({ ...m, salary: 1 })),
      },
      bonusRecords: { emp_other: 0 },
      boardLayout: { nodes: [] },
    });

    const payload = await restoreBackupBytes(repo, bytes);
    expect(payload.snapshots.length).toBe(1);

    const loaded = await repo.loadWorkspace(workspace.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.workspace.year).toBe(2026);
    expect(loaded!.employees.map((e) => e.name)).toEqual(['备份员工']);
    expect(loaded!.monthlyRecords['emp_bak']![0]!.salary).toBe(12_345);
    expect(loaded!.bonusRecords['emp_bak']).toBe(50_000);
    expect(loaded!.employees.find((e) => e.id === 'emp_other')).toBeUndefined();
  });

  it('force path: edit then collect backup reflects latest persisted state', async () => {
    const { repo, workspace } = await seedRepo();
    const snap = (await repo.loadWorkspace(workspace.id))!;
    const months = [...snap.monthlyRecords['emp_bak']!];
    months[0] = { ...months[0]!, salary: 99_001 };
    await repo.saveSnapshot({
      ...snap,
      monthlyRecords: { emp_bak: months },
    });

    const backup = await collectFullBackup(repo);
    expect(backup.snapshots[0]!.monthlyRecords['emp_bak']![0]!.salary).toBe(
      99_001,
    );
    // 经 encode/decode 仍保持
    const again = decodeBackup(encodeBackup(backup));
    expect(again.snapshots[0]!.monthlyRecords['emp_bak']![0]!.salary).toBe(
      99_001,
    );
  });

  it('corrupt/truncated backup rejects without destroying known-good data', async () => {
    const { repo, workspace } = await seedRepo();
    const before = await repo.loadWorkspace(workspace.id);
    expect(before!.monthlyRecords['emp_bak']![0]!.salary).toBe(12_345);

    await expect(
      restoreBackupBytes(repo, new Uint8Array([1, 2, 3, 4, 5])),
    ).rejects.toBeInstanceOf(BackupFormatError);

    await expect(
      restoreBackupBytes(
        repo,
        new TextEncoder().encode('{"format":"nope","version":1,"snapshots":[]}'),
      ),
    ).rejects.toBeInstanceOf(BackupFormatError);

    await expect(
      restoreBackupBytes(
        repo,
        new TextEncoder().encode(
          JSON.stringify({
            format: 'dude-tax-backup',
            version: 1,
            snapshots: [{ broken: true }],
          }),
        ),
      ),
    ).rejects.toBeInstanceOf(BackupFormatError);

    const after = await repo.loadWorkspace(workspace.id);
    expect(after!.employees.map((e) => e.name)).toEqual(['备份员工']);
    expect(after!.monthlyRecords['emp_bak']![0]!.salary).toBe(12_345);
  });
});
