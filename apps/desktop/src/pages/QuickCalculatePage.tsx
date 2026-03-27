import {
  DEFAULT_BASIC_DEDUCTION_AMOUNT,
} from "../../../../packages/config/src/index";
import type {
  AnnualTaxCalculation,
  QuickCalculateMonthInput,
  QuickCalculatePayload,
} from "../../../../packages/core/src/index";
import { useMemo, useState } from "react";
import { apiClient } from "../api/client";
import { useAppContext } from "../context/AppContextProvider";

const emptyQuickCalcRecord = (taxMonth: number): QuickCalculateMonthInput => ({
  taxMonth,
  status: "incomplete",
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

const insuranceFields = [
  { key: "pensionInsurance", label: "养老保险" },
  { key: "medicalInsurance", label: "医疗保险" },
  { key: "occupationalAnnuity", label: "职业年金" },
  { key: "housingFund", label: "公积金" },
  { key: "supplementaryHousingFund", label: "补充公积金" },
  { key: "unemploymentInsurance", label: "失业保险" },
  { key: "workInjuryInsurance", label: "工伤保险" },
] as const;

const specialDeductionFields = [
  { key: "infantCareDeduction", label: "3岁以下婴幼儿照护" },
  { key: "childEducationDeduction", label: "子女教育" },
  { key: "continuingEducationDeduction", label: "继续教育" },
  { key: "housingLoanInterestDeduction", label: "住房贷款利息" },
  { key: "housingRentDeduction", label: "住房租金" },
  { key: "elderCareDeduction", label: "赡养老人" },
  { key: "otherDeduction", label: "其他依法扣除" },
  { key: "taxReductionExemption", label: "减免税额" },
] as const;

const createDefaultRecords = () =>
  Array.from({ length: 12 }, (_, index) => emptyQuickCalcRecord(index + 1));

const parseCurrencyValue = (value: string) => {
  const nextValue = Number(value);
  if (Number.isNaN(nextValue) || nextValue < 0) {
    return 0;
  }

  return nextValue;
};

export const QuickCalculatePage = () => {
  const { context } = useAppContext();
  const currentUnitId = context?.currentUnitId ?? null;
  const currentTaxYear = context?.currentTaxYear ?? null;
  const currentUnit = context?.units.find((unit) => unit.id === currentUnitId) ?? null;

  const [records, setRecords] = useState<QuickCalculateMonthInput[]>(createDefaultRecords);
  const [selectedMonth, setSelectedMonth] = useState(1);
  const [result, setResult] = useState<AnnualTaxCalculation | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedRecord = useMemo(
    () => records.find((record) => record.taxMonth === selectedMonth) ?? emptyQuickCalcRecord(selectedMonth),
    [records, selectedMonth],
  );

  const updateRecord = (taxMonth: number, patch: Partial<QuickCalculateMonthInput>) => {
    setRecords((currentRecords) =>
      currentRecords.map((record) =>
        record.taxMonth === taxMonth ? { ...record, ...patch } : record,
      ),
    );
  };

  const updateNumericField = (field: keyof QuickCalculateMonthInput, value: string) => {
    updateRecord(selectedMonth, {
      [field]: parseCurrencyValue(value),
    } as Partial<QuickCalculateMonthInput>);
  };

  const runQuickCalculate = async () => {
    if (!currentUnitId || !currentTaxYear) {
      setErrorMessage("请先选择单位和年份");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);
      const payload: QuickCalculatePayload = {
        unitId: currentUnitId,
        taxYear: currentTaxYear,
        records,
      };
      const nextResult = await apiClient.quickCalculate(payload) as AnnualTaxCalculation;
      setResult(nextResult);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "执行快速计算失败");
      setResult(null);
    } finally {
      setSubmitting(false);
    }
  };

  const resetQuickCalculate = () => {
    setRecords(createDefaultRecords());
    setSelectedMonth(1);
    setResult(null);
    setErrorMessage(null);
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
    <section className="page-grid month-entry-grid">
      <article className="glass-card page-section">
        <div className="section-header">
          <div>
            <h1>快速计算</h1>
            <p>
              当前房间：{currentUnit?.unitName ?? "未选择单位"} / {currentTaxYear} 年
            </p>
          </div>
          <span className="tag">不落库测算</span>
        </div>

        <div className="year-view-grid">
          <section className="year-quarter-card">
            <div className="year-quarter-header">
              <div>
                <strong>临时月份录入</strong>
                <p>当前输入只用于一次性试算，不会写入员工或月度记录表。</p>
              </div>
            </div>
            <div className="year-month-grid">
              {records.map((record) => (
                <button
                  className={selectedMonth === record.taxMonth ? "year-month-card selected-item" : "year-month-card"}
                  key={record.taxMonth}
                  onClick={() => setSelectedMonth(record.taxMonth)}
                  type="button"
                >
                  <div>
                    <strong>{record.taxMonth} 月</strong>
                    <p>状态：{record.status === "completed" ? "已完成" : "未完成"}</p>
                    <p>
                      工资：{record.salaryIncome.toFixed(2)} / 预扣税：{record.withheldTax.toFixed(2)}
                    </p>
                  </div>
                  <span className={record.status === "completed" ? "tag" : "tag tag-neutral"}>
                    {record.status === "completed" ? "计入试算" : "不计入"}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </article>

      <article className="glass-card page-section">
        <div className="section-header">
          <div>
            <h2>{selectedMonth} 月临时录入</h2>
            <p>快速计算会直接复用当前单位 / 年度的税率口径。</p>
          </div>
          <span className="tag">减除费用：{DEFAULT_BASIC_DEDUCTION_AMOUNT} 元/月</span>
        </div>

        <div className="form-grid">
          <label className="form-field">
            <span>记录状态</span>
            <select
              value={selectedRecord.status}
              onChange={(event) =>
                updateRecord(selectedMonth, {
                  status: event.target.value as QuickCalculateMonthInput["status"],
                })
              }
            >
              <option value="incomplete">未完成</option>
              <option value="completed">已完成</option>
            </select>
          </label>
          <label className="form-field">
            <span>工资收入</span>
            <input
              min="0"
              step="0.01"
              type="number"
              value={selectedRecord.salaryIncome}
              onChange={(event) => updateNumericField("salaryIncome", event.target.value)}
            />
          </label>
          <label className="form-field">
            <span>年终奖</span>
            <input
              min="0"
              step="0.01"
              type="number"
              value={selectedRecord.annualBonus}
              onChange={(event) => updateNumericField("annualBonus", event.target.value)}
            />
          </label>
          <label className="form-field">
            <span>已预扣税额</span>
            <input
              min="0"
              step="0.01"
              type="number"
              value={selectedRecord.withheldTax}
              onChange={(event) => updateNumericField("withheldTax", event.target.value)}
            />
          </label>
        </div>

        <div className="subsection-block">
          <h3>社保公积金类</h3>
          <div className="form-grid">
            {insuranceFields.map((field) => (
              <label className="form-field" key={field.key}>
                <span>{field.label}</span>
                <input
                  min="0"
                  step="0.01"
                  type="number"
                  value={selectedRecord[field.key]}
                  onChange={(event) => updateNumericField(field.key, event.target.value)}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="subsection-block">
          <h3>专项附加与其他扣除</h3>
          <div className="form-grid">
            {specialDeductionFields.map((field) => (
              <label className="form-field" key={field.key}>
                <span>{field.label}</span>
                <input
                  min="0"
                  step="0.01"
                  type="number"
                  value={selectedRecord[field.key]}
                  onChange={(event) => updateNumericField(field.key, event.target.value)}
                />
              </label>
            ))}
          </div>
        </div>

        <label className="form-field">
          <span>备注</span>
          <input
            placeholder="仅用于本次试算"
            value={selectedRecord.remark ?? ""}
            onChange={(event) => updateRecord(selectedMonth, { remark: event.target.value })}
          />
        </label>

        <div className="button-row">
          <button className="ghost-button" disabled={submitting} onClick={resetQuickCalculate}>
            清空重算
          </button>
          <button className="primary-button" disabled={submitting} onClick={() => void runQuickCalculate()}>
            执行快速计算
          </button>
        </div>

        {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}

        {result ? (
          <div className="subsection-block">
            <h3>试算结果</h3>
            <div className="summary-grid results-summary-grid">
              <div className="summary-card">
                <span>采用方案</span>
                <strong>{result.selectedScheme === "separate_bonus" ? "年终奖单独计税" : "并入综合所得"}</strong>
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

            <table className="data-table">
              <thead>
                <tr>
                  <th>方案</th>
                  <th>综合所得税</th>
                  <th>年终奖税额</th>
                  <th>税额合计</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>年终奖单独计税</td>
                  <td>{result.schemeResults.separateBonus.comprehensiveIncomeTax.toFixed(2)}</td>
                  <td>{result.schemeResults.separateBonus.annualBonusTax.toFixed(2)}</td>
                  <td>{result.schemeResults.separateBonus.finalTax.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>并入综合所得</td>
                  <td>{result.schemeResults.combinedBonus.comprehensiveIncomeTax.toFixed(2)}</td>
                  <td>{result.schemeResults.combinedBonus.annualBonusTax.toFixed(2)}</td>
                  <td>{result.schemeResults.combinedBonus.finalTax.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
      </article>
    </section>
  );
};
