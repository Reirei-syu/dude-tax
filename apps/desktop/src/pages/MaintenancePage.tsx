import {
  buildDefaultTaxPolicySettings,
  type BonusTaxBracket,
  type ComprehensiveTaxBracket,
  type TaxPolicyResponse,
  type TaxPolicySettings,
  type TaxPolicyVersionImpactPreview,
} from "@dude-tax/core";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { apiClient } from "../api/client";
import { useAppContext } from "../context/AppContextProvider";
import {
  applyLinePrefixEdit,
  applyWrapEdit,
  parseMaintenanceRichText,
  renderRichTextTokens,
} from "./maintenance-rich-text";
import { validateTaxPolicyDraft } from "./tax-policy-validation";

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

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("读取插图失败"));
    reader.readAsDataURL(file);
  });

export const MaintenancePage = () => {
  const { context } = useAppContext();
  const currentUnit = context?.units.find((unit) => unit.id === context.currentUnitId) ?? null;
  const currentUnitId = context?.currentUnitId ?? null;
  const currentTaxYear = context?.currentTaxYear ?? null;
  const notesTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [taxPolicy, setTaxPolicy] = useState<TaxPolicyResponse | null>(null);
  const [draftSettings, setDraftSettings] = useState<TaxPolicySettings | null>(null);
  const [policyTitle, setPolicyTitle] = useState("");
  const [policyBody, setPolicyBody] = useState("");
  const [policyIllustrationDataUrl, setPolicyIllustrationDataUrl] = useState("");
  const [impactPreview, setImpactPreview] = useState<TaxPolicyVersionImpactPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadTaxPolicy = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const nextTaxPolicy = await apiClient.getTaxPolicy(currentUnitId ?? undefined, currentTaxYear ?? undefined);
      setTaxPolicy(nextTaxPolicy);
      setDraftSettings(cloneTaxPolicySettings(nextTaxPolicy.currentSettings));
      setPolicyTitle(nextTaxPolicy.policyTitle);
      setPolicyBody(nextTaxPolicy.policyBody);
      setPolicyIllustrationDataUrl(nextTaxPolicy.policyIllustrationDataUrl);
      setImpactPreview(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载系统维护配置失败");
      setTaxPolicy(null);
      setDraftSettings(cloneTaxPolicySettings(buildDefaultTaxPolicySettings()));
      setPolicyTitle("");
      setPolicyBody("");
      setPolicyIllustrationDataUrl("");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTaxPolicy();
  }, [currentTaxYear, currentUnitId]);

  const currentSettings =
    draftSettings ?? taxPolicy?.currentSettings ?? buildDefaultTaxPolicySettings();
  const richTextBlocks = useMemo(() => parseMaintenanceRichText(policyBody), [policyBody]);
  const validationIssues = useMemo(
    () => validateTaxPolicyDraft(currentSettings, policyBody),
    [currentSettings, policyBody],
  );
  const basicIssue = validationIssues.find((issue) => issue.section === "basic") ?? null;

  const hasUnsavedChanges = useMemo(() => {
    if (!taxPolicy || !draftSettings) {
      return false;
    }
    return (
      JSON.stringify(taxPolicy.currentSettings) !== JSON.stringify(draftSettings) ||
      taxPolicy.policyTitle !== policyTitle ||
      taxPolicy.policyBody !== policyBody ||
      taxPolicy.policyIllustrationDataUrl !== policyIllustrationDataUrl
    );
  }, [draftSettings, policyBody, policyIllustrationDataUrl, policyTitle, taxPolicy]);

  const applyBodyEdit = (
    transform: (text: string, selectionStart: number, selectionEnd: number) => {
      nextText: string;
      nextSelectionStart: number;
      nextSelectionEnd: number;
    },
  ) => {
    const textarea = notesTextareaRef.current;
    const selectionStart = textarea?.selectionStart ?? policyBody.length;
    const selectionEnd = textarea?.selectionEnd ?? policyBody.length;
    const result = transform(policyBody, selectionStart, selectionEnd);
    setPolicyBody(result.nextText);
    requestAnimationFrame(() => {
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(result.nextSelectionStart, result.nextSelectionEnd);
    });
  };

  const saveTaxPolicy = async () => {
    if (!draftSettings) return;
    try {
      setSaving(true);
      setErrorMessage(null);
      const nextTaxPolicy = await apiClient.updateTaxPolicy({
        ...draftSettings,
        policyTitle,
        policyBody,
        policyIllustrationDataUrl,
      });
      setTaxPolicy(nextTaxPolicy);
      setDraftSettings(cloneTaxPolicySettings(nextTaxPolicy.currentSettings));
      setPolicyTitle(nextTaxPolicy.policyTitle);
      setPolicyBody(nextTaxPolicy.policyBody);
      setPolicyIllustrationDataUrl(nextTaxPolicy.policyIllustrationDataUrl);
      setSuccessMessage(
        nextTaxPolicy.invalidatedResults
          ? "税率与当前政策已保存，相关结果已转为待重新计算。"
          : "系统维护配置已保存。",
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "保存系统维护配置失败");
    } finally {
      setSaving(false);
    }
  };

  const handleIllustrationFileSelect = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setErrorMessage(null);
      setPolicyIllustrationDataUrl(await readFileAsDataUrl(file));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "读取插图失败");
    } finally {
      event.target.value = "";
    }
  };

  const activateTaxPolicyVersion = async (versionId: number) => {
    try {
      setSaving(true);
      setErrorMessage(null);
      const nextTaxPolicy = await apiClient.activateTaxPolicyVersion(versionId);
      setTaxPolicy(nextTaxPolicy);
      setDraftSettings(cloneTaxPolicySettings(nextTaxPolicy.currentSettings));
      setPolicyTitle(nextTaxPolicy.policyTitle);
      setPolicyBody(nextTaxPolicy.policyBody);
      setPolicyIllustrationDataUrl(nextTaxPolicy.policyIllustrationDataUrl);
      setSuccessMessage(`已切换到税率版本“${nextTaxPolicy.currentVersionName}”。`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "切换税率版本失败");
    } finally {
      setSaving(false);
    }
  };

  const bindTaxPolicyVersionToCurrentScope = async (versionId: number) => {
    if (!currentUnitId || !currentTaxYear) {
      setErrorMessage("请先选择单位和年份，再绑定作用域版本。");
      return;
    }
    try {
      setSaving(true);
      setErrorMessage(null);
      const nextTaxPolicy = await apiClient.bindTaxPolicyVersionToScope(versionId, currentUnitId, currentTaxYear);
      setTaxPolicy(nextTaxPolicy);
      setDraftSettings(cloneTaxPolicySettings(nextTaxPolicy.currentSettings));
      setPolicyTitle(nextTaxPolicy.policyTitle);
      setPolicyBody(nextTaxPolicy.policyBody);
      setPolicyIllustrationDataUrl(nextTaxPolicy.policyIllustrationDataUrl);
      setImpactPreview(null);
      setSuccessMessage("已绑定到当前单位 / 年份。");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "绑定作用域版本失败");
    } finally {
      setSaving(false);
    }
  };

  const previewTaxPolicyVersionImpact = async (versionId: number) => {
    if (!currentUnitId || !currentTaxYear) {
      setErrorMessage("请先选择单位和年份，再查看影响。");
      return;
    }
    try {
      setPreviewLoading(true);
      setErrorMessage(null);
      setImpactPreview(await apiClient.getTaxPolicyVersionImpactPreview(versionId, currentUnitId, currentTaxYear));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载影响预览失败");
      setImpactPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const unbindCurrentScope = async () => {
    if (!currentUnitId || !currentTaxYear) {
      setErrorMessage("请先选择单位和年份，再解除绑定。");
      return;
    }
    try {
      setSaving(true);
      setErrorMessage(null);
      const nextTaxPolicy = await apiClient.unbindCurrentScopeTaxPolicy(currentUnitId, currentTaxYear);
      setTaxPolicy(nextTaxPolicy);
      setDraftSettings(cloneTaxPolicySettings(nextTaxPolicy.currentSettings));
      setPolicyTitle(nextTaxPolicy.policyTitle);
      setPolicyBody(nextTaxPolicy.policyBody);
      setPolicyIllustrationDataUrl(nextTaxPolicy.policyIllustrationDataUrl);
      setImpactPreview(null);
      setSuccessMessage("已解除当前单位 / 年份绑定。");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "解除绑定失败");
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
            <p>当前房间：{currentUnit?.unitName ?? "未选择单位"} / {currentTaxYear ?? "-"} 年</p>
          </div>
          <span className="tag">{loading ? "加载中" : saving ? "保存中" : "可编辑"}</span>
        </div>
        <div className="summary-grid results-summary-grid">
          <div className="summary-card"><span>当前税率版本</span><strong>{taxPolicy?.currentVersionName ?? "默认税率版本"}</strong></div>
          <div className="summary-card"><span>版本数量</span><strong>{taxPolicy?.versions.length ?? 0}</strong></div>
          <div className="summary-card"><span>编辑状态</span><strong>{hasUnsavedChanges ? "有未保存修改" : "已同步"}</strong></div>
        </div>
        {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}
        {successMessage ? <div className="success-banner">{successMessage}</div> : null}
      </article>

      <article className="glass-card page-section">
        <div className="section-header">
          <div>
            <h2>扣除项说明</h2>
            <p>“当前政策”模块会直接展示这里的标题、正文和插图。</p>
          </div>
        </div>
        <div className="form-grid">
          <label className="form-field">
            <span>标题</span>
            <input maxLength={100} value={policyTitle} onChange={(event) => setPolicyTitle(event.target.value)} />
          </label>
          <label className="form-field">
            <span>插图文件</span>
            <input accept="image/*" type="file" onChange={(event) => void handleIllustrationFileSelect(event)} />
          </label>
        </div>
        <div className="button-row compact">
          <button className="ghost-button" onClick={() => setPolicyIllustrationDataUrl("")} type="button">清空插图</button>
        </div>
        <div className="rich-text-toolbar">
          <button className="ghost-button table-action-button" onClick={() => applyBodyEdit((text, start, end) => applyLinePrefixEdit(text, start, end, "# "))} type="button">一级标题</button>
          <button className="ghost-button table-action-button" onClick={() => applyBodyEdit((text, start, end) => applyLinePrefixEdit(text, start, end, "## "))} type="button">二级标题</button>
          <button className="ghost-button table-action-button" onClick={() => applyBodyEdit((text, start, end) => applyLinePrefixEdit(text, start, end, "- "))} type="button">列表</button>
          <button className="ghost-button table-action-button" onClick={() => applyBodyEdit((text, start, end) => applyLinePrefixEdit(text, start, end, "> "))} type="button">引用</button>
          <button className="ghost-button table-action-button" onClick={() => applyBodyEdit((text, start, end) => applyWrapEdit(text, start, end, "**", "**"))} type="button">加粗</button>
          <button className="ghost-button table-action-button" onClick={() => applyBodyEdit((text, start, end) => applyWrapEdit(text, start, end, "`", "`"))} type="button">代码</button>
        </div>
        <div className="rich-text-editor-grid">
          <label className="form-field">
            <span>正文</span>
            <textarea className="maintenance-textarea" maxLength={2000} ref={notesTextareaRef} value={policyBody} onChange={(event) => setPolicyBody(event.target.value)} />
          </label>
          <div className="rich-text-preview-card">
            <span className="field-label">预览</span>
            <strong>{policyTitle || "未设置标题"}</strong>
            {policyIllustrationDataUrl ? <img alt={policyTitle || "政策插图"} className="policy-illustration" src={policyIllustrationDataUrl} /> : null}
            {richTextBlocks.length ? <div className="rich-text-preview">{richTextBlocks.map((block, index) => {
              if (block.type === "heading") {
                if (block.level === 1) return <h3 key={index}>{renderRichTextTokens(block.tokens, `preview-h1-${index}`)}</h3>;
                if (block.level === 2) return <h4 key={index}>{renderRichTextTokens(block.tokens, `preview-h2-${index}`)}</h4>;
                return <h5 key={index}>{renderRichTextTokens(block.tokens, `preview-h3-${index}`)}</h5>;
              }
              if (block.type === "quote") return <blockquote key={index}>{renderRichTextTokens(block.tokens, `preview-q-${index}`)}</blockquote>;
              if (block.type === "list") return <ul key={index}>{block.items.map((itemTokens, itemIndex) => <li key={`${index}-${itemIndex}`}>{renderRichTextTokens(itemTokens, `preview-l-${index}-${itemIndex}`)}</li>)}</ul>;
              return <p key={index}>{renderRichTextTokens(block.tokens, `preview-p-${index}`)}</p>;
            })}</div> : <div className="empty-state"><strong>当前正文为空。</strong><p>保存后会同步显示到“当前政策”模块。</p></div>}
          </div>
        </div>
      </article>

      <article className="glass-card page-section">
        <div className="section-header"><div><h2>基本减除费用</h2><p>后续年度计算会直接使用这里的值。</p></div></div>
        <label className="form-field">
          <span>基本减除费用（元 / 月）</span>
          <input className={basicIssue ? "input-invalid" : undefined} min={0} type="number" value={currentSettings.basicDeductionAmount} onChange={(event) => setDraftSettings((previousSettings) => previousSettings ? { ...previousSettings, basicDeductionAmount: Number(event.target.value || 0) } : previousSettings)} />
        </label>
        {basicIssue ? <p className="field-hint field-error">{basicIssue.message}</p> : null}
      </article>

      <article className="glass-card page-section">
        <div className="section-header"><div><h2>综合所得税率表</h2><p>可编辑税率与速算扣除数。</p></div></div>
        <table className="data-table">
          <thead><tr><th>级数</th><th>应纳税所得额</th><th>封顶值</th><th>税率（%）</th><th>速算扣除数</th></tr></thead>
          <tbody>{currentSettings.comprehensiveTaxBrackets.map((bracket, index) => {
            const isLast = index === currentSettings.comprehensiveTaxBrackets.length - 1;
            return <tr className={validationIssues.some((issue) => issue.section === "comprehensive" && issue.rowIndex === index) ? "table-row-invalid" : undefined} key={bracket.level}>
              <td>{bracket.level}</td><td>{bracket.rangeText}</td>
              <td>{isLast ? <span className="field-hint">不封顶</span> : <input className="table-input" min={0} type="number" value={bracket.maxAnnualIncome ?? ""} onChange={(event) => setDraftSettings((previousSettings) => previousSettings ? updateComprehensiveBracketValue(previousSettings, index, { maxAnnualIncome: Number(event.target.value || 0) }) : previousSettings)} />}</td>
              <td><input className="table-input" min={0} step="0.01" type="number" value={bracket.rate} onChange={(event) => setDraftSettings((previousSettings) => previousSettings ? updateComprehensiveBracketValue(previousSettings, index, { rate: Number(event.target.value || 0) }) : previousSettings)} /></td>
              <td><input className="table-input" min={0} step="0.01" type="number" value={bracket.quickDeduction} onChange={(event) => setDraftSettings((previousSettings) => previousSettings ? updateComprehensiveBracketValue(previousSettings, index, { quickDeduction: Number(event.target.value || 0) }) : previousSettings)} /></td>
            </tr>;
          })}</tbody>
        </table>
      </article>

      <article className="glass-card page-section">
        <div className="section-header"><div><h2>年终奖单独计税税率表</h2><p>可编辑税率与速算扣除数。</p></div></div>
        <table className="data-table">
          <thead><tr><th>级数</th><th>平均每月额</th><th>封顶值</th><th>税率（%）</th><th>速算扣除数</th></tr></thead>
          <tbody>{currentSettings.bonusTaxBrackets.map((bracket, index) => {
            const isLast = index === currentSettings.bonusTaxBrackets.length - 1;
            return <tr className={validationIssues.some((issue) => issue.section === "bonus" && issue.rowIndex === index) ? "table-row-invalid" : undefined} key={bracket.level}>
              <td>{bracket.level}</td><td>{bracket.rangeText}</td>
              <td>{isLast ? <span className="field-hint">不封顶</span> : <input className="table-input" min={0} type="number" value={bracket.maxAverageMonthlyIncome ?? ""} onChange={(event) => setDraftSettings((previousSettings) => previousSettings ? updateBonusBracketValue(previousSettings, index, { maxAverageMonthlyIncome: Number(event.target.value || 0) }) : previousSettings)} />}</td>
              <td><input className="table-input" min={0} step="0.01" type="number" value={bracket.rate} onChange={(event) => setDraftSettings((previousSettings) => previousSettings ? updateBonusBracketValue(previousSettings, index, { rate: Number(event.target.value || 0) }) : previousSettings)} /></td>
              <td><input className="table-input" min={0} step="0.01" type="number" value={bracket.quickDeduction} onChange={(event) => setDraftSettings((previousSettings) => previousSettings ? updateBonusBracketValue(previousSettings, index, { quickDeduction: Number(event.target.value || 0) }) : previousSettings)} /></td>
            </tr>;
          })}</tbody>
        </table>
      </article>

      <article className="glass-card page-section placeholder-card">
        <div className="section-header"><div><h2>税率版本列表</h2><p>支持激活历史版本、绑定当前作用域和查看影响。</p></div></div>
        {taxPolicy?.currentScopeBinding && !taxPolicy.currentScopeBinding.isInherited ? <div className="maintenance-warning-card"><strong>当前作用域已绑定专属版本</strong><p>{taxPolicy.currentScopeBinding.versionName}</p><div className="button-row compact"><button className="ghost-button" disabled={loading || saving || hasUnsavedChanges} onClick={() => void unbindCurrentScope()} type="button">解除绑定并恢复继承</button></div></div> : null}
        <div className="reminder-list">{taxPolicy?.versions.map((version) => <div className="maintenance-note-card" key={version.id}><div className="section-header compact-section-header"><div><strong>{version.versionName}</strong><p>创建时间：{version.createdAt}</p><p>最近启用：{version.activatedAt ?? "未启用"}</p></div><span className={version.isActive ? "tag" : "tag tag-neutral"}>{version.isActive ? "当前生效" : "历史版本"}</span></div><div className="button-row compact"><button className="ghost-button" disabled={loading || saving || version.isActive || hasUnsavedChanges} onClick={() => void activateTaxPolicyVersion(version.id)}>激活此版本</button><button className="ghost-button" disabled={loading || saving || hasUnsavedChanges || !currentUnitId || !currentTaxYear || taxPolicy?.currentScopeBinding?.versionId === version.id} onClick={() => void bindTaxPolicyVersionToCurrentScope(version.id)}>绑定到当前单位 / 年份</button><button className="ghost-button" disabled={loading || saving || previewLoading || !currentUnitId || !currentTaxYear} onClick={() => void previewTaxPolicyVersionImpact(version.id)} type="button">查看影响</button></div></div>)}</div>
      </article>

      <article className="glass-card page-section placeholder-card">
        <div className="section-header"><div><h2>版本影响预览</h2><p>基于当前单位 / 年份对比目标税率版本的影响。</p></div><span className="tag">{previewLoading ? "预览中" : impactPreview ? "已加载" : "未选择版本"}</span></div>
        {impactPreview ? <>
          <div className="summary-grid results-summary-grid"><div className="summary-card"><span>当前版本</span><strong>{impactPreview.currentVersionName}</strong></div><div className="summary-card"><span>目标版本</span><strong>{impactPreview.targetVersionName}</strong></div><div className="summary-card"><span>结果记录数</span><strong>{impactPreview.affectedResultCount}</strong></div><div className="summary-card"><span>重算记录数</span><strong>{impactPreview.affectedRunCount}</strong></div></div>
          {impactPreview.diffItems.length ? <table className="data-table"><thead><tr><th>差异项</th><th>当前版本</th><th>目标版本</th></tr></thead><tbody>{impactPreview.diffItems.map((item) => <tr key={item.label}><td>{item.label}</td><td>{item.baselineValue}</td><td>{item.targetValue}</td></tr>)}</tbody></table> : <div className="empty-state"><strong>目标版本与当前作用域版本没有配置差异。</strong><p>如果继续切换，只会改变绑定关系，不会改变税率内容。</p></div>}
        </> : <div className="empty-state"><strong>请选择一个税率版本查看影响。</strong><p>影响预览会基于当前单位 / 年份统计结果和重算记录范围。</p></div>}
      </article>

      <article className="glass-card page-section placeholder-card">
        <div className="section-header"><div><h2>审计日志</h2><p>记录税率保存、版本激活、作用域绑定与解绑等关键操作。</p></div></div>
        {taxPolicy?.auditLogs.length ? <table className="data-table"><thead><tr><th>时间</th><th>操作</th><th>版本</th><th>作用域</th><th>说明</th></tr></thead><tbody>{taxPolicy.auditLogs.map((log) => <tr key={log.id}><td>{new Date(log.createdAt).toLocaleString("zh-CN", { hour12: false })}</td><td>{log.actionType}</td><td>{log.versionName ?? "-"}</td><td>{log.unitId && log.taxYear ? `单位 ${log.unitId} / ${log.taxYear} 年` : "全局"}</td><td>{log.summary}</td></tr>)}</tbody></table> : <div className="empty-state"><strong>当前还没有审计日志。</strong><p>执行系统维护操作后会自动追加记录。</p></div>}
        <div className="button-row"><button className="ghost-button" disabled={loading || saving} onClick={() => void loadTaxPolicy()}>刷新配置</button><button className="ghost-button" disabled={loading || saving} onClick={() => taxPolicy && setDraftSettings(cloneTaxPolicySettings(taxPolicy.currentSettings))}>恢复税率</button><button className="ghost-button" disabled={loading || saving} onClick={() => setDraftSettings(cloneTaxPolicySettings(taxPolicy?.defaultSettings ?? buildDefaultTaxPolicySettings()))}>恢复默认税率</button><button className="primary-button" disabled={loading || saving || !draftSettings || validationIssues.length > 0} onClick={() => void saveTaxPolicy()}>保存税率与当前政策</button></div>
      </article>
    </section>
  );
};
