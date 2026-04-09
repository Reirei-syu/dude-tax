import type {
  AnnualTaxWithholdingMode,
  EmployeeAnnualTaxResult,
  EmployeeYearEntryOverview,
  YearRecordUpsertItem,
} from "@dude-tax/core";
import { DEFAULT_BASIC_DEDUCTION_AMOUNT } from "@dude-tax/config";
import { taxCalculationSchemeLabelMap } from "@dude-tax/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiClient } from "../api/client";
import { AnnualTaxResultDialog } from "../components/AnnualTaxResultDialog";
import { YearEntryEmployeeSelectionDialog } from "../components/YearEntryEmployeeSelectionDialog";
import { YearRecordWorkspaceDialog } from "../components/YearRecordWorkspaceDialog";
import { useAppContext } from "../context/AppContextProvider";
import { saveFileWithDesktopFallback } from "../utils/file-save";
import { annualTaxWithholdingModeLabelMap } from "./annual-tax-withholding-summary";
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
  alternativeTaxAmount: number;
};

const buildResultSummaryRows = (results: EmployeeAnnualTaxResult[]): ResultSummaryRow[] =>
  results.map((result) => {
    const lastTraceItem = result.withholdingTraceItems?.at(-1) ?? null;
    const alternativeSchemeResult =
      result.selectedScheme === "separate_bonus"
        ? result.schemeResults.combinedBonus
        : result.schemeResults.separateBonus;

    return {
      employeeId: result.employeeId,
      employeeCode: result.employeeCode,
      employeeName: result.employeeName,
      cumulativeExpectedWithheldTax:
        lastTraceItem?.cumulativeExpectedWithheldTax ??
        result.withholdingSummary.expectedWithheldTaxTotal,
      lastAppliedRate: lastTraceItem?.appliedRate ?? null,
      selectedScheme: result.selectedScheme,
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

  const [overview, setOverview] =
    useState<Awaited<ReturnType<typeof apiClient.getYearEntryOverview>> | null>(null);
  const [annualResults, setAnnualResults] = useState<EmployeeAnnualTaxResult[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
  const [workspace, setWorkspace] =
    useState<Awaited<ReturnType<typeof apiClient.getEmployeeYearWorkspace>> | null>(null);
  const [workspaceRows, setWorkspaceRows] = useState<YearRecordUpsertItem[]>([]);
  const [originalWorkspaceRows, setOriginalWorkspaceRows] = useState<YearRecordUpsertItem[]>([]);
  const [selectedWorkspaceMonth, setSelectedWorkspaceMonth] = useState(1);
  const [detailEmployeeId, setDetailEmployeeId] = useState<number | null>(null);
  const [withholdingMode, setWithholdingMode] =
    useState<AnnualTaxWithholdingMode>("standard_cumulative");
  const [basicDeductionAmount, setBasicDeductionAmount] = useState(DEFAULT_BASIC_DEDUCTION_AMOUNT);
  const [bonusTaxBrackets, setBonusTaxBrackets] =
    useState<Awaited<ReturnType<typeof apiClient.getTaxPolicy>>["currentSettings"]["bonusTaxBrackets"]>(
      [],
    );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectionDialogOpen, setSelectionDialogOpen] = useState(false);
  const [isEmployeeListCollapsed, setIsEmployeeListCollapsed] = useState(false);
  const [isResultListCollapsed, setIsResultListCollapsed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
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
    () => buildResultSummaryRows(annualResults),
    [annualResults],
  );
  const selectedEmployeeIdSet = useMemo(
    () => new Set(selectedEmployeeIds),
    [selectedEmployeeIds],
  );
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

    try {
      setSaving(true);
      setErrorMessage(null);
      const nextWorkspace = await apiClient.saveEmployeeYearWorkspace(
        currentUnitId,
        currentTaxYear,
        workspace.employeeId,
        { months: dirtyMonths },
      );
      const editableRows = toEditableRows(nextWorkspace);
      setWorkspace(nextWorkspace);
      setWorkspaceRows(editableRows);
      setOriginalWorkspaceRows(editableRows);
      setNoticeMessage("员工年度数据已保存。");
      await loadPageData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "保存员工年度数据失败");
    } finally {
      setSaving(false);
    }
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
      setNoticeMessage("年度录入计算已完成，可前往结果确认模块继续确认。");
      setIsResultListCollapsed(false);
      await loadPageData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "执行年度录入计算失败");
    } finally {
      setSaving(false);
    }
  };

  const downloadWorkbook = async () => {
    if (!currentUnitId || !currentTaxYear || !currentUnit || !selectedEmployees.length) {
      return;
    }

    try {
      setSaving(true);
      setErrorMessage(null);
      const workspaces = await Promise.all(
        selectedEmployees.map((employee) =>
          apiClient.getEmployeeYearWorkspace(
            currentUnitId,
            currentTaxYear,
            employee.employeeId,
          ),
        ),
      );
      const workbookArray = await buildYearRecordWorkbookBuffer({
        summarySheetName: "汇总",
        summaryColumns: [
          { key: "employeeCode", label: "工号" },
          { key: "employeeName", label: "姓名" },
          { key: "recordedMonthCount", label: "已录入月份" },
          { key: "totalWithheldTax", label: "预扣税额合计" },
          { key: "optimalScheme", label: "方案" },
          { key: "uneditedMonths", label: "未编辑月份" },
        ],
        summaryRows: selectedEmployees.map((employee) => ({
          employeeCode: employee.employeeCode,
          employeeName: employee.employeeName,
          recordedMonthCount: String(employee.recordedMonthCount),
          totalWithheldTax: employee.totalWithheldTax.toFixed(2),
          optimalScheme: employee.optimalScheme
            ? taxCalculationSchemeLabelMap[employee.optimalScheme]
            : "-",
          uneditedMonths: employee.uneditedMonths.length
            ? employee.uneditedMonths.join("、")
            : "-",
        })),
        employees: workspaces.map((item) => ({
          employeeCode: item.employeeCode,
          employeeName: item.employeeName,
          rows: toEditableRows(item),
        })),
        basicDeductionAmount,
      });

      await saveFileWithDesktopFallback({
        defaultPath: `月度数据录入_${currentUnit.unitName}_${currentTaxYear}_全年.xlsx`,
        filters: [{ name: "Excel 文件", extensions: ["xlsx"] }],
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        content: workbookArray,
      });
      setNoticeMessage("月度数据录入导出已生成。");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "导出月度数据录入失败");
    } finally {
      setSaving(false);
    }
  };

  if (!currentUnitId || !currentTaxYear) {
    return (
      <section className="page-grid">
        <article className="glass-card page-section placeholder-card">
          <h1>月度数据录入</h1>
          <p>请先在顶部选择单位和年份，再进入月度数据录入模块。</p>
        </article>
      </section>
    );
  }

  return (
    <section className="page-grid month-entry-page">
      <article className="glass-card page-section placeholder-card">
        <div className="section-header">
          <div>
            <h1>月度数据录入</h1>
            <p>
              当前房间：{currentUnit?.unitName ?? "未选择单位"} / {currentTaxYear} 年
            </p>
          </div>
          <span className="tag">{loading ? "加载中" : "全年录入与计算"}</span>
        </div>

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
            className="ghost-button"
            disabled={saving || !selectedEmployees.length}
            type="button"
            onClick={() => void downloadWorkbook()}
          >
            导出 Excel
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
            当前名单未覆盖全部有效员工，结果确认模块将禁止确认当前月份。
          </div>
        ) : null}
        {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}
        {noticeMessage ? <div className="success-banner">{noticeMessage}</div> : null}
      </article>

      <article className="glass-card page-section placeholder-card">
        <div className="section-header">
          <div>
            <h2>员工编辑列表</h2>
            <p>按全年视角编辑在库员工数据，点击“编辑”进入年度工作台。</p>
          </div>
          <div className="button-row compact">
            <span className="tag">{selectedEmployees.length} 人</span>
            <button
              className="ghost-button"
              type="button"
              onClick={() => setIsEmployeeListCollapsed((currentValue) => !currentValue)}
            >
              {isEmployeeListCollapsed ? "展开" : "折叠"}
            </button>
          </div>
        </div>

        {!isEmployeeListCollapsed ? (
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
                        className={
                          employee.employeeGroup === "active" ? "tag" : "tag tag-warning"
                        }
                      >
                        {employee.employeeGroup === "active" ? "在职" : "本年离职"}
                      </span>
                    </td>
                    <td>{employee.recordedMonthCount}</td>
                    <td>
                      {employee.uneditedMonths.length
                        ? employee.uneditedMonths.join("、")
                        : "-"}
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
        ) : null}
      </article>

      <article className="glass-card page-section placeholder-card">
        <div className="section-header">
          <div>
            <h2>计算结果汇总</h2>
            <p>展示当前已计算快照，可直接进入员工计算结果明细。</p>
          </div>
          <div className="button-row compact">
            <span className="tag">{resultSummaryRows.length} 条结果</span>
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
                <th>姓名</th>
                <th>年度累计应预扣额</th>
                <th>最后一个月适用税率</th>
                <th>采用方案</th>
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
                    <td>
                      <div className="table-inline-actions">
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
                        <span>{row.employeeName}</span>
                      </div>
                    </td>
                    <td>{formatCurrency(row.cumulativeExpectedWithheldTax)}</td>
                    <td>{row.lastAppliedRate === null ? "-" : `${row.lastAppliedRate}%`}</td>
                    <td>{taxCalculationSchemeLabelMap[row.selectedScheme]}</td>
                    <td>{formatCurrency(row.alternativeTaxAmount)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>当前暂无已计算结果，请先执行计算。</td>
                </tr>
              )}
            </tbody>
          </table>
        ) : null}
      </article>

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
          setWorkspaceRows((currentRows) =>
            applyWorkspaceMonthToNextMonth(currentRows, selectedWorkspaceMonth),
          )
        }
        onApplyToFutureMonths={() =>
          setWorkspaceRows((currentRows) =>
            applyWorkspaceMonthToFutureMonths(currentRows, selectedWorkspaceMonth),
          )
        }
      />

      <AnnualTaxResultDialog
        open={Boolean(detailResult)}
        title={detailResult ? `${detailResult.employeeName} 全年计算结果` : ""}
        subtitle={detailResult ? `${detailResult.employeeCode} / ${detailResult.taxYear} 年` : undefined}
        result={detailResult}
        bonusTaxBrackets={bonusTaxBrackets}
        onClose={() => setDetailEmployeeId(null)}
      />
    </section>
  );
};
