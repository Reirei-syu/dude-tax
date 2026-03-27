import type {
  AnnualTaxCalculation,
  AnnualTaxResultVersion,
  Employee,
  HistoryAnnualTaxQuery,
  HistoryAnnualTaxResult,
  HistoryResultStatus,
  TaxCalculationScheme,
  TaxSettlementDirection,
} from "@dude-tax/core";
import { getSelectableYears } from "@dude-tax/config";
import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../api/client";
import { useAppContext } from "../context/AppContextProvider";
import { calculateEmployeeAnnualTax } from "@dude-tax/core";
import {
  buildHistoryQueryExportCsv,
  buildHistoryQueryExportFilename,
  buildHistoryQueryExportWorkbookBuffer,
  buildHistoryQueryExportWorkbookFilename,
} from "./history-query-export";
import { buildHistoryQueryComparisonItems } from "./history-query-diff";
import { buildHistoryQueryYearSummaries } from "./history-query-year-summary";
import {
  annualTaxWithholdingModeLabelMap,
  buildAnnualTaxWithholdingExplanation,
} from "./annual-tax-withholding-summary";
import { buildAnnualTaxRuleSourceExplanation } from "./annual-tax-rule-source-summary";
import { saveFileWithDesktopFallback } from "../utils/file-save";

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

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("zh-CN", {
    hour12: false,
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
  const [versionHistory, setVersionHistory] = useState<AnnualTaxResultVersion[]>([]);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [versionHistoryLoading, setVersionHistoryLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [versionHistoryErrorMessage, setVersionHistoryErrorMessage] = useState<string | null>(
    null,
  );
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
    const loadVersionHistory = async () => {
      if (!selectedResult) {
        setVersionHistory([]);
        setVersionHistoryErrorMessage(null);
        return;
      }

      try {
        setVersionHistoryLoading(true);
        setVersionHistoryErrorMessage(null);
        const nextVersions = await apiClient.listAnnualResultVersions(
          selectedResult.unitId,
          selectedResult.taxYear,
          selectedResult.employeeId,
        );
        setVersionHistory(nextVersions);
      } catch (error) {
        setVersionHistory([]);
        setVersionHistoryErrorMessage(error instanceof Error ? error.message : "加载版本历史失败");
      } finally {
        setVersionHistoryLoading(false);
      }
    };

    void loadVersionHistory();
  }, [selectedResult]);

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
          apiClient.getTaxPolicy(selectedResult.unitId, selectedResult.taxYear),
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
  const selectedWithholdingExplanation = selectedResult
    ? buildAnnualTaxWithholdingExplanation(selectedResult.withholdingSummary)
    : null;
  const selectedRuleSourceExplanation = selectedResult
    ? buildAnnualTaxRuleSourceExplanation(selectedResult)
    : null;
  const yearSummaries = useMemo(() => buildHistoryQueryYearSummaries(results), [results]);

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
    void saveFileWithDesktopFallback({
      defaultPath: buildHistoryQueryExportFilename(exportScopeLabel),
      filters: [{ name: "CSV 文件", extensions: ["csv"] }],
      mimeType: "text/csv;charset=utf-8;",
      content: `\uFEFF${csvContent}`,
    });
  };

  const downloadHistoryWorkbook = async () => {
    if (!results.length) {
      return;
    }

    const workbookArray = await buildHistoryQueryExportWorkbookBuffer(results);
    await saveFileWithDesktopFallback({
      defaultPath: buildHistoryQueryExportWorkbookFilename(exportScopeLabel),
      filters: [{ name: "Excel 文件", extensions: ["xlsx"] }],
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      content: workbookArray,
    });
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
            <p>支持切换查看当前有效结果、已失效快照或全部结果，并联动查看所选结果的重算版本历史。</p>
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
            <h2>跨年度概览</h2>
            <p>按年度聚合当前结果集，支持快速切换到某个年份继续细看。</p>
          </div>
          <span className="tag">{yearSummaries.length ? `${yearSummaries.length} 个年度` : "暂无年度"}</span>
        </div>

        {yearSummaries.length ? (
          <>
            <div className="button-row compact">
              <button
                className={filters.taxYear ? "ghost-button" : "ghost-button export-template-button is-active"}
                onClick={() => updateFilter("taxYear", undefined)}
                type="button"
              >
                查看全部年份
              </button>
            </div>

            <div className="year-summary-grid">
              {yearSummaries.map((summaryItem) => (
                <button
                  className={
                    summaryItem.taxYear === filters.taxYear
                      ? "year-summary-card is-active"
                      : "year-summary-card"
                  }
                  key={summaryItem.taxYear}
                  onClick={() => updateFilter("taxYear", summaryItem.taxYear)}
                  type="button"
                >
                  <strong>{summaryItem.taxYear} 年</strong>
                  <span>结果 {summaryItem.total}</span>
                  <span>当前有效 {summaryItem.current}</span>
                  <span>已失效 {summaryItem.invalidated}</span>
                  <span>应补税 {summaryItem.payable}</span>
                  <span>应退税 {summaryItem.refund}</span>
                  <span>已平 {summaryItem.balanced}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <strong>当前没有可聚合的年度结果。</strong>
            <p>请先调整筛选条件，或在历史查询中切换到“全部结果”查看跨年度概览。</p>
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
              <span>预扣模式</span>
              <strong>
                {annualTaxWithholdingModeLabelMap[selectedResult.withholdingSummary.withholdingMode]}
              </strong>
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

        {selectedResult && selectedRuleSourceExplanation ? (
          <div className="subsection-block">
            <h3>规则来源说明</h3>
            <div className="maintenance-note-card">
              <strong>{selectedRuleSourceExplanation.title}</strong>
              <p>{selectedRuleSourceExplanation.summary}</p>
              <div className="validation-list compact-validation-list">
                {selectedRuleSourceExplanation.detailLines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {selectedResult && selectedWithholdingExplanation ? (
          <div className="subsection-block">
            <h3>预扣规则说明</h3>
            <div className="maintenance-note-card">
              <strong>{selectedWithholdingExplanation.title}</strong>
              <p>{selectedWithholdingExplanation.summary}</p>
              <div className="validation-list compact-validation-list">
                {selectedWithholdingExplanation.detailLines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </article>

      <article className="glass-card page-section placeholder-card">
        <div className="section-header">
          <div>
            <h2>重算版本历史</h2>
            <p>仅展示真实重算产生的版本快照，不包含手动方案切换。</p>
          </div>
          <span className="tag">
            {versionHistoryLoading
              ? "加载中"
              : selectedResult
                ? `${versionHistory.length} 个版本`
                : "未选择结果"}
          </span>
        </div>

        {versionHistoryErrorMessage ? <div className="error-banner">{versionHistoryErrorMessage}</div> : null}

        {selectedResult ? (
          versionHistory.length ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>版本</th>
                  <th>重算时间</th>
                  <th>结果状态</th>
                  <th>当前方案</th>
                  <th>应纳税额</th>
                  <th>应补/应退</th>
                  <th>结算方向</th>
                </tr>
              </thead>
              <tbody>
                {versionHistory.map((version) => (
                  <tr key={version.versionId}>
                    <td>V{version.versionSequence}</td>
                    <td>{formatDateTime(version.calculatedAt)}</td>
                    <td>
                      {version.isInvalidated ? (
                        <span className="tag tag-warning">已失效</span>
                      ) : (
                        <span className="tag">当前有效</span>
                      )}
                    </td>
                    <td>{schemeLabelMap[version.selectedScheme]}</td>
                    <td>{formatCurrency(version.annualTaxPayable)}</td>
                    <td>{formatCurrency(version.annualTaxSettlement)}</td>
                    <td>{settlementDirectionLabelMap[version.settlementDirection]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <strong>当前结果还没有重算版本历史。</strong>
              <p>只有执行过年度重算后，这里才会出现对应的版本快照。</p>
            </div>
          )
        ) : (
          <div className="empty-state">
            <strong>请先选择一条历史结果。</strong>
            <p>选中结果后，这里会展示该员工该年度的重算版本时间线。</p>
          </div>
        )}
      </article>

      <article className="glass-card page-section placeholder-card">
        <div className="section-header">
          <div>
            <h2>差异对比</h2>
            <p>对已失效快照按当前税率现场重算，并展示旧快照与当前结果的关键差异。</p>
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
            <p>只有在“已失效”结果下，系统才会按当前税率现场重算并展示新旧差异。</p>
          </div>
        )}
      </article>
    </section>
  );
};

