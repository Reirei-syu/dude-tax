import { Link } from "react-router-dom";
import type { AnnualResultsPageData } from "../hooks/useAnnualResultsPage";
import { formatCurrency } from "../constants";

type Props = Pick<
  AnnualResultsPageData,
  | "currentUnit"
  | "currentTaxYear"
  | "loading"
  | "summary"
  | "errorMessage"
  | "exportPreviewRows"
  | "selectedExportColumnKeys"
  | "loadResults"
  | "downloadExportPreview"
  | "downloadExportWorkbook"
>;

export const AnnualResultsOverviewSection = ({
  currentUnit,
  currentTaxYear,
  loading,
  summary,
  errorMessage,
  exportPreviewRows,
  selectedExportColumnKeys,
  loadResults,
  downloadExportPreview,
  downloadExportWorkbook,
}: Props) => (
  <article className="glass-card page-section placeholder-card">
    <div className="section-header">
      <div>
        <h1>结果中心</h1>
        <p>
          当前房间：{currentUnit?.unitName ?? "未选择单位"} / {currentTaxYear} 年
        </p>
      </div>
      <span className="tag">{loading ? "加载中" : "年度结果已接入"}</span>
    </div>

    <div className="summary-grid results-summary-grid">
      <div className="summary-card">
        <span>已生成结果</span>
        <strong>{summary.total}</strong>
      </div>
      <div className="summary-card">
        <span>单独计税方案</span>
        <strong>{summary.separateBonus}</strong>
      </div>
      <div className="summary-card">
        <span>并入综合所得</span>
        <strong>{summary.combinedBonus}</strong>
      </div>
      <div className="summary-card">
        <span>选定方案税额合计</span>
        <strong>{formatCurrency(summary.totalSelectedTax)}</strong>
      </div>
      <div className="summary-card">
        <span>已失效结果</span>
        <strong>{summary.invalidated}</strong>
      </div>
    </div>

    <div className="button-row">
      <button className="ghost-button" disabled={loading} onClick={() => void loadResults()}>
        刷新结果
      </button>
      <button
        className="primary-button"
        disabled={!exportPreviewRows.length || loading || !selectedExportColumnKeys.length}
        onClick={downloadExportPreview}
      >
        导出 CSV
      </button>
      <button
        className="primary-button"
        disabled={!exportPreviewRows.length || loading || !selectedExportColumnKeys.length}
        onClick={() => void downloadExportWorkbook()}
      >
        导出 XLSX
      </button>
      <Link className="ghost-button link-button" to="/calculation">
        前往计算中心
      </Link>
    </div>

    {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}
  </article>
);
