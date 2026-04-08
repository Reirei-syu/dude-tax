import { formatCurrency, schemeLabelMap } from "../constants";
import type { HistoryQueryPageData } from "../hooks/useHistoryQueryPage";

type Props = Pick<
  HistoryQueryPageData,
  | "selectedResult"
  | "comparisonResult"
  | "comparisonLoading"
  | "comparisonErrorMessage"
  | "comparisonItems"
>;

export const HistoryComparisonSection = ({
  selectedResult,
  comparisonResult,
  comparisonLoading,
  comparisonErrorMessage,
  comparisonItems,
}: Props) => (
  <article className="glass-card page-section placeholder-card">
    <div className="section-header">
      <div>
        <h2>差异对比</h2>
        <p>对已失效快照按当前税率现场重算，并展示旧快照与当前结果的关键差异。</p>
      </div>
      <span className="tag">
        {comparisonLoading ? "对比中" : selectedResult?.isInvalidated ? "已对比" : "无需对比"}
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
            <strong>{schemeLabelMap[comparisonResult.recalculatedResult.selectedScheme]}</strong>
          </div>
          <div className="summary-card">
            <span>旧快照税额</span>
            <strong>{formatCurrency(selectedResult.annualTaxPayable)}</strong>
          </div>
          <div className="summary-card">
            <span>当前重算税额</span>
            <strong>{formatCurrency(comparisonResult.recalculatedResult.annualTaxPayable)}</strong>
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
);
