import type { EmployeeMonthRecord } from "../../../../packages/core/src/index";
import { hasMonthRecordContent } from "./month-record-copy";

export type MonthProgressStatus = "not_started" | "draft" | "completed";

export type MonthRecordSummary = {
  total: number;
  completed: number;
  draft: number;
  notStarted: number;
  recorded: number;
  completionRate: number;
};

export const getMonthProgressStatus = (
  record: EmployeeMonthRecord | null,
): MonthProgressStatus => {
  if (!record) {
    return "not_started";
  }

  if (record.status === "completed") {
    return "completed";
  }

  if (hasMonthRecordContent(record)) {
    return "draft";
  }

  return "not_started";
};

export const buildMonthRecordSummary = (
  records: EmployeeMonthRecord[],
): MonthRecordSummary => {
  const total = records.length;
  const completed = records.filter((record) => getMonthProgressStatus(record) === "completed").length;
  const draft = records.filter((record) => getMonthProgressStatus(record) === "draft").length;
  const notStarted = total - completed - draft;
  const recorded = completed + draft;

  return {
    total,
    completed,
    draft,
    notStarted,
    recorded,
    completionRate: total ? Math.round((completed / total) * 100) : 0,
  };
};
