import { annualTaxWithholdingModeLabelMap } from "../../annual-tax-withholding-summary";
import {
  formatCurrency,
  historyResultStatusLabelMap,
  settlementDirectionLabelMap,
} from "../constants";
import type { HistoryQueryPageData } from "../hooks/useHistoryQueryPage";

type Props = Pick<
  HistoryQueryPageData,
  "selectedResult" | "selectedRuleSourceExplanation" | "selectedWithholdingExplanation"
>;

export const HistoryResultDetailSection = ({
  selectedResult,
  selectedRuleSourceExplanation,
  selectedWithholdingExplanation,
}: Props) => (
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
            {selectedRuleSourceExplanation.detailLines.map((line: string) => (
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
            {selectedWithholdingExplanation.detailLines.map((line: string) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
      </div>
    ) : null}
  </article>
);
