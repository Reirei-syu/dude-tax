import type { EmployeeCalculationStatus, ImportSummary } from "@dude-tax/core";

export type WorkSuggestion = {
  title: string;
  description: string;
  path: string;
  actionLabel: string;
};

type BuildHomeSuggestionsInput = {
  currentUnitId: number | null;
  currentTaxYear: number | null;
  employeeCount: number;
  incompleteMonthCount: number;
  pendingRecalculateCount: number;
  invalidatedCount: number;
  importSummary: ImportSummary | null;
  statuses: EmployeeCalculationStatus[];
};

export const buildHomeSuggestions = ({
  currentUnitId,
  currentTaxYear,
  employeeCount,
  incompleteMonthCount,
  pendingRecalculateCount,
  invalidatedCount,
  importSummary,
  statuses,
}: BuildHomeSuggestionsInput): WorkSuggestion[] => {
  if (!currentUnitId || !currentTaxYear) {
    return [
      {
        title: "先确定工作房间",
        description: "请先选择单位和年份，后续所有录入、计算和查询都会基于这个上下文。",
        path: "/units",
        actionLabel: "前往单位管理",
      },
    ];
  }

  const suggestions: WorkSuggestion[] = [];

  if ((importSummary?.conflictRows ?? 0) > 0) {
    suggestions.push({
      title: "先处理导入冲突",
      description: `当前最新导入预览中还有 ${importSummary?.conflictRows ?? 0} 行冲突，建议先在批量导入页确认处理策略。`,
      path: "/import",
      actionLabel: "前往批量导入",
    });
  }

  if ((importSummary?.readyRows ?? 0) > 0) {
    suggestions.push({
      title: "执行批量导入",
      description: `当前最新导入预览中还有 ${importSummary?.readyRows ?? 0} 行可直接导入，优先批量落库比手工录入更高效。`,
      path: "/import",
      actionLabel: "继续导入",
    });
  }

  if (employeeCount === 0) {
    suggestions.push({
      title: "先补员工基础档案",
      description: "当前单位下还没有员工，建议先通过批量导入或手工新增建立员工档案。",
      path: importSummary ? "/import" : "/employees",
      actionLabel: importSummary ? "前往批量导入" : "前往员工信息",
    });

    return suggestions.slice(0, 3);
  }

  if (incompleteMonthCount > 0) {
    suggestions.push({
      title: "优先补齐月度数据",
      description: `当前还有 ${incompleteMonthCount} 个月份未完成，建议先补录，避免后续计算结果不完整。`,
      path: "/entry",
      actionLabel: "前往月度录入",
    });
  }

  if (pendingRecalculateCount > 0) {
    suggestions.push({
      title: "执行年度重算",
      description:
        invalidatedCount > 0
          ? `当前有 ${pendingRecalculateCount} 名员工需要重算，其中 ${invalidatedCount} 名因税率变更导致结果失效。`
          : `当前有 ${pendingRecalculateCount} 名员工已具备条件但尚未重算，建议尽快生成最新年度结果。`,
      path: "/calculation",
      actionLabel: "前往计算中心",
    });
  }

  if (!suggestions.length) {
    suggestions.push({
      title: "查看年度结果",
      description: "当前录入与计算状态整体平稳，可以直接进入结果中心查看、导出和复核结果。",
      path: "/results",
      actionLabel: "前往结果中心",
    });
  }

  if (statuses.some((status) => status.completedMonthCount > 0)) {
    suggestions.push({
      title: "用快速计算做复核",
      description: "如需先验证临时口径或测算个别月份变化，可进入快速计算做不落库复核。",
      path: "/quick-calc",
      actionLabel: "前往快速计算",
    });
  }

  suggestions.push({
    title: "检查税率口径",
    description: "如需复核当前税率或确认维护边界，可进入系统维护查看当前口径。",
    path: "/maintenance",
    actionLabel: "前往系统维护",
  });

  return suggestions.slice(0, 4);
};
