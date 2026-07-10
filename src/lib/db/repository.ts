/**
 * 工作区持久化仓库（SqlClient：sql.js 测试 / Tauri SQLite 生产）
 */

import type {
  BoardLayout,
  BoardNode,
  Employee,
  MonthInput,
  Organization,
  Workspace,
} from '../../types';
import {
  emptyYearMonths,
  monthDeductTotals,
  normalizeMonthInput,
} from '../../types';
import type { SqlClient } from './sql-client';
import { SqlJsClient } from './sqljs-client';
import { buildNextYearSnapshot } from './year-roll';

/** 与 tauri-client 保持一致；避免 Web 回退静态依赖 plugin-sql */
export const DEFAULT_TAURI_DB_URL = 'sqlite:dude-tax.db';

export interface WorkspaceSnapshot {
  organization: Organization;
  workspace: Workspace;
  employees: Employee[];
  monthlyRecords: Record<string, MonthInput[]>;
  bonusRecords: Record<string, number>;
  boardLayout: BoardLayout;
}

function uid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

function str(v: unknown): string {
  return v == null ? '' : String(v);
}

function num(v: unknown): number {
  return Number(v) || 0;
}

export class TaxRepository {
  private client: SqlClient;

  constructor(client: SqlClient) {
    this.client = client;
  }

  static createWithClient(client: SqlClient): TaxRepository {
    return new TaxRepository(client);
  }

  static async createInMemory(): Promise<TaxRepository> {
    const client = await SqlJsClient.createInMemory();
    return new TaxRepository(client);
  }

  static async createFromBytes(bytes: Uint8Array): Promise<TaxRepository> {
    const client = await SqlJsClient.createFromBytes(bytes);
    return new TaxRepository(client);
  }

  static async openTauri(
    dbUrl: string = DEFAULT_TAURI_DB_URL,
  ): Promise<TaxRepository> {
    const { TauriSqlClient } = await import('./tauri-client');
    const client = await TauriSqlClient.open(dbUrl);
    return new TaxRepository(client);
  }

  getClient(): SqlClient {
    return this.client;
  }

  exportBytes(): Uint8Array | null {
    return this.client.exportBytes();
  }

  async ensureOrgAndWorkspace(
    orgName: string,
    year: number,
  ): Promise<{ organization: Organization; workspace: Workspace }> {
    const orgRows = await this.client.select<{
      id: string;
      name: string;
      created_at: string;
    }>('SELECT id, name, created_at FROM organizations WHERE name = ?', [
      orgName,
    ]);
    let organization: Organization;
    if (!orgRows.length) {
      organization = {
        id: uid('org'),
        name: orgName,
        createdAt: new Date().toISOString(),
      };
      await this.client.execute(
        'INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)',
        [organization.id, organization.name, organization.createdAt],
      );
    } else {
      const v = orgRows[0]!;
      organization = {
        id: str(v.id),
        name: str(v.name),
        createdAt: str(v.created_at),
      };
    }

    const workspace = await this.ensureWorkspaceForOrg(organization, year);
    return { organization, workspace };
  }

  async ensureWorkspaceForOrg(
    organization: Organization,
    year: number,
  ): Promise<Workspace> {
    const y = Math.floor(Number(year));
    const wsRows = await this.client.select<{
      id: string;
      org_id: string;
      year: number;
    }>('SELECT id, org_id, year FROM workspaces WHERE org_id = ? AND year = ?', [
      organization.id,
      y,
    ]);
    if (wsRows.length) {
      const v = wsRows[0]!;
      return {
        id: str(v.id),
        orgId: str(v.org_id),
        year: num(v.year),
      };
    }
    const workspace: Workspace = {
      id: uid('ws'),
      orgId: organization.id,
      year: y,
    };
    await this.client.execute(
      'INSERT INTO workspaces (id, org_id, year) VALUES (?, ?, ?)',
      [workspace.id, workspace.orgId, workspace.year],
    );
    await this.client.execute(
      'INSERT INTO board_layouts (workspace_id, nodes_json) VALUES (?, ?)',
      [workspace.id, JSON.stringify(defaultBoardNodes())],
    );
    return workspace;
  }

  async listWorkspaces(): Promise<
    Array<Workspace & { orgName: string }>
  > {
    const rows = await this.client.select<{
      id: string;
      org_id: string;
      year: number;
      org_name: string;
    }>(
      `SELECT w.id, w.org_id, w.year, o.name AS org_name
       FROM workspaces w JOIN organizations o ON o.id = w.org_id
       ORDER BY o.name, w.year DESC`,
    );
    return rows.map((v) => ({
      id: str(v.id),
      orgId: str(v.org_id),
      year: num(v.year),
      orgName: str(v.org_name),
    }));
  }

  async listYearsForOrg(orgId: string): Promise<number[]> {
    const rows = await this.client.select<{ year: number }>(
      'SELECT year FROM workspaces WHERE org_id = ? ORDER BY year DESC',
      [orgId],
    );
    return rows.map((v) => num(v.year));
  }

  async createNextYearWithInherit(
    organization: Organization,
    sourceYear: number,
  ): Promise<
    | {
        ok: true;
        workspace: Workspace;
        inheritedEmployeeCount: number;
        skippedEmployeeCount: number;
        nextYear: number;
      }
    | { ok: false; error: string }
  > {
    const years = await this.listYearsForOrg(organization.id);
    if (years.length === 0) {
      return { ok: false, error: '该单位尚无年度工作区，无法结转' };
    }
    const maxYear = Math.max(...years);
    if (sourceYear !== maxYear) {
      return {
        ok: false,
        error: `仅可基于最新年度 ${maxYear} 年新建下一年度`,
      };
    }
    const nextYear = sourceYear + 1;
    if (years.includes(nextYear)) {
      return { ok: false, error: `${nextYear} 年工作区已存在` };
    }

    const sourceRows = await this.client.select<{ id: string }>(
      'SELECT id FROM workspaces WHERE org_id = ? AND year = ?',
      [organization.id, sourceYear],
    );
    if (!sourceRows.length) {
      return { ok: false, error: `未找到 ${sourceYear} 年工作区` };
    }
    const sourceId = str(sourceRows[0]!.id);
    const sourceSnap = await this.loadWorkspace(sourceId);
    if (!sourceSnap) {
      return { ok: false, error: `无法加载 ${sourceYear} 年数据` };
    }

    const nextWorkspaceId = uid('ws');
    const rolled = buildNextYearSnapshot({
      sourceYear,
      nextYear,
      organization,
      sourceWorkspaceId: sourceId,
      nextWorkspaceId,
      employees: sourceSnap.employees,
      monthlyRecords: sourceSnap.monthlyRecords,
      boardLayout: sourceSnap.boardLayout,
      newEmployeeId: () => uid('emp'),
    });

    await this.saveSnapshot(rolled.snapshot);

    return {
      ok: true,
      workspace: rolled.snapshot.workspace,
      inheritedEmployeeCount: rolled.inheritedEmployeeCount,
      skippedEmployeeCount: rolled.skippedEmployeeCount,
      nextYear,
    };
  }

  async listOrganizations(): Promise<
    Array<Organization & { workspaceCount: number }>
  > {
    const rows = await this.client.select<{
      id: string;
      name: string;
      created_at: string;
      ws_count: number;
    }>(
      `SELECT o.id, o.name, o.created_at,
              (SELECT COUNT(*) FROM workspaces w WHERE w.org_id = o.id) AS ws_count
       FROM organizations o
       ORDER BY o.name COLLATE NOCASE`,
    );
    return rows.map((v) => ({
      id: str(v.id),
      name: str(v.name),
      createdAt: str(v.created_at),
      workspaceCount: num(v.ws_count),
    }));
  }

  async createOrganization(name: string): Promise<Organization> {
    const trimmed = name.trim() || '未命名单位';
    const existing = await this.client.select<{
      id: string;
      name: string;
      created_at: string;
    }>('SELECT id, name, created_at FROM organizations WHERE name = ?', [
      trimmed,
    ]);
    if (existing.length) {
      const v = existing[0]!;
      return {
        id: str(v.id),
        name: str(v.name),
        createdAt: str(v.created_at),
      };
    }
    const organization: Organization = {
      id: uid('org'),
      name: trimmed,
      createdAt: new Date().toISOString(),
    };
    await this.client.execute(
      'INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)',
      [organization.id, organization.name, organization.createdAt],
    );
    return organization;
  }

  async deleteOrganization(orgId: string): Promise<boolean> {
    const check = await this.client.select<{ id: string }>(
      'SELECT id FROM organizations WHERE id = ?',
      [orgId],
    );
    if (!check.length) return false;

    await this.client.withTransaction(async () => {
      const wsRows = await this.client.select<{ id: string }>(
        'SELECT id FROM workspaces WHERE org_id = ?',
        [orgId],
      );
      for (const row of wsRows) {
        const wsId = str(row.id);
        const empRows = await this.client.select<{ id: string }>(
          'SELECT id FROM employees WHERE workspace_id = ?',
          [wsId],
        );
        for (const emp of empRows) {
          await this.deleteEmployee(str(emp.id));
        }
        await this.client.execute(
          'DELETE FROM board_layouts WHERE workspace_id = ?',
          [wsId],
        );
        await this.client.execute('DELETE FROM workspaces WHERE id = ?', [
          wsId,
        ]);
      }
      await this.client.execute('DELETE FROM organizations WHERE id = ?', [
        orgId,
      ]);
    });
    return true;
  }

  async loadWorkspace(workspaceId: string): Promise<WorkspaceSnapshot | null> {
    const wsRows = await this.client.select<{
      id: string;
      org_id: string;
      year: number;
    }>('SELECT id, org_id, year FROM workspaces WHERE id = ?', [workspaceId]);
    if (!wsRows.length) return null;
    const wv = wsRows[0]!;
    const workspace: Workspace = {
      id: str(wv.id),
      orgId: str(wv.org_id),
      year: num(wv.year),
    };

    const orgRows = await this.client.select<{
      id: string;
      name: string;
      created_at: string;
    }>('SELECT id, name, created_at FROM organizations WHERE id = ?', [
      workspace.orgId,
    ]);
    if (!orgRows.length) return null;
    const ov = orgRows[0]!;
    const organization: Organization = {
      id: str(ov.id),
      name: str(ov.name),
      createdAt: str(ov.created_at),
    };

    const empRows = await this.client.select<{
      id: string;
      workspace_id: string;
      name: string;
      hire_date: string | null;
      leave_date: string | null;
      is_first_time: number;
    }>(
      `SELECT id, workspace_id, name, hire_date, leave_date, is_first_time
       FROM employees WHERE workspace_id = ?`,
      [workspaceId],
    );
    const employees: Employee[] = empRows.map((v) => ({
      id: str(v.id),
      workspaceId: str(v.workspace_id),
      name: str(v.name),
      hireDate: v.hire_date == null ? null : str(v.hire_date),
      leaveDate: v.leave_date == null ? null : str(v.leave_date),
      isFirstTime: num(v.is_first_time) === 1,
    }));

    const monthlyRecords: Record<string, MonthInput[]> = {};
    const bonusRecords: Record<string, number> = {};

    for (const emp of employees) {
      monthlyRecords[emp.id] = emptyYearMonths();
      const mr = await this.client.select<{
        month: number;
        salary: number;
        social_deduct: number;
        special_addl: number;
        other_deduct: number;
        detail_json: string | null;
      }>(
        `SELECT month, salary, social_deduct, special_addl, other_deduct, detail_json
         FROM monthly_records WHERE employee_id = ?`,
        [emp.id],
      );
      for (const row of mr) {
        const month = num(row.month);
        const detailRaw = row.detail_json;
        if (detailRaw != null && String(detailRaw).length > 0) {
          try {
            monthlyRecords[emp.id]![month - 1] = normalizeMonthInput(
              JSON.parse(String(detailRaw)),
            );
            continue;
          } catch {
            /* fall through */
          }
        }
        monthlyRecords[emp.id]![month - 1] = normalizeMonthInput({
          salary: num(row.salary),
          socialDeduct: num(row.social_deduct),
          specialAddl: num(row.special_addl),
          otherDeduct: num(row.other_deduct),
        });
      }
      const br = await this.client.select<{ amount: number }>(
        'SELECT amount FROM bonuses WHERE employee_id = ?',
        [emp.id],
      );
      bonusRecords[emp.id] = br.length ? num(br[0]!.amount) : 0;
    }

    const layoutRows = await this.client.select<{ nodes_json: string }>(
      'SELECT nodes_json FROM board_layouts WHERE workspace_id = ?',
      [workspaceId],
    );
    let boardLayout: BoardLayout = { nodes: defaultBoardNodes() };
    if (layoutRows.length) {
      try {
        const parsed = JSON.parse(String(layoutRows[0]!.nodes_json)) as
          | BoardNode[]
          | BoardLayout;
        if (Array.isArray(parsed)) {
          boardLayout = { nodes: ensureBoardHasAllCards(parsed) };
        } else if (parsed && typeof parsed === 'object') {
          boardLayout = {
            nodes: ensureBoardHasAllCards(
              Array.isArray(parsed.nodes) ? parsed.nodes : defaultBoardNodes(),
            ),
            viewport: parsed.viewport,
          };
        }
      } catch {
        /* keep default */
      }
    }

    return {
      organization,
      workspace,
      employees,
      monthlyRecords,
      bonusRecords,
      boardLayout,
    };
  }

  async saveEmployee(emp: Employee): Promise<void> {
    await this.client.execute(
      `INSERT INTO employees (id, workspace_id, name, hire_date, leave_date, is_first_time)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name=excluded.name,
         hire_date=excluded.hire_date,
         leave_date=excluded.leave_date,
         is_first_time=excluded.is_first_time`,
      [
        emp.id,
        emp.workspaceId,
        emp.name,
        emp.hireDate,
        emp.leaveDate,
        emp.isFirstTime ? 1 : 0,
      ],
    );
  }

  async deleteEmployee(employeeId: string): Promise<void> {
    await this.client.execute(
      'DELETE FROM monthly_records WHERE employee_id = ?',
      [employeeId],
    );
    await this.client.execute('DELETE FROM bonuses WHERE employee_id = ?', [
      employeeId,
    ]);
    await this.client.execute('DELETE FROM employees WHERE id = ?', [
      employeeId,
    ]);
  }

  async saveMonthly(employeeId: string, months: MonthInput[]): Promise<void> {
    for (let i = 0; i < 12; i++) {
      const m = normalizeMonthInput(months[i]);
      const totals = monthDeductTotals(m);
      const id = `${employeeId}_m${i + 1}`;
      await this.client.execute(
        `INSERT INTO monthly_records (id, employee_id, month, salary, social_deduct, special_addl, other_deduct, detail_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(employee_id, month) DO UPDATE SET
           salary=excluded.salary,
           social_deduct=excluded.social_deduct,
           special_addl=excluded.special_addl,
           other_deduct=excluded.other_deduct,
           detail_json=excluded.detail_json`,
        [
          id,
          employeeId,
          i + 1,
          m.salary,
          totals.socialDeduct,
          totals.specialAddl,
          totals.otherDeduct,
          JSON.stringify(m),
        ],
      );
    }
  }

  async saveBonus(employeeId: string, amount: number): Promise<void> {
    await this.client.execute(
      `INSERT INTO bonuses (employee_id, amount) VALUES (?, ?)
       ON CONFLICT(employee_id) DO UPDATE SET amount=excluded.amount`,
      [employeeId, amount],
    );
  }

  async saveLayout(workspaceId: string, layout: BoardLayout): Promise<void> {
    const payload: BoardLayout = {
      nodes: layout.nodes ?? [],
      viewport: layout.viewport,
    };
    await this.client.execute(
      `INSERT INTO board_layouts (workspace_id, nodes_json) VALUES (?, ?)
       ON CONFLICT(workspace_id) DO UPDATE SET nodes_json=excluded.nodes_json`,
      [workspaceId, JSON.stringify(payload)],
    );
  }

  async saveSnapshot(snap: WorkspaceSnapshot): Promise<void> {
    await this.client.withTransaction(async () => {
      await this.client.execute(
        `INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name`,
        [
          snap.organization.id,
          snap.organization.name,
          snap.organization.createdAt,
        ],
      );
      await this.client.execute(
        `INSERT INTO workspaces (id, org_id, year) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET year=excluded.year`,
        [snap.workspace.id, snap.workspace.orgId, snap.workspace.year],
      );

      const existing = await this.client.select<{ id: string }>(
        'SELECT id FROM employees WHERE workspace_id = ?',
        [snap.workspace.id],
      );
      const keep = new Set(snap.employees.map((e) => e.id));
      for (const row of existing) {
        const id = str(row.id);
        if (!keep.has(id)) await this.deleteEmployee(id);
      }

      for (const emp of snap.employees) {
        await this.saveEmployee(emp);
        await this.saveMonthly(
          emp.id,
          snap.monthlyRecords[emp.id] ?? emptyYearMonths(),
        );
        await this.saveBonus(emp.id, snap.bonusRecords[emp.id] ?? 0);
      }
      await this.saveLayout(snap.workspace.id, snap.boardLayout);
    });
  }
}

/** 各卡片类型默认像素尺寸（可自由拖拽边角调整） */
export const DEFAULT_NODE_SIZE: Record<
  BoardNode['type'],
  { width: number; height: number }
> = {
  roster: { width: 360, height: 400 },
  'salary-input': { width: 640, height: 720 },
  'tax-summary': { width: 440, height: 420 },
  'bonus-optimizer': { width: 420, height: 460 },
  insights: { width: 380, height: 480 },
  'all-staff-tax': { width: 920, height: 380 },
};

/**
 * 内置默认画布布局（代码基线）。
 * 用户可通过「保存当前布局为默认」覆盖为个人默认（localStorage）。
 */
export function defaultBoardNodes(): BoardNode[] {
  return [
    {
      id: 'node_roster',
      type: 'roster',
      position: { x: 24, y: 24 },
      width: 360,
      height: 420,
      data: { label: '员工花名册' },
    },
    {
      id: 'node_salary',
      type: 'salary-input',
      position: { x: 408, y: 24 },
      width: 680,
      height: 760,
      data: { label: '月度工资录入' },
    },
    {
      id: 'node_tax',
      type: 'tax-summary',
      position: { x: 1112, y: 24 },
      width: 460,
      height: 440,
      data: { label: '预扣税额汇总' },
    },
    {
      id: 'node_bonus',
      type: 'bonus-optimizer',
      position: { x: 1112, y: 488 },
      width: 460,
      height: 480,
      data: { label: '年终奖优化' },
    },
    {
      id: 'node_insights',
      type: 'insights',
      position: { x: 24, y: 468 },
      width: 360,
      height: 520,
      data: { label: '智能解读' },
    },
    {
      id: 'node_all_staff_tax',
      type: 'all-staff-tax',
      position: { x: 408, y: 808 },
      width: 1164,
      height: 360,
      data: { label: '全员预扣汇总' },
    },
  ];
}

/** 用户自定义默认布局（浏览器 localStorage） */
export const USER_DEFAULT_LAYOUT_KEY = 'taxopt-helper-default-layout';

/** 旧布局缺少新卡片时补全（不覆盖已有节点位置） */
export function ensureBoardHasAllCards(nodes: BoardNode[]): BoardNode[] {
  const defaults = defaultBoardNodes();
  const have = new Set(nodes.map((n) => n.type));
  const extra = defaults.filter((d) => !have.has(d.type));
  if (extra.length === 0) return nodes;
  return [...nodes, ...extra];
}

function cloneLayoutNodes(nodes: BoardNode[]): BoardNode[] {
  return nodes.map((n) => ({
    ...n,
    position: { ...n.position },
    data: { ...n.data },
  }));
}

/**
 * 读取「默认布局」：优先用户保存的，否则内置。
 * Node 测试环境无 localStorage 时回落内置。
 */
export function getDefaultBoardLayout(): BoardLayout {
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(USER_DEFAULT_LAYOUT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as BoardLayout | BoardNode[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return { nodes: ensureBoardHasAllCards(cloneLayoutNodes(parsed)) };
        }
        if (
          parsed &&
          typeof parsed === 'object' &&
          Array.isArray((parsed as BoardLayout).nodes) &&
          (parsed as BoardLayout).nodes.length > 0
        ) {
          const layout = parsed as BoardLayout;
          return {
            nodes: ensureBoardHasAllCards(cloneLayoutNodes(layout.nodes)),
            viewport: layout.viewport
              ? { ...layout.viewport }
              : undefined,
          };
        }
      }
    } catch {
      /* fall through */
    }
  }
  return { nodes: defaultBoardNodes() };
}

/** 将当前布局保存为用户默认（供恢复默认使用） */
export function saveUserDefaultLayout(layout: BoardLayout): void {
  if (typeof localStorage === 'undefined') {
    throw new Error('当前环境无法写入 localStorage');
  }
  const payload: BoardLayout = {
    nodes: ensureBoardHasAllCards(cloneLayoutNodes(layout.nodes ?? [])),
    viewport: layout.viewport ? { ...layout.viewport } : undefined,
  };
  localStorage.setItem(USER_DEFAULT_LAYOUT_KEY, JSON.stringify(payload));
}

/** 清除用户默认布局，恢复内置默认 */
export function clearUserDefaultLayout(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(USER_DEFAULT_LAYOUT_KEY);
}

export function hasUserDefaultLayout(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    const raw = localStorage.getItem(USER_DEFAULT_LAYOUT_KEY);
    return Boolean(raw && raw.length > 2);
  } catch {
    return false;
  }
}
