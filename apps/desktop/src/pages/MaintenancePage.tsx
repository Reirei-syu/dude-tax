import {
  buildDefaultTaxPolicySettings,
  type BonusTaxBracket,
  type ComprehensiveTaxBracket,
  type TaxPolicyResponse,
  type TaxPolicySettings,
} from "../../../../packages/core/src/index";
import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../api/client";
import { useAppContext } from "../context/AppContextProvider";

const maintenanceScopeItems = [
  "当前版本支持编辑并保存全局税标，保存后会自动使年度结果与重算记录失效。",
  "保存后的税标会同步作用于首页展示、系统维护页面和后续年度计算逻辑。",
  "当前仍不包含税标版本管理、富文本说明维护和变更审计。",
];

const maintenanceRoadmapItems = [
  "说明维护：全局提示说明与口径备注。",
  "税标版本管理：支持保留和切换历史版本。",
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
  const [taxPolicy, setTaxPolicy] = useState<TaxPolicyResponse | null>(null);
  const [draftSettings, setDraftSettings] = useState<TaxPolicySettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadTaxPolicy = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const nextTaxPolicy = await apiClient.getTaxPolicy();
      setTaxPolicy(nextTaxPolicy);
      setDraftSettings(cloneTaxPolicySettings(nextTaxPolicy.currentSettings));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载税标失败");
      setTaxPolicy(null);
      setDraftSettings(cloneTaxPolicySettings(buildDefaultTaxPolicySettings()));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTaxPolicy();
  }, []);

  const hasUnsavedChanges = useMemo(() => {
    if (!taxPolicy || !draftSettings) {
      return false;
    }

    return JSON.stringify(taxPolicy.currentSettings) !== JSON.stringify(draftSettings);
  }, [draftSettings, taxPolicy]);

  const currentSettings =
    draftSettings ?? taxPolicy?.currentSettings ?? buildDefaultTaxPolicySettings();

  const resetToSavedSettings = () => {
    if (!taxPolicy) {
      return;
    }

    setDraftSettings(cloneTaxPolicySettings(taxPolicy.currentSettings));
    setSuccessMessage(null);
  };

  const resetToDefaultSettings = () => {
    const defaultSettings = taxPolicy?.defaultSettings ?? buildDefaultTaxPolicySettings();
    setDraftSettings(cloneTaxPolicySettings(defaultSettings));
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
      const nextTaxPolicy = await apiClient.updateTaxPolicy(draftSettings);
      setTaxPolicy(nextTaxPolicy);
      setDraftSettings(cloneTaxPolicySettings(nextTaxPolicy.currentSettings));
      setSuccessMessage(
        nextTaxPolicy.invalidatedResults
          ? "税标已保存，年度结果与重算记录已失效，请前往计算中心重新计算。"
          : "税标未发生变化，当前配置已保持最新。",
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "保存税标失败");
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
            <p>当前可编辑并保存全局税标；保存后将清空年度结果与重算记录，保证后续计算口径一致。</p>
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
            <strong>{context?.currentTaxYear ?? "-"}</strong>
          </div>
          <div className="summary-card">
            <span>当前税标版本</span>
            <strong>{taxPolicy?.isCustomized ? "已自定义" : "默认版本"}</strong>
          </div>
          <div className="summary-card">
            <span>编辑状态</span>
            <strong>{hasUnsavedChanges ? "有未保存修改" : "已同步"}</strong>
          </div>
        </div>

        <div className="maintenance-warning-card">
          <strong>保存影响</strong>
          <p>税标保存成功后，将自动清空当前所有年度结果和重算记录，请在保存后重新执行年度重算。</p>
        </div>

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
                <tr key={bracket.level}>
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
                <tr key={bracket.level}>
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
      </article>

      <article className="glass-card page-section placeholder-card">
        <div className="section-header">
          <div>
            <h2>维护范围</h2>
            <p>当前已开放税标编辑；说明维护、版本管理和更细粒度失效策略仍在后续计划中。</p>
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
            刷新税标
          </button>
          <button className="ghost-button" disabled={loading || saving} onClick={resetToSavedSettings}>
            恢复已保存
          </button>
          <button className="ghost-button" disabled={loading || saving} onClick={resetToDefaultSettings}>
            恢复默认税标
          </button>
          <button
            className="primary-button"
            disabled={loading || saving || !draftSettings}
            onClick={() => void saveTaxPolicy()}
          >
            保存税标
          </button>
        </div>
      </article>
    </section>
  );
};
