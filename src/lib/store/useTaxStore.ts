/**
 * Zustand 全局状态：工作区 / 员工 / 月度 / 年终奖 / 画布 / 入职离职确认
 */

import { create } from 'zustand';
import type {
  BoardLayout,
  BoardNode,
  BoardViewport,
  Employee,
  MonthInput,
  Organization,
  PendingConfirm,
  Workspace,
} from '../../types';
import {
  cloneMonth,
  emptyMonth,
  emptyYearMonths,
  type OtherDeductDetail,
  type SocialDeductDetail,
  type SpecialAddlDetail,
} from '../../types';
import { dateToMonth, resolveTaxYearEmployment } from '../utils/date';
import { monthsToZeroOnEmploymentConfirm } from '../utils/hire-leave-zero';
import {
  ensureBoardHasAllCards,
  getDefaultBoardLayout,
  saveUserDefaultLayout,
  type TaxRepository,
} from '../db/repository';
import { createPersistQueue, type PersistQueue } from '../db/persist-queue';
import { formatPersistError } from '../db/sql-client';
import { compareBonusMethods } from '../tax/engine';
import type { BonusCompareResult, MonthCalcResult } from '../../types';
import { createDirtyTracker } from './dirty-tracker';
import { createTaxCalcCache } from './tax-calc-cache';

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
}

/** 模块级：脏追踪 + 计税缓存（跨 action，测试可重置） */
const dirtyTracker = createDirtyTracker();
const taxCalcCache = createTaxCalcCache();

export function getTaxCalcInvokeCount(employeeId: string): number {
  return taxCalcCache.getInvokeCount(employeeId);
}

export function resetTaxCalcInvokeCounts(): void {
  taxCalcCache.resetInvokeCounts();
}

export function getDirtyEmployeeIdsForTests(): string[] {
  return dirtyTracker.getDirtyEmployeeIds();
}

export interface TaxState {
  organization: Organization | null;
  workspace: Workspace | null;
  employees: Record<string, Employee>;
  monthlyRecords: Record<string, MonthInput[]>;
  bonusRecords: Record<string, number>;
  boardLayout: BoardLayout;
  selectedEmployeeId: string | null;
  pendingConfirm: PendingConfirm | null;
  /** 持久 banner 文案（入职/离职确认后） */
  statusBanner: string | null;
  repo: TaxRepository | null;
  hydrated: boolean;
  /**
   * 任意员工数据变更时递增；UI 用其作廉价依赖（避免 JSON.stringify 全量 monthlyRecords）
   */
  dataEpoch: number;

  // actions
  setRepo: (repo: TaxRepository | null) => void;
  hydrateFromSnapshot: (args: {
    organization: Organization;
    workspace: Workspace;
    employees: Employee[];
    monthlyRecords: Record<string, MonthInput[]>;
    bonusRecords: Record<string, number>;
    boardLayout: BoardLayout;
  }) => void;
  /**
   * 测试/工具：创建带示例员工的单位。
   * 正式首次启动请用 enterEmptyState，勿自动建「默认单位」。
   */
  bootstrapDefault: (orgName?: string, year?: number) => void;
  /** 无单位空壳：hydrated=true，引导用户自行创建单位 */
  enterEmptyState: () => void;
  switchWorkspaceSnapshot: (args: {
    organization: Organization;
    workspace: Workspace;
    employees: Employee[];
    monthlyRecords: Record<string, MonthInput[]>;
    bonusRecords: Record<string, number>;
    boardLayout: BoardLayout;
  }) => void;

  addEmployee: (name: string) => string;
  removeEmployee: (id: string) => void;
  selectEmployee: (id: string | null) => void;
  updateMonthSalary: (
    employeeId: string,
    month: number,
    salary: number,
  ) => void;
  updateMonthFreeIncome: (
    employeeId: string,
    month: number,
    freeIncome: number,
  ) => void;
  updateMonthSocial: (
    employeeId: string,
    month: number,
    field: keyof SocialDeductDetail,
    value: number,
  ) => void;
  updateMonthSpecialAddl: (
    employeeId: string,
    month: number,
    field: keyof SpecialAddlDetail,
    value: number,
  ) => void;
  updateMonthOther: (
    employeeId: string,
    month: number,
    field: keyof OtherDeductDetail,
    value: number,
  ) => void;
  updateMonthDonation: (
    employeeId: string,
    month: number,
    donation: number,
  ) => void;
  updateMonthTaxReduction: (
    employeeId: string,
    month: number,
    taxReduction: number,
  ) => void;
  updateMonthTreatyReduction: (
    employeeId: string,
    month: number,
    treatyReduction: number,
  ) => void;
  /**
   * 工资单个税扣缴（对照台账，不参与引擎）
   * null = 清空未录入
   */
  updateMonthPayrollTaxWithheld: (
    employeeId: string,
    month: number,
    payrollTaxWithheld: number | null,
  ) => void;
  /**
   * 将指定月份的「本期应预扣」批量写入工资单扣缴（对照台账）
   * @param months 1–12，空则不改
   */
  /**
   * 批量将「本期应预扣」写入工资单扣缴。
   * 跳过收入与应预扣均为 0 的闲置月（保持 null，不算已录入）。
   * @returns 实际写入的月份数
   */
  fillPayrollTaxWithheldFromDue: (
    employeeId: string,
    months: number[],
  ) => number;
  /** 将 fromMonth 的工资与全部扣除明细复制到后续月份（fromMonth+1…12）；不复制工资单扣缴 */
  copyMonthToFollowing: (employeeId: string, fromMonth: number) => void;
  /**
   * 批量导入月度工资（按姓名匹配；可选自动新建员工）
   * @returns 导入统计
   */
  applySalaryImport: (
    plan: {
      byEmployeeName: Map<
        string,
        {
          months: Partial<Record<number, MonthInput & { __partial?: boolean }>>;
          bonus: number | null;
        }
      >;
    },
    opts?: { createMissing?: boolean },
  ) => {
    updated: number;
    created: number;
    monthsWritten: number;
    skippedNames: string[];
  };
  setBonus: (employeeId: string, amount: number) => void;
  setIsFirstTime: (employeeId: string, flag: boolean) => void;
  setHireDate: (employeeId: string, dateStr: string) => void;
  setLeaveDate: (employeeId: string, dateStr: string) => void;
  /** 清空离职日期（不弹确认） */
  clearLeaveDate: (employeeId: string) => void;
  confirmPendingAction: () => void;
  cancelPendingAction: () => void;
  updateBoardNodes: (nodes: BoardNode[]) => void;
  updateBoardViewport: (viewport: BoardViewport) => void;
  resetBoardLayout: () => void;
  /** 将当前画布布局（含视口）存为用户默认 */
  saveCurrentLayoutAsDefault: () => void;

  /** 派生计算（纯函数，不写库） */
  getEmployeeCalc: (employeeId: string) => MonthCalcResult[];
  getBonusCompare: (employeeId: string) => BonusCompareResult | null;

  persistNow: () => Promise<void>;
  /** 立即落盘（布局调整 / 关闭页面前） */
  flushPersist: () => Promise<void>;
  /** 最近一次持久化错误（供 UI 提示） */
  lastPersistError: string | null;
}

/** 增量落盘任务（执行时按当前脏集合构建，并捕获 revision 供写后安全清脏） */
export interface IncrementalPersistJob {
  organization: Organization;
  workspace: Workspace;
  dirtyIds: string[];
  removedIds: string[];
  layoutDirty: boolean;
  dirtyEmployees: Employee[];
  monthlyRecords: Record<string, MonthInput[]>;
  bonusRecords: Record<string, number>;
  boardLayout: BoardLayout | null;
  revisionsAtCapture: Record<string, number>;
  removedGensAtCapture: Record<string, number>;
  layoutGenAtCapture: number;
}

export function buildIncrementalPersistJob(
  state: TaxState,
): IncrementalPersistJob | null {
  if (!state.organization || !state.workspace) return null;
  const dirtyIds = dirtyTracker.getDirtyEmployeeIds();
  const removedIds = dirtyTracker.getRemovedEmployeeIds();
  const layoutDirty = dirtyTracker.isLayoutDirty();
  if (dirtyIds.length === 0 && removedIds.length === 0 && !layoutDirty) {
    return null;
  }
  const dirtyEmployees = dirtyIds
    .map((id) => state.employees[id])
    .filter((e): e is Employee => Boolean(e));
  const monthlyRecords: Record<string, MonthInput[]> = {};
  const bonusRecords: Record<string, number> = {};
  const revisionsAtCapture: Record<string, number> = {};
  for (const id of dirtyIds) {
    monthlyRecords[id] = state.monthlyRecords[id] ?? emptyYearMonths();
    bonusRecords[id] = state.bonusRecords[id] ?? 0;
    revisionsAtCapture[id] = dirtyTracker.getEmployeeRevision(id);
  }
  const removedGensAtCapture: Record<string, number> = {};
  for (const id of removedIds) {
    removedGensAtCapture[id] = dirtyTracker.getRemovedGeneration(id);
  }
  return {
    organization: state.organization,
    workspace: state.workspace,
    dirtyIds,
    removedIds,
    layoutDirty,
    dirtyEmployees,
    monthlyRecords,
    bonusRecords,
    boardLayout: layoutDirty ? state.boardLayout : null,
    revisionsAtCapture,
    removedGensAtCapture,
    layoutGenAtCapture: dirtyTracker.getLayoutGeneration(),
  };
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
/** 布局/视口写库防抖（避免拖拽时全量 snapshot 过频） */
let layoutPersistTimer: ReturnType<typeof setTimeout> | null = null;

/** 模块级串行写队列（单 store 进程） */
let persistQueue: PersistQueue | null = null;

function getPersistQueue(
  get: () => TaxState,
  set: (p: Partial<TaxState>) => void,
): PersistQueue {
  if (!persistQueue) {
    persistQueue = createPersistQueue<IncrementalPersistJob>(
      () => buildIncrementalPersistJob(get()),
      async (job) => {
        const repo = get().repo;
        if (!repo || !job) return;
        try {
          await repo.saveIncremental({
            organization: job.organization,
            workspace: job.workspace,
            dirtyEmployees: job.dirtyEmployees,
            monthlyRecords: job.monthlyRecords,
            bonusRecords: job.bonusRecords,
            removedIds: job.removedIds,
            boardLayout: job.boardLayout,
          });
          dirtyTracker.clearAfterWrite({
            dirtyIds: job.dirtyIds,
            removedIds: job.removedIds,
            layout: job.layoutDirty,
            revisionsAtCapture: job.revisionsAtCapture,
            removedGensAtCapture: job.removedGensAtCapture,
            layoutGenAtCapture: job.layoutGenAtCapture,
          });
          if (get().lastPersistError) set({ lastPersistError: null });
        } catch (e) {
          const msg = formatPersistError(e);
          set({ lastPersistError: msg });
          console.error('persistNow failed', e);
          throw e;
        }
      },
    );
  }
  return persistQueue;
}

/** 测试用：重置写队列与脏/缓存状态 */
export function resetPersistQueueForTests(): void {
  persistQueue = null;
  dirtyTracker.reset();
  taxCalcCache.clear();
  taxCalcCache.resetInvokeCounts();
}

function bumpDirty(employeeId: string): { dataEpoch: number } {
  dirtyTracker.markEmployee(employeeId);
  taxCalcCache.invalidate(employeeId);
  return { dataEpoch: dirtyTracker.getDataEpoch() };
}

/** 台账字段（工资单扣缴）落盘脏：刷新 UI epoch，不失效税缓存 */
function bumpDirtyLedgerOnly(employeeId: string): { dataEpoch: number } {
  dirtyTracker.markEmployeePersistOnly(employeeId);
  return { dataEpoch: dirtyTracker.getDataEpoch() };
}

function schedulePersist(get: () => TaxState) {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void get()
      .persistNow()
      .catch((e) => console.error('persist failed', e));
  }, 500);
}

function scheduleLayoutPersist(get: () => TaxState) {
  dirtyTracker.markLayout();
  if (layoutPersistTimer) clearTimeout(layoutPersistTimer);
  layoutPersistTimer = setTimeout(() => {
    layoutPersistTimer = null;
    void get()
      .persistNow()
      .catch((e) => console.error('layout persist failed', e));
  }, 400);
}

async function flushPersistTimer(get: () => TaxState): Promise<void> {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (layoutPersistTimer) {
    clearTimeout(layoutPersistTimer);
    layoutPersistTimer = null;
  }
  await get().persistNow();
}

export const useTaxStore = create<TaxState>((set, get) => ({
  organization: null,
  workspace: null,
  employees: {},
  monthlyRecords: {},
  bonusRecords: {},
  boardLayout: getDefaultBoardLayout(),
  selectedEmployeeId: null,
  pendingConfirm: null,
  statusBanner: null,
  repo: null,
  hydrated: false,
  lastPersistError: null,
  dataEpoch: 0,

  setRepo: (repo) => set({ repo }),

  hydrateFromSnapshot: (args) => {
    dirtyTracker.reset();
    taxCalcCache.clear();
    const map: Record<string, Employee> = {};
    for (const e of args.employees) map[e.id] = e;
    const rawNodes = args.boardLayout.nodes?.length
      ? args.boardLayout.nodes
      : getDefaultBoardLayout().nodes;
    const nodes = ensureBoardHasAllCards(rawNodes);
    const layoutPatched = nodes.length !== rawNodes.length;
    set({
      organization: args.organization,
      workspace: args.workspace,
      employees: map,
      monthlyRecords: args.monthlyRecords,
      bonusRecords: args.bonusRecords,
      dataEpoch: dirtyTracker.getDataEpoch(),
      boardLayout: {
        nodes,
        viewport: args.boardLayout.viewport,
      },
      selectedEmployeeId: args.employees[0]?.id ?? null,
      pendingConfirm: null,
      hydrated: true,
    });
    // 补全新卡片后写回，避免下次启动又缺卡
    if (layoutPatched && get().repo) {
      dirtyTracker.markLayout();
      void flushPersistTimer(get);
    }
  },

  bootstrapDefault: (orgName = '默认单位', year = new Date().getFullYear()) => {
    dirtyTracker.reset();
    taxCalcCache.clear();
    const orgId = newId('org');
    const wsId = newId('ws');
    const empId = newId('emp');
    const organization: Organization = {
      id: orgId,
      name: orgName,
      createdAt: new Date().toISOString(),
    };
    const workspace: Workspace = { id: wsId, orgId, year };
    const employee: Employee = {
      id: empId,
      workspaceId: wsId,
      name: '示例员工',
      hireDate: `${year}-01-01`,
      leaveDate: null,
      isFirstTime: false,
    };
    const months = emptyYearMonths();
    for (let i = 0; i < 12; i++) {
      months[i] = { ...emptyMonth(), salary: 10_000 };
    }
    dirtyTracker.markEmployee(empId);
    dirtyTracker.markLayout();
    set({
      organization,
      workspace,
      employees: { [empId]: employee },
      monthlyRecords: { [empId]: months },
      bonusRecords: { [empId]: 0 },
      boardLayout: getDefaultBoardLayout(),
      selectedEmployeeId: empId,
      pendingConfirm: null,
      statusBanner: null,
      hydrated: true,
      dataEpoch: dirtyTracker.getDataEpoch(),
    });
    schedulePersist(get);
  },

  enterEmptyState: () => {
    dirtyTracker.reset();
    taxCalcCache.clear();
    set({
      organization: null,
      workspace: null,
      employees: {},
      monthlyRecords: {},
      bonusRecords: {},
      boardLayout: getDefaultBoardLayout(),
      selectedEmployeeId: null,
      pendingConfirm: null,
      statusBanner: null,
      lastPersistError: null,
      hydrated: true,
      dataEpoch: dirtyTracker.getDataEpoch(),
    });
  },

  switchWorkspaceSnapshot: (args) => {
    get().hydrateFromSnapshot(args);
  },

  addEmployee: (name) => {
    const ws = get().workspace;
    if (!ws) return '';
    const id = newId('emp');
    const emp: Employee = {
      id,
      workspaceId: ws.id,
      name: name || '新员工',
      hireDate: `${ws.year}-01-01`,
      leaveDate: null,
      isFirstTime: false,
    };
    const epoch = bumpDirty(id);
    set((s) => ({
      employees: { ...s.employees, [id]: emp },
      monthlyRecords: { ...s.monthlyRecords, [id]: emptyYearMonths() },
      bonusRecords: { ...s.bonusRecords, [id]: 0 },
      selectedEmployeeId: id,
      ...epoch,
    }));
    schedulePersist(get);
    return id;
  },

  removeEmployee: (id) => {
    dirtyTracker.markRemoved(id);
    taxCalcCache.invalidate(id);
    set((s) => {
      const { [id]: _, ...employees } = s.employees;
      const { [id]: __, ...monthlyRecords } = s.monthlyRecords;
      const { [id]: ___, ...bonusRecords } = s.bonusRecords;
      const selected =
        s.selectedEmployeeId === id
          ? Object.keys(employees)[0] ?? null
          : s.selectedEmployeeId;
      return {
        employees,
        monthlyRecords,
        bonusRecords,
        selectedEmployeeId: selected,
        dataEpoch: dirtyTracker.getDataEpoch(),
      };
    });
    schedulePersist(get);
  },

  selectEmployee: (id) => set({ selectedEmployeeId: id }),

  updateMonthSalary: (employeeId, month, salary) => {
    if (month < 1 || month > 12) return;
    const v = Math.max(0, Number(salary) || 0);
    const epoch = bumpDirty(employeeId);
    set((s) => {
      const months = [...(s.monthlyRecords[employeeId] ?? emptyYearMonths())];
      const cur = cloneMonth(months[month - 1] ?? emptyMonth());
      cur.salary = v;
      months[month - 1] = cur;
      return {
        monthlyRecords: { ...s.monthlyRecords, [employeeId]: months },
        ...epoch,
      };
    });
    schedulePersist(get);
  },

  updateMonthFreeIncome: (employeeId, month, freeIncome) => {
    if (month < 1 || month > 12) return;
    const v = Math.max(0, Number(freeIncome) || 0);
    const epoch = bumpDirty(employeeId);
    set((s) => {
      const months = [...(s.monthlyRecords[employeeId] ?? emptyYearMonths())];
      const cur = cloneMonth(months[month - 1] ?? emptyMonth());
      cur.freeIncome = v;
      months[month - 1] = cur;
      return {
        monthlyRecords: { ...s.monthlyRecords, [employeeId]: months },
        ...epoch,
      };
    });
    schedulePersist(get);
  },

  updateMonthSocial: (employeeId, month, field, value) => {
    if (month < 1 || month > 12) return;
    const v = Math.max(0, Number(value) || 0);
    const epoch = bumpDirty(employeeId);
    set((s) => {
      const months = [...(s.monthlyRecords[employeeId] ?? emptyYearMonths())];
      const cur = cloneMonth(months[month - 1] ?? emptyMonth());
      cur.social = { ...cur.social, [field]: v };
      months[month - 1] = cur;
      return {
        monthlyRecords: { ...s.monthlyRecords, [employeeId]: months },
        ...epoch,
      };
    });
    schedulePersist(get);
  },

  updateMonthSpecialAddl: (employeeId, month, field, value) => {
    if (month < 1 || month > 12) return;
    const v = Math.max(0, Number(value) || 0);
    const epoch = bumpDirty(employeeId);
    set((s) => {
      const months = [...(s.monthlyRecords[employeeId] ?? emptyYearMonths())];
      const cur = cloneMonth(months[month - 1] ?? emptyMonth());
      cur.specialAddl = { ...cur.specialAddl, [field]: v };
      months[month - 1] = cur;
      return {
        monthlyRecords: { ...s.monthlyRecords, [employeeId]: months },
        ...epoch,
      };
    });
    schedulePersist(get);
  },

  updateMonthOther: (employeeId, month, field, value) => {
    if (month < 1 || month > 12) return;
    const v = Math.max(0, Number(value) || 0);
    const epoch = bumpDirty(employeeId);
    set((s) => {
      const months = [...(s.monthlyRecords[employeeId] ?? emptyYearMonths())];
      const cur = cloneMonth(months[month - 1] ?? emptyMonth());
      cur.other = { ...cur.other, [field]: v };
      months[month - 1] = cur;
      return {
        monthlyRecords: { ...s.monthlyRecords, [employeeId]: months },
        ...epoch,
      };
    });
    schedulePersist(get);
  },

  updateMonthDonation: (employeeId, month, donation) => {
    if (month < 1 || month > 12) return;
    const v = Math.max(0, Number(donation) || 0);
    const epoch = bumpDirty(employeeId);
    set((s) => {
      const months = [...(s.monthlyRecords[employeeId] ?? emptyYearMonths())];
      const cur = cloneMonth(months[month - 1] ?? emptyMonth());
      cur.donation = v;
      months[month - 1] = cur;
      return {
        monthlyRecords: { ...s.monthlyRecords, [employeeId]: months },
        ...epoch,
      };
    });
    schedulePersist(get);
  },

  updateMonthTaxReduction: (employeeId, month, taxReduction) => {
    if (month < 1 || month > 12) return;
    const v = Math.max(0, Number(taxReduction) || 0);
    const epoch = bumpDirty(employeeId);
    set((s) => {
      const months = [...(s.monthlyRecords[employeeId] ?? emptyYearMonths())];
      const cur = cloneMonth(months[month - 1] ?? emptyMonth());
      cur.taxReduction = v;
      months[month - 1] = cur;
      return {
        monthlyRecords: { ...s.monthlyRecords, [employeeId]: months },
        ...epoch,
      };
    });
    schedulePersist(get);
  },

  updateMonthTreatyReduction: (employeeId, month, treatyReduction) => {
    if (month < 1 || month > 12) return;
    const v = Math.max(0, Number(treatyReduction) || 0);
    const epoch = bumpDirty(employeeId);
    set((s) => {
      const months = [...(s.monthlyRecords[employeeId] ?? emptyYearMonths())];
      const cur = cloneMonth(months[month - 1] ?? emptyMonth());
      cur.treatyReduction = v;
      months[month - 1] = cur;
      return {
        monthlyRecords: { ...s.monthlyRecords, [employeeId]: months },
        ...epoch,
      };
    });
    schedulePersist(get);
  },

  updateMonthPayrollTaxWithheld: (employeeId, month, payrollTaxWithheld) => {
    if (month < 1 || month > 12) return;
    const v =
      payrollTaxWithheld == null || !Number.isFinite(Number(payrollTaxWithheld))
        ? null
        : Math.max(0, Number(payrollTaxWithheld));
    const epoch = bumpDirtyLedgerOnly(employeeId);
    set((s) => {
      const months = [...(s.monthlyRecords[employeeId] ?? emptyYearMonths())];
      const cur = cloneMonth(months[month - 1] ?? emptyMonth());
      cur.payrollTaxWithheld = v;
      months[month - 1] = cur;
      return {
        monthlyRecords: { ...s.monthlyRecords, [employeeId]: months },
        ...epoch,
      };
    });
    schedulePersist(get);
  },

  fillPayrollTaxWithheldFromDue: (employeeId, months) => {
    const targets = [
      ...new Set(
        months
          .map((m) => Number(m))
          .filter((m) => Number.isInteger(m) && m >= 1 && m <= 12),
      ),
    ];
    if (targets.length === 0) return 0;
    if (!get().employees[employeeId]) return 0;
    const calc = get().getEmployeeCalc(employeeId);
    const current =
      get().monthlyRecords[employeeId] ?? emptyYearMonths();
    const toWrite: { month: number; due: number }[] = [];
    for (const month of targets) {
      const due = calc[month - 1]?.thisMonthTax ?? 0;
      const salary = current[month - 1]?.salary ?? 0;
      // 闲置月（无收入且应预扣为 0）：保持未录入，勿写入 0
      if (salary <= 0 && due <= 0) continue;
      toWrite.push({ month, due: Math.max(0, due) });
    }
    if (toWrite.length === 0) return 0;
    const epoch = bumpDirtyLedgerOnly(employeeId);
    set((s) => {
      const yearMonths = [
        ...(s.monthlyRecords[employeeId] ?? emptyYearMonths()),
      ].map((m) => cloneMonth(m));
      for (const { month, due } of toWrite) {
        const cur = cloneMonth(yearMonths[month - 1] ?? emptyMonth());
        cur.payrollTaxWithheld = due;
        yearMonths[month - 1] = cur;
      }
      return {
        monthlyRecords: { ...s.monthlyRecords, [employeeId]: yearMonths },
        ...epoch,
      };
    });
    schedulePersist(get);
    return toWrite.length;
  },

  copyMonthToFollowing: (employeeId, fromMonth) => {
    if (fromMonth < 1 || fromMonth > 11) return;
    const epoch = bumpDirty(employeeId);
    set((s) => {
      const months = [...(s.monthlyRecords[employeeId] ?? emptyYearMonths())];
      const src = cloneMonth(months[fromMonth - 1] ?? emptyMonth());
      // 工资/扣除可复制；工资单扣缴每月独立，保留目标月原值
      for (let m = fromMonth + 1; m <= 12; m++) {
        const prevWithheld =
          months[m - 1]?.payrollTaxWithheld ?? null;
        const dest = cloneMonth(src);
        dest.payrollTaxWithheld =
          prevWithheld == null || !Number.isFinite(prevWithheld)
            ? null
            : Math.max(0, prevWithheld);
        months[m - 1] = dest;
      }
      return {
        monthlyRecords: { ...s.monthlyRecords, [employeeId]: months },
        ...epoch,
      };
    });
    schedulePersist(get);
  },

  applySalaryImport: (plan, opts) => {
    const createMissing = opts?.createMissing !== false;
    const ws = get().workspace;
    if (!ws) {
      return { updated: 0, created: 0, monthsWritten: 0, skippedNames: [] };
    }

    let updated = 0;
    let created = 0;
    let monthsWritten = 0;
    const skippedNames: string[] = [];

    set((s) => {
      const employees = { ...s.employees };
      const monthlyRecords = { ...s.monthlyRecords };
      const bonusRecords = { ...s.bonusRecords };

      // 姓名 → id（同名取先出现的）
      const nameToId = new Map<string, string>();
      for (const emp of Object.values(employees)) {
        if (!nameToId.has(emp.name)) nameToId.set(emp.name, emp.id);
      }

      for (const [name, entry] of plan.byEmployeeName) {
        let empId = nameToId.get(name);
        if (!empId) {
          if (!createMissing) {
            skippedNames.push(name);
            continue;
          }
          empId = newId('emp');
          const year = ws.year;
          employees[empId] = {
            id: empId,
            workspaceId: ws.id,
            name,
            hireDate: `${year}-01-01`,
            leaveDate: null,
            isFirstTime: false,
          };
          monthlyRecords[empId] = emptyYearMonths();
          bonusRecords[empId] = 0;
          nameToId.set(name, empId);
          created += 1;
        } else {
          updated += 1;
        }

        const months = [
          ...(monthlyRecords[empId] ?? emptyYearMonths()).map((m) =>
            cloneMonth(m),
          ),
        ];
        for (const [monthStr, data] of Object.entries(entry.months)) {
          const month = Number(monthStr);
          if (month < 1 || month > 12 || !data) continue;
          // PartialMonthPatch：仅覆盖有值的字段；空单元格不把原数据抹 0
          const patch = data as MonthInput & { __partial?: boolean };
          if (patch.__partial) {
            months[month - 1] = mergeMonthPatch(
              months[month - 1] ?? emptyMonth(),
              patch,
            );
          } else {
            months[month - 1] = cloneMonth(data);
          }
          monthsWritten += 1;
        }
        monthlyRecords[empId] = months;

        if (entry.bonus != null) {
          bonusRecords[empId] = Math.max(0, Number(entry.bonus) || 0);
        }
        dirtyTracker.markEmployee(empId);
        taxCalcCache.invalidate(empId);
      }

      return {
        employees,
        monthlyRecords,
        bonusRecords,
        dataEpoch: dirtyTracker.getDataEpoch(),
      };
    });

    schedulePersist(get);
    return { updated, created, monthsWritten, skippedNames };
  },

  setBonus: (employeeId, amount) => {
    const epoch = bumpDirty(employeeId);
    set((s) => ({
      bonusRecords: {
        ...s.bonusRecords,
        [employeeId]: Math.max(0, Number(amount) || 0),
      },
      ...epoch,
    }));
    schedulePersist(get);
  },

  setIsFirstTime: (employeeId, flag) => {
    const epoch = bumpDirty(employeeId);
    set((s) => {
      const emp = s.employees[employeeId];
      if (!emp) return s;
      return {
        employees: {
          ...s.employees,
          [employeeId]: { ...emp, isFirstTime: flag },
        },
        ...epoch,
      };
    });
    schedulePersist(get);
  },

  setHireDate: (employeeId, dateStr) => {
    if (!get().employees[employeeId]) return;
    const targetMonth = dateToMonth(dateStr);
    set({
      pendingConfirm: {
        employeeId,
        type: 'hire',
        targetMonth,
        proposedDate: dateStr,
      },
    });
  },

  setLeaveDate: (employeeId, dateStr) => {
    if (!get().employees[employeeId]) return;
    if (!dateStr) {
      get().clearLeaveDate(employeeId);
      return;
    }
    const targetMonth = dateToMonth(dateStr);
    set({
      pendingConfirm: {
        employeeId,
        type: 'leave',
        targetMonth,
        proposedDate: dateStr,
      },
    });
  },

  clearLeaveDate: (employeeId) => {
    const epoch = bumpDirty(employeeId);
    set((s) => {
      const emp = s.employees[employeeId];
      if (!emp) return s;
      return {
        employees: {
          ...s.employees,
          [employeeId]: { ...emp, leaveDate: null },
        },
        ...epoch,
      };
    });
    schedulePersist(get);
  },

  cancelPendingAction: () => set({ pendingConfirm: null }),

  confirmPendingAction: () => {
    const p = get().pendingConfirm;
    if (!p) return;
    const emp = get().employees[p.employeeId];
    if (!emp) {
      set({ pendingConfirm: null });
      return;
    }
    const taxYear = get().workspace?.year ?? new Date().getFullYear();
    const otherDate =
      p.type === 'hire' ? emp.leaveDate : emp.hireDate;
    const zeroMonths = monthsToZeroOnEmploymentConfirm(
      p.type,
      p.proposedDate,
      taxYear,
      otherDate,
    );

    set((s) => {
      const months = [...(s.monthlyRecords[p.employeeId] ?? emptyYearMonths())];
      for (const m of zeroMonths) {
        months[m - 1] = emptyMonth();
      }

      const updated: Employee = {
        ...emp,
        hireDate:
          p.type === 'hire' ? p.proposedDate : emp.hireDate,
        leaveDate:
          p.type === 'leave' ? p.proposedDate : emp.leaveDate,
      };

      const scope = resolveTaxYearEmployment(
        updated.hireDate,
        updated.leaveDate,
        taxYear,
        updated.isFirstTime,
      );
      const banner =
        p.type === 'leave'
          ? zeroMonths.length === 0
            ? `该员工离职日在 ${taxYear} 年之后，本工作年度月度数据未清零（年终奖仍可录入）。`
            : `该员工按 ${taxYear} 年口径于 ${scope.leaveMonth ?? p.targetMonth} 月离职，后续月份工资与扣除已自动清零（年终奖仍可录入）。`
          : zeroMonths.length === 0
            ? `该员工入职日早于 ${taxYear} 年，本工作年度月度数据未清零。`
            : `该员工按 ${taxYear} 年口径于 ${scope.hireMonth >= 13 ? '—' : scope.hireMonth} 月入职，对应之前月份已自动处理为无收入。`;

      dirtyTracker.markEmployee(p.employeeId);
      taxCalcCache.invalidate(p.employeeId);
      return {
        employees: { ...s.employees, [p.employeeId]: updated },
        monthlyRecords: { ...s.monthlyRecords, [p.employeeId]: months },
        pendingConfirm: null,
        statusBanner: banner,
        dataEpoch: dirtyTracker.getDataEpoch(),
      };
    });
    schedulePersist(get);
  },

  updateBoardNodes: (nodes) => {
    set((s) => ({
      boardLayout: {
        nodes,
        viewport: s.boardLayout.viewport,
      },
    }));
    // 布局防抖落盘，避免拖拽过程中频繁全量 snapshot
    scheduleLayoutPersist(get);
  },

  updateBoardViewport: (viewport) => {
    set((s) => ({
      boardLayout: {
        nodes: s.boardLayout.nodes,
        viewport: { ...viewport },
      },
    }));
    scheduleLayoutPersist(get);
  },

  resetBoardLayout: () => {
    dirtyTracker.markLayout();
    set({ boardLayout: getDefaultBoardLayout() });
    void flushPersistTimer(get);
  },

  saveCurrentLayoutAsDefault: () => {
    const layout = get().boardLayout;
    saveUserDefaultLayout(layout);
  },

  getEmployeeCalc: (employeeId) => {
    const s = get();
    const emp = s.employees[employeeId];
    if (!emp) return [];
    const months = s.monthlyRecords[employeeId] ?? emptyYearMonths();
    const taxYear = s.workspace?.year ?? new Date().getFullYear();
    return taxCalcCache.getOrCompute(employeeId, {
      employee: emp,
      months,
      taxYear,
      revision: dirtyTracker.getEmployeeRevision(employeeId),
    });
  },

  getBonusCompare: (employeeId) => {
    const s = get();
    const bonus = s.bonusRecords[employeeId] ?? 0;
    const months = s.getEmployeeCalc(employeeId);
    if (!months.length) return null;
    return compareBonusMethods(months, bonus);
  },

  persistNow: async () => {
    const s = get();
    if (!s.repo || !s.organization || !s.workspace) return;
    await getPersistQueue(get, set).enqueue();
  },

  flushPersist: async () => {
    await flushPersistTimer(get);
  },
}));

/** 合并 CSV 部分字段补丁：未提供的字段（NaN 哨兵）保留原值 */
export function mergeMonthPatch(
  base: MonthInput,
  patch: MonthInput,
): MonthInput {
  const b = cloneMonth(base);
  const keep = (v: number) => Number.isNaN(v);
  if (!keep(patch.salary)) b.salary = patch.salary;
  if (!keep(patch.freeIncome)) b.freeIncome = patch.freeIncome;
  if (!keep(patch.donation)) b.donation = patch.donation;
  if (!keep(patch.taxReduction)) b.taxReduction = patch.taxReduction;
  if (!keep(patch.treatyReduction)) b.treatyReduction = patch.treatyReduction;

  // 工资单扣缴：NaN（FIELD_ABSENT）= 未提供保留；有限数字写入
  const pWithheld = patch.payrollTaxWithheld;
  if (
    typeof pWithheld === 'number' &&
    !Number.isNaN(pWithheld) &&
    Number.isFinite(pWithheld)
  ) {
    b.payrollTaxWithheld = Math.max(0, pWithheld);
  }

  for (const k of Object.keys(b.social) as (keyof typeof b.social)[]) {
    const v = patch.social[k];
    if (!keep(v)) b.social[k] = v;
  }
  for (const k of Object.keys(b.specialAddl) as (keyof typeof b.specialAddl)[]) {
    const v = patch.specialAddl[k];
    if (!keep(v)) b.specialAddl[k] = v;
  }
  for (const k of Object.keys(b.other) as (keyof typeof b.other)[]) {
    const v = patch.other[k];
    if (!keep(v)) b.other[k] = v;
  }
  return b;
}

/** 测试辅助：同步创建隔离 store 状态（不依赖 React） */
export function createIsolatedStoreState(
  partial?: Partial<TaxState>,
): TaxState {
  resetPersistQueueForTests();
  // 使用真实 store 的 getState 并重置
  useTaxStore.setState({
    organization: null,
    workspace: null,
    employees: {},
    monthlyRecords: {},
    bonusRecords: {},
    boardLayout: getDefaultBoardLayout(),
    selectedEmployeeId: null,
    pendingConfirm: null,
    statusBanner: null,
    repo: null,
    hydrated: false,
    lastPersistError: null,
    dataEpoch: 0,
    ...partial,
  });
  return useTaxStore.getState();
}
