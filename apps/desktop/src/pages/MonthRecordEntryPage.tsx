import type {
  AnnualTaxWithholdingMode,
  EmployeeAnnualTaxResult,
  EmployeeYearEntryOverview,
  EmploymentIncomeConflictMonths,
  YearRecordUpsertItem,
} from "@dude-tax/core";
import { DEFAULT_BASIC_DEDUCTION_AMOUNT } from "@dude-tax/config";
import { taxCalculationSchemeLabelMap } from "@dude-tax/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiClient } from "../api/client";
import { AnnualTaxResultDialog } from "../components/AnnualTaxResultDialog";
import { CollapsibleSectionCard } from "../components/CollapsibleSectionCard";
import { EmploymentIncomeConflictDialog } from "../components/EmploymentIncomeConflictDialog";
import { ImportWorkflowSection } from "../components/ImportWorkflowSection";
import { WorkspaceCanvas, WorkspaceItem, WorkspaceLayoutRoot } from "../components/WorkspaceLayout";
import { YearEntryEmployeeSelectionDialog } from "../components/YearEntryEmployeeSelectionDialog";
import { YearRecordWorkspaceDialog } from "../components/YearRecordWorkspaceDialog";
import { useAppContext } from "../context/AppContextProvider";
import { saveFileWithDesktopFallback } from "../utils/file-save";
import { annualTaxWithholdingModeLabelMap } from "./annual-tax-withholding-summary";
import { downloadMonthRecordImportTemplateWorkbook } from "./import-template";
import {
  buildEmploymentConflictDialogMessage,
  collectWorkspaceEmploymentConflictMonths,
  filterRowsByTaxMonths,
  resolveWorkspaceRowsAfterSkippingEmploymentConflict,
} from "./month-record-employment-conflict";
import { buildYearRecordWorkbookBuffer } from "./year-record-export";
import {
  applyWorkspaceMonthToFutureMonths,
  applyWorkspaceMonthToNextMonth,
  getDirtyWorkspaceMonths,
} from "./year-record-workspace";

const formatCurrency = (value: number) =>
  value.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const YEAR_ENTRY_WITHHOLDING_MODES = (
  Object.entries(annualTaxWithholdingModeLabelMap) as Array<[AnnualTaxWithholdingMode, string]>
).filter(([mode]) => mode !== "first_salary_month_cumulative");

const toEditableRows = (
  workspace: Awaited<ReturnType<typeof apiClient.getEmployeeYearWorkspace>>,
): YearRecordUpsertItem[] =>
  workspace.months.map((row) => ({
    taxMonth: row.taxMonth,
    salaryIncome: row.salaryIncome,
    annualBonus: row.annualBonus,
    pensionInsurance: row.pensionInsurance,
    medicalInsurance: row.medicalInsurance,
    occupationalAnnuity: row.occupationalAnnuity,
    housingFund: row.housingFund,
    supplementaryHousingFund: row.supplementaryHousingFund,
    unemploymentInsurance: row.unemploymentInsurance,
    workInjuryInsurance: row.workInjuryInsurance,
    withheldTax: row.withheldTax,
    otherIncome: row.otherIncome ?? 0,
    otherIncomeRemark: row.otherIncomeRemark ?? "",
    infantCareDeduction: row.infantCareDeduction,
    childEducationDeduction: row.childEducationDeduction,
    continuingEducationDeduction: row.continuingEducationDeduction,
    housingLoanInterestDeduction: row.housingLoanInterestDeduction,
    housingRentDeduction: row.housingRentDeduction,
    elderCareDeduction: row.elderCareDeduction,
    otherDeduction: row.otherDeduction,
    taxReductionExemption: row.taxReductionExemption,
    remark: row.remark ?? "",
  }));

type ResultSummaryRow = {
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  cumulativeExpectedWithheldTax: number;
  lastAppliedRate: number | null;
  selectedScheme: EmployeeAnnualTaxResult["selectedScheme"];
  annualBonusTax: number | null;
  annualBonusRate: number | null;
  alternativeTaxAmount: number;
};

type EmploymentConflictDialogState = {
  actionKind: "save" | "apply_next_month" | "apply_future_months";
  conflict: EmploymentIncomeConflictMonths;
  baseRows?: YearRecordUpsertItem[];
  pendingDirtyMonths?: YearRecordUpsertItem[];
  pendingRows?: YearRecordUpsertItem[];
  targetMonths?: number[];
};

const buildResultSummaryRows = (
  results: EmployeeAnnualTaxResult[],
  bonusTaxBrackets: Awaited<
    ReturnType<typeof apiClient.getTaxPolicy>
  >["currentSettings"]["bonusTaxBrackets"],
): ResultSummaryRow[] =>
  [...results]
    .sort((left, right) =>
      left.employeeCode.localeCompare(right.employeeCode, "zh-CN", { numeric: true }),
    )
    .map((result) => {
      const lastTraceItem = result.withholdingTraceItems?.at(-1) ?? null;
      const alternativeSchemeResult =
        result.selectedScheme === "separate_bonus"
          ? result.schemeResults.combinedBonus
          : result.schemeResults.separateBonus;
      const selectedSchemeResult =
        result.selectedScheme === "separate_bonus"
          ? result.schemeResults.separateBonus
          : result.schemeResults.combinedBonus;
      const annualBonusRate =
        result.selectedScheme === "separate_bonus" && selectedSchemeResult.bonusBracketLevel
          ? (bonusTaxBrackets.find(
              (bracket) => bracket.level === selectedSchemeResult.bonusBracketLevel,
            )?.rate ?? null)
          : null;

      return {
        employeeId: result.employeeId,
        employeeCode: result.employeeCode,
        employeeName: result.employeeName,
        cumulativeExpectedWithheldTax:
          lastTraceItem?.cumulativeExpectedWithheldTax ??
          result.withholdingSummary.expectedWithheldTaxTotal,
        lastAppliedRate: lastTraceItem?.appliedRate ?? null,
        selectedScheme: result.selectedScheme,
        annualBonusTax:
          result.selectedScheme === "separate_bonus" ? selectedSchemeResult.annualBonusTax : null,
        annualBonusRate,
        alternativeTaxAmount: alternativeSchemeResult.finalTax,
      };
    });

export const MonthRecordEntryPage = () => {
  const { context } = useAppContext();
  const currentUnitId = context?.currentUnitId ?? null;
  const currentTaxYear = context?.currentTaxYear ?? null;
  const currentUnit = context?.units.find((unit) => unit.id === currentUnitId) ?? null;
  const scopeKey =
    currentUnitId && currentTaxYear ? `${currentUnitId}:${currentTaxYear}` : "no-scope";

  const [overview, setOverview] = useState<Awaited<
    ReturnType<typeof apiClient.getYearEntryOverview>
  > | null>(null);
  const [annualResults, setAnnualResults] = useState<EmployeeAnnualTaxResult[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
  const [workspace, setWorkspace] = useState<Awaited<
    ReturnType<typeof apiClient.getEmployeeYearWorkspace>
  > | null>(null);
  const [workspaceRows, setWorkspaceRows] = useState<YearRecordUpsertItem[]>([]);
  const [originalWorkspaceRows, setOriginalWorkspaceRows] = useState<YearRecordUpsertItem[]>([]);
  const [selectedWorkspaceMonth, setSelectedWorkspaceMonth] = useState(1);
  const [detailEmployeeId, setDetailEmployeeId] = useState<number | null>(null);
  const [withholdingMode, setWithholdingMode] =
    useState<AnnualTaxWithholdingMode>("standard_cumulative");
  const [basicDeductionAmount, setBasicDeductionAmount] = useState(DEFAULT_BASIC_DEDUCTION_AMOUNT);
  const [bonusTaxBrackets, setBonusTaxBrackets] = useState<
    Awaited<ReturnType<typeof apiClient.getTaxPolicy>>["currentSettings"]["bonusTaxBrackets"]
  >([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectionDialogOpen, setSelectionDialogOpen] = useState(false);
  const [isResultListCollapsed, setIsResultListCollapsed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [employmentConflictDialogState, setEmploymentConflictDialogState] =
    useState<EmploymentConflictDialogState | null>(null);
  const initializedScopeRef = useRef<string>("no-scope");

  const loadPageData = async () => {
    if (!currentUnitId || !currentTaxYear) {
      setOverview(null);
      setAnnualResults([]);
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      const [nextOverview, taxPolicy, nextAnnualResults] = await Promise.all([
        apiClient.getYearEntryOverview(currentUnitId, currentTaxYear),
        apiClient.getTaxPolicy(currentUnitId, currentTaxYear),
        apiClient.listAnnualResults(currentUnitId, currentTaxYear),
      ]);
      setOverview(nextOverview);
      setAnnualResults(nextAnnualResults);
      setBasicDeductionAmount(taxPolicy.currentSettings.basicDeductionAmount);
      setBonusTaxBrackets(taxPolicy.currentSettings.bonusTaxBrackets);
      setSelectedEmployeeIds((currentIds) => {
        const allEmployeeIds = nextOverview.employees.map((employee) => employee.employeeId);
        if (initializedScopeRef.current !== scopeKey) {
          initializedScopeRef.current = scopeKey;
          return allEmployeeIds;
        }

        const nextIds = currentIds.filter((employeeId) => allEmployeeIds.includes(employeeId));
        return nextIds.length ? nextIds : allEmployeeIds;
      });
      if (nextAnnualResults.length) {
        setIsResultListCollapsed(false);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载月度数据录入页面失败");
      setOverview(null);
      setAnnualResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initializedScopeRef.current = "no-scope";
    void loadPageData();
  }, [scopeKey]);

  const resultSummaryRows = useMemo(
    () => buildResultSummaryRows(annualResults, bonusTaxBrackets),
    [annualResults, bonusTaxBrackets],
  );
  const selectedEmployeeIdSet = useMemo(() => new Set(selectedEmployeeIds), [selectedEmployeeIds]);
  const selectedEmployees = useMemo(
    () =>
      (overview?.employees ?? []).filter((employee) =>
        selectedEmployeeIdSet.has(employee.employeeId),
      ),
    [overview, selectedEmployeeIdSet],
  );
  const detailResult = useMemo(
    () => annualResults.find((result) => result.employeeId === detailEmployeeId) ?? null,
    [annualResults, detailEmployeeId],
  );

  const currentResultCoverage = overview?.currentResultCoverage ?? {
    totalEffectiveEmployeeCount: 0,
    calculatedEmployeeCount: 0,
    uncoveredEmployeeIds: [],
    isComplete: false,
  };

  const employmentConflictDialogMessage =
    employmentConflictDialogState && workspace
      ? buildEmploymentConflictDialogMessage(
          workspace,
          employmentConflictDialogState.conflict,
          employmentConflictDialogState.actionKind,
        )
      : null;

  const persistWorkspaceMonths = async (
    months: YearRecordUpsertItem[],
    options?: {
      acknowledgedEmploymentConflictMonths?: number[];
      successMessage?: string;
    },
  ) => {
    if (!workspace || !currentUnitId || !currentTaxYear) {
      return;
    }

    if (!months.length) {
      setNoticeMessage("当前没有需要保存的合法改动。");
      return;
    }

    try {
      setSaving(true);
      setErrorMessage(null);
      const nextWorkspace = await apiClient.saveEmployeeYearWorkspace(
        currentUnitId,
        currentTaxYear,
        workspace.employeeId,
        {
          months,
          acknowledgedEmploymentConflictMonths: options?.acknowledgedEmploymentConflictMonths,
        },
      );
      const editableRows = toEditableRows(nextWorkspace);
      setWorkspace(nextWorkspace);
      setWorkspaceRows(editableRows);
      setOriginalWorkspaceRows(editableRows);
      setNoticeMessage(options?.successMessage ?? "员工年度数据已保存。");
      await loadPageData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "保存员工年度数据失败");
    } finally {
      setSaving(false);
    }
  };

  const openEmploymentConflictDialog = (
    actionKind: EmploymentConflictDialogState["actionKind"],
    conflict: EmploymentIncomeConflictMonths,
    options?: Pick<
      EmploymentConflictDialogState,
      "baseRows" | "pendingDirtyMonths" | "pendingRows" | "targetMonths"
    >,
  ) => {
    setEmploymentConflictDialogState({
      actionKind,
      conflict,
      ...options,
    });
  };

  const applyWorkspaceRowsForTargetMonths = (
    nextRows: YearRecordUpsertItem[],
    targetMonths: number[],
  ) => {
    const replacementMap = new Map(
      filterRowsByTaxMonths(nextRows, targetMonths).map((row) => [row.taxMonth, row] as const),
    );

    setWorkspaceRows((currentRows) =>
      currentRows.map((row) => replacementMap.get(row.taxMonth) ?? row),
    );
  };

  const openWorkspace = async (employeeId: number) => {
    if (!currentUnitId || !currentTaxYear) {
      return;
    }

    try {
      setSaving(true);
      setErrorMessage(null);
      const nextWorkspace = await apiClient.getEmployeeYearWorkspace(
        currentUnitId,
        currentTaxYear,
        employeeId,
      );
      const editableRows = toEditableRows(nextWorkspace);
      setWorkspace(nextWorkspace);
      setWorkspaceRows(editableRows);
      setOriginalWorkspaceRows(editableRows);
      setSelectedWorkspaceMonth(1);
      setEmploymentConflictDialogState(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载员工年度工作台失败");
    } finally {
      setSaving(false);
    }
  };

  const handleChangeWorkspaceRow = (
    taxMonth: number,
    key: keyof YearRecordUpsertItem,
    value: string | number,
  ) => {
    setWorkspaceRows((currentRows) =>
      currentRows.map((row) =>
        row.taxMonth === taxMonth
          ? {
              ...row,
              [key]: value,
            }
          : row,
      ),
    );
  };

  const handleSaveWorkspace = async () => {
    if (!workspace || !currentUnitId || !currentTaxYear) {
      return;
    }

    const dirtyMonths = getDirtyWorkspaceMonths(originalWorkspaceRows, workspaceRows);
    if (!dirtyMonths.length) {
      setNoticeMessage("当前没有需要保存的改动。");
      return;
    }

    const conflict = collectWorkspaceEmploymentConflictMonths(workspace, dirtyMonths);
    if (conflict.conflictMonths.length) {
      openEmploymentConflictDialog("save", conflict, {
        pendingDirtyMonths: dirtyMonths,
      });
      return;
    }

    await persistWorkspaceMonths(dirtyMonths);
  };

  const handleApplyWorkspaceRows = (
    actionKind: EmploymentConflictDialogState["actionKind"],
    nextRows: YearRecordUpsertItem[],
    targetMonths: number[],
  ) => {
    if (!workspace) {
      return;
    }

    const relevantMonths = Array.from(
      new Set([selectedWorkspaceMonth, ...targetMonths]),
    ).sort((left, right) => left - right);
    const targetRows = filterRowsByTaxMonths(nextRows, relevantMonths);
    const conflict = collectWorkspaceEmploymentConflictMonths(workspace, targetRows);
    if (conflict.conflictMonths.length) {
      openEmploymentConflictDialog(actionKind, conflict, {
        baseRows: workspaceRows,
        pendingRows: nextRows,
        targetMonths,
      });
      return;
    }

    applyWorkspaceRowsForTargetMonths(nextRows, targetMonths);
  };

  const handleConfirmEmploymentConflict = async () => {
    const dialogState = employmentConflictDialogState;
    setEmploymentConflictDialogState(null);
    if (!dialogState) {
      return;
    }

    if (dialogState.actionKind === "save") {
      await persistWorkspaceMonths(dialogState.pendingDirtyMonths ?? [], {
        acknowledgedEmploymentConflictMonths: dialogState.conflict.conflictMonths,
        successMessage: "已确认异常月份并完成保存。",
      });
      return;
    }

    if (dialogState.pendingRows && dialogState.targetMonths?.length) {
      applyWorkspaceRowsForTargetMonths(dialogState.pendingRows, dialogState.targetMonths);
      setNoticeMessage("已保留异常月份并完成复制。");
    }
  };

  const handleSkipEmploymentConflict = async () => {
    const dialogState = employmentConflictDialogState;
    setEmploymentConflictDialogState(null);
    if (!dialogState) {
      return;
    }

    if (dialogState.actionKind === "save") {
      const safeMonths = (dialogState.pendingDirtyMonths ?? []).filter(
        (row) => !dialogState.conflict.conflictMonths.includes(row.taxMonth),
      );
      if (!safeMonths.length) {
        setNoticeMessage("已跳过异常月份，当前没有可保存的合法改动。");
        return;
      }

      await persistWorkspaceMonths(safeMonths, {
        successMessage: "已跳过异常月份，仅保存合法月份。",
      });
      return;
    }

    const safeTargetMonths = (dialogState.targetMonths ?? []).filter(
      (taxMonth) => !dialogState.conflict.conflictMonths.includes(taxMonth),
    );
    if (!dialogState.pendingRows || !dialogState.baseRows) {
      setNoticeMessage("已跳过异常月份，当前没有可复制的合法月份。");
      return;
    }

    const nextRows = resolveWorkspaceRowsAfterSkippingEmploymentConflict(
      dialogState.baseRows,
      originalWorkspaceRows,
      dialogState.pendingRows,
      safeTargetMonths,
      dialogState.conflict.conflictMonths,
    );
    setWorkspaceRows(nextRows);
    setNoticeMessage("已跳过异常月份，仅复制合法月份。");
  };

  const handleToggleEmployee = (employeeId: number) => {
    setSelectedEmployeeIds((currentIds) => {
      if (currentIds.includes(employeeId)) {
        return currentIds.length === 1
          ? currentIds
          : currentIds.filter((currentEmployeeId) => currentEmployeeId !== employeeId);
      }

      return [...currentIds, employeeId];
    });
  };

  const handleCalculate = async () => {
    if (!currentUnitId || !currentTaxYear) {
      return;
    }

    if (!selectedEmployeeIds.length) {
      setErrorMessage("请至少保留一名员工后再执行计算。");
      return;
    }

    try {
      setSaving(true);
      setErrorMessage(null);
      await apiClient.calculateYearEntryResults(currentUnitId, currentTaxYear, {
        employeeIds: selectedEmployeeIds,
        withholdingContext: {
          mode: withholdingMode,
        },
      });
      setNoticeMessage("年度录入计算已完成，可前往缴纳确认模块继续确认。");
      setIsResultListCollapsed(false);
      await loadPageData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "执行年度录入计算失败");
    } finally {
      setSaving(false);
    }
  };

  const downloadWorkbook = async () => {
    if (!currentUnitId || !currentTaxYear || !currentUnit || !annualResults.length) {
      return;
    }

    try {
      setSaving(true);
      setErrorMessage(null);
      const workspaces = await Promise.all(
        annualResults.map((employee) =>
          apiClient.getEmployeeYearWorkspace(currentUnitId, currentTaxYear, employee.employeeId),
        ),
      );
      const workbookArray = await buildYearRecordWorkbookBuffer({
        summarySheetName: "汇总",
        summaryColumns: [
          { key: "employeeCode", label: "工号" },
          { key: "employeeName", label: "姓名" },
          { key: "selectedScheme", label: "采用方案" },
          { key: "annualTaxWithheld", label: "本年税额" },
          { key: "lastAppliedRate", label: "末月税率" },
          { key: "alternativeTaxAmount", label: "另一方案应扣税额" },
        ],
        summaryRows: resultSummaryRows.map((row) => ({
          employeeCode: row.employeeCode,
          employeeName: row.employeeName,
          selectedScheme: taxCalculationSchemeLabelMap[row.selectedScheme],
          annualTaxWithheld: formatCurrency(row.cumulativeExpectedWithheldTax),
          lastAppliedRate: row.lastAppliedRate === null ? "-" : `${row.lastAppliedRate}%`,
          alternativeTaxAmount: formatCurrency(row.alternativeTaxAmount),
        })),
        employees: workspaces.map((item) => ({
          employeeCode: item.employeeCode,
          employeeName: item.employeeName,
          rows: toEditableRows(item),
        })),
        basicDeductionAmount,
      });

      await saveFileWithDesktopFallback({
        defaultPath: `月度数据结果_${currentUnit.unitName}_${currentTaxYear}.xlsx`,
        filters: [{ name: "Excel 文件", extensions: ["xlsx"] }],
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        content: workbookArray,
      });
      setNoticeMessage("当前计算结果导出已生成。");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "导出当前计算结果失败");
    } finally {
      setSaving(false);
    }
  };

  if (!currentUnitId || !currentTaxYear) {
    return (
      <WorkspaceLayoutRoot scope="page:entry">
        <WorkspaceCanvas className="month-entry-page">
          <WorkspaceItem cardId="entry-overview" defaultLayout={{ x: 0, y: 0, w: 12, h: 10 }} minH={8}>
            <CollapsibleSectionCard
              cardId="entry-overview"
              className="placeholder-card"
              description="请先在顶部选择单位和年份，再进入月度数据录入模块。"
              headingTag="h1"
              title="月度数据手工录入"
            />
          </WorkspaceItem>
        </WorkspaceCanvas>
      </WorkspaceLayoutRoot>
    );
  }

  return (
    <WorkspaceLayoutRoot scope="page:entry">
      <WorkspaceCanvas className="month-entry-page">
        <WorkspaceItem
          cardId="entry-overview"
          defaultLayout={{ x: 0, y: 0, w: 12, h: 24 }}
          minH={18}
        >
          <CollapsibleSectionCard
            cardId="entry-overview"
            className="placeholder-card"
            description={`当前房间：${currentUnit?.unitName ?? "未选择单位"} / ${currentTaxYear} 年`}
            headingTag="h1"
            headerExtras={<span className="tag">{loading ? "加载中" : "全年录入与计算"}</span>}
            title="月度数据手工录入"
          >
            <div className="form-grid">
              <label className="form-field">
                <span>预扣模式</span>
                <select
                  value={withholdingMode}
                  onChange={(event) =>
                    setWithholdingMode(event.target.value as AnnualTaxWithholdingMode)
                  }
                >
                  {YEAR_ENTRY_WITHHOLDING_MODES.map(([mode, label]) => (
                    <option key={mode} value={mode}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="summary-grid">
              <div className="summary-card">
                <span>全部有效员工</span>
                <strong>{overview?.totalEffectiveEmployeeCount ?? 0}</strong>
              </div>
              <div className="summary-card">
                <span>当前已选员工</span>
                <strong>{selectedEmployeeIds.length}</strong>
              </div>
              <div className="summary-card">
                <span>当前结果覆盖</span>
                <strong>
                  {currentResultCoverage.calculatedEmployeeCount}/
                  {currentResultCoverage.totalEffectiveEmployeeCount}
                </strong>
              </div>
            </div>

            <div className="button-row">
              <button
                className="ghost-button"
                disabled={saving || !(overview?.employees.length ?? 0)}
                type="button"
                onClick={() => setSelectionDialogOpen(true)}
              >
                选择员工
              </button>
              <button
                className="primary-button"
                disabled={saving || !selectedEmployeeIds.length}
                type="button"
                onClick={() => void handleCalculate()}
              >
                执行计算
              </button>
            </div>

            {selectedEmployeeIds.length < (overview?.totalEffectiveEmployeeCount ?? 0) ? (
              <div className="error-banner">
                当前名单未覆盖全部有效员工，缴纳确认模块将禁止确认当前月份。
              </div>
            ) : null}
            {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}
            {noticeMessage ? <div className="success-banner">{noticeMessage}</div> : null}

            <div className="section-header compact-section-header">
              <div>
                <h2>年度员工列表</h2>
                <p>按全年视角编辑在库员工数据，点击“编辑”进入年度工作台。</p>
              </div>
              <span className="tag">{selectedEmployees.length} 人</span>
            </div>

            <table className="data-table month-entry-overview-table">
              <thead>
                <tr>
                  <th>工号</th>
                  <th>姓名</th>
                  <th>状态</th>
                  <th>已录入月份</th>
                  <th>未编辑月份</th>
                </tr>
              </thead>
              <tbody>
                {selectedEmployees.length ? (
                  selectedEmployees.map((employee) => (
                    <tr
                      key={employee.employeeId}
                      className="selectable-row"
                      onClick={() => void openWorkspace(employee.employeeId)}
                    >
                      <td>{employee.employeeCode}</td>
                      <td>
                        <div className="table-inline-actions">
                          <button
                            className="ghost-button table-action-button"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void openWorkspace(employee.employeeId);
                            }}
                          >
                            编辑
                          </button>
                          <span>{employee.employeeName}</span>
                        </div>
                      </td>
                      <td>
                        <span
                          className={employee.employeeGroup === "active" ? "tag" : "tag tag-warning"}
                        >
                          {employee.employeeGroup === "active" ? "在职" : "本年离职"}
                        </span>
                      </td>
                      <td>{employee.recordedMonthCount}</td>
                      <td>
                        {employee.uneditedMonths.length ? employee.uneditedMonths.join("、") : "-"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5}>当前名单没有可编辑员工，请先通过“选择员工”调整名单。</td>
                  </tr>
                )}
              </tbody>
            </table>
          </CollapsibleSectionCard>
        </WorkspaceItem>

        <WorkspaceItem
          cardId="entry-import"
          defaultLayout={{ x: 0, y: 24, w: 12, h: 14 }}
          minH={12}
        >
          <ImportWorkflowSection
            title="月度数据批量导入"
            description="在月度数据录入模块内完成模板下载、导入预览、冲突处理和执行导入。"
            importType="month_record"
            canOperate={Boolean(currentUnitId && currentTaxYear)}
            currentUnitId={currentUnitId}
            scopeTaxYear={currentTaxYear}
            downloadButtonLabel="下载月度模板"
            groupTitle="月度批量导入工作区"
            groupDescription="默认收起，展开后处理模板下载、导入预览和导入回执。"
            defaultCollapsed={true}
            defaultConflictStrategy="overwrite"
            onDownloadTemplate={() =>
              downloadMonthRecordImportTemplateWorkbook(
                currentUnitId as number,
                currentTaxYear as number,
              )
            }
            onImportCommitted={() => loadPageData()}
          />
        </WorkspaceItem>

        <WorkspaceItem
          cardId="entry-result-summary"
          defaultLayout={{ x: 0, y: 38, w: 12, h: 18 }}
          minH={14}
        >
          <article className="glass-card page-section placeholder-card">
            <div className="section-header" data-workspace-drag-handle="true">
              <div>
                <h2>计算结果汇总</h2>
                <p>展示当前已计算快照，可直接进入员工计算结果明细。</p>
              </div>
              <div className="button-row compact">
                <span className="tag">{resultSummaryRows.length} 条结果</span>
                <button
                  className="ghost-button"
                  disabled={saving || !resultSummaryRows.length}
                  type="button"
                  onClick={() => void downloadWorkbook()}
                >
                  导出当前结果
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => setIsResultListCollapsed((currentValue) => !currentValue)}
                >
                  {isResultListCollapsed ? "展开" : "折叠"}
                </button>
              </div>
            </div>

            {!isResultListCollapsed ? (
              <table className="data-table month-entry-overview-table">
                <thead>
                  <tr>
                    <th>工号</th>
                    <th aria-label="明细操作"></th>
                    <th>姓名</th>
                    <th>本年税额</th>
                    <th>末月税率</th>
                    <th>采用方案</th>
                    <th>年终奖税额</th>
                    <th>年终奖税率</th>
                    <th>另一方案应扣税额</th>
                  </tr>
                </thead>
                <tbody>
                  {resultSummaryRows.length ? (
                    resultSummaryRows.map((row) => (
                      <tr
                        key={row.employeeId}
                        className="selectable-row"
                        onClick={() => setDetailEmployeeId(row.employeeId)}
                      >
                        <td>{row.employeeCode}</td>
                        <td className="table-action-cell">
                          <button
                            className="ghost-button table-action-button"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setDetailEmployeeId(row.employeeId);
                            }}
                          >
                            明细
                          </button>
                        </td>
                        <td>{row.employeeName}</td>
                        <td>{formatCurrency(row.cumulativeExpectedWithheldTax)}</td>
                        <td>{row.lastAppliedRate === null ? "-" : `${row.lastAppliedRate}%`}</td>
                        <td>{taxCalculationSchemeLabelMap[row.selectedScheme]}</td>
                        <td>
                          {row.annualBonusTax === null ? "-" : formatCurrency(row.annualBonusTax)}
                        </td>
                        <td>{row.annualBonusRate === null ? "-" : `${row.annualBonusRate}%`}</td>
                        <td>{formatCurrency(row.alternativeTaxAmount)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8}>当前暂无已计算结果，请先执行计算。</td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : null}
          </article>
        </WorkspaceItem>
      </WorkspaceCanvas>

      <YearEntryEmployeeSelectionDialog
        open={selectionDialogOpen}
        employees={overview?.employees ?? []}
        selectedEmployeeIds={selectedEmployeeIds}
        onClose={() => setSelectionDialogOpen(false)}
        onToggleEmployee={handleToggleEmployee}
        onSelectAll={() =>
          setSelectedEmployeeIds((overview?.employees ?? []).map((employee) => employee.employeeId))
        }
      />

      <YearRecordWorkspaceDialog
        open={Boolean(workspace)}
        title={workspace ? `${workspace.employeeName} 年度录入工作台` : ""}
        subtitle={workspace ? `${workspace.employeeCode} / ${currentTaxYear} 年` : undefined}
        rows={workspaceRows}
        selectedMonth={selectedWorkspaceMonth}
        lockedMonths={workspace?.lockedMonths ?? []}
        basicDeductionAmount={basicDeductionAmount}
        primaryActionLabel="保存当前改动"
        primaryActionDisabled={saving}
        onPrimaryAction={() => void handleSaveWorkspace()}
        onClose={() => {
          setWorkspace(null);
          setWorkspaceRows([]);
          setOriginalWorkspaceRows([]);
        }}
        onSelectMonth={setSelectedWorkspaceMonth}
        onChangeRow={handleChangeWorkspaceRow}
        onApplyToNextMonth={() =>
          handleApplyWorkspaceRows(
            "apply_next_month",
            applyWorkspaceMonthToNextMonth(workspaceRows, selectedWorkspaceMonth),
            [selectedWorkspaceMonth + 1].filter((taxMonth) => taxMonth <= 12),
          )
        }
        onApplyToFutureMonths={() =>
          handleApplyWorkspaceRows(
            "apply_future_months",
            applyWorkspaceMonthToFutureMonths(workspaceRows, selectedWorkspaceMonth),
            workspaceRows
              .filter((row) => row.taxMonth > selectedWorkspaceMonth)
              .map((row) => row.taxMonth),
          )
        }
      />

      <EmploymentIncomeConflictDialog
        open={Boolean(employmentConflictDialogState && workspace && employmentConflictDialogMessage)}
        title={employmentConflictDialogMessage?.title ?? ""}
        description={employmentConflictDialogMessage?.description ?? ""}
        beforeHireMonths={employmentConflictDialogState?.conflict.beforeHireMonths ?? []}
        afterLeaveMonths={employmentConflictDialogState?.conflict.afterLeaveMonths ?? []}
        confirmLabel={
          employmentConflictDialogState?.actionKind === "save"
            ? "继续保存异常月份"
            : "继续复制异常月份"
        }
        skipLabel={
          employmentConflictDialogState?.actionKind === "save"
            ? "跳过异常月份，仅保存合法月份"
            : "跳过异常月份，仅复制合法月份"
        }
        cancelLabel="取消"
        onConfirm={() => void handleConfirmEmploymentConflict()}
        onSkip={() => void handleSkipEmploymentConflict()}
        onCancel={() => setEmploymentConflictDialogState(null)}
      />

      <AnnualTaxResultDialog
        open={Boolean(detailResult)}
        title={detailResult ? `${detailResult.employeeName} 全年计算结果` : ""}
        subtitle={
          detailResult ? `${detailResult.employeeCode} / ${detailResult.taxYear} 年` : undefined
        }
        result={detailResult}
        bonusTaxBrackets={bonusTaxBrackets}
        onClose={() => setDetailEmployeeId(null)}
      />
    </WorkspaceLayoutRoot>
  );
};
