import { buildDefaultTaxPolicySettings, type TaxPolicyResponse } from "@dude-tax/core";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { apiClient } from "../api/client";
import { CollapsibleSectionCard } from "../components/CollapsibleSectionCard";
import { WorkspaceCanvas, WorkspaceItem, WorkspaceLayoutRoot } from "../components/WorkspaceLayout";
import { useAppContext } from "../context/AppContextProvider";

export const HomePage = () => {
  const { context, errorMessage, loading } = useAppContext();
  const currentUnit = context?.units.find((item) => item.id === context.currentUnitId) ?? null;
  const currentUnitId = context?.currentUnitId ?? null;
  const currentTaxYear = context?.currentTaxYear ?? null;
  const [taxPolicy, setTaxPolicy] = useState<TaxPolicyResponse | null>(null);
  const [taxPolicyLoading, setTaxPolicyLoading] = useState(false);
  const [taxPolicyErrorMessage, setTaxPolicyErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadTaxPolicy = async () => {
      try {
        setTaxPolicyLoading(true);
        setTaxPolicyErrorMessage(null);
        const nextTaxPolicy = await apiClient.getTaxPolicy(
          currentUnitId ?? undefined,
          currentTaxYear ?? undefined,
        );
        setTaxPolicy(nextTaxPolicy);
      } catch (error) {
        setTaxPolicyErrorMessage(error instanceof Error ? error.message : "加载税率失败");
      } finally {
        setTaxPolicyLoading(false);
      }
    };

    void loadTaxPolicy();
  }, [currentTaxYear, currentUnitId]);

  const currentTaxPolicy = taxPolicy?.currentSettings ?? buildDefaultTaxPolicySettings();

  return (
    <WorkspaceLayoutRoot scope="page:home">
      <WorkspaceCanvas>
        <WorkspaceItem
          cardId="home-overview"
          defaultLayout={{ x: 0, y: 0, w: 6, h: 12 }}
          minH={10}
        >
          <CollapsibleSectionCard
            cardId="home-overview"
            className="placeholder-card"
            description="这里是当前单位和年份的工作总控台。"
            headingTag="h1"
            headerExtras={
              <span className="tag">{loading || taxPolicyLoading ? "加载中" : "首页概览"}</span>
            }
            title="首页"
          >
            <div className="summary-grid">
              <div className="summary-card">
                <span>当前单位</span>
                <strong>{currentUnit?.unitName ?? "未选择单位"}</strong>
              </div>
              <div className="summary-card">
                <span>当前年份</span>
                <strong>{context?.currentTaxYear ?? "-"}</strong>
              </div>
              <div className="summary-card">
                <span>全局税率</span>
                <strong>{taxPolicy?.isCustomized ? "已自定义" : "默认版本"}</strong>
              </div>
            </div>

            {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}
            {taxPolicyErrorMessage ? <div className="error-banner">{taxPolicyErrorMessage}</div> : null}
          </CollapsibleSectionCard>
        </WorkspaceItem>

        <WorkspaceItem
          cardId="home-policy"
          defaultLayout={{ x: 6, y: 0, w: 6, h: 12 }}
          minH={10}
        >
          <CollapsibleSectionCard
            cardId="home-policy"
            description="用于查看当前房间生效的政策口径、税率表和扣除项说明。"
            title="政策口径"
          >
            <div className="summary-grid">
              <div className="summary-card">
                <span>当前版本</span>
                <strong>{taxPolicy?.currentVersionName ?? "默认税率版本"}</strong>
              </div>
              <div className="summary-card">
                <span>政策说明条数</span>
                <strong>{taxPolicy?.policyItems.length ?? 0}</strong>
              </div>
              <div className="summary-card">
                <span>当前口径</span>
                <strong>{taxPolicy?.policyCustomized ? "已维护说明" : "默认说明"}</strong>
              </div>
            </div>

            <div className="button-row">
              <Link className="primary-button link-button" to="/policy">
                前往政策参考
              </Link>
            </div>
          </CollapsibleSectionCard>
        </WorkspaceItem>

        <WorkspaceItem
          cardId="home-tax-table"
          defaultLayout={{ x: 0, y: 12, w: 12, h: 18 }}
          minH={14}
        >
          <CollapsibleSectionCard
            cardId="home-tax-table"
            defaultCollapsed
            description="首页税率表读取当前生效税率，和后续计算保持同源。"
            title="当前税率表"
          >
            <div className="tax-rule-block">
              <div className="tax-rule-title">减除费用</div>
              <div className="tax-rule-value">
                {currentTaxPolicy.basicDeductionAmount.toLocaleString()} 元 / 月
              </div>
            </div>

            <div className="tax-rule-columns">
              <div>
                <h3>综合所得税率表</h3>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>级数</th>
                      <th>应纳税所得额</th>
                      <th>税率</th>
                      <th>速算扣除数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentTaxPolicy.comprehensiveTaxBrackets.map((bracket) => (
                      <tr key={bracket.level}>
                        <td>{bracket.level}</td>
                        <td>{bracket.rangeText}</td>
                        <td>{bracket.rate}%</td>
                        <td>{bracket.quickDeduction}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <h3>年终奖单独计税税率表</h3>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>级数</th>
                      <th>平均每月额</th>
                      <th>税率</th>
                      <th>速算扣除数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentTaxPolicy.bonusTaxBrackets.map((bracket) => (
                      <tr key={bracket.level}>
                        <td>{bracket.level}</td>
                        <td>{bracket.rangeText}</td>
                        <td>{bracket.rate}%</td>
                        <td>{bracket.quickDeduction}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CollapsibleSectionCard>
        </WorkspaceItem>
      </WorkspaceCanvas>
    </WorkspaceLayoutRoot>
  );
};
