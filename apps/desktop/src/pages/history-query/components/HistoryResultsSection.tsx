import type { HistoryQueryPageData } from "../hooks/useHistoryQueryPage";
import { formatCurrency, schemeLabelMap, settlementDirectionLabelMap } from "../constants";

type Props = Pick<HistoryQueryPageData, "results" | "selectedResultId" | "setSelectedResultId">;

export const HistoryResultsSection = ({
  results,
  selectedResultId,
  setSelectedResultId,
}: Props) => (
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
                className={
                  rowId === selectedResultId ? "selectable-row is-selected" : "selectable-row"
                }
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
                <td>
                  {result.selectedScheme === "separate_bonus" ? "年终奖单独计税" : "并入综合所得"}
                </td>
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
);
