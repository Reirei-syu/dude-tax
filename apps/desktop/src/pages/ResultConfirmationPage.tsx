import type { EmployeeAnnualTaxResult } from "@dude-tax/core";
import { DEFAULT_BASIC_DEDUCTION_AMOUNT } from "@dude-tax/config";
import { taxCalculationSchemeLabelMap } from "@dude-tax/core";
import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../api/client";
import { AnnualTaxResultDialog } from "../components/AnnualTaxResultDialog";
import { CollapsibleSectionCard } from "../components/CollapsibleSectionCard";
import { useAppContext } from "../context/AppContextProvider";
import { saveFileWithDesktopFallback } from "../utils/file-save";
import { buildYearRecordWorkbookBuffer } from "./year-record-export";

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("zh-CN", {
    hour12: false,
  });
};

export const ResultConfirmationPage = () => {
  const { context } = useAppContext();
  const currentUnitId = context?.currentUnitId ?? null;
  const currentTaxYear = context?.currentTaxYear ?? null;
  const currentUnit = context?.units.find((unit) => unit.id === currentUnitId) ?? null;

  const [confirmationState, setConfirmationState] = useState<Awaited<
    ReturnType<typeof apiClient.getMonthConfirmationState>
  > | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(1);
  const [results, setResults] = useState<EmployeeAnnualTaxResult[]>([]);
  const [detailEmployeeId, setDetailEmployeeId] = useState<number | null>(null);
  const [basicDeductionAmount, setBasicDeductionAmount] = useState(DEFAULT_BASIC_DEDUCTION_AMOUNT);
  const [bonusTaxBrackets, setBonusTaxBrackets] = useState<
    Awaited<ReturnType<typeof apiClient.getTaxPolicy>>["currentSettings"]["bonusTaxBrackets"]
  >([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const loadPageData = async () => {
    if (!currentUnitId || !currentTaxYear) {
      setConfirmationState(null);
      setResults([]);
      return;
    }

    const [nextState, taxPolicy, nextResults] = await Promise.all([
      apiClient.getMonthConfirmationState(currentUnitId, currentTaxYear),
      apiClient.getTaxPolicy(currentUnitId, currentTaxYear),
      apiClient.listAnnualResults(currentUnitId, currentTaxYear),
    ]);
    setConfirmationState(nextState);
    setResults(nextResults);
    setBasicDeductionAmount(taxPolicy.currentSettings.basicDeductionAmount);
    setBonusTaxBrackets(taxPolicy.currentSettings.bonusTaxBrackets);
    setSelectedMonth((currentMonth) => {
      if (currentMonth >= 1 && currentMonth <= 12) {
        return currentMonth;
      }

      return Math.min(nextState.lastConfirmedMonth + 1 || 1, 12);
    });
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setErrorMessage(null);
        await loadPageData();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "加载结果确认页面失败");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [currentUnitId, currentTaxYear]);

  const currentMonthState =
    confirmationState?.months.find((month) => month.taxMonth === selectedMonth) ?? null;
  const detailResult = useMemo(
    () => results.find((result) => result.employeeId === detailEmployeeId) ?? null,
    [detailEmployeeId, results],
  );

  const handleConfirm = async () => {
    if (!currentUnitId || !currentTaxYear) {
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);
      if (currentMonthState?.isConfirmed) {
        await apiClient.unconfirmMonth(currentUnitId, currentTaxYear, selectedMonth);
        setNoticeMessage(`已取消 ${selectedMonth} 月及其后续月份确认。`);
      } else {
        await apiClient.confirmMonth(currentUnitId, currentTaxYear, selectedMonth);
        setNoticeMessage(`已确认 ${selectedMonth} 月数据。`);
      }
      await loadPageData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "执行确认操作失败");
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
      const workbookArray = await buildYearRecordWorkbookBuffer({
        summarySheetName: "汇总",
        summaryColumns: [
          { key: "employeeCode", label: "工号" },
          { key: "employeeName", label: "姓名" },
          { key: "annualTaxWithheld", label: "年度累计应预扣额" },
          { key: "selectedScheme", label: "方案" },
          { key: "calculatedAt", label: "计算时间" },
        ],
        summaryRows: results.map((result) => ({
          employeeCode: result.employeeCode,
          employeeName: result.employeeName,
          annualTaxWithheld: result.annualTaxWithheld.toFixed(2),
          selectedScheme: taxCalculationSchemeLabelMap[result.selectedScheme],
          calculatedAt: formatDateTime(result.calculatedAt),
        })),
        employees: [],
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
        <CollapsibleSectionCard
          className="placeholder-card"
          description="请先在顶部选择单位和年份，再进入结果确认模块。"
          headingTag="h1"
          title="结果确认"
        />
      </section>
    );
  }

  return (
    <section className="page-grid">
      <CollapsibleSectionCard
        className="placeholder-card"
        description={`当前房间：${currentUnit?.unitName ?? "未选择单位"} / ${currentTaxYear} 年`}
        headingTag="h1"
        headerExtras={<span className="tag">{loading ? "加载中" : "待确认结果"}</span>}
        title="结果确认"
      >
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
            <span>待确认结果数</span>
            <strong>{results.length}</strong>
          </div>
          <div className="summary-card">
            <span>结果覆盖</span>
            <strong>
              {confirmationState?.coverage.calculatedEmployeeCount ?? 0}/
              {confirmationState?.coverage.totalEffectiveEmployeeCount ?? 0}
            </strong>
          </div>
        </div>

        <div className="button-row">
          <button
            className={currentMonthState?.isConfirmed ? "ghost-button" : "primary-button"}
            disabled={
              submitting || (!currentMonthState?.isConfirmed && !currentMonthState?.canConfirm)
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
        {currentMonthState?.blockedReason === "results_incomplete" ? (
          <div className="error-banner">
            当前计算结果未覆盖全部有效员工，请先返回月度数据录入完成全员计算。
          </div>
        ) : null}
        {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}
        {noticeMessage ? <div className="success-banner">{noticeMessage}</div> : null}

        <table className="data-table month-entry-overview-table">
          <thead>
            <tr>
              <th>工号</th>
              <th>姓名</th>
              <th>年度累计应预扣额</th>
              <th>当前方案</th>
              <th>计算时间</th>
            </tr>
          </thead>
          <tbody>
            {results.length ? (
              results.map((result) => (
                <tr
                  key={result.employeeId}
                  className="selectable-row"
                  onClick={() => setDetailEmployeeId(result.employeeId)}
                >
                  <td>{result.employeeCode}</td>
                  <td>
                    <div className="table-inline-actions">
                      <button
                        className="ghost-button table-action-button"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setDetailEmployeeId(result.employeeId);
                        }}
                      >
                        查询明细
                      </button>
                      <span>{result.employeeName}</span>
                    </div>
                  </td>
                  <td>{result.annualTaxWithheld.toFixed(2)}</td>
                  <td>{taxCalculationSchemeLabelMap[result.selectedScheme]}</td>
                  <td>{formatDateTime(result.calculatedAt)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>当前暂无待确认结果，请先返回月度数据录入执行计算。</td>
              </tr>
            )}
          </tbody>
        </table>
      </CollapsibleSectionCard>

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
    </section>
  );
};
