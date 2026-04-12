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
