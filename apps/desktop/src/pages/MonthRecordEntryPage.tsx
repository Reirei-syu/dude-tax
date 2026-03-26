import {
  DEFAULT_BASIC_DEDUCTION_AMOUNT,
} from "../../../../packages/config/src/index";
import type {
  Employee,
  EmployeeMonthRecord,
  UpsertEmployeeMonthRecordPayload,
} from "../../../../packages/core/src/index";
import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../api/client";
import { useAppContext } from "../context/AppContextProvider";
import {
  applyBatchEditDrafts,
  buildEffectiveMonthRecords,
  clearBatchEditDrafts,
  getBatchSaveTargetMonths,
  toggleBatchMonthSelection,
} from "./month-record-batch-edit";
import { buildCopiedMonthRecordPayload, hasMonthRecordContent } from "./month-record-copy";
import {
  buildMonthRecordDraftDiffSummary,
  getMonthRecordDraftDiffs,
} from "./month-record-diff";
import { buildMonthRecordSummary } from "./month-record-progress";
import { buildMonthRecordYearView } from "./month-record-year-view";

const emptyMonthRecordPayload: UpsertEmployeeMonthRecordPayload = {
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
};

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

const parseCurrencyValue = (value: string) => {
  const nextValue = Number(value);
  if (Number.isNaN(nextValue) || nextValue < 0) {
    return 0;
  }

  return nextValue;
};

const toMonthRecordPayload = (
  record: EmployeeMonthRecord | null,
): UpsertEmployeeMonthRecordPayload => ({
  status: record?.status ?? emptyMonthRecordPayload.status,
  salaryIncome: record?.salaryIncome ?? 0,
  annualBonus: record?.annualBonus ?? 0,
  pensionInsurance: record?.pensionInsurance ?? 0,
  medicalInsurance: record?.medicalInsurance ?? 0,
  occupationalAnnuity: record?.occupationalAnnuity ?? 0,
  housingFund: record?.housingFund ?? 0,
  supplementaryHousingFund: record?.supplementaryHousingFund ?? 0,
  unemploymentInsurance: record?.unemploymentInsurance ?? 0,
  workInjuryInsurance: record?.workInjuryInsurance ?? 0,
  withheldTax: record?.withheldTax ?? 0,
  infantCareDeduction: record?.infantCareDeduction ?? 0,
  childEducationDeduction: record?.childEducationDeduction ?? 0,
  continuingEducationDeduction: record?.continuingEducationDeduction ?? 0,
  housingLoanInterestDeduction: record?.housingLoanInterestDeduction ?? 0,
  housingRentDeduction: record?.housingRentDeduction ?? 0,
  elderCareDeduction: record?.elderCareDeduction ?? 0,
  otherDeduction: record?.otherDeduction ?? 0,
  taxReductionExemption: record?.taxReductionExemption ?? 0,
  remark: record?.remark ?? "",
});

export const MonthRecordEntryPage = () => {
  const { context } = useAppContext();
  const currentUnitId = context?.currentUnitId ?? null;
  const currentTaxYear = context?.currentTaxYear ?? null;
  const currentUnit = context?.units.find((unit) => unit.id === currentUnitId) ?? null;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [monthRecords, setMonthRecords] = useState<EmployeeMonthRecord[]>([]);
  const [draftPayloadByMonth, setDraftPayloadByMonth] = useState<
    Partial<Record<number, UpsertEmployeeMonthRecordPayload>>
  >({});
  const [selectedBatchMonths, setSelectedBatchMonths] = useState<number[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number>(1);
  const [form, setForm] = useState<UpsertEmployeeMonthRecordPayload>(emptyMonthRecordPayload);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const effectiveMonthRecords = useMemo(
    () => buildEffectiveMonthRecords(monthRecords, draftPayloadByMonth),
    [draftPayloadByMonth, monthRecords],
  );
  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === selectedEmployeeId) ?? null,
    [employees, selectedEmployeeId],
  );

  const selectedRecord = useMemo(
    () => effectiveMonthRecords.find((record) => record.taxMonth === selectedMonth) ?? null,
    [effectiveMonthRecords, selectedMonth],
  );
  const previousMonthRecord = useMemo(
    () => effectiveMonthRecords.find((record) => record.taxMonth === selectedMonth - 1) ?? null,
    [effectiveMonthRecords, selectedMonth],
  );
  const canCopyPreviousMonth = selectedMonth > 1 && hasMonthRecordContent(previousMonthRecord);
  const monthSummary = useMemo(
    () => buildMonthRecordSummary(effectiveMonthRecords),
    [effectiveMonthRecords],
  );
  const yearView = useMemo(
    () => buildMonthRecordYearView(effectiveMonthRecords),
    [effectiveMonthRecords],
  );
  const draftMonthCount = useMemo(
    () => Object.keys(draftPayloadByMonth).length,
    [draftPayloadByMonth],
  );
  const draftDiffSummary = useMemo(
    () => buildMonthRecordDraftDiffSummary(monthRecords, draftPayloadByMonth),
    [draftPayloadByMonth, monthRecords],
  );
  const changedMonthsSet = useMemo(
    () => new Set(draftDiffSummary.changedMonths),
    [draftDiffSummary.changedMonths],
  );
  const selectedMonthDiffs = useMemo(() => {
    const savedRecord = monthRecords.find((record) => record.taxMonth === selectedMonth) ?? null;
    if (!savedRecord) {
      return [];
    }

    return getMonthRecordDraftDiffs(savedRecord, draftPayloadByMonth[selectedMonth]);
  }, [draftPayloadByMonth, monthRecords, selectedMonth]);

  const loadEmployees = async () => {
    if (!currentUnitId) {
      setEmployees([]);
      setSelectedEmployeeId(null);
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      setNoticeMessage(null);
      const nextEmployees = await apiClient.listEmployees(currentUnitId);
      setEmployees(nextEmployees);
      setSelectedEmployeeId((currentEmployeeId) =>
        currentEmployeeId && nextEmployees.some((employee) => employee.id === currentEmployeeId)
          ? currentEmployeeId
          : nextEmployees[0]?.id ?? null,
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载员工列表失败");
    } finally {
      setLoading(false);
    }
  };

  const loadMonthRecords = async (employeeId: number) => {
    if (!currentUnitId || !currentTaxYear) {
      setMonthRecords([]);
      setForm(emptyMonthRecordPayload);
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      setNoticeMessage(null);
      const nextRecords = await apiClient.listMonthRecords(currentUnitId, currentTaxYear, employeeId);
      setMonthRecords(nextRecords);
      const nextSelectedMonth = nextRecords.some((record) => record.taxMonth === selectedMonth)
        ? selectedMonth
        : 1;
      setSelectedMonth(nextSelectedMonth);
      setForm(toMonthRecordPayload(nextRecords.find((record) => record.taxMonth === nextSelectedMonth) ?? null));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载月度记录失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEmployees();
  }, [currentUnitId]);

  useEffect(() => {
    if (!selectedEmployeeId) {
      setMonthRecords([]);
      setDraftPayloadByMonth({});
      setSelectedBatchMonths([]);
      setForm(emptyMonthRecordPayload);
      return;
    }

    setDraftPayloadByMonth({});
    setSelectedBatchMonths([]);
    void loadMonthRecords(selectedEmployeeId);
  }, [selectedEmployeeId, currentUnitId, currentTaxYear]);

  useEffect(() => {
    setForm(toMonthRecordPayload(selectedRecord));
  }, [selectedRecord]);

  const updateNumericField = (
    field: keyof UpsertEmployeeMonthRecordPayload,
    value: string,
  ) => {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: parseCurrencyValue(value),
    }));
  };

  const saveMonthRecord = async () => {
    if (!currentUnitId || !currentTaxYear || !selectedEmployeeId) {
      setErrorMessage("请先选择单位、年份和员工");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);
      setNoticeMessage(null);
      await apiClient.upsertMonthRecord(
        currentUnitId,
        currentTaxYear,
        selectedEmployeeId,
        selectedMonth,
        form,
      );
      setDraftPayloadByMonth((currentDrafts) =>
        clearBatchEditDrafts(currentDrafts, [selectedMonth]),
      );
      await loadMonthRecords(selectedEmployeeId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "保存月度记录失败");
    } finally {
      setSubmitting(false);
    }
  };

  const copyPreviousMonth = () => {
    if (!previousMonthRecord || !canCopyPreviousMonth) {
      setErrorMessage("上月没有可复制的数据");
      return;
    }

    setErrorMessage(null);
    setNoticeMessage(`已复制 ${selectedMonth - 1} 月数据到当前月份，尚未保存。`);
    setForm(buildCopiedMonthRecordPayload(previousMonthRecord));
  };

  const applyBatchEdit = () => {
    if (!selectedBatchMonths.length) {
      setErrorMessage("请先选择需要批量编辑的月份");
      return;
    }

    setErrorMessage(null);
    setNoticeMessage(`已将当前表单应用到 ${selectedBatchMonths.join("、")} 月，尚未保存。`);
    setDraftPayloadByMonth((currentDrafts) =>
      applyBatchEditDrafts(currentDrafts, selectedBatchMonths, form),
    );
  };

  const clearSelectedBatchDrafts = () => {
    if (!selectedBatchMonths.length) {
      setErrorMessage("请先选择需要清空草稿的月份");
      return;
    }

    setErrorMessage(null);
    setNoticeMessage(`已清空 ${selectedBatchMonths.join("、")} 月的本地草稿。`);
    setDraftPayloadByMonth((currentDrafts) =>
      clearBatchEditDrafts(currentDrafts, selectedBatchMonths),
    );
  };

  const saveSelectedBatchDrafts = async () => {
    if (!currentUnitId || !currentTaxYear || !selectedEmployeeId) {
      setErrorMessage("请先选择单位、年份和员工");
      return;
    }

    const targetMonths = getBatchSaveTargetMonths(selectedBatchMonths, draftPayloadByMonth);
    if (!targetMonths.length) {
      setErrorMessage("所选月份没有可保存的草稿");
      return;
    }

    const savedMonths: number[] = [];
    const failedMonths: number[] = [];
    let lastErrorMessage = "";

    try {
      setSubmitting(true);
      setErrorMessage(null);
      setNoticeMessage(null);

      for (const taxMonth of targetMonths) {
        const draftPayload = draftPayloadByMonth[taxMonth];
        if (!draftPayload) {
          continue;
        }

        try {
          await apiClient.upsertMonthRecord(
            currentUnitId,
            currentTaxYear,
            selectedEmployeeId,
            taxMonth,
            draftPayload,
          );
          savedMonths.push(taxMonth);
        } catch (error) {
          failedMonths.push(taxMonth);
          lastErrorMessage = error instanceof Error ? error.message : "批量保存失败";
        }
      }

      if (savedMonths.length) {
        setDraftPayloadByMonth((currentDrafts) =>
          clearBatchEditDrafts(currentDrafts, savedMonths),
        );
        await loadMonthRecords(selectedEmployeeId);
      }

      setSelectedBatchMonths(failedMonths);

      if (failedMonths.length) {
        if (savedMonths.length) {
          setNoticeMessage(`已保存 ${savedMonths.join("、")} 月草稿。`);
        }
        setErrorMessage(
          `以下月份保存失败：${failedMonths.join("、")} 月。${lastErrorMessage}`,
        );
        return;
      }

      setNoticeMessage(`已保存 ${savedMonths.join("、")} 月草稿。`);
    } finally {
      setSubmitting(false);
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
    <section className="page-grid month-entry-grid">
      <article className="glass-card page-section">
        <div className="section-header">
          <div>
            <h1>月度数据录入</h1>
            <p>
              当前房间：{currentUnit?.unitName ?? "未选择单位"} / {currentTaxYear} 年
            </p>
          </div>
          <span className="tag">{loading ? "加载中" : "基础录入已开启"}</span>
        </div>

        <div className="month-entry-toolbar">
          <label className="form-field">
            <span>当前员工</span>
            <select
              disabled={!employees.length}
              value={selectedEmployeeId ?? ""}
              onChange={(event) => setSelectedEmployeeId(event.target.value ? Number(event.target.value) : null)}
            >
              {!employees.length ? <option value="">请先新增员工</option> : null}
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.employeeName}（{employee.employeeCode}）
                </option>
              ))}
            </select>
          </label>
        </div>

        {selectedEmployee ? (
          <div className="summary-grid detail-summary-grid">
            <div className="summary-card">
              <span>已完成月份</span>
              <strong>{monthSummary.completed}</strong>
            </div>
            <div className="summary-card">
              <span>待补录月份</span>
              <strong>{monthSummary.draft}</strong>
            </div>
            <div className="summary-card">
              <span>未开始月份</span>
              <strong>{monthSummary.notStarted}</strong>
            </div>
            <div className="summary-card">
              <span>已录入月份</span>
              <strong>{monthSummary.recorded}</strong>
            </div>
            <div className="summary-card">
              <span>完成度</span>
              <strong>{monthSummary.completionRate}%</strong>
            </div>
            <div className="summary-card">
              <span>批量草稿月份</span>
              <strong>{draftMonthCount}</strong>
            </div>
            <div className="summary-card">
              <span>差异月份</span>
              <strong>{draftDiffSummary.changedMonths.length}</strong>
            </div>
          </div>
        ) : null}

        {selectedEmployee ? (
          <div className="batch-edit-panel">
            <div className="section-header">
              <div>
                <h3>批量编辑</h3>
                <p>勾选目标月份后，可将右侧当前表单内容批量应用为本地草稿，不会立即保存到数据库。</p>
              </div>
              <span className="tag tag-neutral">已选 {selectedBatchMonths.length} 个月</span>
            </div>

            <div className="batch-month-grid">
              {effectiveMonthRecords.map((record) => {
                const isSelected = selectedBatchMonths.includes(record.taxMonth);
                const diffCount = draftDiffSummary.changedFieldCountByMonth[record.taxMonth] ?? 0;
                return (
                  <label
                    className={isSelected ? "batch-month-item selected-item" : "batch-month-item"}
                    key={record.taxMonth}
                  >
                    <input
                      checked={isSelected}
                      type="checkbox"
                      onChange={() =>
                        setSelectedBatchMonths((currentMonths) =>
                          toggleBatchMonthSelection(currentMonths, record.taxMonth),
                        )
                      }
                    />
                    <div className="batch-month-label">
                      <span>{record.taxMonth} 月</span>
                      {diffCount ? <small>{diffCount} 项差异</small> : <small>无差异</small>}
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="button-row compact">
              <button className="ghost-button" disabled={submitting} onClick={applyBatchEdit}>
                批量应用当前表单
              </button>
              <button className="primary-button" disabled={submitting} onClick={() => void saveSelectedBatchDrafts()}>
                批量保存所选草稿
              </button>
              <button className="ghost-button" disabled={submitting} onClick={clearSelectedBatchDrafts}>
                清空所选草稿
              </button>
            </div>
          </div>
        ) : null}

        <div className="year-view-grid">
          {yearView.length ? (
            yearView.map((quarter) => (
              <section className="year-quarter-card" key={quarter.quarter}>
                <div className="year-quarter-header">
                  <div>
                    <strong>{quarter.label}</strong>
                    <p>
                      已完成 {quarter.summary.completed} / 待补录 {quarter.summary.draft} / 未开始 {quarter.summary.notStarted}
                    </p>
                  </div>
                  <span className="tag tag-neutral">{quarter.months.length} 个月</span>
                </div>
                <div className="year-month-grid">
                  {quarter.months.map((month) => {
                    const progressClassName =
                      month.status === "completed"
                        ? "tag"
                        : month.status === "draft"
                          ? "tag tag-warning"
                          : "tag tag-neutral";
                    const hasDiff = changedMonthsSet.has(month.taxMonth);

                    return (
                      <button
                        className={selectedMonth === month.taxMonth ? "year-month-card selected-item" : "year-month-card"}
                        key={month.taxMonth}
                        onClick={() => setSelectedMonth(month.taxMonth)}
                        type="button"
                      >
                        <div>
                          <strong>{month.taxMonth} 月</strong>
                          <p>状态：{month.statusLabel}</p>
                          <p>
                            工资：{month.salaryIncome.toFixed(2)} / 预扣税：{month.withheldTax.toFixed(2)}
                          </p>
                        </div>
                        <div className="month-card-tag-row">
                          <span className={progressClassName}>{month.statusLabel}</span>
                          {hasDiff ? <span className="tag tag-diff">有差异</span> : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))
          ) : (
            <div className="empty-state">当前单位下没有员工，无法录入月度数据。</div>
          )}
        </div>
      </article>

      <article className="glass-card page-section">
        <div className="section-header">
          <div>
            <h2>
              {selectedEmployee
                ? `${selectedEmployee.employeeName} - ${selectedMonth} 月录入`
                : "请选择员工"}
            </h2>
            <p>本阶段仅实现基础录入，不进行个税计算。</p>
          </div>
          <span className="tag">减除费用：{DEFAULT_BASIC_DEDUCTION_AMOUNT} 元/月</span>
        </div>

        {selectedMonthDiffs.length ? (
          <div className="draft-diff-banner">
            <strong>当前月份有 {selectedMonthDiffs.length} 项未保存差异</strong>
            <p>{selectedMonthDiffs.map((diff) => diff.label).join("、")}</p>
          </div>
        ) : null}

        {selectedEmployee ? (
          <>
            <div className="form-grid">
              <label className="form-field">
                <span>记录状态</span>
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      status: event.target.value as UpsertEmployeeMonthRecordPayload["status"],
                    }))
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
                  value={form.salaryIncome}
                  onChange={(event) => updateNumericField("salaryIncome", event.target.value)}
                />
              </label>
              <label className="form-field">
                <span>年终奖</span>
                <input
                  min="0"
                  step="0.01"
                  type="number"
                  value={form.annualBonus}
                  onChange={(event) => updateNumericField("annualBonus", event.target.value)}
                />
              </label>
              <label className="form-field">
                <span>已预扣税额</span>
                <input
                  min="0"
                  step="0.01"
                  type="number"
                  value={form.withheldTax}
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
                      value={form[field.key]}
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
                      value={form[field.key]}
                      onChange={(event) => updateNumericField(field.key, event.target.value)}
                    />
                  </label>
                ))}
              </div>
            </div>

            <label className="form-field">
              <span>备注</span>
              <input
                placeholder="可选备注"
                value={form.remark ?? ""}
                onChange={(event) =>
                  setForm((currentForm) => ({ ...currentForm, remark: event.target.value }))
                }
              />
            </label>

            <div className="button-row">
              <button
                className="ghost-button"
                disabled={submitting || !canCopyPreviousMonth}
                onClick={copyPreviousMonth}
              >
                复制上月
              </button>
              <button className="primary-button" disabled={submitting} onClick={() => void saveMonthRecord()}>
                保存当前月份
              </button>
              <button
                className="ghost-button"
                disabled={submitting}
                onClick={() => setForm(toMonthRecordPayload(selectedRecord))}
              >
                恢复当前月份
              </button>
            </div>
          </>
        ) : (
          <div className="empty-state">请先在左侧选择员工。</div>
        )}

        {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}
        {noticeMessage ? <div className="success-banner">{noticeMessage}</div> : null}
      </article>
    </section>
  );
};
