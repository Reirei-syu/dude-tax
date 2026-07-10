import { describe, expect, it } from 'vitest';
import { emptyYearMonths } from '../../types';
import { TaxRepository } from './repository';

describe('workspace isolation + persistence', () => {
  it('two workspaces isolate employees and monthly data across save/load', async () => {
    const repo = await TaxRepository.createInMemory();

    const a = await repo.ensureOrgAndWorkspace('甲单位', 2026);
    const b = await repo.ensureOrgAndWorkspace('乙单位', 2026);

    expect(a.workspace.id).not.toBe(b.workspace.id);

    const empA = {
      id: 'emp_a',
      workspaceId: a.workspace.id,
      name: '张三',
      hireDate: '2026-01-01',
      leaveDate: null,
      isFirstTime: false,
    };
    const empB = {
      id: 'emp_b',
      workspaceId: b.workspace.id,
      name: '李四',
      hireDate: '2026-03-01',
      leaveDate: null,
      isFirstTime: true,
    };

    const monthsA = emptyYearMonths();
    monthsA[0] = {
      ...emptyYearMonths()[0]!,
      salary: 12_000,
      social: {
        pension: 0,
        medical: 0,
        unemployment: 0,
        housingFund: 1_000,
      },
    };
    const monthsB = emptyYearMonths();
    monthsB[2] = {
      ...emptyYearMonths()[0]!,
      salary: 8_000,
      social: {
        pension: 0,
        medical: 0,
        unemployment: 0,
        housingFund: 500,
      },
      specialAddl: {
        childEducation: 200,
        continuingEdu: 0,
        housingLoan: 0,
        housingRent: 0,
        elderlySupport: 0,
        infantCare: 0,
        personalPension: 0,
      },
    };

    await repo.saveSnapshot({
      organization: a.organization,
      workspace: a.workspace,
      employees: [empA],
      monthlyRecords: { emp_a: monthsA },
      bonusRecords: { emp_a: 36_000 },
      boardLayout: { nodes: [] },
    });

    await repo.saveSnapshot({
      organization: b.organization,
      workspace: b.workspace,
      employees: [empB],
      monthlyRecords: { emp_b: monthsB },
      bonusRecords: { emp_b: 10_000 },
      boardLayout: { nodes: [] },
    });

    const loadA = await repo.loadWorkspace(a.workspace.id);
    const loadB = await repo.loadWorkspace(b.workspace.id);

    expect(loadA).not.toBeNull();
    expect(loadB).not.toBeNull();

    expect(loadA!.employees.map((e) => e.name)).toEqual(['张三']);
    expect(loadB!.employees.map((e) => e.name)).toEqual(['李四']);

    expect(loadA!.monthlyRecords['emp_a']![0]!.salary).toBe(12_000);
    expect(loadA!.monthlyRecords['emp_a']![0]!.social.housingFund).toBe(1_000);
    expect(loadA!.bonusRecords['emp_a']).toBe(36_000);

    expect(loadB!.monthlyRecords['emp_b']![2]!.salary).toBe(8_000);
    expect(loadB!.bonusRecords['emp_b']).toBe(10_000);

    expect(loadA!.employees.find((e) => e.id === 'emp_b')).toBeUndefined();
    expect(loadB!.employees.find((e) => e.id === 'emp_a')).toBeUndefined();
    expect(loadA!.monthlyRecords['emp_b']).toBeUndefined();
    expect(loadB!.monthlyRecords['emp_a']).toBeUndefined();

    const bytes = repo.exportBytes();
    expect(bytes).not.toBeNull();
    const repo2 = await TaxRepository.createFromBytes(bytes!);
    const againA = (await repo2.loadWorkspace(a.workspace.id))!;
    const againB = (await repo2.loadWorkspace(b.workspace.id))!;
    expect(againA.employees[0]!.name).toBe('张三');
    expect(againB.employees[0]!.name).toBe('李四');
    expect(againA.monthlyRecords['emp_a']![0]!.salary).toBe(12_000);
    expect(againB.monthlyRecords['emp_b']![2]!.salary).toBe(8_000);
  });

  it('board layout with sizes and viewport survives save/load', async () => {
    const repo = await TaxRepository.createInMemory();
    const a = await repo.ensureOrgAndWorkspace('布局单位', 2026);
    const customNodes = [
      {
        id: 'node_roster',
        type: 'roster' as const,
        position: { x: 100, y: 200 },
        width: 333,
        height: 444,
        data: { label: '员工花名册' },
      },
    ];
    await repo.saveSnapshot({
      organization: a.organization,
      workspace: a.workspace,
      employees: [],
      monthlyRecords: {},
      bonusRecords: {},
      boardLayout: {
        nodes: customNodes,
        viewport: { x: 12, y: -34, zoom: 0.85 },
      },
    });
    const loaded = (await repo.loadWorkspace(a.workspace.id))!;
    const roster = loaded.boardLayout.nodes.find((n) => n.id === 'node_roster');
    expect(roster?.position).toEqual({ x: 100, y: 200 });
    expect(roster?.width).toBe(333);
    expect(roster?.height).toBe(444);
    expect(loaded.boardLayout.viewport).toEqual({ x: 12, y: -34, zoom: 0.85 });
    expect(loaded.boardLayout.nodes.some((n) => n.type === 'all-staff-tax')).toBe(
      true,
    );
  });

  it('listWorkspaces returns both orgs', async () => {
    const repo = await TaxRepository.createInMemory();
    await repo.ensureOrgAndWorkspace('单位A', 2025);
    await repo.ensureOrgAndWorkspace('单位A', 2026);
    await repo.ensureOrgAndWorkspace('单位B', 2026);
    const list = await repo.listWorkspaces();
    expect(list.length).toBe(3);
    expect(list.some((w) => w.orgName === '单位B' && w.year === 2026)).toBe(
      true,
    );
  });

  it('ensureWorkspaceForOrg creates year workspace and listYearsForOrg', async () => {
    const repo = await TaxRepository.createInMemory();
    const { organization } = await repo.ensureOrgAndWorkspace('年度单位', 2026);
    const y2025 = await repo.ensureWorkspaceForOrg(organization, 2025);
    const y2026again = await repo.ensureWorkspaceForOrg(organization, 2026);
    expect(y2025.year).toBe(2025);
    expect(y2025.orgId).toBe(organization.id);
    const list = await repo.listWorkspaces();
    expect(y2026again.id).toBe(
      list.find((w) => w.year === 2026 && w.orgId === organization.id)!.id,
    );
    expect(await repo.listYearsForOrg(organization.id)).toEqual([2026, 2025]);

    await repo.saveSnapshot({
      organization,
      workspace: y2025,
      employees: [
        {
          id: 'emp_25',
          workspaceId: y2025.id,
          name: '往年员工',
          hireDate: '2025-01-01',
          leaveDate: null,
          isFirstTime: false,
        },
      ],
      monthlyRecords: { emp_25: emptyYearMonths() },
      bonusRecords: {},
      boardLayout: { nodes: [] },
    });
    const load25 = (await repo.loadWorkspace(y2025.id))!;
    const load26 = (await repo.loadWorkspace(y2026again.id))!;
    expect(load25.employees.map((e) => e.name)).toEqual(['往年员工']);
    expect(load26.employees).toHaveLength(0);
  });
});

describe('organization add / delete', () => {
  it('createOrganization adds unit and listOrganizations reflects it', async () => {
    const repo = await TaxRepository.createInMemory();
    const a = await repo.createOrganization('新单位甲');
    const b = await repo.createOrganization('新单位乙');
    expect(a.id).not.toBe(b.id);
    const again = await repo.createOrganization('新单位甲');
    expect(again.id).toBe(a.id);

    const list = await repo.listOrganizations();
    expect(list).toHaveLength(2);
    expect(list.map((o) => o.name)).toEqual(
      expect.arrayContaining(['新单位甲', '新单位乙']),
    );
    expect(list.find((o) => o.name === '新单位甲')!.workspaceCount).toBe(0);
  });

  it('new org can enable a chosen year workspace', async () => {
    const repo = await TaxRepository.createInMemory();
    const org = await repo.createOrganization('启用2024单位');
    const ws = await repo.ensureWorkspaceForOrg(org, 2024);
    expect(ws.year).toBe(2024);
    expect(ws.orgId).toBe(org.id);
    expect(await repo.listYearsForOrg(org.id)).toEqual([2024]);
    expect(
      (await repo.listOrganizations()).find((o) => o.id === org.id)!
        .workspaceCount,
    ).toBe(1);
  });

  it('createNextYearWithInherit copies year-end staff and monthly template', async () => {
    const repo = await TaxRepository.createInMemory();
    const { organization, workspace } = await repo.ensureOrgAndWorkspace(
      '结转单位',
      2025,
    );
    const months = emptyYearMonths();
    months[11] = {
      ...emptyYearMonths()[0]!,
      salary: 20_000,
      social: {
        pension: 1_600,
        medical: 400,
        unemployment: 100,
        housingFund: 2_000,
      },
    };
    await repo.saveSnapshot({
      organization,
      workspace,
      employees: [
        {
          id: 'emp_keep',
          workspaceId: workspace.id,
          name: '持续在职',
          hireDate: '2025-01-01',
          leaveDate: null,
          isFirstTime: true,
        },
        {
          id: 'emp_left',
          workspaceId: workspace.id,
          name: '年中离职',
          hireDate: '2025-01-01',
          leaveDate: '2025-09-30',
          isFirstTime: false,
        },
      ],
      monthlyRecords: {
        emp_keep: months,
        emp_left: emptyYearMonths(),
      },
      bonusRecords: { emp_keep: 50_000, emp_left: 0 },
      boardLayout: { nodes: [] },
    });

    const rolled = await repo.createNextYearWithInherit(organization, 2025);
    expect(rolled.ok).toBe(true);
    if (!rolled.ok) return;
    expect(rolled.nextYear).toBe(2026);
    expect(rolled.inheritedEmployeeCount).toBe(1);
    expect(rolled.skippedEmployeeCount).toBe(1);

    const next = (await repo.loadWorkspace(rolled.workspace.id))!;
    expect(next.workspace.year).toBe(2026);
    expect(next.employees).toHaveLength(1);
    expect(next.employees[0]!.name).toBe('持续在职');
    expect(next.employees[0]!.isFirstTime).toBe(false);
    expect(next.bonusRecords[next.employees[0]!.id!]).toBe(0);
    expect(next.monthlyRecords[next.employees[0]!.id!]![0]!.salary).toBe(20_000);
    expect(
      next.monthlyRecords[next.employees[0]!.id!]![0]!.social.housingFund,
    ).toBe(2_000);

    const again = await repo.createNextYearWithInherit(organization, 2025);
    expect(again.ok).toBe(false);
  });

  it('deleteOrganization cascades workspaces and employees', async () => {
    const repo = await TaxRepository.createInMemory();
    const a = await repo.ensureOrgAndWorkspace('待删单位', 2026);
    const b = await repo.ensureOrgAndWorkspace('保留单位', 2026);

    await repo.saveSnapshot({
      organization: a.organization,
      workspace: a.workspace,
      employees: [
        {
          id: 'emp_del',
          workspaceId: a.workspace.id,
          name: '将被删除',
          hireDate: '2026-01-01',
          leaveDate: null,
          isFirstTime: false,
        },
      ],
      monthlyRecords: {
        emp_del: emptyYearMonths().map((m) => ({ ...m, salary: 9000 })),
      },
      bonusRecords: { emp_del: 1000 },
      boardLayout: { nodes: [] },
    });

    expect(await repo.deleteOrganization(a.organization.id)).toBe(true);
    expect(await repo.loadWorkspace(a.workspace.id)).toBeNull();
    expect((await repo.listOrganizations()).map((o) => o.name)).toEqual([
      '保留单位',
    ]);
    expect(
      (await repo.listWorkspaces()).every((w) => w.orgId === b.organization.id),
    ).toBe(true);

    const kept = await repo.loadWorkspace(b.workspace.id);
    expect(kept).not.toBeNull();
    expect(kept!.organization.name).toBe('保留单位');
  });
});
