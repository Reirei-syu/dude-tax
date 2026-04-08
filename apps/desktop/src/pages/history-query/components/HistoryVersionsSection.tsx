import {
  formatDateTime,
  formatCurrency,
  schemeLabelMap,
  settlementDirectionLabelMap,
} from "../constants";
import type { HistoryQueryPageData } from "../hooks/useHistoryQueryPage";

type Props = Pick<
  HistoryQueryPageData,
  "selectedResult" | "versionHistory" | "versionHistoryLoading" | "versionHistoryErrorMessage"
>;

export const HistoryVersionsSection = ({
  selectedResult,
  versionHistory,
  versionHistoryLoading,
  versionHistoryErrorMessage,
}: Props) => (
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

    {versionHistoryErrorMessage ? (
      <div className="error-banner">{versionHistoryErrorMessage}</div>
    ) : null}

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
          <strong>
            {versionHistoryLoading ? "版本历史加载中。" : "当前结果还没有重算版本历史。"}
          </strong>
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
);
