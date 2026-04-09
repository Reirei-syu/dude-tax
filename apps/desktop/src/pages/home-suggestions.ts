import type { EmployeeCalculationStatus } from "@dude-tax/core";

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
  statuses: EmployeeCalculationStatus[];
};

export const buildHomeSuggestions = ({
  currentUnitId,
  currentTaxYear,
  employeeCount,
  incompleteMonthCount,
  pendingRecalculateCount,
  invalidatedCount,
  statuses,
}: BuildHomeSuggestionsInput): WorkSuggestion[] => {
  if (!currentUnitId || !currentTaxYear) {
    return [
      {
        title: "先确定工作房间",
        description: "请先选择单位和年份，后续录入、确认和查询都基于这个上下文。",
        path: "/units",
        actionLabel: "前往单位管理",
      },
    ];
  }

  const suggestions: WorkSuggestion[] = [];

  if (employeeCount === 0) {
    suggestions.push({
      title: "先补员工基础档案",
      description: "当前单位下还没有员工，建议先前往员工信息模块手工新增或执行批量导入。",
      path: "/employees",
      actionLabel: "前往员工信息",
    });

    return suggestions.slice(0, 3);
  }

  if (incompleteMonthCount > 0) {
    suggestions.push({
      title: "优先补齐月度数据",
      description: `当前还有 ${incompleteMonthCount} 个月份未完成，建议先补录，避免后续确认结果不完整。`,
      path: "/entry",
      actionLabel: "前往月度数据录入",
    });
  }

  if (pendingRecalculateCount > 0) {
    suggestions.push({
      title: "执行年度重算",
      description:
        invalidatedCount > 0
          ? `当前有 ${pendingRecalculateCount} 名员工需要重算，其中 ${invalidatedCount} 名因政策或数据变化需要重新确认结果。`
          : `当前有 ${pendingRecalculateCount} 名员工已具备条件，建议尽快进入结果确认模块复核已确认结果。`,
      path: "/result-confirmation",
      actionLabel: "前往结果确认",
    });
  }

  if (!suggestions.length) {
    suggestions.push({
      title: "查看已确认结果",
      description: "当前录入与确认状态整体平稳，可以直接进入结果确认模块查看和导出已确认结果。",
      path: "/result-confirmation",
      actionLabel: "前往结果确认",
    });
  }

  if (statuses.some((status) => status.completedMonthCount > 0)) {
    suggestions.push({
      title: "用快速计算做复核",
      description: "如需临时测算个别月份变化，可进入快速计算做不落库复核。",
      path: "/quick-calc",
      actionLabel: "前往快速计算",
    });
  }

  suggestions.push({
    title: "检查政策口径",
    description: "如需复核当前政策口径或维护边界，可进入系统维护和政策参考继续检查。",
    path: "/policy",
    actionLabel: "前往政策参考",
  });

  return suggestions.slice(0, 4);
};
