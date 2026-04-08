import type { HistoryQueryPageData } from "../hooks/useHistoryQueryPage";

type Props = Pick<HistoryQueryPageData, "yearSummaries" | "filters" | "updateFilter">;

export const HistoryYearSummarySection = ({ yearSummaries, filters, updateFilter }: Props) => (
  <article className="glass-card page-section placeholder-card">
    <div className="section-header">
      <div>
        <h2>跨年度概览</h2>
        <p>按年度聚合当前结果集，支持快速切换到某个年份继续细看。</p>
      </div>
      <span className="tag">
        {yearSummaries.length ? `${yearSummaries.length} 个年度` : "暂无年度"}
      </span>
    </div>

    {yearSummaries.length ? (
      <>
        <div className="button-row compact">
          <button
            className={
              filters.taxYear ? "ghost-button" : "ghost-button export-template-button is-active"
            }
            onClick={() => updateFilter("taxYear", undefined)}
            type="button"
          >
            查看全部年份
          </button>
        </div>

        <div className="year-summary-grid">
          {yearSummaries.map(
            (summaryItem: {
              taxYear: number;
              total: number;
              current: number;
              invalidated: number;
              payable: number;
              refund: number;
              balanced: number;
            }) => (
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
            ),
          )}
        </div>
      </>
    ) : (
      <div className="empty-state">
        <strong>当前没有可聚合的年度结果。</strong>
        <p>请先调整筛选条件，或在历史查询中切换到“全部结果”查看跨年度概览。</p>
      </div>
    )}
  </article>
);
