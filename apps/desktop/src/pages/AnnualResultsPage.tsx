import type {
  AnnualTaxExportPreviewRow,
  AnnualTaxSchemeResult,
  EmployeeAnnualTaxResult,
  TaxCalculationScheme,
} from "../../../../packages/core/src/index";
import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../api/client";
import { useAppContext } from "../context/AppContextProvider";
import {
  ANNUAL_TAX_EXPORT_COLUMNS,
  ANNUAL_TAX_EXPORT_TEMPLATES,
  buildAnnualTaxExportCsv,
  buildAnnualTaxExportFilename,
  buildAnnualTaxExportWorkbookBuffer,
  buildAnnualTaxExportWorkbookFilename,
  DEFAULT_ANNUAL_TAX_EXPORT_COLUMN_KEYS,
  DEFAULT_ANNUAL_TAX_EXPORT_TEMPLATE_ID,
  type AnnualTaxExportColumnKey,
  type AnnualTaxExportTemplateId,
} from "./annual-tax-export";

const schemeLabelMap: Record<TaxCalculationScheme, string> = {
  separate_bonus: "年终奖单独计税",
  combined_bonus: "并入综合所得",
};

const settlementDirectionLabelMap = {
  payable: "应补税",
  refund: "应退税",
  balanced: "已平",
} as const;

const formatCurrency = (value: number) =>
  value.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const getSelectedSchemeResult = (result: EmployeeAnnualTaxResult): AnnualTaxSchemeResult =>
  result.selectedScheme === "separate_bonus"
    ? result.schemeResults.separateBonus
    : result.schemeResults.combinedBonus;

export const AnnualResultsPage = () => {
  const { context } = useAppContext();
  const currentUnitId = context?.currentUnitId ?? null;
  const currentTaxYear = context?.currentTaxYear ?? null;
  const currentUnit = context?.units.find((unit) => unit.id === currentUnitId) ?? null;

  const [results, setResults] = useState<EmployeeAnnualTaxResult[]>([]);
  const [exportPreviewRows, setExportPreviewRows] = useState<AnnualTaxExportPreviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [switchingScheme, setSwitchingScheme] = useState<TaxCalculationScheme | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [selectedExportTemplateId, setSelectedExportTemplateId] = useState<
    AnnualTaxExportTemplateId | "custom"
  >(DEFAULT_ANNUAL_TAX_EXPORT_TEMPLATE_ID);
  const [selectedExportColumnKeys, setSelectedExportColumnKeys] = useState<AnnualTaxExportColumnKey[]>(
    DEFAULT_ANNUAL_TAX_EXPORT_COLUMN_KEYS,
  );

  const loadResults = async () => {
    if (!currentUnitId || !currentTaxYear) {
      setResults([]);
      setExportPreviewRows([]);
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      const [nextResults, nextExportPreviewRows] = await Promise.all([
        apiClient.listAnnualResults(currentUnitId, currentTaxYear),
        apiClient.listAnnualResultExportPreview(currentUnitId, currentTaxYear),
      ]);
      setResults(nextResults);
      setExportPreviewRows(nextExportPreviewRows);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载年度结果失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadResults();
  }, [currentUnitId, currentTaxYear]);

  useEffect(() => {
    if (!results.length) {
      setSelectedEmployeeId(null);
      return;
    }

    const selectedExists = results.some((result) => result.employeeId === selectedEmployeeId);
    if (!selectedExists) {
      setSelectedEmployeeId(results[0]?.employeeId ?? null);
    }
  }, [results, selectedEmployeeId]);

  const selectedResult =
    results.find((result) => result.employeeId === selectedEmployeeId) ?? results[0] ?? null;
  const selectedSchemeResult = selectedResult ? getSelectedSchemeResult(selectedResult) : null;
  const selectedExportPreviewRow =
    exportPreviewRows.find((row) => row.employeeId === selectedEmployeeId) ??
    exportPreviewRows[0] ??
    null;

  const switchSelectedScheme = async (selectedScheme: TaxCalculationScheme) => {
    if (!currentUnitId || !currentTaxYear || !selectedResult) {
      return;
    }

    try {
      setSwitchingScheme(selectedScheme);
      setErrorMessage(null);
      await apiClient.updateAnnualResultSelectedScheme(
        currentUnitId,
        currentTaxYear,
        selectedResult.employeeId,
        { selectedScheme },
      );
      await loadResults();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "切换结果方案失败");
    } finally {
      setSwitchingScheme(null);
    }
  };

  const summary = useMemo(
    () => ({
      total: results.length,
      separateBonus: results.filter((result) => result.selectedScheme === "separate_bonus").length,
      combinedBonus: results.filter((result) => result.selectedScheme === "combined_bonus").length,
      totalSelectedTax: results.reduce((sum, result) => sum + result.selectedTaxAmount, 0),
    }),
    [results],
  );

  const toggleExportColumn = (columnKey: AnnualTaxExportColumnKey) => {
    setSelectedExportTemplateId("custom");
    setSelectedExportColumnKeys((currentKeys) => {
      if (currentKeys.includes(columnKey)) {
        return currentKeys.filter((key) => key !== columnKey);
      }

      return [...currentKeys, columnKey];
    });
  };

  const applyExportTemplate = (templateId: AnnualTaxExportTemplateId) => {
    const template = ANNUAL_TAX_EXPORT_TEMPLATES.find((item) => item.id === templateId);
    if (!template) {
      return;
    }

    setSelectedExportTemplateId(templateId);
    setSelectedExportColumnKeys(template.columnKeys);
  };

  const downloadExportPreview = () => {
    if (
      !exportPreviewRows.length ||
      !currentUnit ||
      !currentTaxYear ||
      !selectedExportColumnKeys.length
    ) {
      return;
    }

    const csvContent = buildAnnualTaxExportCsv(exportPreviewRows, selectedExportColumnKeys);
    const blob = new Blob([`\uFEFF${csvContent}`], {
      type: "text/csv;charset=utf-8;",
    });
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = buildAnnualTaxExportFilename(currentUnit.unitName, currentTaxYear);
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(downloadUrl);
  };

  const downloadExportWorkbook = async () => {
    if (
      !exportPreviewRows.length ||
      !currentUnit ||
      !currentTaxYear ||
      !selectedExportColumnKeys.length
    ) {
      return;
    }

    const workbookArray = await buildAnnualTaxExportWorkbookBuffer(
      exportPreviewRows,
      selectedExportColumnKeys,
    );
    const blob = new Blob([workbookArray], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = buildAnnualTaxExportWorkbookFilename(currentUnit.unitName, currentTaxYear);
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(downloadUrl);
  };

  if (!currentUnitId || !currentTaxYear) {
    return (
      <section className="page-grid">
        <article className="glass-card page-section placeholder-card">
          <h1>结果中心</h1>
          <p>请先在顶部选择单位和年份，再进入结果中心。</p>
        </article>
      </section>
    );
  }

  return (
    <section className="page-grid">
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
            <strong>当前还没有年度结果。</strong>
            <p>请先到计算中心执行重算，结果生成后会显示在这里。</p>
          </div>
        )}
      </article>

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

      <article className="glass-card page-section placeholder-card">
        <div className="section-header">
          <div>
            <h2>年度导出预览</h2>
            <p>这里展示导出模板、字段分组和当前导出预览，支持按模板或自定义字段导出 CSV / XLSX。</p>
          </div>
          <span className="tag">
            {exportPreviewRows.length ? `共 ${exportPreviewRows.length} 行` : "暂无预览"}
          </span>
        </div>

        <div className="export-template-panel">
          {ANNUAL_TAX_EXPORT_TEMPLATES.map((template) => (
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
        </div>

        {Array.from(
          ANNUAL_TAX_EXPORT_COLUMNS.reduce((groupMap, column) => {
            const columns = groupMap.get(column.group) ?? [];
            columns.push(column);
            groupMap.set(column.group, columns);
            return groupMap;
          }, new Map<string, typeof ANNUAL_TAX_EXPORT_COLUMNS>()),
        ).map(([groupName, columns]) => (
          <div className="subsection-block" key={groupName}>
            <h3>{groupName}</h3>
            <div className="export-column-panel">
              {columns.map((column) => (
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
    </section>
  );
};
