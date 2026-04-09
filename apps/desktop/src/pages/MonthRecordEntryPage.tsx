import type { EmployeeYearRecordWorkspace, YearRecordUpsertItem } from "@dude-tax/core";
import { taxCalculationSchemeLabelMap } from "@dude-tax/core";
import { DEFAULT_BASIC_DEDUCTION_AMOUNT } from "@dude-tax/config";
import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../api/client";
import { YearRecordWorkspaceDialog } from "../components/YearRecordWorkspaceDialog";
import { useAppContext } from "../context/AppContextProvider";
import { saveFileWithDesktopFallback } from "../utils/file-save";
import { buildYearRecordWorkbookBuffer } from "./year-record-export";
import {
  applyWorkspaceMonthToFutureMonths,
  applyWorkspaceMonthToNextMonth,
  getDirtyWorkspaceMonths,
} from "./year-record-workspace";

const TAX_MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

const toEditableRows = (workspace: EmployeeYearRecordWorkspace): YearRecordUpsertItem[] =>
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

const toggleSelectedMonth = (selectedMonths: number[], taxMonth: number) => {
  if (selectedMonths.includes(taxMonth)) {
    return selectedMonths.length === 1
      ? selectedMonths
      : selectedMonths.filter((item) => item !== taxMonth);
  }

  return [...selectedMonths, taxMonth].sort((left, right) => left - right);
};

export const MonthRecordEntryPage = () => {
  const { context } = useAppContext();
  const currentUnitId = context?.currentUnitId ?? null;
  const currentTaxYear = context?.currentTaxYear ?? null;
  const currentUnit = context?.units.find((unit) => unit.id === currentUnitId) ?? null;

  const [selectedMonths, setSelectedMonths] = useState<number[]>([1]);
  const [overview, setOverview] =
    useState<Awaited<ReturnType<typeof apiClient.getYearEntryOverview>> | null>(null);
  const [workspace, setWorkspace] = useState<EmployeeYearRecordWorkspace | null>(null);
  const [workspaceRows, setWorkspaceRows] = useState<YearRecordUpsertItem[]>([]);
  const [originalWorkspaceRows, setOriginalWorkspaceRows] = useState<YearRecordUpsertItem[]>([]);
  const [selectedWorkspaceMonth, setSelectedWorkspaceMonth] = useState(1);
  const [basicDeductionAmount, setBasicDeductionAmount] = useState(DEFAULT_BASIC_DEDUCTION_AMOUNT);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const loadOverview = async () => {
    if (!currentUnitId || !currentTaxYear) {
      setOverview(null);
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      const [nextOverview, taxPolicy] = await Promise.all([
        apiClient.getYearEntryOverview(currentUnitId, currentTaxYear, selectedMonths),
        apiClient.getTaxPolicy(currentUnitId, currentTaxYear),
      ]);
      setOverview(nextOverview);
      setBasicDeductionAmount(taxPolicy.currentSettings.basicDeductionAmount);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载月度数据录入总览失败");
      setOverview(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOverview();
  }, [currentUnitId, currentTaxYear, selectedMonths.join(",")]);

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
      setSelectedWorkspaceMonth(selectedMonths[0] ?? 1);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载员工工作台失败");
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
      await loadOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "保存员工年度数据失败");
    } finally {
      setSaving(false);
    }
  };

  const selectedMonthsLabel = useMemo(() => selectedMonths.join("、"), [selectedMonths]);

  const downloadWorkbook = async () => {
    if (!currentUnitId || !currentTaxYear || !currentUnit || !overview?.employees.length) {
      return;
    }

    try {
      setSaving(true);
      setErrorMessage(null);
      const workspaces = await Promise.all(
        overview.employees.map((employee) =>
          apiClient.getEmployeeYearWorkspace(currentUnitId, currentTaxYear, employee.employeeId),
        ),
      );

      const workbookArray = await buildYearRecordWorkbookBuffer({
        summarySheetName: "汇总",
        summaryColumns: [
          { key: "employeeCode", label: "工号" },
          { key: "employeeName", label: "姓名" },
          { key: "totalWithheldTax", label: "预扣税额" },
          { key: "optimalScheme", label: "方案" },
          { key: "uneditedMonths", label: "未编辑月份" },
        ],
        summaryRows: overview.employees.map((employee) => ({
          employeeCode: employee.employeeCode,
          employeeName: employee.employeeName,
          totalWithheldTax: employee.totalWithheldTax.toFixed(2),
          optimalScheme: employee.optimalScheme
            ? taxCalculationSchemeLabelMap[employee.optimalScheme]
            : "-",
          uneditedMonths: employee.uneditedMonths.length ? employee.uneditedMonths.join("、") : "-",
        })),
        employees: workspaces.map((item) => ({
          employeeCode: item.employeeCode,
          employeeName: item.employeeName,
          rows: toEditableRows(item).filter((row) => selectedMonths.includes(row.taxMonth)),
        })),
        basicDeductionAmount,
      });

      await saveFileWithDesktopFallback({
        defaultPath: `月度数据录入_${currentUnit.unitName}_${currentTaxYear}_${selectedMonths.join("-")}.xlsx`,
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
    <section className="page-grid">
      <article className="glass-card page-section placeholder-card">
        <div className="section-header">
          <div>
            <h1>月度数据录入</h1>
            <p>
              当前房间：{currentUnit?.unitName ?? "未选择单位"} / {currentTaxYear} 年
            </p>
          </div>
          <span className="tag">{loading ? "加载中" : "年度员工总览"}</span>
        </div>

        <div className="month-selector-panel">
          {TAX_MONTHS.map((taxMonth) => (
            <button
              key={taxMonth}
              className={selectedMonths.includes(taxMonth) ? "month-picker-button is-selected" : "month-picker-button"}
              type="button"
              onClick={() =>
                setSelectedMonths((currentMonths) => toggleSelectedMonth(currentMonths, taxMonth))
              }
            >
              {taxMonth} 月
            </button>
          ))}
        </div>

        <div className="summary-grid">
          <div className="summary-card">
            <span>所选月份</span>
            <strong>{selectedMonthsLabel}</strong>
          </div>
          <div className="summary-card">
            <span>所选月份预扣税额合计</span>
            <strong>{overview?.totalWithheldTax.toFixed(2) ?? "0.00"}</strong>
          </div>
          <div className="summary-card">
            <span>员工数量</span>
            <strong>{overview?.employees.length ?? 0}</strong>
          </div>
        </div>

        <div className="button-row">
          <button
            className="ghost-button"
            disabled={saving || !overview?.employees.length}
            type="button"
            onClick={() => void downloadWorkbook()}
          >
            导出 Excel
          </button>
        </div>

        {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}
        {noticeMessage ? <div className="success-banner">{noticeMessage}</div> : null}

        <table className="data-table month-entry-overview-table">
          <thead>
            <tr>
              <th>工号</th>
              <th>姓名</th>
              <th>预扣税额</th>
              <th>方案</th>
              <th>未编辑月份</th>
            </tr>
          </thead>
          <tbody>
            {overview?.employees.length ? (
              overview.employees.map((employee) => (
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
                  <td>{employee.totalWithheldTax.toFixed(2)}</td>
                  <td>
                    {employee.optimalScheme
                      ? taxCalculationSchemeLabelMap[employee.optimalScheme]
                      : "-"}
                  </td>
                  <td>{employee.uneditedMonths.length ? employee.uneditedMonths.join("、") : "-"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>当前年度暂无可录入员工。</td>
              </tr>
            )}
          </tbody>
        </table>
      </article>

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
    </section>
  );
};
