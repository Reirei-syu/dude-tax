import {
  ANNUAL_TAX_EXPORT_COLUMNS,
  DEFAULT_ANNUAL_TAX_EXPORT_TEMPLATE_ID,
} from "../../annual-tax-export";
import { formatCurrency } from "../constants";
import type { AnnualResultsPageData } from "../hooks/useAnnualResultsPage";

type Props = Pick<
  AnnualResultsPageData,
  | "exportPreviewRows"
  | "exportSelectionSummary"
  | "exportFeedbackMessage"
  | "selectedExportTemplateId"
  | "selectedExportColumnKeys"
  | "setSelectedExportTemplateId"
  | "setSelectedExportColumnKeys"
  | "setExportFeedbackMessage"
  | "toggleExportColumn"
  | "applyExportTemplate"
>;

export const AnnualResultsExportSection = ({
  exportPreviewRows,
  exportSelectionSummary,
  exportFeedbackMessage,
  selectedExportTemplateId,
  selectedExportColumnKeys,
  setSelectedExportTemplateId,
  setSelectedExportColumnKeys,
  setExportFeedbackMessage,
  toggleExportColumn,
  applyExportTemplate,
}: Props) => (
  <article className="glass-card page-section placeholder-card">
    <div className="section-header">
      <div>
        <h2>年度导出预览</h2>
        <p>这里展示导出模板、当前选择状态和导出预览，支持按模板或自定义字段导出。</p>
      </div>
      <span className="tag">
        {exportPreviewRows.length ? `共 ${exportPreviewRows.length} 行` : "暂无预览"}
      </span>
    </div>

    <div className="summary-grid results-summary-grid detail-summary-grid">
      <div className="summary-card">
        <span>当前模板</span>
        <strong>{exportSelectionSummary.matchedTemplateLabel ?? "自定义模板"}</strong>
      </div>
      <div className="summary-card">
        <span>已选字段数</span>
        <strong>{exportSelectionSummary.selectedColumnCount}</strong>
      </div>
      <div className="summary-card">
        <span>涉及分组数</span>
        <strong>{exportSelectionSummary.selectedGroupCount}</strong>
      </div>
      <div className="summary-card">
        <span>模板状态</span>
        <strong>{exportSelectionSummary.isCustomSelection ? "已自定义" : "匹配预置模板"}</strong>
      </div>
    </div>

    {exportFeedbackMessage ? <div className="success-banner">{exportFeedbackMessage}</div> : null}

    <div className="export-template-panel">
      {exportSelectionSummary.templates.map((template: any) => (
        <button
          className={
            template.id === selectedExportTemplateId
              ? "ghost-button export-template-button is-active"
              : "ghost-button export-template-button"
          }
          key={template.id}
          onClick={() => applyExportTemplate(template.id)}
          type="button"
        >
          <strong>{template.label}</strong>
          <small>{template.description}</small>
          <small>
            {template.columnCount} 个字段 / {template.groupCount} 个分组
          </small>
        </button>
      ))}
    </div>

    <div className="button-row compact">
      <button
        className="ghost-button"
        onClick={() =>
          applyExportTemplate(
            selectedExportTemplateId === "custom"
              ? DEFAULT_ANNUAL_TAX_EXPORT_TEMPLATE_ID
              : selectedExportTemplateId,
          )
        }
        type="button"
      >
        {selectedExportTemplateId === "custom" ? "恢复推荐模板字段" : "恢复当前模板字段"}
      </button>
      <button
        className="ghost-button"
        onClick={() => {
          setSelectedExportTemplateId("custom");
          setSelectedExportColumnKeys([]);
          setExportFeedbackMessage(null);
        }}
        type="button"
      >
        清空字段选择
      </button>
    </div>

    {exportSelectionSummary.groups.length ? (
      <div className="subsection-block">
        <h3>当前模板摘要</h3>
        <div className="template-summary-grid">
          {exportSelectionSummary.groups.map((group: any) => (
            <div className="template-summary-card" key={group.group}>
              <strong>{group.group}</strong>
              <span>{group.count} 个字段</span>
              <small>{group.labels.join("、")}</small>
            </div>
          ))}
        </div>
      </div>
    ) : (
      <div className="empty-state">
        <strong>当前还没有选中导出字段。</strong>
        <p>可先选择一个模板，或手动勾选需要导出的字段。</p>
      </div>
    )}

    {Array.from(
      ANNUAL_TAX_EXPORT_COLUMNS.reduce((groupMap, column) => {
        const columns = groupMap.get(column.group) ?? [];
        columns.push(column);
        groupMap.set(column.group, columns);
        return groupMap;
      }, new Map<string, typeof ANNUAL_TAX_EXPORT_COLUMNS>()),
    ).map(([groupName, columns]: [string, any[]]) => (
      <div className="subsection-block" key={groupName}>
        <h3>{groupName}</h3>
        <div className="export-column-panel">
          {columns.map((column: any) => (
            <label className="export-column-item" key={column.key}>
              <input
                checked={selectedExportColumnKeys.includes(column.key)}
                type="checkbox"
                onChange={() => toggleExportColumn(column.key)}
              />
              <span>{column.label}</span>
            </label>
          ))}
        </div>
      </div>
    ))}

    {exportPreviewRows.length ? (
      <table className="data-table">
        <thead>
          <tr>
            <th>员工</th>
            <th>方案</th>
            <th>工资收入</th>
            <th>年终奖</th>
            <th>年度应纳税额</th>
            <th>已预扣税额</th>
            <th>应补/应退</th>
            <th>结算方向</th>
          </tr>
        </thead>
        <tbody>
          {exportPreviewRows.map((row) => (
            <tr key={row.employeeId}>
              <td>
                {row.employeeName}
                <br />
                <small>{row.employeeCode}</small>
              </td>
              <td>{row.selectedSchemeLabel}</td>
              <td>{formatCurrency(row.salaryIncomeTotal)}</td>
              <td>{formatCurrency(row.annualBonusTotal)}</td>
              <td>{formatCurrency(row.annualTaxPayable)}</td>
              <td>{formatCurrency(row.annualTaxWithheld)}</td>
              <td>{formatCurrency(row.annualTaxSettlement)}</td>
              <td>{row.settlementDirectionLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    ) : (
      <div className="empty-state">
        <strong>当前还没有导出预览数据。</strong>
        <p>请先生成年度结果，后续导出功能将直接使用这里的结构。</p>
      </div>
    )}
  </article>
);
