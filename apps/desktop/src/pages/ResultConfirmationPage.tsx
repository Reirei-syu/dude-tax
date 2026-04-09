import type { ConfirmedAnnualResultDetail, YearRecordUpsertItem } from "@dude-tax/core";
import { DEFAULT_BASIC_DEDUCTION_AMOUNT } from "@dude-tax/config";
import { taxCalculationSchemeLabelMap } from "@dude-tax/core";
import { useEffect, useState } from "react";
import { apiClient } from "../api/client";
import { YearRecordWorkspaceDialog } from "../components/YearRecordWorkspaceDialog";
import { useAppContext } from "../context/AppContextProvider";
import { saveFileWithDesktopFallback } from "../utils/file-save";
import { buildYearRecordWorkbookBuffer } from "./year-record-export";

const toReadonlyRows = (detail: ConfirmedAnnualResultDetail): YearRecordUpsertItem[] =>
  detail.months.map((row) => ({
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

export const ResultConfirmationPage = () => {
  const { context } = useAppContext();
  const currentUnitId = context?.currentUnitId ?? null;
  const currentTaxYear = context?.currentTaxYear ?? null;
  const currentUnit = context?.units.find((unit) => unit.id === currentUnitId) ?? null;

  const [confirmationState, setConfirmationState] =
    useState<Awaited<ReturnType<typeof apiClient.getMonthConfirmationState>> | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(1);
  const [results, setResults] = useState<Awaited<ReturnType<typeof apiClient.listConfirmedResults>>>([]);
  const [detail, setDetail] = useState<ConfirmedAnnualResultDetail | null>(null);
  const [detailRows, setDetailRows] = useState<YearRecordUpsertItem[]>([]);
  const [detailSelectedMonth, setDetailSelectedMonth] = useState(1);
  const [basicDeductionAmount, setBasicDeductionAmount] = useState(DEFAULT_BASIC_DEDUCTION_AMOUNT);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const loadConfirmationState = async () => {
    if (!currentUnitId || !currentTaxYear) {
      setConfirmationState(null);
      return;
    }

    const [nextState, taxPolicy] = await Promise.all([
      apiClient.getMonthConfirmationState(currentUnitId, currentTaxYear),
      apiClient.getTaxPolicy(currentUnitId, currentTaxYear),
    ]);
    setConfirmationState(nextState);
    setBasicDeductionAmount(taxPolicy.currentSettings.basicDeductionAmount);
    setSelectedMonth((currentMonth) => {
      const preferredMonth = Math.min(nextState.lastConfirmedMonth + 1 || 1, 12);
      return currentMonth > 12 ? preferredMonth : currentMonth;
    });
  };

  const loadResults = async (throughMonth: number) => {
    if (!currentUnitId || !currentTaxYear) {
      setResults([]);
      return;
    }

    const nextResults = await apiClient.listConfirmedResults(currentUnitId, currentTaxYear, throughMonth);
    setResults(nextResults);
  };

  useEffect(() => {
    const loadPage = async () => {
      if (!currentUnitId || !currentTaxYear) {
        return;
      }

      try {
        setLoading(true);
        setErrorMessage(null);
        await loadConfirmationState();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "加载结果确认状态失败");
      } finally {
        setLoading(false);
      }
    };

    void loadPage();
  }, [currentUnitId, currentTaxYear]);

  useEffect(() => {
    const loadScopedResults = async () => {
      if (!currentUnitId || !currentTaxYear) {
        return;
      }

      try {
        setLoading(true);
        setErrorMessage(null);
        await loadResults(selectedMonth);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "加载已确认结果失败");
      } finally {
        setLoading(false);
      }
    };

    void loadScopedResults();
  }, [currentUnitId, currentTaxYear, selectedMonth]);

  const currentMonthState =
    confirmationState?.months.find((month) => month.taxMonth === selectedMonth) ?? null;

  const handleConfirm = async () => {
    if (!currentUnitId || !currentTaxYear) {
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);
      const nextState = currentMonthState?.isConfirmed
        ? await apiClient.unconfirmMonth(currentUnitId, currentTaxYear, selectedMonth)
        : await apiClient.confirmMonth(currentUnitId, currentTaxYear, selectedMonth);
      setConfirmationState(nextState);
      await loadResults(selectedMonth);
      setNoticeMessage(
        currentMonthState?.isConfirmed
          ? `已取消 ${selectedMonth} 月及其后续月份确认。`
          : `已确认 ${selectedMonth} 月数据。`,
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "执行确认操作失败");
    } finally {
      setSubmitting(false);
    }
  };

  const openDetail = async (employeeId: number) => {
    if (!currentUnitId || !currentTaxYear) {
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);
      const nextDetail = await apiClient.getConfirmedResultDetail(
        currentUnitId,
        currentTaxYear,
        employeeId,
        selectedMonth,
      );
      setDetail(nextDetail);
      setDetailRows(toReadonlyRows(nextDetail));
      setDetailSelectedMonth(nextDetail.confirmedMonths[0] ?? 1);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载确认明细失败");
    } finally {
      setSubmitting(false);
    }
  };

  const downloadWorkbook = async () => {
    if (!currentUnitId || !currentTaxYear || !currentUnit || !results.length) {
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);
      const details = await Promise.all(
        results.map((result) =>
          apiClient.getConfirmedResultDetail(
            currentUnitId,
            currentTaxYear,
            result.employeeId,
            selectedMonth,
          ),
        ),
      );
      const workbookArray = await buildYearRecordWorkbookBuffer({
        summarySheetName: "汇总",
        summaryColumns: [
          { key: "employeeCode", label: "工号" },
          { key: "employeeName", label: "姓名" },
          { key: "annualTaxWithheld", label: "预扣税额" },
          { key: "selectedScheme", label: "方案" },
          { key: "confirmedMonths", label: "已确认月份" },
        ],
        summaryRows: results.map((result) => ({
          employeeCode: result.employeeCode,
          employeeName: result.employeeName,
          annualTaxWithheld: result.annualTaxWithheld.toFixed(2),
          selectedScheme: taxCalculationSchemeLabelMap[result.selectedScheme],
          confirmedMonths: result.confirmedMonths.join("、"),
        })),
        employees: details.map((item) => ({
          employeeCode: item.employeeCode,
          employeeName: item.employeeName,
          rows: toReadonlyRows(item),
        })),
        basicDeductionAmount,
      });
      await saveFileWithDesktopFallback({
        defaultPath: `结果确认_${currentUnit.unitName}_${currentTaxYear}_${selectedMonth}月.xlsx`,
        filters: [{ name: "Excel 文件", extensions: ["xlsx"] }],
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        content: workbookArray,
      });
      setNoticeMessage("结果确认导出已生成。");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "导出结果确认失败");
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentUnitId || !currentTaxYear) {
    return (
      <section className="page-grid">
        <article className="glass-card page-section placeholder-card">
          <h1>结果确认</h1>
          <p>请先在顶部选择单位和年份，再进入结果确认模块。</p>
        </article>
      </section>
    );
  }

  return (
    <section className="page-grid">
      <article className="glass-card page-section placeholder-card">
        <div className="section-header">
          <div>
            <h1>结果确认</h1>
            <p>
              当前房间：{currentUnit?.unitName ?? "未选择单位"} / {currentTaxYear} 年
            </p>
          </div>
          <span className="tag">{loading ? "加载中" : "已确认结果"}</span>
        </div>

        <div className="month-selector-panel">
          {confirmationState?.months.map((month) => (
            <button
              key={month.taxMonth}
              className={
                selectedMonth === month.taxMonth
                  ? month.isConfirmed
                    ? "month-picker-button is-selected is-completed"
                    : "month-picker-button is-selected"
                  : month.isConfirmed
                    ? "month-picker-button is-completed"
                    : "month-picker-button"
              }
              type="button"
              onClick={() => setSelectedMonth(month.taxMonth)}
            >
              {month.taxMonth} 月
            </button>
          ))}
        </div>

        <div className="summary-grid">
          <div className="summary-card">
            <span>已确认到</span>
            <strong>{confirmationState?.lastConfirmedMonth ?? 0} 月</strong>
          </div>
          <div className="summary-card">
            <span>当前月份状态</span>
            <strong>{currentMonthState?.isConfirmed ? "已确认" : "未确认"}</strong>
          </div>
          <div className="summary-card">
            <span>已确认员工结果数</span>
            <strong>{results.length}</strong>
          </div>
        </div>

        <div className="button-row">
          <button
            className={currentMonthState?.isConfirmed ? "ghost-button" : "primary-button"}
            disabled={
              submitting ||
              (!currentMonthState?.isConfirmed && !currentMonthState?.canConfirm)
            }
            type="button"
            onClick={() => void handleConfirm()}
          >
            {currentMonthState?.isConfirmed ? "取消确认本月及后续" : "确认当前月份"}
          </button>
          <button
            className="ghost-button"
            disabled={submitting || !results.length}
            type="button"
            onClick={() => void downloadWorkbook()}
          >
            导出 Excel
          </button>
        </div>

        {currentMonthState?.blockedReason === "previous_month_unconfirmed" ? (
          <div className="error-banner">请先完成前一个月份的确认。</div>
        ) : null}
        {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}
        {noticeMessage ? <div className="success-banner">{noticeMessage}</div> : null}

        <table className="data-table month-entry-overview-table">
          <thead>
            <tr>
              <th>工号</th>
              <th>姓名</th>
              <th>预扣税额</th>
              <th>方案</th>
              <th>已确认月份</th>
            </tr>
          </thead>
          <tbody>
            {results.length ? (
              results.map((result) => (
                <tr
                  key={result.employeeId}
                  className="selectable-row"
                  onClick={() => void openDetail(result.employeeId)}
                >
                  <td>{result.employeeCode}</td>
                  <td>
                    <div className="table-inline-actions">
                      <button
                        className="ghost-button table-action-button"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void openDetail(result.employeeId);
                        }}
                      >
                        查询明细
                      </button>
                      <span>{result.employeeName}</span>
                    </div>
                  </td>
                  <td>{result.annualTaxWithheld.toFixed(2)}</td>
                  <td>{taxCalculationSchemeLabelMap[result.selectedScheme]}</td>
                  <td>{result.confirmedMonths.join("、")}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>当前筛选范围内暂无已确认结果。</td>
              </tr>
            )}
          </tbody>
        </table>
      </article>

      <YearRecordWorkspaceDialog
        open={Boolean(detail)}
        title={detail ? `${detail.employeeName} 已确认明细` : ""}
        subtitle={
          detail ? `${detail.employeeCode} / 已确认月份：${detail.confirmedMonths.join("、")}` : undefined
        }
        rows={detailRows}
        selectedMonth={detailSelectedMonth}
        lockedMonths={detail?.confirmedMonths ?? []}
        basicDeductionAmount={basicDeductionAmount}
        readOnly
        onClose={() => {
          setDetail(null);
          setDetailRows([]);
          setDetailSelectedMonth(1);
        }}
        onSelectMonth={setDetailSelectedMonth}
      />
    </section>
  );
};
