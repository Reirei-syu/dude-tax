import type { AnnualTaxWithholdingMode } from "@dude-tax/core";
import { annualTaxWithholdingModeLabelMap } from "../../annual-tax-withholding-summary";
import {
  formatCurrency,
  formatDateTime,
  schemeLabelMap,
  settlementDirectionLabelMap,
} from "../constants";
import type { AnnualResultsPageData } from "../hooks/useAnnualResultsPage";

type Props = {
  data: AnnualResultsPageData;
};

export const AnnualResultsDetailSection = ({ data }: Props) => {
  const {
    selectedResult,
    selectedSchemeResult,
    selectedExplanation,
    selectedWithholdingExplanation,
    selectedRuleSourceExplanation,
    selectedExportPreviewRow,
    versionErrorMessage,
    resultVersions,
    versionLoading,
    versionOptions,
    selectedBaselineVersionId,
    selectedTargetVersionId,
    setSelectedBaselineVersionId,
    setSelectedTargetVersionId,
    versionComparisonItems,
    switchingScheme,
    switchSelectedScheme,
  } = data;

  return (
    <article className="glass-card page-section">
      <div className="section-header">
        <div>
          <h2>结果明细</h2>
          <p>展示当前选中员工的收入汇总、导出预览字段和两套计税结果对比。</p>
        </div>
        <span className="tag">
          {selectedResult ? schemeLabelMap[selectedResult.selectedScheme] : "未选择员工"}
        </span>
      </div>

      {selectedResult && selectedSchemeResult ? (
        <>
          <div className="summary-grid results-summary-grid">
            <div className="summary-card">
              <span>工资收入合计</span>
              <strong>{formatCurrency(selectedResult.salaryIncomeTotal)}</strong>
            </div>
            <div className="summary-card">
              <span>年终奖合计</span>
              <strong>{formatCurrency(selectedResult.annualBonusTotal)}</strong>
            </div>
            <div className="summary-card">
              <span>减除费用合计</span>
              <strong>{formatCurrency(selectedResult.basicDeductionTotal)}</strong>
            </div>
            <div className="summary-card">
              <span>年度应纳税额</span>
              <strong>{formatCurrency(selectedResult.annualTaxPayable)}</strong>
            </div>
          </div>

          <div className="summary-grid results-summary-grid detail-summary-grid">
            <div className="summary-card">
              <span>五险一金合计</span>
              <strong>{formatCurrency(selectedResult.insuranceAndHousingFundTotal)}</strong>
            </div>
            <div className="summary-card">
              <span>专项附加扣除</span>
              <strong>{formatCurrency(selectedResult.specialAdditionalDeductionTotal)}</strong>
            </div>
            <div className="summary-card">
              <span>其他扣除</span>
              <strong>{formatCurrency(selectedResult.otherDeductionTotal)}</strong>
            </div>
            <div className="summary-card">
              <span>税额减免</span>
              <strong>{formatCurrency(selectedResult.taxReductionExemptionTotal)}</strong>
            </div>
          </div>

          <div className="summary-grid results-summary-grid detail-summary-grid">
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
              <span>当前综合应税额</span>
              <strong>{formatCurrency(selectedSchemeResult.taxableComprehensiveIncome)}</strong>
            </div>
            <div className="summary-card">
              <span>当前综合所得税</span>
              <strong>{formatCurrency(selectedSchemeResult.comprehensiveIncomeTax)}</strong>
            </div>
          </div>

          <div className="summary-grid results-summary-grid detail-summary-grid">
            <div className="summary-card">
              <span>当前年终奖税额</span>
              <strong>{formatCurrency(selectedSchemeResult.annualBonusTax)}</strong>
            </div>
            <div className="summary-card">
              <span>当前税额合计</span>
              <strong>{formatCurrency(selectedSchemeResult.finalTax)}</strong>
            </div>
          </div>

          <div className="subsection-block">
            <h3>预扣轨迹摘要</h3>
            <div className="summary-grid results-summary-grid detail-summary-grid">
              <div className="summary-card">
                <span>预扣模式</span>
                <strong>
                  {
                    annualTaxWithholdingModeLabelMap[
                      selectedResult.withholdingSummary.withholdingMode as AnnualTaxWithholdingMode
                    ]
                  }
                </strong>
              </div>
              <div className="summary-card">
                <span>规则应预扣</span>
                <strong>
                  {formatCurrency(selectedResult.withholdingSummary.expectedWithheldTaxTotal)}
                </strong>
              </div>
              <div className="summary-card">
                <span>实际已预扣</span>
                <strong>
                  {formatCurrency(selectedResult.withholdingSummary.actualWithheldTaxTotal)}
                </strong>
              </div>
              <div className="summary-card">
                <span>预扣差异额</span>
                <strong>
                  {formatCurrency(selectedResult.withholdingSummary.withholdingVariance)}
                </strong>
              </div>
              <div className="summary-card">
                <span>轨迹月份数</span>
                <strong>{selectedResult.withholdingSummary.traceCount}</strong>
              </div>
            </div>
          </div>

          <div className="subsection-block">
            <h3>规则来源说明</h3>
            {selectedRuleSourceExplanation ? (
              <div className="maintenance-note-card">
                <strong>{selectedRuleSourceExplanation.title}</strong>
                <p>{selectedRuleSourceExplanation.summary}</p>
                <div className="validation-list compact-validation-list">
                  {selectedRuleSourceExplanation.detailLines.map((line: string) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="subsection-block">
            <h3>预扣规则说明</h3>
            {selectedWithholdingExplanation ? (
              <div className="maintenance-note-card">
                <strong>{selectedWithholdingExplanation.title}</strong>
                <p>{selectedWithholdingExplanation.summary}</p>
                <div className="validation-list compact-validation-list">
                  {selectedWithholdingExplanation.detailLines.map((line: string) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="subsection-block">
            <h3>结算说明</h3>
            {selectedExplanation ? (
              <div className="maintenance-note-card">
                <strong>{selectedExplanation.title}</strong>
                <p>{selectedExplanation.summary}</p>
                <div className="validation-list compact-validation-list">
                  {selectedExplanation.detailLines.map((line: string) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="subsection-block">
            <h3>历史版本查看</h3>
            {versionErrorMessage ? <div className="error-banner">{versionErrorMessage}</div> : null}

            {resultVersions.length ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>版本</th>
                    <th>重算时间</th>
                    <th>结果状态</th>
                    <th>当前方案</th>
                    <th>年度应纳税额</th>
                    <th>应补/应退</th>
                    <th>结算方向</th>
                  </tr>
                </thead>
                <tbody>
                  {resultVersions.map((version) => (
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
                  {versionLoading ? "版本历史加载中。" : "当前还没有可查看的历史版本。"}
                </strong>
                <p>这里只记录真实重算形成的版本快照，手动方案切换不会单独生成新版本。</p>
              </div>
            )}
          </div>

          <div className="subsection-block">
            <h3>版本差异对比</h3>
            {resultVersions.length >= 2 ? (
              <>
                <div className="form-grid">
                  <label className="form-field">
                    <span>基准版本</span>
                    <select
                      value={selectedBaselineVersionId ?? ""}
                      onChange={(event) => setSelectedBaselineVersionId(Number(event.target.value))}
                    >
                      {versionOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="form-field">
                    <span>对比版本</span>
                    <select
                      value={selectedTargetVersionId ?? ""}
                      onChange={(event) => setSelectedTargetVersionId(Number(event.target.value))}
                    >
                      {versionOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {data.versionComparisonItems.length ? (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>项目</th>
                        <th>基准版本</th>
                        <th>对比版本</th>
                        <th>差异</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.versionComparisonItems.map((item) => (
                        <tr key={item.label}>
                          <td>{item.label}</td>
                          <td>{item.baselineValue}</td>
                          <td>{item.targetValue}</td>
                          <td>{item.deltaValue}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="empty-state">
                    <strong>请选择两个不同版本。</strong>
                    <p>版本相同时不会生成有效差异。</p>
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state">
                <strong>当前版本数量不足，无法对比。</strong>
                <p>至少需要两个真实重算版本，才能进行版本差异对比。</p>
              </div>
            )}
          </div>

          <div className="subsection-block">
            <h3>两套方案对比</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>方案</th>
                  <th>综合应税额</th>
                  <th>综合所得税</th>
                  <th>年终奖税额</th>
                  <th>减免税额</th>
                  <th>最终税额</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {[
                  selectedResult.schemeResults.separateBonus,
                  selectedResult.schemeResults.combinedBonus,
                ].map((schemeResult) => (
                  <tr
                    key={schemeResult.scheme}
                    className={
                      schemeResult.scheme === selectedResult.selectedScheme
                        ? "selectable-row is-selected"
                        : ""
                    }
                  >
                    <td>{schemeLabelMap[schemeResult.scheme]}</td>
                    <td>{formatCurrency(schemeResult.taxableComprehensiveIncome)}</td>
                    <td>{formatCurrency(schemeResult.comprehensiveIncomeTax)}</td>
                    <td>{formatCurrency(schemeResult.annualBonusTax)}</td>
                    <td>{formatCurrency(schemeResult.taxReductionExemptionTotal)}</td>
                    <td>{formatCurrency(schemeResult.finalTax)}</td>
                    <td>
                      {schemeResult.scheme === selectedResult.selectedScheme ? (
                        <span className="tag">当前采用</span>
                      ) : (
                        <button
                          className="ghost-button table-action-button"
                          disabled={switchingScheme === schemeResult.scheme}
                          onClick={() => void switchSelectedScheme(schemeResult.scheme)}
                        >
                          采用该方案
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="subsection-block">
            <h3>导出预览字段</h3>
            {selectedExportPreviewRow ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>单位</th>
                    <th>员工</th>
                    <th>当前方案</th>
                    <th>年度应纳税额</th>
                    <th>已预扣税额</th>
                    <th>应补/应退</th>
                    <th>结算方向</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{selectedExportPreviewRow.unitName}</td>
                    <td>
                      {selectedExportPreviewRow.employeeName}
                      <br />
                      <small>{selectedExportPreviewRow.employeeCode}</small>
                    </td>
                    <td>{selectedExportPreviewRow.selectedSchemeLabel}</td>
                    <td>{formatCurrency(selectedExportPreviewRow.annualTaxPayable)}</td>
                    <td>{formatCurrency(selectedExportPreviewRow.annualTaxWithheld)}</td>
                    <td>{formatCurrency(selectedExportPreviewRow.annualTaxSettlement)}</td>
                    <td>{selectedExportPreviewRow.settlementDirectionLabel}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                <strong>暂无导出预览。</strong>
                <p>当前年份下还没有可用于导出的年度结果行。</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="empty-state">
          <strong>暂无可展示明细。</strong>
          <p>当前年份下还没有已保存的年度计算结果。</p>
        </div>
      )}
    </article>
  );
};
