import type {
  EmployeeYearRecordWorkspace,
  EmploymentIncomeConflictMonths,
  YearRecordUpsertItem,
} from "@dude-tax/core";
import { collectEmploymentIncomeConflictMonths } from "@dude-tax/core";

type ConflictActionKind = "save" | "apply_next_month" | "apply_future_months";

export const collectWorkspaceEmploymentConflictMonths = (
  workspace: Pick<EmployeeYearRecordWorkspace, "hireDate" | "leaveDate" | "taxYear">,
  rows: YearRecordUpsertItem[],
): EmploymentIncomeConflictMonths =>
  collectEmploymentIncomeConflictMonths(
    {
      hireDate: workspace.hireDate,
      leaveDate: workspace.leaveDate,
    },
    workspace.taxYear,
    rows,
  );

export const filterRowsByTaxMonths = (
  rows: YearRecordUpsertItem[],
  targetMonths: number[],
) => {
  const targetMonthSet = new Set(targetMonths);
  return rows.filter((row) => targetMonthSet.has(row.taxMonth));
};

export const resolveWorkspaceRowsAfterSkippingEmploymentConflict = (
  baseRows: YearRecordUpsertItem[],
  originalRows: YearRecordUpsertItem[],
  pendingRows: YearRecordUpsertItem[],
  safeTargetMonths: number[],
  conflictMonths: number[],
) => {
  const safeTargetMonthSet = new Set(safeTargetMonths);
  const conflictMonthSet = new Set(conflictMonths);
  const pendingRowMap = new Map(pendingRows.map((row) => [row.taxMonth, row] as const));
  const originalRowMap = new Map(originalRows.map((row) => [row.taxMonth, row] as const));

  return baseRows.map((row) => {
    if (conflictMonthSet.has(row.taxMonth)) {
      return originalRowMap.get(row.taxMonth) ?? row;
    }

    if (safeTargetMonthSet.has(row.taxMonth)) {
      return pendingRowMap.get(row.taxMonth) ?? row;
    }

    return row;
  });
};

const formatMonths = (months: number[]) => months.map((month) => `${month} 月`).join("、");

const getActionLabel = (actionKind: ConflictActionKind) => {
  if (actionKind === "save") {
    return "保存当前改动";
  }

  if (actionKind === "apply_next_month") {
    return "将本月数据应用到下月";
  }

  return "将本月数据应用到后续月份";
};

export const buildEmploymentConflictDialogMessage = (
  workspace: Pick<EmployeeYearRecordWorkspace, "employeeName" | "hireDate" | "leaveDate">,
  conflict: EmploymentIncomeConflictMonths,
  actionKind: ConflictActionKind,
) => {
  const segments: string[] = [];

  if (workspace.hireDate && conflict.beforeHireMonths.length) {
    segments.push(
      `员工入职日期 ${workspace.hireDate}，${formatMonths(conflict.beforeHireMonths)} 仍录入了收入。`,
    );
  }

  if (workspace.leaveDate && conflict.afterLeaveMonths.length) {
    segments.push(
      `员工离职日期 ${workspace.leaveDate}，${formatMonths(conflict.afterLeaveMonths)} 仍录入了收入。`,
    );
  }

  return {
    title: `${getActionLabel(actionKind)}前确认`,
    description: `${workspace.employeeName} 存在就业月份收入录入冲突。${segments.join(" ")}`,
  };
};
