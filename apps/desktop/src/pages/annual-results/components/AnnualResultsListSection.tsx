import type { AnnualResultsPageData } from "../hooks/useAnnualResultsPage";
import { formatCurrency, schemeLabelMap, settlementDirectionLabelMap } from "../constants";

type Props = Pick<
  AnnualResultsPageData,
  "results" | "selectedResult" | "summary" | "setSelectedEmployeeId"
>;

export const AnnualResultsListSection = ({
  results,
  selectedResult,
  summary,
  setSelectedEmployeeId,
}: Props) => (
  <article className="glass-card page-section">
    <div className="section-header">
      <div>
        <h2>年度结果列表</h2>
        <p>选择员工后，可在右侧查看两套方案对比、导出预览字段和当前采用结果。</p>
      </div>
      <span className="tag">{results.length ? `共 ${results.length} 条` : "暂无结果"}</span>
    </div>

    {results.length ? (
      <table className="data-table">
        <thead>
          <tr>
            <th>员工</th>
            <th>完成月份</th>
            <th>当前方案</th>
            <th>年度应纳税额</th>
            <th>已预扣税额</th>
            <th>应补/应退</th>
            <th>重算时间</th>
          </tr>
        </thead>
        <tbody>
          {results.map((result) => (
            <tr
              key={result.employeeId}
              className={
                result.employeeId === selectedResult?.employeeId
                  ? "selectable-row is-selected"
                  : "selectable-row"
              }
              onClick={() => setSelectedEmployeeId(result.employeeId)}
            >
              <td>
                {result.employeeName}
                <br />
                <small>{result.employeeCode}</small>
              </td>
              <td>{result.completedMonthCount}</td>
              <td>{schemeLabelMap[result.selectedScheme]}</td>
              <td>{formatCurrency(result.annualTaxPayable)}</td>
              <td>{formatCurrency(result.annualTaxWithheld)}</td>
              <td>
                {settlementDirectionLabelMap[result.settlementDirection]}
                <br />
                <small>{formatCurrency(result.annualTaxSettlement)}</small>
              </td>
              <td>{new Date(result.calculatedAt).toLocaleString("zh-CN")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    ) : (
      <div className="empty-state">
        <strong>{summary.invalidated ? "当前结果已失效。" : "当前还没有年度结果。"}</strong>
        <p>
          {summary.invalidated
            ? "当前税率已变更，旧结果已被判定为失效，请前往计算中心重新计算。"
            : "请先到计算中心执行重算，结果生成后会显示在这里。"}
        </p>
      </div>
    )}
  </article>
);
