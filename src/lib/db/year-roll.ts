/**
 * 年度结转：新建下一年度时，继承上一年度期末在职人员与期末月度明细
 */

import type {
  BoardLayout,
  Employee,
  MonthInput,
  Organization,
  Workspace,
} from '../../types';
import {
  cloneMonth,
  emptyMonth,
  emptyYearMonths,
  monthDeductTotals,
} from '../../types';
import { parseToYmd } from '../utils/date';

/** 与 repository.WorkspaceSnapshot 结构一致（避免循环依赖） */
export interface YearRollSnapshot {
  organization: Organization;
  workspace: Workspace;
  employees: Employee[];
  monthlyRecords: Record<string, MonthInput[]>;
  bonusRecords: Record<string, number>;
  boardLayout: BoardLayout;
}

/** 该员工在 sourceYear 年末是否仍在职（可结转至下一年） */
export function isEmployedAtYearEnd(
  emp: Pick<Employee, 'leaveDate'>,
  sourceYear: number,
): boolean {
  if (!emp.leaveDate) return true;
  const ld = parseToYmd(emp.leaveDate);
  if (!ld) return true;
  // 离职日在源年度内或更早 → 年末不在职
  if (ld.year < sourceYear) return false;
  if (ld.year === sourceYear) return false;
  // 离职日在源年度之后 → 仍可结转
  return true;
}

/** 月度是否有有效金额（用于回溯期末快照） */
export function monthHasAmounts(m: MonthInput): boolean {
  if (!m) return false;
  if ((m.salary || 0) > 0) return true;
  if ((m.freeIncome || 0) > 0) return true;
  if ((m.donation || 0) > 0) return true;
  if ((m.taxReduction || 0) > 0) return true;
  if ((m.treatyReduction || 0) > 0) return true;
  const t = monthDeductTotals(m);
  return t.socialDeduct > 0 || t.specialAddl > 0 || t.otherDeduct > 0;
}

/**
 * 取源年度期末月度快照：优先 12 月，若为空则向前回溯有数的月份
 */
export function pickYearEndMonthSnapshot(
  months: MonthInput[] | undefined,
): MonthInput {
  const list = months && months.length === 12 ? months : emptyYearMonths();
  for (let i = 11; i >= 0; i--) {
    const m = list[i] ?? emptyMonth();
    if (monthHasAmounts(m)) return cloneMonth(m);
  }
  // 全年无数据也继承 12 月结构（全 0）
  return cloneMonth(list[11] ?? emptyMonth());
}

/** 将期末快照铺满新年度 12 个月 */
export function fillYearFromSnapshot(snapshot: MonthInput): MonthInput[] {
  const base = cloneMonth(snapshot);
  return Array.from({ length: 12 }, () => cloneMonth(base));
}

export interface YearRollInput {
  sourceYear: number;
  nextYear: number;
  organization: Organization;
  sourceWorkspaceId: string;
  /** 新工作区 id（由调用方生成） */
  nextWorkspaceId: string;
  employees: Employee[];
  monthlyRecords: Record<string, MonthInput[]>;
  boardLayout: BoardLayout;
  /** 生成新员工 id */
  newEmployeeId: () => string;
}

export interface YearRollResult {
  snapshot: YearRollSnapshot;
  inheritedEmployeeCount: number;
  skippedEmployeeCount: number;
}

/**
 * 纯函数：由源年度快照生成下一年度快照（继承期末在职 + 期末月度明细）
 *
 * 规则：
 * - 仅结转源年度末仍在职员工
 * - 入职日期保留；离职日期仅当落在下一年度及以后时保留
 * - isFirstTime 置 false（上年已取得工资薪金）
 * - 月度：以期末快照填充 1–12 月，便于继续填报
 * - 年终奖不继承（置 0）
 * - 画布布局复制
 */
export function buildNextYearSnapshot(input: YearRollInput): YearRollResult {
  const {
    sourceYear,
    nextYear,
    organization,
    nextWorkspaceId,
    employees,
    monthlyRecords,
    boardLayout,
    newEmployeeId,
  } = input;

  const nextWorkspace: Workspace = {
    id: nextWorkspaceId,
    orgId: organization.id,
    year: nextYear,
  };

  const nextEmployees: Employee[] = [];
  const nextMonthly: Record<string, MonthInput[]> = {};
  const nextBonus: Record<string, number> = {};
  let skipped = 0;

  for (const emp of employees) {
    if (!isEmployedAtYearEnd(emp, sourceYear)) {
      skipped += 1;
      continue;
    }

    const newId = newEmployeeId();
    let leaveDate = emp.leaveDate;
    if (leaveDate) {
      const ld = parseToYmd(leaveDate);
      // 离职在下一年度之前的已在 isEmployedAtYearEnd 过滤
      // 保留下一年度及以后的离职日
      if (ld && ld.year < nextYear) {
        leaveDate = null;
      }
    }

    nextEmployees.push({
      id: newId,
      workspaceId: nextWorkspaceId,
      name: emp.name,
      hireDate: emp.hireDate,
      leaveDate,
      isFirstTime: false,
    });

    const endSnap = pickYearEndMonthSnapshot(monthlyRecords[emp.id]);
    nextMonthly[newId] = fillYearFromSnapshot(endSnap);
    nextBonus[newId] = 0;
  }

  // 布局：复制节点尺寸位置，清除可能挂着的员工 id
  const layout: BoardLayout = {
    nodes: (boardLayout.nodes ?? []).map((n) => ({
      ...n,
      data: { ...n.data, employeeId: undefined },
    })),
    viewport: boardLayout.viewport
      ? { ...boardLayout.viewport }
      : undefined,
  };

  return {
    snapshot: {
      organization,
      workspace: nextWorkspace,
      employees: nextEmployees,
      monthlyRecords: nextMonthly,
      bonusRecords: nextBonus,
      boardLayout: layout,
    },
    inheritedEmployeeCount: nextEmployees.length,
    skippedEmployeeCount: skipped,
  };
}
