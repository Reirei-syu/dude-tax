import type { ConfirmedAnnualResultDetail, Unit, YearRecordUpsertItem } from "@dude-tax/core";
import { DEFAULT_BASIC_DEDUCTION_AMOUNT } from "@dude-tax/config";
import { taxCalculationSchemeLabelMap } from "@dude-tax/core";
import { useMemo, useState } from "react";
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

export const HistoryQueryPage = () => {
  const { context } = useAppContext();
  const units = context?.units ?? [];

  const [unitId, setUnitId] = useState<number | null>(context?.currentUnitId ?? null);
  const [taxYear, setTaxYear] = useState<number | null>(context?.currentTaxYear ?? null);
  const [results, setResults] =
    useState<Awaited<ReturnType<typeof apiClient.listConfirmedResults>>>([]);
  const [detail, setDetail] = useState<ConfirmedAnnualResultDetail | null>(null);
  const [detailRows, setDetailRows] = useState<YearRecordUpsertItem[]>([]);
  const [detailSelectedMonth, setDetailSelectedMonth] = useState(1);
  const [basicDeductionAmount, setBasicDeductionAmount] = useState(DEFAULT_BASIC_DEDUCTION_AMOUNT);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedUnit = useMemo(
    () => units.find((unit) => unit.id === unitId) ?? null,
    [unitId, units],
  );
  const availableTaxYears = selectedUnit?.availableTaxYears ?? [];

  const runQuery = async () => {
    if (!unitId || !taxYear) {
      setErrorMessage("请先选择单位和年份。");
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      const [nextResults, taxPolicy] = await Promise.all([
        apiClient.listConfirmedResults(unitId, taxYear),
        apiClient.getTaxPolicy(unitId, taxYear),
      ]);
      setResults(nextResults);
      setBasicDeductionAmount(taxPolicy.currentSettings.basicDeductionAmount);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "查询历史结果失败");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (employeeId: number) => {
    if (!unitId || !taxYear) {
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      const nextDetail = await apiClient.getConfirmedResultDetail(unitId, taxYear, employeeId);
      setDetail(nextDetail);
      setDetailRows(toReadonlyRows(nextDetail));
      setDetailSelectedMonth(nextDetail.confirmedMonths[0] ?? 1);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载历史明细失败");
    } finally {
      setLoading(false);
    }
  };

  const downloadWorkbook = async () => {
    if (!unitId || !taxYear || !selectedUnit || !results.length) {
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      const details = await Promise.all(
        results.map((result) => apiClient.getConfirmedResultDetail(unitId, taxYear, result.employeeId)),
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
        defaultPath: `历史查询_${selectedUnit.unitName}_${taxYear}.xlsx`,
        filters: [{ name: "Excel 文件", extensions: ["xlsx"] }],
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        content: workbookArray,
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "导出历史查询失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="page-grid">
      <article className="glass-card page-section placeholder-card">
        <div className="section-header">
          <div>
            <h1>历史查询</h1>
            <p>仅查询已确认数据，按员工查看当年度纳税明细。</p>
          </div>
          <span className="tag">{loading ? "查询中" : "已确认历史数据"}</span>
        </div>

        <div className="form-grid">
          <label className="form-field">
            <span>单位</span>
            <select
              value={unitId ?? ""}
              onChange={(event) => {
                const nextUnitId = event.target.value ? Number(event.target.value) : null;
                const nextUnit = units.find((unit) => unit.id === nextUnitId) ?? null;
                setUnitId(nextUnitId);
                setTaxYear(nextUnit?.availableTaxYears[0] ?? null);
              }}
            >
              <option value="">请选择单位</option>
              {units.map((unit: Unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.unitName}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>年份</span>
            <select
              value={taxYear ?? ""}
              onChange={(event) => setTaxYear(event.target.value ? Number(event.target.value) : null)}
            >
              <option value="">请选择年份</option>
              {availableTaxYears.map((year) => (
                <option key={year} value={year}>
                  {year} 年
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="button-row">
          <button className="primary-button" type="button" onClick={() => void runQuery()}>
            查询
          </button>
          <button
            className="ghost-button"
            disabled={loading || !results.length}
            type="button"
            onClick={() => void downloadWorkbook()}
          >
            导出 Excel
          </button>
        </div>

        {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}

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
                <td colSpan={5}>当前条件下暂无已确认历史数据。</td>
              </tr>
            )}
          </tbody>
        </table>
      </article>

      <YearRecordWorkspaceDialog
        open={Boolean(detail)}
        title={detail ? `${detail.employeeName} 全年已确认明细` : ""}
        subtitle={detail ? `${detail.employeeCode} / ${detail.taxYear} 年` : undefined}
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
