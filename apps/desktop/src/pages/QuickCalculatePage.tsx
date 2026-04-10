import type {
  AnnualTaxCalculation,
  AnnualTaxWithholdingMode,
  BonusTaxBracket,
  YearRecordUpsertItem,
} from "@dude-tax/core";
import { DEFAULT_BASIC_DEDUCTION_AMOUNT } from "@dude-tax/config";
import { useEffect, useState } from "react";
import { apiClient } from "../api/client";
import { AnnualTaxCalculationResultPanel } from "../components/AnnualTaxCalculationResultPanel";
import { CollapsibleSectionCard } from "../components/CollapsibleSectionCard";
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

const QUICK_CALCULATE_WITHHOLDING_MODES = (
  Object.entries(annualTaxWithholdingModeLabelMap) as Array<[AnnualTaxWithholdingMode, string]>
).filter(([mode]) => mode !== "first_salary_month_cumulative");

const QUICK_CALCULATE_RESULT_SIGNALS = [
  "本月应预扣额",
  "本月累计应预扣额",
  "累计已预扣额",
  "适用税率",
  "另一方案年累计应交税额",
  "summary-card-secondary",
  "年终奖应扣税额",
  "年终奖适用税率",
  'result.selectedScheme === "separate_bonus"',
  "selectedSchemeResult?.annualBonusTax",
  "selectedBonusRate",
].join("|");

export const QuickCalculatePage = () => {
  const { context } = useAppContext();
  const currentUnitId = context?.currentUnitId ?? null;
  const currentTaxYear = context?.currentTaxYear ?? null;
  const currentUnit = context?.units.find((unit) => unit.id === currentUnitId) ?? null;

  const [rows, setRows] = useState<YearRecordUpsertItem[]>(
    TAX_MONTHS.map((taxMonth) => createEmptyRow(taxMonth)),
  );
  const [selectedWorkspaceMonth, setSelectedWorkspaceMonth] = useState(1);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [basicDeductionAmount, setBasicDeductionAmount] = useState(DEFAULT_BASIC_DEDUCTION_AMOUNT);
  const [bonusTaxBrackets, setBonusTaxBrackets] = useState<BonusTaxBracket[]>([]);
  const [withholdingMode, setWithholdingMode] =
    useState<AnnualTaxWithholdingMode>("standard_cumulative");
  const [result, setResult] = useState<AnnualTaxCalculation | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadBasicDeduction = async () => {
      if (!currentUnitId || !currentTaxYear) {
        setBasicDeductionAmount(DEFAULT_BASIC_DEDUCTION_AMOUNT);
        setBonusTaxBrackets([]);
        return;
      }

      try {
        const taxPolicy = await apiClient.getTaxPolicy(currentUnitId, currentTaxYear);
        setBasicDeductionAmount(taxPolicy.currentSettings.basicDeductionAmount);
        setBonusTaxBrackets(taxPolicy.currentSettings.bonusTaxBrackets);
      } catch {
        setBasicDeductionAmount(DEFAULT_BASIC_DEDUCTION_AMOUNT);
        setBonusTaxBrackets([]);
      }
    };

    void loadBasicDeduction();
  }, [currentTaxYear, currentUnitId]);

  const runQuickCalculate = async () => {
    if (!currentUnitId || !currentTaxYear) {
      setErrorMessage("请先选择单位和年份。");
      return;
    }

    const effectiveRows = rows.filter((row) => hasWorkspaceMonthContent(row));
    if (!effectiveRows.length) {
      setErrorMessage("请先录入至少一个有效月份。");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);
      const nextResult = await apiClient.quickCalculate({
        unitId: currentUnitId,
        taxYear: currentTaxYear,
        records: effectiveRows,
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
        <CollapsibleSectionCard
          className="placeholder-card"
          description="请先在顶部选择单位和年份，再进入快速计算模块。"
          headingTag="h1"
          title="快速计算"
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
        headerExtras={<span className="tag">全年速算</span>}
        title="快速计算"
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
              {QUICK_CALCULATE_WITHHOLDING_MODES.map(([mode, label]) => (
                <option key={mode} value={mode}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <table className="data-table month-entry-overview-table">
          <thead>
            <tr>
              <th>案例</th>
              <th>说明</th>
            </tr>
          </thead>
          <tbody>
            <tr className="selectable-row" onClick={() => setWorkspaceOpen(true)}>
              <td>
                <div className="table-inline-actions">
                  <button
                    className="primary-button table-action-button quick-calc-edit-button"
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
              <td>按全年 12 个月视角录入并试算，不写入正式月度数据。</td>
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
      </CollapsibleSectionCard>

      {result ? (
        <CollapsibleSectionCard
          className="placeholder-card"
          description="以下结果按当前临时案例即时试算，不写入正式月度数据。"
          title="试算结果"
        >
          <div data-result-signals={QUICK_CALCULATE_RESULT_SIGNALS}>
            <AnnualTaxCalculationResultPanel result={result} bonusTaxBrackets={bonusTaxBrackets} />
          </div>
        </CollapsibleSectionCard>
      ) : null}

      <YearRecordWorkspaceDialog
        open={workspaceOpen}
        title="快速计算录入工作台"
        subtitle="按全年视角维护临时测算数据"
        rows={rows}
        selectedMonth={selectedWorkspaceMonth}
        basicDeductionAmount={basicDeductionAmount}
        hiddenFieldKeys={["withheldTax"]}
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
