import {
  buildDefaultTaxPolicySettings,
  type BonusTaxBracket,
  type ComprehensiveTaxBracket,
  type CreateUnitBackupResponse,
  type TaxPolicyAuditAction,
  type TaxPolicyItem,
  type TaxPolicyResponse,
  type TaxPolicySettings,
  type TaxPolicyVersionImpactPreview,
  type UnitBackupDraftResponse,
} from "@dude-tax/core";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { apiClient } from "../api/client";
import { WorkspaceCanvas, WorkspaceItem, WorkspaceLayoutRoot } from "../components/WorkspaceLayout";
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

const clonePolicyItems = (items: TaxPolicyItem[]): TaxPolicyItem[] =>
  JSON.parse(JSON.stringify(items)) as TaxPolicyItem[];

const normalizePolicyItems = (items: TaxPolicyItem[]) =>
  items.map((item, index) => ({
    ...item,
    sortOrder: index,
  }));

const createEmptyPolicyItem = (index: number): TaxPolicyItem => ({
  id: `draft-policy-item-${Date.now()}-${index + 1}`,
  title: "",
  body: "",
  illustrationDataUrl: "",
  sortOrder: index,
});

const taxPolicyAuditActionLabelMap: Record<TaxPolicyAuditAction, string> = {
  save_settings: "保存税率",
  update_notes: "更新政策说明",
  activate_version: "激活版本",
  bind_scope: "绑定作用域",
  unbind_scope: "解除作用域绑定",
  rename_version: "重命名版本",
};

type MaintenanceSectionKey =
  | "taxMaintenance"
  | "policyItems"
  | "basic"
  | "comprehensive"
  | "bonus"
  | "versions"
  | "impact"
  | "backup"
  | "audit";

const defaultCollapsedSections: Record<MaintenanceSectionKey, boolean> = {
  taxMaintenance: true,
  policyItems: true,
  basic: true,
  comprehensive: true,
  bonus: true,
  versions: true,
  impact: true,
  backup: true,
  audit: true,
};

const formatLocalDateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "未启用";

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

const joinWindowsLikePath = (directoryPath: string, fileName: string) =>
  `${directoryPath.replace(/[\\/]+$/, "")}\\${fileName}`;

export const MaintenancePage = () => {
  const { context } = useAppContext();
  const currentUnit = context?.units.find((unit) => unit.id === context.currentUnitId) ?? null;
  const currentUnitId = context?.currentUnitId ?? null;
  const currentTaxYear = context?.currentTaxYear ?? null;
  const itemTextareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const [taxPolicy, setTaxPolicy] = useState<TaxPolicyResponse | null>(null);
  const [draftSettings, setDraftSettings] = useState<TaxPolicySettings | null>(null);
  const [policyItems, setPolicyItems] = useState<TaxPolicyItem[]>([]);
  const [impactPreview, setImpactPreview] = useState<TaxPolicyVersionImpactPreview | null>(null);
  const [backupDraft, setBackupDraft] = useState<UnitBackupDraftResponse | null>(null);
  const [backupExecutionResult, setBackupExecutionResult] =
    useState<CreateUnitBackupResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupSaving, setBackupSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [backupErrorMessage, setBackupErrorMessage] = useState<string | null>(null);
  const [selectedBackupPath, setSelectedBackupPath] = useState<string | null>(null);
  const [customVersionName, setCustomVersionName] = useState("");
  const [collapsedSections, setCollapsedSections] = useState(defaultCollapsedSections);
  const [collapsedPolicyItems, setCollapsedPolicyItems] = useState<Record<string, boolean>>({});
  const [savingPolicyItemId, setSavingPolicyItemId] = useState<string | null>(null);
  const [policyItemFeedback, setPolicyItemFeedback] = useState<{
    itemId: string;
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [editingVersionId, setEditingVersionId] = useState<number | null>(null);
  const [editingVersionName, setEditingVersionName] = useState("");

  const applyTaxPolicyState = (nextTaxPolicy: TaxPolicyResponse) => {
    setTaxPolicy(nextTaxPolicy);
    setDraftSettings(cloneTaxPolicySettings(nextTaxPolicy.currentSettings));
    setPolicyItems(clonePolicyItems(nextTaxPolicy.policyItems));
    setImpactPreview(null);
    setCustomVersionName("");
    setCollapsedPolicyItems({});
    setEditingVersionId(null);
    setEditingVersionName("");
  };

  const loadTaxPolicy = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const nextTaxPolicy = await apiClient.getTaxPolicy(
        currentUnitId ?? undefined,
        currentTaxYear ?? undefined,
      );
      applyTaxPolicyState(nextTaxPolicy);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载系统维护配置失败");
      setTaxPolicy(null);
      setDraftSettings(cloneTaxPolicySettings(buildDefaultTaxPolicySettings()));
      setPolicyItems([]);
      setCustomVersionName("");
      setCollapsedPolicyItems({});
      setEditingVersionId(null);
      setEditingVersionName("");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTaxPolicy();
  }, [currentTaxYear, currentUnitId]);

  const loadBackupDraft = async (options?: { resetResult?: boolean }) => {
    if (!currentUnitId) {
      setBackupDraft(null);
      setBackupExecutionResult(null);
      setBackupErrorMessage(null);
      setSelectedBackupPath(null);
      return;
    }

    try {
      setBackupLoading(true);
      setBackupErrorMessage(null);
      if (options?.resetResult ?? true) {
        setBackupExecutionResult(null);
      }
      setSelectedBackupPath(null);
      const nextDraft = await apiClient.getUnitBackupDraft(currentUnitId);
      setBackupDraft(nextDraft);
    } catch (error) {
      setBackupDraft(null);
      setBackupErrorMessage(error instanceof Error ? error.message : "加载单位备份信息失败");
    } finally {
      setBackupLoading(false);
    }
  };

  useEffect(() => {
    void loadBackupDraft();
  }, [currentUnitId]);

  const currentSettings =
    draftSettings ?? taxPolicy?.currentSettings ?? buildDefaultTaxPolicySettings();
  const policyItemPreviewBlocks = useMemo(
    () =>
      Object.fromEntries(policyItems.map((item) => [item.id, parseMaintenanceRichText(item.body)])),
    [policyItems],
  );
  const validationIssues = useMemo(
    () => validateTaxPolicyDraft(currentSettings, policyItems),
    [currentSettings, policyItems],
  );
  const basicIssue = validationIssues.find((issue) => issue.section === "basic") ?? null;

  const hasUnsavedChanges = useMemo(() => {
    if (!taxPolicy || !draftSettings) {
      return false;
    }

    return (
      JSON.stringify(taxPolicy.currentSettings) !== JSON.stringify(draftSettings) ||
      JSON.stringify(taxPolicy.policyItems) !== JSON.stringify(policyItems)
    );
  }, [draftSettings, policyItems, taxPolicy]);

  const updatePolicyItem = (itemId: string, patch: Partial<TaxPolicyItem>) => {
    setPolicyItemFeedback((currentFeedback) =>
      currentFeedback?.itemId === itemId ? null : currentFeedback,
    );
    setPolicyItems((currentItems) =>
      normalizePolicyItems(
        currentItems.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
      ),
    );
  };

  const applyItemBodyEdit = (
    itemId: string,
    transform: (
      text: string,
      selectionStart: number,
      selectionEnd: number,
    ) => {
      nextText: string;
      nextSelectionStart: number;
      nextSelectionEnd: number;
    },
  ) => {
    const textarea = itemTextareaRefs.current[itemId];
    const currentItem = policyItems.find((item) => item.id === itemId);
    if (!textarea || !currentItem) {
      return;
    }

    const selectionStart = textarea.selectionStart ?? currentItem.body.length;
    const selectionEnd = textarea.selectionEnd ?? currentItem.body.length;
    const result = transform(currentItem.body, selectionStart, selectionEnd);
    updatePolicyItem(itemId, { body: result.nextText });

    requestAnimationFrame(() => {
      const nextTextarea = itemTextareaRefs.current[itemId];
      if (!nextTextarea) {
        return;
      }
      nextTextarea.focus();
      nextTextarea.setSelectionRange(result.nextSelectionStart, result.nextSelectionEnd);
    });
  };

  const addPolicyItem = () => {
    setPolicyItemFeedback(null);
    setPolicyItems((currentItems) => [...currentItems, createEmptyPolicyItem(currentItems.length)]);
  };

  const togglePolicyItem = (itemId: string) => {
    setCollapsedPolicyItems((currentItems) => ({
      ...currentItems,
      [itemId]: !currentItems[itemId],
    }));
  };

  const removePolicyItem = (itemId: string) => {
    const targetItem = policyItems.find((item) => item.id === itemId);
    if (!targetItem) {
      return;
    }

    const confirmed = window.confirm(
      `确认删除“${targetItem.title || "未命名说明"}”吗？删除后需重新保存才会生效。`,
    );
    if (!confirmed) {
      return;
    }

    delete itemTextareaRefs.current[itemId];
    setPolicyItemFeedback((currentFeedback) =>
      currentFeedback?.itemId === itemId ? null : currentFeedback,
    );
    setCollapsedPolicyItems((currentItems) => {
      const nextItems = { ...currentItems };
      delete nextItems[itemId];
      return nextItems;
    });
    setPolicyItems((currentItems) =>
      normalizePolicyItems(currentItems.filter((item) => item.id !== itemId)),
    );
  };

  const startRenameVersion = (versionId: number, versionName: string) => {
    setEditingVersionId(versionId);
    setEditingVersionName(versionName);
  };

  const cancelRenameVersion = () => {
    setEditingVersionId(null);
    setEditingVersionName("");
  };

  const toggleSection = (sectionKey: MaintenanceSectionKey) => {
    setCollapsedSections((currentSections) => ({
      ...currentSections,
      [sectionKey]: !currentSections[sectionKey],
    }));
  };

  const saveTaxPolicy = async () => {
    if (!draftSettings) return;
    try {
      setSaving(true);
      setPolicyItemFeedback(null);
      setErrorMessage(null);
      const nextTaxPolicy = await apiClient.updateTaxPolicy({
        ...draftSettings,
        unitId: currentUnitId ?? undefined,
        taxYear: currentTaxYear ?? undefined,
        policyItems,
        versionName: customVersionName.trim() || undefined,
      });
      setTaxPolicy(nextTaxPolicy);
      setDraftSettings(cloneTaxPolicySettings(nextTaxPolicy.currentSettings));
      setPolicyItems(clonePolicyItems(nextTaxPolicy.policyItems));
      setCustomVersionName("");
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

  const savePolicyItem = async (itemId: string) => {
    const currentItem = policyItems.find((item) => item.id === itemId);
    if (!taxPolicy || !currentItem) {
      setPolicyItemFeedback({
        itemId,
        type: "error",
        message: "当前说明条目未找到，无法保存。",
      });
      return;
    }

    if (
      !currentItem.title.trim() &&
      !currentItem.body.trim() &&
      !currentItem.illustrationDataUrl.trim()
    ) {
      setPolicyItemFeedback({
        itemId,
        type: "error",
        message: "请至少填写标题、正文或插图后再保存当前说明条目。",
      });
      return;
    }

    const basePolicyItems = clonePolicyItems(taxPolicy.policyItems);
    const targetIndex = basePolicyItems.findIndex((item) => item.id === itemId);
    const nextPolicyItems =
      targetIndex >= 0
        ? normalizePolicyItems(
            basePolicyItems.map((item, index) => (index === targetIndex ? currentItem : item)),
          )
        : normalizePolicyItems([...basePolicyItems, currentItem]);

    try {
      setSaving(true);
      setSavingPolicyItemId(itemId);
      setPolicyItemFeedback(null);
      setErrorMessage(null);
      setSuccessMessage(null);
      const nextTaxPolicy = await apiClient.updateTaxPolicy({
        ...cloneTaxPolicySettings(taxPolicy.currentSettings),
        unitId: currentUnitId ?? undefined,
        taxYear: currentTaxYear ?? undefined,
        policyItems: nextPolicyItems,
      });
      const savedPolicyItem =
        nextTaxPolicy.policyItems.find((item) => item.id === itemId) ?? currentItem;

      setTaxPolicy(nextTaxPolicy);
      setPolicyItems((currentItems) =>
        normalizePolicyItems(
          currentItems.map((item) => (item.id === itemId ? savedPolicyItem : item)),
        ),
      );
      setPolicyItemFeedback({
        itemId,
        type: "success",
        message: "当前说明条目已保存。",
      });
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "保存当前说明条目失败";
      setPolicyItemFeedback({
        itemId,
        type: "error",
        message: nextMessage,
      });
    } finally {
      setSaving(false);
      setSavingPolicyItemId(null);
    }
  };

  const handleIllustrationFileSelect = async (
    itemId: string,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setErrorMessage(null);
      updatePolicyItem(itemId, { illustrationDataUrl: await readFileAsDataUrl(file) });
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
      setPolicyItems(clonePolicyItems(nextTaxPolicy.policyItems));
      setEditingVersionId(null);
      setEditingVersionName("");
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
      const nextTaxPolicy = await apiClient.bindTaxPolicyVersionToScope(
        versionId,
        currentUnitId,
        currentTaxYear,
      );
      setTaxPolicy(nextTaxPolicy);
      setDraftSettings(cloneTaxPolicySettings(nextTaxPolicy.currentSettings));
      setPolicyItems(clonePolicyItems(nextTaxPolicy.policyItems));
      setImpactPreview(null);
      setEditingVersionId(null);
      setEditingVersionName("");
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
      setImpactPreview(
        await apiClient.getTaxPolicyVersionImpactPreview(versionId, currentUnitId, currentTaxYear),
      );
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
      const nextTaxPolicy = await apiClient.unbindCurrentScopeTaxPolicy(
        currentUnitId,
        currentTaxYear,
      );
      setTaxPolicy(nextTaxPolicy);
      setDraftSettings(cloneTaxPolicySettings(nextTaxPolicy.currentSettings));
      setPolicyItems(clonePolicyItems(nextTaxPolicy.policyItems));
      setImpactPreview(null);
      setEditingVersionId(null);
      setEditingVersionName("");
      setSuccessMessage("已解除当前单位 / 年份绑定。");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "解除绑定失败");
    } finally {
      setSaving(false);
    }
  };

  const saveVersionName = async (versionId: number) => {
    try {
      setSaving(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      const nextVersionName = editingVersionName.trim();
      await apiClient.renameTaxPolicyVersion(versionId, {
        versionName: nextVersionName,
        unitId: currentUnitId ?? undefined,
        taxYear: currentTaxYear ?? undefined,
      });
      const refreshedTaxPolicy = await apiClient.getTaxPolicy(
        currentUnitId ?? undefined,
        currentTaxYear ?? undefined,
      );
      applyTaxPolicyState(refreshedTaxPolicy);
      setSuccessMessage(`税率版本“${nextVersionName}”已更新。`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "更新版本名称失败");
    } finally {
      setSaving(false);
    }
  };

  const preferredBackupTargetPath =
    selectedBackupPath ??
    (backupDraft?.lastDirectoryPath
      ? joinWindowsLikePath(backupDraft.lastDirectoryPath, backupDraft.suggestedFileName)
      : null);

  const pickBackupPath = async () => {
    if (!backupDraft) {
      setBackupErrorMessage("请先选择单位，再选择备份位置。");
      return;
    }

    if (!window.salaryTaxDesktop?.pickSavePath) {
      setBackupErrorMessage("当前环境不支持桌面备份路径选择。");
      return;
    }

    try {
      setBackupErrorMessage(null);
      const result = await window.salaryTaxDesktop.pickSavePath({
        defaultFileName: backupDraft.suggestedFileName,
        defaultDirectory: backupDraft.lastDirectoryPath ?? undefined,
        filters: [{ name: "ZIP 压缩包", extensions: ["zip"] }],
      });

      if (result.canceled || !result.filePath) {
        return;
      }

      setSelectedBackupPath(result.filePath);
      setBackupExecutionResult(null);
    } catch (error) {
      setBackupErrorMessage(error instanceof Error ? error.message : "选择备份位置失败");
    }
  };

  const startBackup = async () => {
    if (!currentUnitId) {
      setBackupErrorMessage("请先选择单位。");
      return;
    }

    if (!preferredBackupTargetPath) {
      setBackupErrorMessage("请先选择备份位置。");
      return;
    }

    try {
      setBackupSaving(true);
      setBackupErrorMessage(null);
      const result = await apiClient.createUnitBackup(currentUnitId, {
        targetPath: preferredBackupTargetPath,
      });
      setBackupExecutionResult(result);
      await loadBackupDraft({ resetResult: false });
    } catch (error) {
      setBackupExecutionResult(null);
      setBackupErrorMessage(error instanceof Error ? error.message : "生成单位备份失败");
    } finally {
      setBackupSaving(false);
    }
  };

  return (
    <WorkspaceLayoutRoot scope="page:maintenance">
      <WorkspaceCanvas>
        <WorkspaceItem
          cardId="maintenance-tax"
          defaultLayout={{ x: 0, y: 0, w: 12, h: 24 }}
          minH={18}
        >
          <article className="glass-card page-section placeholder-card">
        {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}
        {successMessage ? <div className="success-banner">{successMessage}</div> : null}
        <div className="section-header">
          <div>
            <h2>税率维护</h2>
            <p>集中维护政策说明、基本减除费用与两张税率表，默认折叠展示。</p>
          </div>
          <div className="button-row compact">
            <span className="tag">{loading ? "加载中" : saving ? "保存中" : "可编辑"}</span>
            <button
              className="ghost-button"
              type="button"
              onClick={() => toggleSection("taxMaintenance")}
            >
              {collapsedSections.taxMaintenance ? "展开" : "折叠"}
            </button>
          </div>
        </div>
        <div className="collapsible-card-body" hidden={collapsedSections.taxMaintenance}>
          <div className="maintenance-tax-config-stack">
            <article className="glass-card page-section placeholder-card">
              <div className="section-header">
                <div>
                  <h3>专项附加扣除政策维护</h3>
                  <p>支持新增并维护多条说明，政策参考模块会按顺序展示这些条目。</p>
                </div>
                <div className="button-row compact">
                  <span className="tag">{policyItems.length} 条</span>
                  <button className="ghost-button" onClick={addPolicyItem} type="button">
                    新增说明条目
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => toggleSection("policyItems")}
                  >
                    {collapsedSections.policyItems ? "展开" : "折叠"}
                  </button>
                </div>
              </div>

              <div className="collapsible-card-body" hidden={collapsedSections.policyItems}>
                <div className="policy-item-list">
                  {policyItems.length ? (
                    policyItems.map((item, index) => {
                      const previewBlocks = policyItemPreviewBlocks[item.id] ?? [];

                      return (
                        <div
                          className="maintenance-note-card policy-item-editor-card"
                          key={item.id}
                        >
                          <div className="section-header compact-section-header">
                            <div>
                              <strong>{item.title || `说明条目 ${index + 1}`}</strong>
                              <p>可维护标题、正文与插图；保存后会同步到政策参考模块。</p>
                            </div>
                            <div className="button-row compact">
                              <button
                                className="primary-button table-action-button"
                                disabled={loading || saving || savingPolicyItemId !== null}
                                onClick={() => void savePolicyItem(item.id)}
                                type="button"
                              >
                                {savingPolicyItemId === item.id ? "保存中" : "保存"}
                              </button>
                              <button
                                className="danger-button table-action-button"
                                disabled={loading || saving || savingPolicyItemId !== null}
                                onClick={() => removePolicyItem(item.id)}
                                type="button"
                              >
                                删除
                              </button>
                              <button
                                className="ghost-button table-action-button"
                                disabled={loading || saving || savingPolicyItemId !== null}
                                onClick={() => togglePolicyItem(item.id)}
                                type="button"
                              >
                                {collapsedPolicyItems[item.id] ? "展开" : "折叠"}
                              </button>
                            </div>
                          </div>
                          <span className="tag">第 {index + 1} 条</span>
                          {policyItemFeedback?.itemId === item.id ? (
                            policyItemFeedback.type === "success" ? (
                              <div className="success-banner">{policyItemFeedback.message}</div>
                            ) : (
                              <div className="error-banner">{policyItemFeedback.message}</div>
                            )
                          ) : null}

                          <div
                            className="collapsible-card-body"
                            hidden={collapsedPolicyItems[item.id] ?? false}
                          >
                            <div className="form-grid">
                              <label className="form-field">
                                <span>标题</span>
                                <input
                                  maxLength={100}
                                  placeholder="请输入说明标题"
                                  value={item.title}
                                  onChange={(event) =>
                                    updatePolicyItem(item.id, { title: event.target.value })
                                  }
                                />
                              </label>
                              <label className="form-field">
                                <span>插图文件</span>
                                <input
                                  accept="image/*"
                                  type="file"
                                  onChange={(event) =>
                                    void handleIllustrationFileSelect(item.id, event)
                                  }
                                />
                              </label>
                            </div>

                            <div className="button-row compact">
                              <button
                                className="ghost-button"
                                onClick={() =>
                                  updatePolicyItem(item.id, { illustrationDataUrl: "" })
                                }
                                type="button"
                              >
                                清空插图
                              </button>
                            </div>

                            <div className="rich-text-toolbar">
                              <button
                                className="ghost-button table-action-button"
                                onClick={() =>
                                  applyItemBodyEdit(item.id, (text, start, end) =>
                                    applyLinePrefixEdit(text, start, end, "# "),
                                  )
                                }
                                type="button"
                              >
                                一级标题
                              </button>
                              <button
                                className="ghost-button table-action-button"
                                onClick={() =>
                                  applyItemBodyEdit(item.id, (text, start, end) =>
                                    applyLinePrefixEdit(text, start, end, "## "),
                                  )
                                }
                                type="button"
                              >
                                二级标题
                              </button>
                              <button
                                className="ghost-button table-action-button"
                                onClick={() =>
                                  applyItemBodyEdit(item.id, (text, start, end) =>
                                    applyLinePrefixEdit(text, start, end, "- "),
                                  )
                                }
                                type="button"
                              >
                                列表
                              </button>
                              <button
                                className="ghost-button table-action-button"
                                onClick={() =>
                                  applyItemBodyEdit(item.id, (text, start, end) =>
                                    applyLinePrefixEdit(text, start, end, "> "),
                                  )
                                }
                                type="button"
                              >
                                引用
                              </button>
                              <button
                                className="ghost-button table-action-button"
                                onClick={() =>
                                  applyItemBodyEdit(item.id, (text, start, end) =>
                                    applyWrapEdit(text, start, end, "**", "**"),
                                  )
                                }
                                type="button"
                              >
                                加粗
                              </button>
                              <button
                                className="ghost-button table-action-button"
                                onClick={() =>
                                  applyItemBodyEdit(item.id, (text, start, end) =>
                                    applyWrapEdit(text, start, end, "`", "`"),
                                  )
                                }
                                type="button"
                              >
                                代码
                              </button>
                            </div>

                            <div className="rich-text-editor-grid">
                              <label className="form-field">
                                <span>正文</span>
                                <textarea
                                  className="maintenance-textarea"
                                  maxLength={2000}
                                  ref={(node) => {
                                    itemTextareaRefs.current[item.id] = node;
                                  }}
                                  value={item.body}
                                  onChange={(event) =>
                                    updatePolicyItem(item.id, { body: event.target.value })
                                  }
                                />
                              </label>
                              <div className="rich-text-preview-card">
                                <span className="field-label">预览</span>
                                <strong>{item.title || `未设置标题 ${index + 1}`}</strong>
                                {item.illustrationDataUrl ? (
                                  <img
                                    alt={item.title || `政策插图 ${index + 1}`}
                                    className="policy-illustration"
                                    src={item.illustrationDataUrl}
                                  />
                                ) : null}
                                {previewBlocks.length ? (
                                  <div className="rich-text-preview">
                                    {previewBlocks.map((block, blockIndex) => {
                                      if (block.type === "heading") {
                                        if (block.level === 1) {
                                          return (
                                            <h3 key={blockIndex}>
                                              {renderRichTextTokens(
                                                block.tokens,
                                                `preview-h1-${item.id}-${blockIndex}`,
                                              )}
                                            </h3>
                                          );
                                        }

                                        if (block.level === 2) {
                                          return (
                                            <h4 key={blockIndex}>
                                              {renderRichTextTokens(
                                                block.tokens,
                                                `preview-h2-${item.id}-${blockIndex}`,
                                              )}
                                            </h4>
                                          );
                                        }

                                        return (
                                          <h5 key={blockIndex}>
                                            {renderRichTextTokens(
                                              block.tokens,
                                              `preview-h3-${item.id}-${blockIndex}`,
                                            )}
                                          </h5>
                                        );
                                      }

                                      if (block.type === "quote") {
                                        return (
                                          <blockquote key={blockIndex}>
                                            {renderRichTextTokens(
                                              block.tokens,
                                              `preview-q-${item.id}-${blockIndex}`,
                                            )}
                                          </blockquote>
                                        );
                                      }

                                      if (block.type === "list") {
                                        return (
                                          <ul key={blockIndex}>
                                            {block.items.map((itemTokens, itemIndex) => (
                                              <li key={`${blockIndex}-${itemIndex}`}>
                                                {renderRichTextTokens(
                                                  itemTokens,
                                                  `preview-l-${item.id}-${blockIndex}-${itemIndex}`,
                                                )}
                                              </li>
                                            ))}
                                          </ul>
                                        );
                                      }

                                      return (
                                        <p key={blockIndex}>
                                          {renderRichTextTokens(
                                            block.tokens,
                                            `preview-p-${item.id}-${blockIndex}`,
                                          )}
                                        </p>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="empty-state">
                                    <strong>当前正文为空。</strong>
                                    <p>保存后会同步显示到政策参考模块。</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="empty-state">
                      <strong>当前还没有说明条目。</strong>
                      <p>点击“新增说明条目”后即可开始维护多条政策说明。</p>
                    </div>
                  )}
                </div>
                <div className="button-row">
                  <button className="ghost-button" onClick={addPolicyItem} type="button">
                    新增说明条目
                  </button>
                  <button
                    className="primary-button"
                    disabled={loading || saving || !draftSettings || validationIssues.length > 0}
                    onClick={() => void saveTaxPolicy()}
                    type="button"
                  >
                    保存专项附加扣除政策维护
                  </button>
                </div>
              </div>
            </article>

            <article className="glass-card page-section placeholder-card">
              <div className="section-header">
                <div>
                  <h3>基本减除费用</h3>
                  <p>后续年度计算会直接使用这里的值。</p>
                </div>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => toggleSection("basic")}
                >
                  {collapsedSections.basic ? "展开" : "折叠"}
                </button>
              </div>
              <div className="collapsible-card-body" hidden={collapsedSections.basic}>
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
              </div>
            </article>

            <div className="maintenance-tax-rate-grid">
              <article className="glass-card page-section">
                <div className="section-header">
                  <div>
                    <h3>综合所得税率表</h3>
                    <p>可编辑税率与速算扣除数。</p>
                  </div>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => toggleSection("comprehensive")}
                  >
                    {collapsedSections.comprehensive ? "展开" : "折叠"}
                  </button>
                </div>
                <div className="collapsible-card-body" hidden={collapsedSections.comprehensive}>
                  <div className="maintenance-table-wrapper">
                    <table className="data-table maintenance-tax-table">
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
                          const isLast =
                            index === currentSettings.comprehensiveTaxBrackets.length - 1;
                          return (
                            <tr
                              className={
                                validationIssues.some(
                                  (issue) =>
                                    issue.section === "comprehensive" && issue.rowIndex === index,
                                )
                                  ? "table-row-invalid"
                                  : undefined
                              }
                              key={bracket.level}
                            >
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
                                          ? updateComprehensiveBracketValue(
                                              previousSettings,
                                              index,
                                              {
                                                maxAnnualIncome: Number(event.target.value || 0),
                                              },
                                            )
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
                  </div>
                </div>
              </article>

              <article className="glass-card page-section">
                <div className="section-header">
                  <div>
                    <h3>年终奖单独计税税率表</h3>
                    <p>可编辑税率与速算扣除数。</p>
                  </div>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => toggleSection("bonus")}
                  >
                    {collapsedSections.bonus ? "展开" : "折叠"}
                  </button>
                </div>
                <div className="collapsible-card-body" hidden={collapsedSections.bonus}>
                  <div className="maintenance-table-wrapper">
                    <table className="data-table maintenance-tax-table">
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
                            <tr
                              className={
                                validationIssues.some(
                                  (issue) => issue.section === "bonus" && issue.rowIndex === index,
                                )
                                  ? "table-row-invalid"
                                  : undefined
                              }
                              key={bracket.level}
                            >
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
                                              maxAverageMonthlyIncome: Number(
                                                event.target.value || 0,
                                              ),
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
                  </div>
                </div>
              </article>
            </div>
          </div>
        </div>
          </article>
        </WorkspaceItem>

        <WorkspaceItem
          cardId="maintenance-versions"
          defaultLayout={{ x: 0, y: 24, w: 12, h: 18 }}
          minH={14}
        >
          <article className="glass-card page-section placeholder-card">
        <div className="section-header">
          <div>
            <h2>税率版本列表</h2>
            <p>支持激活历史版本、绑定当前作用域和查看影响。</p>
          </div>
          <button className="ghost-button" type="button" onClick={() => toggleSection("versions")}>
            {collapsedSections.versions ? "展开" : "折叠"}
          </button>
        </div>
        <div className="collapsible-card-body" hidden={collapsedSections.versions}>
          <label className="form-field">
            <span>新版本名称（选填）</span>
            <input
              maxLength={100}
              placeholder="保存税率配置时可使用自定义版本名称"
              value={customVersionName}
              onChange={(event) => setCustomVersionName(event.target.value)}
            />
          </label>
          <p className="field-hint">
            仅在税率配置发生变化并创建新版本时生效；若为空，则继续自动生成版本名称。
          </p>
          {taxPolicy?.currentScopeBinding && !taxPolicy.currentScopeBinding.isInherited ? (
            <div className="maintenance-warning-card">
              <strong>当前作用域已绑定专属版本</strong>
              <p>{taxPolicy.currentScopeBinding.versionName}</p>
              <div className="button-row compact">
                <button
                  className="ghost-button"
                  disabled={loading || saving || hasUnsavedChanges}
                  onClick={() => void unbindCurrentScope()}
                  type="button"
                >
                  解除绑定并恢复继承
                </button>
              </div>
            </div>
          ) : null}
          <div className="reminder-list">
            {taxPolicy?.versions.map((version) => (
              <div className="maintenance-note-card" key={version.id}>
                <div className="section-header compact-section-header">
                  <div>
                    {editingVersionId === version.id ? (
                      <label className="form-field maintenance-version-name-field">
                        <span>版本名称</span>
                        <input
                          maxLength={100}
                          value={editingVersionName}
                          onChange={(event) => setEditingVersionName(event.target.value)}
                        />
                      </label>
                    ) : (
                      <strong>{version.versionName}</strong>
                    )}
                    <p>创建时间：{formatLocalDateTime(version.createdAt)}</p>
                    <p>最近启用：{formatLocalDateTime(version.activatedAt)}</p>
                  </div>
                  <span className={version.isActive ? "tag" : "tag tag-neutral"}>
                    {version.isActive ? "当前生效" : "历史版本"}
                  </span>
                </div>
                <div className="button-row compact">
                  {editingVersionId === version.id ? (
                    <>
                      <button
                        className="primary-button"
                        disabled={loading || saving || !editingVersionName.trim()}
                        onClick={() => void saveVersionName(version.id)}
                      >
                        保存名称
                      </button>
                      <button
                        className="ghost-button"
                        disabled={loading || saving}
                        onClick={cancelRenameVersion}
                        type="button"
                      >
                        取消
                      </button>
                    </>
                  ) : (
                    <button
                      className="ghost-button"
                      disabled={loading || saving}
                      onClick={() => startRenameVersion(version.id, version.versionName)}
                      type="button"
                    >
                      编辑名称
                    </button>
                  )}
                  <button
                    className="ghost-button"
                    disabled={
                      loading ||
                      saving ||
                      version.isActive ||
                      hasUnsavedChanges ||
                      editingVersionId !== null
                    }
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
                      editingVersionId !== null ||
                      !currentUnitId ||
                      !currentTaxYear ||
                      taxPolicy?.currentScopeBinding?.versionId === version.id
                    }
                    onClick={() => void bindTaxPolicyVersionToCurrentScope(version.id)}
                  >
                    绑定到当前单位 / 年份
                  </button>
                  <button
                    className="ghost-button"
                    disabled={
                      loading ||
                      saving ||
                      previewLoading ||
                      editingVersionId !== null ||
                      !currentUnitId ||
                      !currentTaxYear
                    }
                    onClick={() => void previewTaxPolicyVersionImpact(version.id)}
                    type="button"
                  >
                    查看影响
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
          </article>
        </WorkspaceItem>

        <WorkspaceItem
          cardId="maintenance-impact"
          defaultLayout={{ x: 0, y: 42, w: 12, h: 16 }}
          minH={12}
        >
          <article className="glass-card page-section placeholder-card">
        <div className="section-header">
          <div>
            <h2>版本影响预览</h2>
            <p>基于当前单位 / 年份对比目标税率版本的影响。</p>
          </div>
          <div className="button-row compact">
            <span className="tag">
              {previewLoading ? "预览中" : impactPreview ? "已加载" : "未选择版本"}
            </span>
            <button className="ghost-button" type="button" onClick={() => toggleSection("impact")}>
              {collapsedSections.impact ? "展开" : "折叠"}
            </button>
          </div>
        </div>
        <div className="collapsible-card-body" hidden={collapsedSections.impact}>
          {impactPreview ? (
            <>
              <div className="summary-grid results-summary-grid">
                <div className="summary-card">
                  <span>当前版本</span>
                  <strong>{impactPreview.currentVersionName}</strong>
                </div>
                <div className="summary-card">
                  <span>目标版本</span>
                  <strong>{impactPreview.targetVersionName}</strong>
                </div>
                <div className="summary-card">
                  <span>结果记录数</span>
                  <strong>{impactPreview.affectedResultCount}</strong>
                </div>
                <div className="summary-card">
                  <span>重算记录数</span>
                  <strong>{impactPreview.affectedRunCount}</strong>
                </div>
              </div>
              {impactPreview.diffItems.length ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>差异项</th>
                      <th>当前版本</th>
                      <th>目标版本</th>
                    </tr>
                  </thead>
                  <tbody>
                    {impactPreview.diffItems.map((item) => (
                      <tr key={item.label}>
                        <td>{item.label}</td>
                        <td>{item.baselineValue}</td>
                        <td>{item.targetValue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="empty-state">
                  <strong>目标版本与当前作用域版本没有配置差异。</strong>
                  <p>如果继续切换，只会改变绑定关系，不会改变税率内容。</p>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">
              <strong>请选择一个税率版本查看影响。</strong>
              <p>影响预览会基于当前单位 / 年份统计结果和重算记录范围。</p>
            </div>
          )}
        </div>
          </article>
        </WorkspaceItem>

        <WorkspaceItem
          cardId="maintenance-backup"
          defaultLayout={{ x: 0, y: 58, w: 12, h: 16 }}
          minH={12}
        >
          <article className="glass-card page-section placeholder-card">
        <div className="section-header">
          <div>
            <h2>单位备份</h2>
            <p>按当前单位导出全部年份业务数据，生成单个 ZIP 备份包。</p>
          </div>
          <div className="button-row compact">
            <span className="tag">
              {backupSaving ? "备份中" : backupLoading ? "加载中" : "待执行"}
            </span>
            <button className="ghost-button" type="button" onClick={() => toggleSection("backup")}>
              {collapsedSections.backup ? "展开" : "折叠"}
            </button>
          </div>
        </div>
        <div className="collapsible-card-body" hidden={collapsedSections.backup}>
          {!currentUnit ? (
            <div className="empty-state">
              <strong>请先选择单位。</strong>
              <p>单位备份以当前单位为范围，不支持整库导出。</p>
            </div>
          ) : (
            <>
              <div className="summary-grid results-summary-grid">
                <div className="summary-card">
                  <span>当前单位</span>
                  <strong>{currentUnit.unitName}</strong>
                </div>
                <div className="summary-card">
                  <span>纳入备份年份</span>
                  <strong>
                    {backupDraft?.includedTaxYears.length
                      ? `${backupDraft.includedTaxYears.join("、")} 年`
                      : "加载中"}
                  </strong>
                </div>
                <div className="summary-card">
                  <span>最近备份目录</span>
                  <strong>{backupDraft?.lastDirectoryPath ?? "未记录"}</strong>
                </div>
                <div className="summary-card">
                  <span>建议文件名</span>
                  <strong>{backupDraft?.suggestedFileName ?? "加载中"}</strong>
                </div>
              </div>
              <div className="reminder-list">
                <div className="maintenance-note-card">
                  <strong>当前备份路径</strong>
                  <p>{preferredBackupTargetPath ?? "尚未选择，将在首次备份时要求选择位置"}</p>
                </div>
                {backupExecutionResult ? (
                  <div className="maintenance-note-card">
                    <strong>上次成功备份结果</strong>
                    <p>导出时间：{formatLocalDateTime(backupExecutionResult.exportedAt)}</p>
                    <p>文件路径：{backupExecutionResult.filePath}</p>
                    <p>
                      数据摘要：员工 {backupExecutionResult.summaryCounts.employees} 条，月度记录{" "}
                      {backupExecutionResult.summaryCounts.employeeMonthRecords} 条，税率版本{" "}
                      {backupExecutionResult.summaryCounts.taxPolicyVersions} 条
                    </p>
                  </div>
                ) : null}
                {backupErrorMessage ? (
                  <div className="maintenance-note-card">
                    <strong>备份失败</strong>
                    <p>{backupErrorMessage}</p>
                  </div>
                ) : null}
              </div>
              <div className="button-row">
                <button
                  className="ghost-button"
                  disabled={!backupDraft || backupLoading || backupSaving}
                  onClick={() => void pickBackupPath()}
                  type="button"
                >
                  选择备份位置
                </button>
                <button
                  className="primary-button"
                  disabled={!backupDraft || backupLoading || backupSaving}
                  onClick={() => void startBackup()}
                  type="button"
                >
                  开始备份
                </button>
              </div>
            </>
          )}
        </div>
          </article>
        </WorkspaceItem>

        <WorkspaceItem
          cardId="maintenance-audit"
          defaultLayout={{ x: 0, y: 74, w: 12, h: 16 }}
          minH={12}
        >
          <article className="glass-card page-section placeholder-card">
        <div className="section-header">
          <div>
            <h2>审计日志</h2>
            <p>记录税率保存、版本激活、作用域绑定与解绑等关键操作。</p>
          </div>
          <button className="ghost-button" type="button" onClick={() => toggleSection("audit")}>
            {collapsedSections.audit ? "展开" : "折叠"}
          </button>
        </div>
        <div className="collapsible-card-body" hidden={collapsedSections.audit}>
          {taxPolicy?.auditLogs.length ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>操作</th>
                  <th>版本</th>
                  <th>作用域</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                {taxPolicy.auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{new Date(log.createdAt).toLocaleString("zh-CN", { hour12: false })}</td>
                    <td>{taxPolicyAuditActionLabelMap[log.actionType] ?? log.actionType}</td>
                    <td>{log.versionName ?? "-"}</td>
                    <td>
                      {log.unitId && log.taxYear
                        ? `单位 ${log.unitId} / ${log.taxYear} 年`
                        : "全局"}
                    </td>
                    <td>{log.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <strong>当前还没有审计日志。</strong>
              <p>执行系统维护操作后会自动追加记录。</p>
            </div>
          )}
          <div className="button-row">
            <button
              className="ghost-button"
              disabled={loading || saving}
              onClick={() => void loadTaxPolicy()}
            >
              刷新配置
            </button>
            <button
              className="ghost-button"
              disabled={loading || saving}
              onClick={() =>
                taxPolicy && setDraftSettings(cloneTaxPolicySettings(taxPolicy.currentSettings))
              }
            >
              恢复税率
            </button>
            <button
              className="ghost-button"
              disabled={loading || saving}
              onClick={() =>
                setDraftSettings(
                  cloneTaxPolicySettings(
                    taxPolicy?.defaultSettings ?? buildDefaultTaxPolicySettings(),
                  ),
                )
              }
            >
              恢复默认税率
            </button>
            <button
              className="primary-button"
              disabled={loading || saving || !draftSettings || validationIssues.length > 0}
              onClick={() => void saveTaxPolicy()}
            >
              保存税率与当前政策
            </button>
          </div>
        </div>
          </article>
        </WorkspaceItem>
      </WorkspaceCanvas>
    </WorkspaceLayoutRoot>
  );
};
