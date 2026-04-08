import type { HistoryResultStatus, TaxSettlementDirection } from "@dude-tax/core";
import type { HistoryQueryPageData } from "../hooks/useHistoryQueryPage";

type Props = Pick<
  HistoryQueryPageData,
  | "filters"
  | "years"
  | "employees"
  | "summary"
  | "loading"
  | "errorMessage"
  | "updateFilter"
  | "downloadHistoryCsv"
  | "downloadHistoryWorkbook"
  | "results"
> & {
  units: Array<{ id: number; unitName: string }>;
};

export const HistoryQueryFiltersSection = ({
  filters,
  years,
  employees,
  summary,
  loading,
  errorMessage,
  updateFilter,
  downloadHistoryCsv,
  downloadHistoryWorkbook,
  results,
  units,
}: Props) => (
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
          {units.map((unit) => (
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
            updateFilter("employeeId", event.target.value ? Number(event.target.value) : undefined)
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
              event.target.value ? (event.target.value as TaxSettlementDirection) : undefined,
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
);
