import type {
  AnnualTaxCalculation,
  AnnualTaxWithholdingMode,
  QuickCalculatePayload,
  YearRecordUpsertItem,
} from "@dude-tax/core";
import { DEFAULT_BASIC_DEDUCTION_AMOUNT } from "@dude-tax/config";
import { taxCalculationSchemeLabelMap } from "@dude-tax/core";
import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../api/client";
import { YearRecordWorkspaceDialog } from "../components/YearRecordWorkspaceDialog";
import { useAppContext } from "../context/AppContextProvider";
import { annualTaxWithholdingModeLabelMap } from "./annual-tax-withholding-summary";
import {
  applyWorkspaceMonthToFutureMonths,
  applyWorkspaceMonthToNextMonth,
  hasWorkspaceMonthContent,
} from "./year-record-workspace";

const TAX_MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

const createEmptyRow = (taxMonth: number): YearRecordUpsertItem => ({
  taxMonth,
  salaryIncome: 0,
  annualBonus: 0,
  pensionInsurance: 0,
  medicalInsurance: 0,
  occupationalAnnuity: 0,
  housingFund: 0,
  supplementaryHousingFund: 0,
  unemploymentInsurance: 0,
  workInjuryInsurance: 0,
  withheldTax: 0,
  otherIncome: 0,
  otherIncomeRemark: "",
  infantCareDeduction: 0,
  childEducationDeduction: 0,
  continuingEducationDeduction: 0,
  housingLoanInterestDeduction: 0,
  housingRentDeduction: 0,
  elderCareDeduction: 0,
  otherDeduction: 0,
  taxReductionExemption: 0,
  remark: "",
});

const toggleSelectedMonth = (selectedMonths: number[], taxMonth: number) => {
  if (selectedMonths.includes(taxMonth)) {
    return selectedMonths.length === 1
      ? selectedMonths
      : selectedMonths.filter((item) => item !== taxMonth);
  }

  return [...selectedMonths, taxMonth].sort((left, right) => left - right);
};

const createPreviewPayload = (
  unitId: number,
  taxYear: number,
  rows: YearRecordUpsertItem[],
  selectedMonths: number[],
  withholdingMode: AnnualTaxWithholdingMode,
): QuickCalculatePayload | null => {
  const previewRows = rows
    .filter((row) => selectedMonths.includes(row.taxMonth))
    .filter((row) => hasWorkspaceMonthContent(row));

  if (!previewRows.length) {
    return null;
  }

  return {
    unitId,
    taxYear,
    records: previewRows,
    withholdingContext: {
      mode: withholdingMode,
    },
  };
};

export const QuickCalculatePage = () => {
  const { context } = useAppContext();
  const currentUnitId = context?.currentUnitId ?? null;
  const currentTaxYear = context?.currentTaxYear ?? null;
  const currentUnit = context?.units.find((unit) => unit.id === currentUnitId) ?? null;

  const [rows, setRows] = useState<YearRecordUpsertItem[]>(
    TAX_MONTHS.map((taxMonth) => createEmptyRow(taxMonth)),
  );
  const [selectedMonths, setSelectedMonths] = useState<number[]>([1]);
  const [selectedWorkspaceMonth, setSelectedWorkspaceMonth] = useState(1);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [basicDeductionAmount, setBasicDeductionAmount] = useState(DEFAULT_BASIC_DEDUCTION_AMOUNT);
  const [withholdingMode, setWithholdingMode] =
    useState<AnnualTaxWithholdingMode>("standard_cumulative");
  const [previewResult, setPreviewResult] = useState<AnnualTaxCalculation | null>(null);
  const [result, setResult] = useState<AnnualTaxCalculation | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadBasicDeduction = async () => {
      if (!currentUnitId || !currentTaxYear) {
        setBasicDeductionAmount(DEFAULT_BASIC_DEDUCTION_AMOUNT);
        return;
      }

      try {
        const taxPolicy = await apiClient.getTaxPolicy(currentUnitId, currentTaxYear);
        setBasicDeductionAmount(taxPolicy.currentSettings.basicDeductionAmount);
      } catch {
        setBasicDeductionAmount(DEFAULT_BASIC_DEDUCTION_AMOUNT);
      }
    };

    void loadBasicDeduction();
  }, [currentTaxYear, currentUnitId]);

  useEffect(() => {
    const loadPreview = async () => {
      if (!currentUnitId || !currentTaxYear) {
        setPreviewResult(null);
        return;
      }

      const previewPayload = createPreviewPayload(
        currentUnitId,
        currentTaxYear,
        rows,
        selectedMonths,
        withholdingMode,
      );
      if (!previewPayload) {
        setPreviewResult(null);
        return;
      }

      try {
        setLoadingPreview(true);
        const nextResult = await apiClient.quickCalculate(previewPayload);
        setPreviewResult(nextResult);
      } catch {
        setPreviewResult(null);
      } finally {
        setLoadingPreview(false);
      }
    };

    void loadPreview();
  }, [currentTaxYear, currentUnitId, rows, selectedMonths.join(","), withholdingMode]);

  const totalWithheldTax = useMemo(
    () =>
      rows
        .filter((row) => selectedMonths.includes(row.taxMonth))
        .reduce((sum, row) => sum + row.withheldTax, 0),
    [rows, selectedMonths],
  );

  const uneditedMonths = useMemo(
    () => rows.filter((row) => !hasWorkspaceMonthContent(row)).map((row) => row.taxMonth),
    [rows],
  );

  const runQuickCalculate = async () => {
    if (!currentUnitId || !currentTaxYear) {
      setErrorMessage("请先选择单位和年份。");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);
      const nextResult = await apiClient.quickCalculate({
        unitId: currentUnitId,
        taxYear: currentTaxYear,
        records: rows.filter((row) => hasWorkspaceMonthContent(row)),
        withholdingContext: {
          mode: withholdingMode,
        },
      });
      setResult(nextResult);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "执行快速计算失败");
      setResult(null);
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentUnitId || !currentTaxYear) {
    return (
      <section className="page-grid">
        <article className="glass-card page-section placeholder-card">
          <h1>快速计算</h1>
          <p>请先在顶部选择单位和年份，再进入快速计算模块。</p>
        </article>
      </section>
    );
  }

  return (
    <section className="page-grid">
      <article className="glass-card page-section placeholder-card">
        <div className="section-header">
          <div>
            <h1>快速计算</h1>
            <p>
              当前房间：{currentUnit?.unitName ?? "未选择单位"} / {currentTaxYear} 年
            </p>
          </div>
          <span className="tag">单案例工作台</span>
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
              {(
                Object.entries(annualTaxWithholdingModeLabelMap) as Array<
                  [AnnualTaxWithholdingMode, string]
                >
              ).map(([mode, label]) => (
                <option key={mode} value={mode}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="month-selector-panel">
          {TAX_MONTHS.map((taxMonth) => (
            <button
              key={taxMonth}
              className={
                selectedMonths.includes(taxMonth)
                  ? "month-picker-button is-selected"
                  : "month-picker-button"
              }
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
            <span>所选月份预扣税额合计</span>
            <strong>{totalWithheldTax.toFixed(2)}</strong>
          </div>
          <div className="summary-card">
            <span>预览方案</span>
            <strong>
              {previewResult ? taxCalculationSchemeLabelMap[previewResult.selectedScheme] : "-"}
            </strong>
          </div>
          <div className="summary-card">
            <span>未编辑月份</span>
            <strong>{uneditedMonths.length ? uneditedMonths.join("、") : "-"}</strong>
          </div>
        </div>

        <table className="data-table month-entry-overview-table">
          <thead>
            <tr>
              <th>案例</th>
              <th>预扣税额</th>
              <th>方案</th>
              <th>未编辑月份</th>
            </tr>
          </thead>
          <tbody>
            <tr className="selectable-row" onClick={() => setWorkspaceOpen(true)}>
              <td>
                <div className="table-inline-actions">
                  <button
                    className="ghost-button table-action-button"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setWorkspaceOpen(true);
                    }}
                  >
                    编辑
                  </button>
                  <span>临时测算案例</span>
                </div>
              </td>
              <td>{totalWithheldTax.toFixed(2)}</td>
              <td>
                {previewResult ? taxCalculationSchemeLabelMap[previewResult.selectedScheme] : "-"}
              </td>
              <td>{uneditedMonths.length ? uneditedMonths.join("、") : "-"}</td>
            </tr>
          </tbody>
        </table>

        <div className="button-row">
          <button
            className="ghost-button"
            type="button"
            onClick={() => {
              setRows(TAX_MONTHS.map((taxMonth) => createEmptyRow(taxMonth)));
              setResult(null);
              setErrorMessage(null);
            }}
          >
            清空案例
          </button>
          <button
            className="primary-button"
            disabled={submitting}
            type="button"
            onClick={() => void runQuickCalculate()}
          >
            执行快速计算
          </button>
        </div>

        {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}
        {loadingPreview ? <div className="success-banner">正在刷新预览方案…</div> : null}
      </article>

      {result ? (
        <article className="glass-card page-section placeholder-card">
          <div className="section-header">
            <div>
              <h2>试算结果</h2>
              <p>以下结果按当前临时案例即时试算，不写入正式月度数据。</p>
            </div>
          </div>

          <div className="summary-grid results-summary-grid">
            <div className="summary-card">
              <span>采用方案</span>
              <strong>{taxCalculationSchemeLabelMap[result.selectedScheme]}</strong>
            </div>
            <div className="summary-card">
              <span>年度应纳税额</span>
              <strong>{result.annualTaxPayable.toFixed(2)}</strong>
            </div>
            <div className="summary-card">
              <span>全年已预扣税额</span>
              <strong>{result.annualTaxWithheld.toFixed(2)}</strong>
            </div>
            <div className="summary-card">
              <span>应补 / 应退</span>
              <strong>{result.annualTaxSettlement.toFixed(2)}</strong>
            </div>
          </div>
        </article>
      ) : null}

      <YearRecordWorkspaceDialog
        open={workspaceOpen}
        title="快速计算录入工作台"
        subtitle="不填写姓名等基本信息，按 12 个月维护临时测算数据"
        rows={rows}
        selectedMonth={selectedWorkspaceMonth}
        basicDeductionAmount={basicDeductionAmount}
        onClose={() => setWorkspaceOpen(false)}
        onSelectMonth={setSelectedWorkspaceMonth}
        onChangeRow={(taxMonth, key, value) =>
          setRows((currentRows) =>
            currentRows.map((row) =>
              row.taxMonth === taxMonth
                ? {
                    ...row,
                    [key]: value,
                  }
                : row,
            ),
          )
        }
        onApplyToNextMonth={() =>
          setRows((currentRows) =>
            applyWorkspaceMonthToNextMonth(currentRows, selectedWorkspaceMonth),
          )
        }
        onApplyToFutureMonths={() =>
          setRows((currentRows) =>
            applyWorkspaceMonthToFutureMonths(currentRows, selectedWorkspaceMonth),
          )
        }
      />
    </section>
  );
};
