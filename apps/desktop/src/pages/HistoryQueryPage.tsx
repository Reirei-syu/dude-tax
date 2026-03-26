import type {
  AnnualTaxCalculation,
  Employee,
  HistoryAnnualTaxQuery,
  HistoryAnnualTaxResult,
  HistoryResultStatus,
  TaxCalculationScheme,
  TaxSettlementDirection,
} from "../../../../packages/core/src/index";
import { getSelectableYears } from "../../../../packages/config/src/index";
import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../api/client";
import { useAppContext } from "../context/AppContextProvider";
import { calculateEmployeeAnnualTax } from "../../../../packages/core/src/index";
import {
  buildHistoryQueryExportCsv,
  buildHistoryQueryExportFilename,
  buildHistoryQueryExportWorkbookBuffer,
  buildHistoryQueryExportWorkbookFilename,
} from "./history-query-export";
import { buildHistoryQueryComparisonItems } from "./history-query-diff";

const settlementDirectionLabelMap: Record<TaxSettlementDirection, string> = {
  payable: "应补税",
  refund: "应退税",
  balanced: "已平",
};

const historyResultStatusLabelMap: Record<HistoryResultStatus, string> = {
  current: "当前有效",
  invalidated: "已失效",
  all: "全部结果",
};

const schemeLabelMap: Record<TaxCalculationScheme, string> = {
  separate_bonus: "年终奖单独计税",
  combined_bonus: "并入综合所得",
};

const formatCurrency = (value: number) =>
  value.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const buildHistoryQueryExportScopeLabel = (
  unitName: string | undefined,
  taxYear: number | undefined,
  resultStatus: HistoryResultStatus | undefined,
) => {
  const unitPart = unitName ?? "全部单位";
  const yearPart = taxYear ? `${taxYear}` : "全部年份";
  const statusPart = historyResultStatusLabelMap[resultStatus ?? "current"];

  return `${unitPart}_${yearPart}_${statusPart}`;
};

export const HistoryQueryPage = () => {
  const { context } = useAppContext();
  const years = getSelectableYears();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [results, setResults] = useState<HistoryAnnualTaxResult[]>([]);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [comparisonResult, setComparisonResult] = useState<AnnualTaxCalculation | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonErrorMessage, setComparisonErrorMessage] = useState<string | null>(null);
  const [filters, setFilters] = useState<HistoryAnnualTaxQuery>({
    unitId: context?.currentUnitId ?? undefined,
    taxYear: context?.currentTaxYear ?? undefined,
  });

  useEffect(() => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      unitId: currentFilters.unitId ?? context?.currentUnitId ?? undefined,
      taxYear: currentFilters.taxYear ?? context?.currentTaxYear ?? undefined,
    }));
  }, [context?.currentTaxYear, context?.currentUnitId]);

  const loadEmployees = async (unitId?: number) => {
    if (!unitId) {
      setEmployees([]);
      return;
    }

    try {
      const nextEmployees = await apiClient.listEmployees(unitId);
      setEmployees(nextEmployees);
    } catch {
      setEmployees([]);
    }
  };

  const loadHistoryResults = async (query: HistoryAnnualTaxQuery) => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const nextResults = await apiClient.searchHistoryResults(query);
      setResults(nextResults);
      setSelectedResultId(
        nextResults[0] ? `${nextResults[0].unitId}-${nextResults[0].employeeId}-${nextResults[0].taxYear}` : null,
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载历史结果失败");
      setResults([]);
      setSelectedResultId(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEmployees(filters.unitId);
  }, [filters.unitId]);

  useEffect(() => {
    void loadHistoryResults(filters);
  }, [filters]);

  const selectedResult =
    results.find(
      (result) => `${result.unitId}-${result.employeeId}-${result.taxYear}` === selectedResultId,
    ) ?? results[0] ?? null;

  useEffect(() => {
    const loadComparison = async () => {
      if (!selectedResult?.isInvalidated) {
        setComparisonResult(null);
        setComparisonErrorMessage(null);
        return;
      }

      try {
        setComparisonLoading(true);
        setComparisonErrorMessage(null);
        const [records, taxPolicy] = await Promise.all([
          apiClient.listMonthRecords(
            selectedResult.unitId,
            selectedResult.taxYear,
            selectedResult.employeeId,
          ),
          apiClient.getTaxPolicy(),
        ]);
        const nextComparison = calculateEmployeeAnnualTax(records, taxPolicy.currentSettings);
        setComparisonResult(nextComparison);
      } catch (error) {
        setComparisonResult(null);
        setComparisonErrorMessage(error instanceof Error ? error.message : "计算对比结果失败");
      } finally {
        setComparisonLoading(false);
      }
    };

    void loadComparison();
  }, [selectedResult]);

  const updateFilter = <T extends keyof HistoryAnnualTaxQuery>(
    key: T,
    value: HistoryAnnualTaxQuery[T],
  ) => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [key]: value,
      ...(key === "unitId" ? { employeeId: undefined } : {}),
    }));
  };

  const summary = useMemo(
    () => ({
      total: results.length,
      current: results.filter((result) => !result.isInvalidated).length,
      invalidated: results.filter((result) => result.isInvalidated).length,
      payable: results.filter((result) => result.settlementDirection === "payable").length,
      refund: results.filter((result) => result.settlementDirection === "refund").length,
      balanced: results.filter((result) => result.settlementDirection === "balanced").length,
      unitCount: new Set(results.map((result) => result.unitId)).size,
      employeeCount: new Set(results.map((result) => result.employeeId)).size,
      yearCount: new Set(results.map((result) => result.taxYear)).size,
    }),
    [results],
  );
  const comparisonItems =
    selectedResult && comparisonResult && selectedResult.isInvalidated
      ? buildHistoryQueryComparisonItems(selectedResult, comparisonResult)
      : [];

  const selectedUnitName =
    context?.units.find((unit) => unit.id === filters.unitId)?.unitName ?? undefined;
  const exportScopeLabel = buildHistoryQueryExportScopeLabel(
    selectedUnitName,
    filters.taxYear,
    filters.resultStatus,
  );

  const downloadHistoryCsv = () => {
    if (!results.length) {
      return;
    }

    const csvContent = buildHistoryQueryExportCsv(results);
    const blob = new Blob([`\uFEFF${csvContent}`], {
      type: "text/csv;charset=utf-8;",
    });
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = buildHistoryQueryExportFilename(exportScopeLabel);
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(downloadUrl);
  };

  const downloadHistoryWorkbook = async () => {
    if (!results.length) {
      return;
    }

    const workbookArray = await buildHistoryQueryExportWorkbookBuffer(results);
    const blob = new Blob([workbookArray], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = buildHistoryQueryExportWorkbookFilename(exportScopeLabel);
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(downloadUrl);
  };

  return (
    <section className="page-grid">
      <article className="glass-card page-section placeholder-card">
        <div className="section-header">
          <div>
            <h1>历史查询</h1>
            <p>按单位、年份、员工和结算方向检索历史年度结果。</p>
          </div>
          <span className="tag">{loading ? "查询中" : "历史查询已开启"}</span>
        </div>

        <div className="form-grid">
          <label className="form-field">
            <span>单位</span>
            <select
              value={filters.unitId ?? ""}
              onChange={(event) =>
                updateFilter("unitId", event.target.value ? Number(event.target.value) : undefined)
              }
            >
              <option value="">全部单位</option>
              {context?.units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.unitName}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>年份</span>
            <select
              value={filters.taxYear ?? ""}
              onChange={(event) =>
                updateFilter("taxYear", event.target.value ? Number(event.target.value) : undefined)
              }
            >
              <option value="">全部年份</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year} 年度
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>员工</span>
            <select
              value={filters.employeeId ?? ""}
              onChange={(event) =>
                updateFilter(
                  "employeeId",
                  event.target.value ? Number(event.target.value) : undefined,
                )
              }
            >
              <option value="">全部员工</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.employeeName}（{employee.employeeCode}）
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>结算方向</span>
            <select
              value={filters.settlementDirection ?? ""}
              onChange={(event) =>
                updateFilter(
                  "settlementDirection",
                  event.target.value
                    ? (event.target.value as TaxSettlementDirection)
                    : undefined,
                )
              }
            >
              <option value="">全部方向</option>
              <option value="payable">应补税</option>
              <option value="refund">应退税</option>
              <option value="balanced">已平</option>
            </select>
          </label>

          <label className="form-field">
            <span>结果状态</span>
            <select
              value={filters.resultStatus ?? "current"}
              onChange={(event) =>
                updateFilter("resultStatus", event.target.value as HistoryResultStatus)
              }
            >
              <option value="current">当前有效</option>
              <option value="invalidated">已失效</option>
              <option value="all">全部结果</option>
            </select>
          </label>
        </div>

        <div className="summary-grid results-summary-grid detail-summary-grid">
          <div className="summary-card">
            <span>结果总数</span>
            <strong>{summary.total}</strong>
          </div>
          <div className="summary-card">
            <span>当前有效</span>
            <strong>{summary.current}</strong>
          </div>
          <div className="summary-card">
            <span>已失效</span>
            <strong>{summary.invalidated}</strong>
          </div>
          <div className="summary-card">
            <span>应补税</span>
            <strong>{summary.payable}</strong>
          </div>
        </div>

        <div className="summary-grid results-summary-grid detail-summary-grid">
          <div className="summary-card">
            <span>应退税</span>
            <strong>{summary.refund}</strong>
          </div>
          <div className="summary-card">
            <span>已平</span>
            <strong>{summary.balanced}</strong>
          </div>
          <div className="summary-card">
            <span>涉及单位数</span>
            <strong>{summary.unitCount}</strong>
          </div>
          <div className="summary-card">
            <span>涉及员工数</span>
            <strong>{summary.employeeCount}</strong>
          </div>
          <div className="summary-card">
            <span>涉及年份数</span>
            <strong>{summary.yearCount}</strong>
          </div>
        </div>

        <div className="button-row">
          <button
            className="primary-button"
            disabled={!results.length || loading}
            onClick={downloadHistoryCsv}
          >
            导出当前筛选 CSV
          </button>
          <button
            className="primary-button"
            disabled={!results.length || loading}
            onClick={() => void downloadHistoryWorkbook()}
          >
            导出当前筛选 XLSX
          </button>
        </div>

        {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}
      </article>

      <article className="glass-card page-section">
        <div className="section-header">
          <div>
            <h2>历史结果列表</h2>
            <p>支持切换查看当前有效结果、已失效快照或全部结果；当前仍不含重算版本历史。</p>
          </div>
          <span className="tag">{results.length ? `命中 ${results.length} 条` : "暂无结果"}</span>
        </div>

        {results.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>单位 / 年份</th>
                <th>员工</th>
                <th>结果状态</th>
                <th>当前方案</th>
                <th>应纳税额</th>
                <th>应补/应退</th>
                <th>结算方向</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result) => {
                const rowId = `${result.unitId}-${result.employeeId}-${result.taxYear}`;
                return (
                  <tr
                    className={rowId === selectedResultId ? "selectable-row is-selected" : "selectable-row"}
                    key={rowId}
                    onClick={() => setSelectedResultId(rowId)}
                  >
                    <td>
                      {result.unitName}
                      <br />
                      <small>{result.taxYear} 年</small>
                    </td>
                    <td>
                      {result.employeeName}
                      <br />
                      <small>{result.employeeCode}</small>
                    </td>
                    <td>
                      {result.isInvalidated ? (
                        <span className="tag tag-warning">已失效</span>
                      ) : (
                        <span className="tag">当前有效</span>
                      )}
                    </td>
                    <td>{result.selectedScheme === "separate_bonus" ? "年终奖单独计税" : "并入综合所得"}</td>
                    <td>{formatCurrency(result.annualTaxPayable)}</td>
                    <td>{formatCurrency(result.annualTaxSettlement)}</td>
                    <td>{settlementDirectionLabelMap[result.settlementDirection]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <strong>没有符合条件的历史结果。</strong>
            <p>
              请调整筛选条件；如果当前有效结果为空，也可以切换到“已失效”或“全部结果”查看保留的历史快照。
            </p>
          </div>
        )}
      </article>

      <article className="glass-card page-section placeholder-card">
        <div className="section-header">
          <div>
            <h2>结果详情</h2>
            <p>展示当前选中历史结果的关键字段，当前为只读详情。</p>
          </div>
          <span className="tag">
            {selectedResult
              ? selectedResult.isInvalidated
                ? "已失效快照"
                : "当前有效结果"
              : "未选择结果"}
          </span>
        </div>

        {selectedResult ? (
          <div className="summary-grid results-summary-grid">
            <div className="summary-card">
              <span>单位 / 年份</span>
              <strong>
                {selectedResult.unitName} / {selectedResult.taxYear}
              </strong>
            </div>
            <div className="summary-card">
              <span>员工</span>
              <strong>{selectedResult.employeeName}</strong>
            </div>
            <div className="summary-card">
              <span>结果状态</span>
              <strong>
                {selectedResult.isInvalidated
                  ? historyResultStatusLabelMap.invalidated
                  : historyResultStatusLabelMap.current}
              </strong>
            </div>
            <div className="summary-card">
              <span>年度应纳税额</span>
              <strong>{formatCurrency(selectedResult.annualTaxPayable)}</strong>
            </div>
            <div className="summary-card">
              <span>全年已预扣税额</span>
              <strong>{formatCurrency(selectedResult.annualTaxWithheld)}</strong>
            </div>
            <div className="summary-card">
              <span>应补/应退税额</span>
              <strong>{formatCurrency(selectedResult.annualTaxSettlement)}</strong>
            </div>
            <div className="summary-card">
              <span>结算方向</span>
              <strong>{settlementDirectionLabelMap[selectedResult.settlementDirection]}</strong>
            </div>
            <div className="summary-card">
              <span>工资收入合计</span>
              <strong>{formatCurrency(selectedResult.salaryIncomeTotal)}</strong>
            </div>
            <div className="summary-card">
              <span>年终奖合计</span>
              <strong>{formatCurrency(selectedResult.annualBonusTotal)}</strong>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <strong>请先选择一条历史结果。</strong>
            <p>左侧列表点击任意结果后，可在这里查看只读详情。</p>
          </div>
        )}
      </article>

      <article className="glass-card page-section placeholder-card">
        <div className="section-header">
          <div>
            <h2>差异对比</h2>
            <p>对已失效快照按当前税标现场重算，并展示旧快照与当前结果的关键差异。</p>
          </div>
          <span className="tag">
            {comparisonLoading
              ? "对比中"
              : selectedResult?.isInvalidated
                ? "已对比"
                : "无需对比"}
          </span>
        </div>

        {comparisonErrorMessage ? <div className="error-banner">{comparisonErrorMessage}</div> : null}

        {selectedResult?.isInvalidated && comparisonResult ? (
          <>
            <div className="summary-grid results-summary-grid">
              <div className="summary-card">
                <span>旧快照方案</span>
                <strong>{schemeLabelMap[selectedResult.selectedScheme]}</strong>
              </div>
              <div className="summary-card">
                <span>当前重算方案</span>
                <strong>{schemeLabelMap[comparisonResult.selectedScheme]}</strong>
              </div>
              <div className="summary-card">
                <span>旧快照税额</span>
                <strong>{formatCurrency(selectedResult.annualTaxPayable)}</strong>
              </div>
              <div className="summary-card">
                <span>当前重算税额</span>
                <strong>{formatCurrency(comparisonResult.annualTaxPayable)}</strong>
              </div>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>项目</th>
                  <th>旧快照</th>
                  <th>当前重算</th>
                  <th>差异</th>
                </tr>
              </thead>
              <tbody>
                {comparisonItems.map((item) => (
                  <tr key={item.label}>
                    <td>{item.label}</td>
                    <td>{item.snapshotValue}</td>
                    <td>{item.currentValue}</td>
                    <td>{item.deltaValue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <div className="empty-state">
            <strong>当前没有可对比的失效快照。</strong>
            <p>只有在“已失效”结果下，系统才会按当前税标现场重算并展示新旧差异。</p>
          </div>
        )}
      </article>
    </section>
  );
};
