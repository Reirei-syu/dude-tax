import {
  buildDefaultTaxPolicySettings,
  type BonusTaxBracket,
  type ComprehensiveTaxBracket,
  type TaxPolicyResponse,
  type TaxPolicySettings,
} from "../../../../packages/core/src/index";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiClient } from "../api/client";
import { useAppContext } from "../context/AppContextProvider";
import {
  applyLinePrefixEdit,
  applyWrapEdit,
  parseMaintenanceRichText,
  renderRichTextTokens,
} from "./maintenance-rich-text";
import { validateTaxPolicyDraft } from "./tax-policy-validation";

const maintenanceScopeItems = [
  "当前版本支持编辑并保存全局税率，保存后会自动使年度结果与重算记录失效。",
  "保存后的税率会同步作用于首页展示、系统维护页面和后续年度计算逻辑。",
  "当前已支持税率版本管理、富文本说明维护和作用域绑定，仍不包含变更审计。",
];

const maintenanceRoadmapItems = [
  "说明维护：全局提示说明与口径备注。",
  "税率版本管理：支持保留和切换历史版本。",
  "更精细的结果联动：按年度或按单位范围失效，而不是全量清空结果。",
];

const cloneTaxPolicySettings = (settings: TaxPolicySettings): TaxPolicySettings =>
  JSON.parse(JSON.stringify(settings)) as TaxPolicySettings;

const updateComprehensiveBracketValue = (
  settings: TaxPolicySettings,
  index: number,
  patch: Partial<ComprehensiveTaxBracket>,
) => ({
  ...settings,
  comprehensiveTaxBrackets: settings.comprehensiveTaxBrackets.map((bracket, bracketIndex) =>
    bracketIndex === index ? { ...bracket, ...patch } : bracket,
  ),
});

const updateBonusBracketValue = (
  settings: TaxPolicySettings,
  index: number,
  patch: Partial<BonusTaxBracket>,
) => ({
  ...settings,
  bonusTaxBrackets: settings.bonusTaxBrackets.map((bracket, bracketIndex) =>
    bracketIndex === index ? { ...bracket, ...patch } : bracket,
  ),
});

export const MaintenancePage = () => {
  const { context } = useAppContext();
  const currentUnit = context?.units.find((unit) => unit.id === context.currentUnitId) ?? null;
  const currentUnitId = context?.currentUnitId ?? null;
  const currentTaxYear = context?.currentTaxYear ?? null;
  const [taxPolicy, setTaxPolicy] = useState<TaxPolicyResponse | null>(null);
  const [draftSettings, setDraftSettings] = useState<TaxPolicySettings | null>(null);
  const [draftNotes, setDraftNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const notesTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const loadTaxPolicy = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const nextTaxPolicy = await apiClient.getTaxPolicy(currentUnitId ?? undefined, currentTaxYear ?? undefined);
      setTaxPolicy(nextTaxPolicy);
      setDraftSettings(cloneTaxPolicySettings(nextTaxPolicy.currentSettings));
      setDraftNotes(nextTaxPolicy.currentNotes);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载税率失败");
      setTaxPolicy(null);
      setDraftSettings(cloneTaxPolicySettings(buildDefaultTaxPolicySettings()));
      setDraftNotes("");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTaxPolicy();
  }, [currentUnitId, currentTaxYear]);

  const hasUnsavedChanges = useMemo(() => {
    if (!taxPolicy || !draftSettings) {
      return false;
    }

    return (
      JSON.stringify(taxPolicy.currentSettings) !== JSON.stringify(draftSettings) ||
      taxPolicy.currentNotes !== draftNotes
    );
  }, [draftNotes, draftSettings, taxPolicy]);

  const currentSettings =
    draftSettings ?? taxPolicy?.currentSettings ?? buildDefaultTaxPolicySettings();
  const richTextBlocks = useMemo(() => parseMaintenanceRichText(draftNotes), [draftNotes]);
  const validationIssues = useMemo(
    () => validateTaxPolicyDraft(currentSettings, draftNotes),
    [currentSettings, draftNotes],
  );
  const basicIssue = validationIssues.find((issue) => issue.section === "basic") ?? null;
  const notesIssue = validationIssues.find((issue) => issue.section === "notes") ?? null;
  const comprehensiveIssues = validationIssues.filter((issue) => issue.section === "comprehensive");
  const bonusIssues = validationIssues.filter((issue) => issue.section === "bonus");
  const invalidComprehensiveRows = useMemo(
    () =>
      new Set(
        comprehensiveIssues
          .map((issue) => issue.rowIndex)
          .filter((rowIndex): rowIndex is number => rowIndex !== undefined),
      ),
    [comprehensiveIssues],
  );
  const invalidBonusRows = useMemo(
    () =>
      new Set(
        bonusIssues
          .map((issue) => issue.rowIndex)
          .filter((rowIndex): rowIndex is number => rowIndex !== undefined),
      ),
    [bonusIssues],
  );

  const resetToSavedSettings = () => {
    if (!taxPolicy) {
      return;
    }

    setDraftSettings(cloneTaxPolicySettings(taxPolicy.currentSettings));
    setDraftNotes(taxPolicy.currentNotes);
    setSuccessMessage(null);
  };

  const resetToDefaultSettings = () => {
    const defaultSettings = taxPolicy?.defaultSettings ?? buildDefaultTaxPolicySettings();
    setDraftSettings(cloneTaxPolicySettings(defaultSettings));
    setDraftNotes(taxPolicy?.defaultNotes ?? "");
    setSuccessMessage(null);
  };

  const saveTaxPolicy = async () => {
    if (!draftSettings) {
      return;
    }

    try {
      setSaving(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      const nextTaxPolicy = await apiClient.updateTaxPolicy({
        ...draftSettings,
        maintenanceNotes: draftNotes,
      });
      setTaxPolicy(nextTaxPolicy);
      setDraftSettings(cloneTaxPolicySettings(nextTaxPolicy.currentSettings));
      setDraftNotes(nextTaxPolicy.currentNotes);
      setSuccessMessage(
        nextTaxPolicy.invalidatedResults
          ? "说明与税率已保存；由于税率已变更，年度结果与重算记录已失效，请前往计算中心重新计算。"
          : "说明已保存；当前税率未变更，年度结果保持有效。",
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "保存税率失败");
    } finally {
      setSaving(false);
    }
  };

  const applyNotesEdit = (
    transform: (text: string, selectionStart: number, selectionEnd: number) => {
      nextText: string;
      nextSelectionStart: number;
      nextSelectionEnd: number;
    },
  ) => {
    const textarea = notesTextareaRef.current;
    const selectionStart = textarea?.selectionStart ?? draftNotes.length;
    const selectionEnd = textarea?.selectionEnd ?? draftNotes.length;
    const result = transform(draftNotes, selectionStart, selectionEnd);

    setDraftNotes(result.nextText);
    requestAnimationFrame(() => {
      if (!textarea) {
        return;
      }

      textarea.focus();
      textarea.setSelectionRange(result.nextSelectionStart, result.nextSelectionEnd);
    });
  };

  const activateTaxPolicyVersion = async (versionId: number) => {
    try {
      setSaving(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      const nextTaxPolicy = await apiClient.activateTaxPolicyVersion(versionId);
      setTaxPolicy(nextTaxPolicy);
      setDraftSettings(cloneTaxPolicySettings(nextTaxPolicy.currentSettings));
      setDraftNotes(nextTaxPolicy.currentNotes);
      setSuccessMessage(
        nextTaxPolicy.invalidatedResults
          ? `已切换到历史税率版本「${nextTaxPolicy.currentVersionName}」；当前有效结果已按该版本重新判定，请前往计算中心确认是否需要重算。`
          : `已切换到税率版本「${nextTaxPolicy.currentVersionName}」。`,
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "切换税率版本失败");
    } finally {
      setSaving(false);
    }
  };

  const bindTaxPolicyVersionToCurrentScope = async (versionId: number) => {
    if (!currentUnitId || !currentTaxYear) {
      setErrorMessage("请先选择单位和年份，再绑定作用域税率版本");
      return;
    }

    try {
      setSaving(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      const nextTaxPolicy = await apiClient.bindTaxPolicyVersionToScope(versionId, currentUnitId, currentTaxYear);
      setTaxPolicy(nextTaxPolicy);
      setDraftSettings(cloneTaxPolicySettings(nextTaxPolicy.currentSettings));
      setDraftNotes(nextTaxPolicy.currentNotes);
      setSuccessMessage(
        nextTaxPolicy.invalidatedResults
          ? `已将税率版本「${nextTaxPolicy.currentScopeBinding?.versionName ?? nextTaxPolicy.currentVersionName}」绑定到当前单位 / 年度；当前作用域结果已重新判定有效性。`
          : `已将税率版本绑定到当前单位 / 年度。`,
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "绑定作用域税率版本失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="page-grid">
      <article className="glass-card page-section placeholder-card">
        <div className="section-header">
          <div>
            <h1>系统维护</h1>
            <p>当前可编辑并保存全局税率；保存后将清空年度结果与重算记录，保证后续计算口径一致。</p>
          </div>
          <span className="tag">{loading ? "加载中" : saving ? "保存中" : "可编辑"}</span>
        </div>

        <div className="summary-grid results-summary-grid">
          <div className="summary-card">
            <span>当前单位</span>
            <strong>{currentUnit?.unitName ?? "未选择单位"}</strong>
          </div>
          <div className="summary-card">
            <span>当前年份</span>
            <strong>{currentTaxYear ?? "-"}</strong>
          </div>
          <div className="summary-card">
            <span>当前税率版本</span>
            <strong>{taxPolicy?.currentVersionName ?? "默认税率版本"}</strong>
          </div>
          <div className="summary-card">
            <span>编辑状态</span>
            <strong>{hasUnsavedChanges ? "有未保存修改" : "已同步"}</strong>
          </div>
          <div className="summary-card">
            <span>校验状态</span>
            <strong>{validationIssues.length ? `待修正 ${validationIssues.length} 项` : "已通过"}</strong>
          </div>
          <div className="summary-card">
            <span>税率版本数</span>
            <strong>{taxPolicy?.versions.length ?? 0}</strong>
          </div>
          <div className="summary-card">
            <span>当前作用域税率</span>
            <strong>{taxPolicy?.currentScopeBinding?.versionName ?? "未绑定"}</strong>
          </div>
        </div>

        <div className="maintenance-warning-card">
          <strong>保存影响</strong>
          <p>税率保存成功后，将自动清空当前所有年度结果和重算记录，请在保存后重新执行年度重算。</p>
        </div>

        {validationIssues.length ? (
          <div className="validation-card">
            <strong>请先修正以下校验问题</strong>
            <ul className="validation-list">
              {validationIssues.map((issue) => (
                <li key={`${issue.section}-${issue.rowIndex ?? "global"}-${issue.message}`}>{issue.message}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}
        {successMessage ? <div className="success-banner">{successMessage}</div> : null}
      </article>

      <article className="glass-card page-section">
        <div className="section-header">
          <div>
            <h2>基本减除费用</h2>
            <p>按月维护全局基本减除费用，后续年度计算会直接使用这里的值。</p>
          </div>
        </div>

        <label className="form-field">
          <span>基本减除费用（元 / 月）</span>
          <input
            className={basicIssue ? "input-invalid" : undefined}
            min={0}
            type="number"
            value={currentSettings.basicDeductionAmount}
            onChange={(event) =>
              setDraftSettings((previousSettings) =>
                previousSettings
                  ? {
                      ...previousSettings,
                      basicDeductionAmount: Number(event.target.value || 0),
                    }
                  : previousSettings,
              )
            }
          />
        </label>
        {basicIssue ? <p className="field-hint field-error">{basicIssue.message}</p> : null}
      </article>

      <article className="glass-card page-section">
        <div className="section-header">
          <div>
            <h2>全局说明（富文本）</h2>
            <p>支持标题、列表、引用、加粗和代码样式，仍按全局统一生效。</p>
          </div>
          <span className="tag">{taxPolicy?.notesCustomized ? "已自定义说明" : "默认空白"}</span>
        </div>

        <div className="rich-text-toolbar">
          <button
            className="ghost-button table-action-button"
            onClick={() => applyNotesEdit((text, start, end) => applyLinePrefixEdit(text, start, end, "# "))}
            type="button"
          >
            标题
          </button>
          <button
            className="ghost-button table-action-button"
            onClick={() => applyNotesEdit((text, start, end) => applyLinePrefixEdit(text, start, end, "## "))}
            type="button"
          >
            小标题
          </button>
          <button
            className="ghost-button table-action-button"
            onClick={() => applyNotesEdit((text, start, end) => applyLinePrefixEdit(text, start, end, "- "))}
            type="button"
          >
            列表
          </button>
          <button
            className="ghost-button table-action-button"
            onClick={() => applyNotesEdit((text, start, end) => applyLinePrefixEdit(text, start, end, "> "))}
            type="button"
          >
            引用
          </button>
          <button
            className="ghost-button table-action-button"
            onClick={() => applyNotesEdit((text, start, end) => applyWrapEdit(text, start, end, "**", "**"))}
            type="button"
          >
            加粗
          </button>
          <button
            className="ghost-button table-action-button"
            onClick={() => applyNotesEdit((text, start, end) => applyWrapEdit(text, start, end, "`", "`"))}
            type="button"
          >
            代码
          </button>
        </div>

        <div className="rich-text-editor-grid">
          <label className="form-field">
            <span>编辑说明</span>
            <textarea
              className={notesIssue ? "maintenance-textarea input-invalid" : "maintenance-textarea"}
              maxLength={2000}
              placeholder="例如：# 适用范围&#10;- 当前税率适用于 2026 年工资薪金年度计算&#10;- 保存税率后需重新执行年度重算"
              ref={notesTextareaRef}
              value={draftNotes}
              onChange={(event) => setDraftNotes(event.target.value)}
            />
          </label>

          <div className="rich-text-preview-card">
            <span className="field-label">预览</span>
            {richTextBlocks.length ? (
              <div className="rich-text-preview">
                {richTextBlocks.map((block, index) => {
                  if (block.type === "heading") {
                    if (block.level === 1) {
                      return <h3 key={index}>{renderRichTextTokens(block.tokens, `heading-1-${index}`)}</h3>;
                    }

                    if (block.level === 2) {
                      return <h4 key={index}>{renderRichTextTokens(block.tokens, `heading-2-${index}`)}</h4>;
                    }

                    return <h5 key={index}>{renderRichTextTokens(block.tokens, `heading-3-${index}`)}</h5>;
                  }

                  if (block.type === "quote") {
                    return <blockquote key={index}>{renderRichTextTokens(block.tokens, `quote-${index}`)}</blockquote>;
                  }

                  if (block.type === "list") {
                    return (
                      <ul key={index}>
                        {block.items.map((itemTokens, itemIndex) => (
                          <li key={`${index}-${itemIndex}`}>
                            {renderRichTextTokens(itemTokens, `list-${index}-${itemIndex}`)}
                          </li>
                        ))}
                      </ul>
                    );
                  }

                  return <p key={index}>{renderRichTextTokens(block.tokens, `paragraph-${index}`)}</p>;
                })}
              </div>
            ) : (
              <div className="empty-state">
                <strong>说明预览为空。</strong>
                <p>可直接输入正文，或使用上方按钮快速插入标题、列表、引用和强调格式。</p>
              </div>
            )}
          </div>
        </div>

        <p className={notesIssue ? "field-hint field-error" : "field-hint"}>
          {notesIssue ? `${notesIssue.message}；` : ""}
          当前已输入 {draftNotes.length} / 2000 字。支持标题、列表、引用、加粗和代码样式。
        </p>
      </article>

      <article className="glass-card page-section">
        <div className="section-header">
          <div>
            <h2>综合所得税率表</h2>
            <p>“级数”与“区间说明”为固定展示，“封顶值 / 税率 / 速算扣除数”可编辑。</p>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>级数</th>
              <th>应纳税所得额</th>
              <th>封顶值</th>
              <th>税率（%）</th>
              <th>速算扣除数</th>
            </tr>
          </thead>
          <tbody>
            {currentSettings.comprehensiveTaxBrackets.map((bracket, index) => {
              const isLast = index === currentSettings.comprehensiveTaxBrackets.length - 1;

              return (
                <tr className={invalidComprehensiveRows.has(index) ? "table-row-invalid" : undefined} key={bracket.level}>
                  <td>{bracket.level}</td>
                  <td>{bracket.rangeText}</td>
                  <td>
                    {isLast ? (
                      <span className="field-hint">不封顶</span>
                    ) : (
                      <input
                        className="table-input"
                        min={0}
                        type="number"
                        value={bracket.maxAnnualIncome ?? ""}
                        onChange={(event) =>
                          setDraftSettings((previousSettings) =>
                            previousSettings
                              ? updateComprehensiveBracketValue(previousSettings, index, {
                                  maxAnnualIncome: Number(event.target.value || 0),
                                })
                              : previousSettings,
                          )
                        }
                      />
                    )}
                  </td>
                  <td>
                    <input
                      className="table-input"
                      min={0}
                      step="0.01"
                      type="number"
                      value={bracket.rate}
                      onChange={(event) =>
                        setDraftSettings((previousSettings) =>
                          previousSettings
                            ? updateComprehensiveBracketValue(previousSettings, index, {
                                rate: Number(event.target.value || 0),
                              })
                            : previousSettings,
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      className="table-input"
                      min={0}
                      step="0.01"
                      type="number"
                      value={bracket.quickDeduction}
                      onChange={(event) =>
                        setDraftSettings((previousSettings) =>
                          previousSettings
                            ? updateComprehensiveBracketValue(previousSettings, index, {
                                quickDeduction: Number(event.target.value || 0),
                              })
                            : previousSettings,
                        )
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {comprehensiveIssues.length ? (
          <ul className="validation-list compact-validation-list">
            {comprehensiveIssues.map((issue) => (
              <li key={`comprehensive-${issue.rowIndex ?? "global"}-${issue.message}`}>{issue.message}</li>
            ))}
          </ul>
        ) : null}
      </article>

      <article className="glass-card page-section">
        <div className="section-header">
          <div>
            <h2>年终奖单独计税税率表</h2>
            <p>“级数”与“区间说明”为固定展示，“封顶值 / 税率 / 速算扣除数”可编辑。</p>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>级数</th>
              <th>平均每月额</th>
              <th>封顶值</th>
              <th>税率（%）</th>
              <th>速算扣除数</th>
            </tr>
          </thead>
          <tbody>
            {currentSettings.bonusTaxBrackets.map((bracket, index) => {
              const isLast = index === currentSettings.bonusTaxBrackets.length - 1;

              return (
                <tr className={invalidBonusRows.has(index) ? "table-row-invalid" : undefined} key={bracket.level}>
                  <td>{bracket.level}</td>
                  <td>{bracket.rangeText}</td>
                  <td>
                    {isLast ? (
                      <span className="field-hint">不封顶</span>
                    ) : (
                      <input
                        className="table-input"
                        min={0}
                        type="number"
                        value={bracket.maxAverageMonthlyIncome ?? ""}
                        onChange={(event) =>
                          setDraftSettings((previousSettings) =>
                            previousSettings
                              ? updateBonusBracketValue(previousSettings, index, {
                                  maxAverageMonthlyIncome: Number(event.target.value || 0),
                                })
                              : previousSettings,
                          )
                        }
                      />
                    )}
                  </td>
                  <td>
                    <input
                      className="table-input"
                      min={0}
                      step="0.01"
                      type="number"
                      value={bracket.rate}
                      onChange={(event) =>
                        setDraftSettings((previousSettings) =>
                          previousSettings
                            ? updateBonusBracketValue(previousSettings, index, {
                                rate: Number(event.target.value || 0),
                              })
                            : previousSettings,
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      className="table-input"
                      min={0}
                      step="0.01"
                      type="number"
                      value={bracket.quickDeduction}
                      onChange={(event) =>
                        setDraftSettings((previousSettings) =>
                          previousSettings
                            ? updateBonusBracketValue(previousSettings, index, {
                                quickDeduction: Number(event.target.value || 0),
                              })
                            : previousSettings,
                        )
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {bonusIssues.length ? (
          <ul className="validation-list compact-validation-list">
            {bonusIssues.map((issue) => (
              <li key={`bonus-${issue.rowIndex ?? "global"}-${issue.message}`}>{issue.message}</li>
            ))}
          </ul>
        ) : null}
      </article>

      <article className="glass-card page-section placeholder-card">
        <div className="section-header">
          <div>
            <h2>税率版本列表</h2>
            <p>当前支持保留历史税率版本、回切全局活动版本，并将某个版本绑定到当前单位 / 年度作用域。</p>
          </div>
          <span className="tag">{taxPolicy?.versions.length ?? 0} 个版本</span>
        </div>

        {hasUnsavedChanges ? (
          <div className="maintenance-warning-card">
            <strong>版本切换限制</strong>
            <p>当前有未保存修改。请先保存、恢复已保存或恢复默认后，再切换历史税率版本。</p>
          </div>
        ) : null}

        {taxPolicy?.currentScopeBinding ? (
          <div className="maintenance-warning-card">
            <strong>当前作用域</strong>
            <p>
              {currentUnit?.unitName ?? "未选择单位"} / {currentTaxYear ?? "-"} 年当前使用
              {taxPolicy.currentScopeBinding.isInherited ? "全局活动税率" : "专属绑定税率"}：
              {taxPolicy.currentScopeBinding.versionName}
            </p>
          </div>
        ) : null}

        <div className="reminder-list">
          {taxPolicy?.versions.map((version) => (
            <div className="maintenance-note-card" key={version.id}>
              <div className="section-header compact-section-header">
                <div>
                  <strong>{version.versionName}</strong>
                  <p>创建时间：{version.createdAt}</p>
                  <p>最近启用：{version.activatedAt ?? "未启用"}</p>
                </div>
                <span className={version.isActive ? "tag" : "tag tag-neutral"}>
                  {version.isActive ? "当前生效" : "历史版本"}
                </span>
              </div>
              <div className="button-row compact">
                <button
                  className="ghost-button"
                  disabled={loading || saving || version.isActive || hasUnsavedChanges}
                  onClick={() => void activateTaxPolicyVersion(version.id)}
                >
                  激活此版本
                </button>
                <button
                  className="ghost-button"
                  disabled={
                    loading ||
                    saving ||
                    hasUnsavedChanges ||
                    !currentUnitId ||
                    !currentTaxYear ||
                    taxPolicy?.currentScopeBinding?.versionId === version.id
                  }
                  onClick={() => void bindTaxPolicyVersionToCurrentScope(version.id)}
                >
                  绑定到当前单位 / 年度
                </button>
              </div>
            </div>
          ))}
        </div>
      </article>

      <article className="glass-card page-section placeholder-card">
        <div className="section-header">
          <div>
            <h2>维护范围</h2>
            <p>当前已开放税率编辑、富文本说明维护、版本管理和作用域绑定；更细粒度优化仍在后续计划中。</p>
          </div>
        </div>

        <div className="reminder-list">
          {maintenanceScopeItems.map((item) => (
            <div className="maintenance-note-card" key={item}>
              <strong>当前说明</strong>
              <p>{item}</p>
            </div>
          ))}
          {maintenanceRoadmapItems.map((item) => (
            <div className="maintenance-note-card" key={item}>
              <strong>待开发</strong>
              <p>{item}</p>
            </div>
          ))}
        </div>

        <div className="button-row">
          <button className="ghost-button" disabled={loading || saving} onClick={() => void loadTaxPolicy()}>
            刷新税率
          </button>
          <button className="ghost-button" disabled={loading || saving} onClick={resetToSavedSettings}>
            恢复已保存
          </button>
          <button className="ghost-button" disabled={loading || saving} onClick={resetToDefaultSettings}>
            恢复默认税率
          </button>
          <button
            className="primary-button"
            disabled={loading || saving || !draftSettings || validationIssues.length > 0}
            onClick={() => void saveTaxPolicy()}
          >
            保存税率
          </button>
        </div>
      </article>
    </section>
  );
};

