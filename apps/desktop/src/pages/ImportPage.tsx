import type {
  ImportCommitResponse,
  ImportConflictStrategy,
  ImportPreviewResponse,
  ImportType,
} from "@dude-tax/core";
import { type ChangeEvent, useMemo, useState } from "react";
import { apiClient } from "../api/client";
import { useAppContext } from "../context/AppContextProvider";
import { saveFileWithDesktopFallback } from "../utils/file-save";
import { parseImportFileToCsvText } from "./import-file-parser";
import { buildImportPreviewDetail } from "./import-preview-details";

const importTypeLabelMap: Record<ImportType, string> = {
  employee: "员工基础信息",
  month_record: "月度数据",
};

const conflictStrategyLabelMap: Record<ImportConflictStrategy, string> = {
  skip: "跳过冲突行",
  overwrite: "覆盖冲突记录",
  abort: "遇冲突即终止",
};

const conflictTypeLabelMap: Record<string, string> = {
  employee_code_conflict: "工号冲突",
  id_number_conflict: "证件号冲突",
  month_record_conflict: "月份记录冲突",
};

const templateFilenameMap: Record<ImportType, string> = {
  employee: "员工导入模板.csv",
  month_record: "月度数据导入模板.csv",
};

export const ImportPage = () => {
  const { context } = useAppContext();
  const currentUnitId = context?.currentUnitId ?? null;
  const currentTaxYear = context?.currentTaxYear ?? null;
  const currentUnit = context?.units.find((unit) => unit.id === currentUnitId) ?? null;

  const [importType, setImportType] = useState<ImportType>("employee");
  const [importText, setImportText] = useState("");
  const [conflictStrategy, setConflictStrategy] = useState<ImportConflictStrategy>("skip");
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [commitResult, setCommitResult] = useState<ImportCommitResponse | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const canOperate = Boolean(currentUnitId);

  const previewSummary = useMemo(() => {
    if (!preview) {
      return null;
    }

    return `可导入 ${preview.readyRows} 行 / 冲突 ${preview.conflictRows} 行 / 错误 ${preview.errorRows} 行`;
  }, [preview]);

  const downloadTemplate = async () => {
    try {
      setLoadingTemplate(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      const templateText = await apiClient.downloadImportTemplate(
        importType,
        currentUnitId ?? undefined,
        importType === "month_record" ? currentTaxYear ?? undefined : undefined,
      );
      await saveFileWithDesktopFallback({
        defaultPath: templateFilenameMap[importType],
        filters: [{ name: "CSV 文件", extensions: ["csv"] }],
        mimeType: "text/csv;charset=utf-8;",
        content: `\uFEFF${templateText}`,
      });
      setSuccessMessage("模板文件已生成，请在本地打开后填写。");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "下载模板失败");
    } finally {
      setLoadingTemplate(false);
    }
  };

  const handleImportFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setErrorMessage(null);
      setSuccessMessage(null);
      const fileText = await parseImportFileToCsvText(file);
      setImportText(fileText);
      setPreview(null);
      setCommitResult(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "读取文件失败");
    } finally {
      event.target.value = "";
    }
  };

  const previewImport = async () => {
    if (!currentUnitId) {
      setErrorMessage("请先选择单位");
      return;
    }

    try {
      setPreviewing(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      setCommitResult(null);
      const nextPreview = await apiClient.previewImport(
        importType,
        currentUnitId,
        importText,
        importType === "month_record" ? currentTaxYear ?? undefined : undefined,
      );
      setPreview(nextPreview);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "导入预览失败");
      setPreview(null);
    } finally {
      setPreviewing(false);
    }
  };

  const commitImport = async () => {
    if (!currentUnitId) {
      setErrorMessage("请先选择单位");
      return;
    }

    try {
      setCommitting(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      const nextCommitResult = await apiClient.commitImport(
        importType,
        currentUnitId,
        importText,
        conflictStrategy,
        importType === "month_record" ? currentTaxYear ?? undefined : undefined,
      );
      setCommitResult(nextCommitResult);
      setSuccessMessage("导入执行完成，请查看回执结果。");
      const nextPreview = await apiClient.previewImport(
        importType,
        currentUnitId,
        importText,
        importType === "month_record" ? currentTaxYear ?? undefined : undefined,
      );
      setPreview(nextPreview);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "执行导入失败");
    } finally {
      setCommitting(false);
    }
  };

  return (
    <section className="page-grid">
      <article className="glass-card page-section placeholder-card">
        <div className="section-header">
          <div>
            <h1>批量导入</h1>
            <p>
              当前房间：{currentUnit?.unitName ?? "未选择单位"} / {currentTaxYear ?? "-"} 年
            </p>
          </div>
          <span className="tag">{previewing || committing ? "处理中" : "导入模块已开启"}</span>
        </div>

        <div className="form-grid">
          <label className="form-field">
            <span>导入类型</span>
            <select value={importType} onChange={(event) => setImportType(event.target.value as ImportType)}>
              <option value="employee">员工基础信息</option>
              <option value="month_record">月度数据</option>
            </select>
          </label>

          <label className="form-field">
            <span>冲突处理策略</span>
            <select
              value={conflictStrategy}
              onChange={(event) => setConflictStrategy(event.target.value as ImportConflictStrategy)}
            >
              <option value="skip">跳过冲突行</option>
              <option value="overwrite">覆盖冲突记录</option>
              <option value="abort">遇冲突即终止</option>
            </select>
          </label>
        </div>

        <label className="form-field">
          <span>导入内容</span>
          <textarea
            className="maintenance-textarea"
            placeholder="可直接粘贴 CSV 内容，或选择 CSV / XLSX / XLSM 文件自动读取。"
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
          />
        </label>

        <label className="form-field">
          <span>导入文件</span>
          <input
            accept=".csv,.xlsx,.xlsm,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12"
            type="file"
            onChange={(event) => void handleImportFileSelect(event)}
          />
        </label>

        <div className="button-row">
          <button
            className="ghost-button"
            disabled={loadingTemplate || !canOperate}
            onClick={() => void downloadTemplate()}
          >
            {loadingTemplate ? "下载中" : "下载模板"}
          </button>
          <button
            className="ghost-button"
            disabled={!importText.trim() || !canOperate || previewing}
            onClick={() => void previewImport()}
          >
            导入预览
          </button>
          <button
            className="primary-button"
            disabled={!importText.trim() || !canOperate || committing || !preview}
            onClick={() => void commitImport()}
          >
            执行导入
          </button>
        </div>

        {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}
        {successMessage ? <div className="success-banner">{successMessage}</div> : null}
      </article>

      <article className="glass-card page-section">
        <div className="section-header">
          <div>
            <h2>导入预览</h2>
            <p>当前支持 CSV、XLSX、XLSM；这里会细化展示字段映射、冲突字段和值。</p>
          </div>
          <span className="tag">{previewSummary ?? "尚未预览"}</span>
        </div>

        {preview ? (
          <>
            <div className="summary-grid results-summary-grid">
              <div className="summary-card">
                <span>导入类型</span>
                <strong>{importTypeLabelMap[preview.importType]}</strong>
              </div>
              <div className="summary-card">
                <span>总行数</span>
                <strong>{preview.totalRows}</strong>
              </div>
              <div className="summary-card">
                <span>可导入</span>
                <strong>{preview.readyRows}</strong>
              </div>
              <div className="summary-card">
                <span>冲突行</span>
                <strong>{preview.conflictRows}</strong>
              </div>
              <div className="summary-card">
                <span>错误行</span>
                <strong>{preview.errorRows}</strong>
              </div>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>行号</th>
                  <th>状态</th>
                  <th>关键字段</th>
                  <th>字段明细</th>
                  <th>错误 / 说明</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => {
                  const detail = buildImportPreviewDetail(importType, row);

                  return (
                    <tr key={row.rowNumber}>
                      <td>{row.rowNumber}</td>
                      <td>
                        {row.status === "ready" ? (
                          <span className="tag">可导入</span>
                        ) : row.status === "conflict" ? (
                          <span className="tag tag-warning">冲突</span>
                        ) : (
                          <span className="tag tag-diff">错误</span>
                        )}
                      </td>
                      <td>
                        <div className="preview-summary-line">
                          <strong>{detail.primaryText}</strong>
                          {detail.secondaryText ? <small>{detail.secondaryText}</small> : null}
                        </div>
                      </td>
                      <td>
                        <div className="preview-detail-list">
                          {detail.fields.map((field) => (
                            <span
                              className={
                                field.isHighlighted
                                  ? "preview-field-chip is-highlighted"
                                  : "preview-field-chip"
                              }
                              key={field.key}
                            >
                              {field.label}：{field.value}
                            </span>
                          ))}
                          {detail.foldedFieldCount ? (
                            <span className="preview-field-chip is-folded">
                              另有 {detail.foldedFieldCount} 个字段已折叠
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        {row.errors.length ? (
                          row.errors.join("；")
                        ) : row.status === "conflict" ? (
                          <>
                            {conflictTypeLabelMap[row.conflictType ?? ""] ?? row.conflictType ?? "冲突"}
                            {detail.conflictFieldLabels.length
                              ? `，冲突字段：${detail.conflictFieldLabels.join("、")}`
                              : ""}
                          </>
                        ) : (
                          "通过校验"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        ) : (
          <div className="empty-state">
            <strong>请先执行导入预览。</strong>
            <p>下载模板、粘贴内容或选择文件后，系统会在这里展示冲突、错误和字段明细。</p>
          </div>
        )}
      </article>

      <article className="glass-card page-section placeholder-card">
        <div className="section-header">
          <div>
            <h2>导入回执</h2>
            <p>执行导入后会在这里展示成功、跳过和失败情况。</p>
          </div>
          <span className="tag">
            {commitResult ? conflictStrategyLabelMap[conflictStrategy] : "尚未导入"}
          </span>
        </div>

        {commitResult ? (
          <>
            <div className="summary-grid results-summary-grid">
              <div className="summary-card">
                <span>成功条数</span>
                <strong>{commitResult.successCount}</strong>
              </div>
              <div className="summary-card">
                <span>跳过条数</span>
                <strong>{commitResult.skippedCount}</strong>
              </div>
              <div className="summary-card">
                <span>失败条数</span>
                <strong>{commitResult.failureCount}</strong>
              </div>
            </div>

            {commitResult.failures.length ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>行号</th>
                    <th>失败原因</th>
                  </tr>
                </thead>
                <tbody>
                  {commitResult.failures.map((failure) => (
                    <tr key={`${failure.rowNumber}-${failure.reason}`}>
                      <td>{failure.rowNumber}</td>
                      <td>{failure.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="success-banner">本次导入没有失败行。</div>
            )}
          </>
        ) : (
          <div className="empty-state">
            <strong>尚未执行导入。</strong>
            <p>完成预览后执行导入，系统会在这里返回成功、跳过和失败统计。</p>
          </div>
        )}
      </article>
    </section>
  );
};
