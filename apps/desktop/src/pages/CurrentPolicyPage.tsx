import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../api/client";
import { useAppContext } from "../context/AppContextProvider";
import {
  parseMaintenanceRichText,
  renderRichTextTokens,
  type RichTextBlock,
} from "./maintenance-rich-text";

const renderPolicyBlock = (block: RichTextBlock, index: number) => {
  if (block.type === "heading") {
    if (block.level === 1) {
      return <h3 key={index}>{renderRichTextTokens(block.tokens, `policy-heading-1-${index}`)}</h3>;
    }

    if (block.level === 2) {
      return <h4 key={index}>{renderRichTextTokens(block.tokens, `policy-heading-2-${index}`)}</h4>;
    }

    return <h5 key={index}>{renderRichTextTokens(block.tokens, `policy-heading-3-${index}`)}</h5>;
  }

  if (block.type === "quote") {
    return (
      <blockquote key={index}>
        {renderRichTextTokens(block.tokens, `policy-quote-${index}`)}
      </blockquote>
    );
  }

  if (block.type === "list") {
    return (
      <ul key={index}>
        {block.items.map((itemTokens, itemIndex) => (
          <li key={`${index}-${itemIndex}`}>
            {renderRichTextTokens(itemTokens, `policy-list-${index}-${itemIndex}`)}
          </li>
        ))}
      </ul>
    );
  }

  return <p key={index}>{renderRichTextTokens(block.tokens, `policy-paragraph-${index}`)}</p>;
};

export const CurrentPolicyPage = () => {
  const { context } = useAppContext();
  const currentUnitId = context?.currentUnitId ?? undefined;
  const currentTaxYear = context?.currentTaxYear ?? undefined;
  const currentUnit = context?.units.find((unit) => unit.id === currentUnitId) ?? null;

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [policy, setPolicy] = useState<Awaited<ReturnType<typeof apiClient.getTaxPolicy>> | null>(null);

  useEffect(() => {
    const loadPolicy = async () => {
      try {
        setLoading(true);
        setErrorMessage(null);
        const nextPolicy = await apiClient.getTaxPolicy(currentUnitId, currentTaxYear);
        setPolicy(nextPolicy);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "加载当前政策失败");
        setPolicy(null);
      } finally {
        setLoading(false);
      }
    };

    void loadPolicy();
  }, [currentTaxYear, currentUnitId]);

  const policyBlocks = useMemo(
    () => parseMaintenanceRichText(policy?.policyBody ?? ""),
    [policy?.policyBody],
  );

  return (
    <section className="page-grid">
      <article className="glass-card page-section placeholder-card">
        <div className="section-header">
          <div>
            <h1>当前政策</h1>
            <p>
              当前房间：{currentUnit?.unitName ?? "未选择单位"} / {currentTaxYear ?? "-"} 年
            </p>
          </div>
          <span className="tag">{loading ? "加载中" : "已同步"}</span>
        </div>
        {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}
      </article>

      <article className="glass-card page-section">
        <div className="section-header">
          <div>
            <h2>综合税率表</h2>
            <p>显示当前生效税率版本下的综合所得税率档位。</p>
          </div>
        </div>

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
            {policy?.currentSettings.comprehensiveTaxBrackets.map((bracket) => (
              <tr key={bracket.level}>
                <td>{bracket.level}</td>
                <td>{bracket.rangeText}</td>
                <td>{bracket.rate}%</td>
                <td>{bracket.quickDeduction}</td>
              </tr>
            )) ?? (
              <tr>
                <td colSpan={4}>暂无税率数据</td>
              </tr>
            )}
          </tbody>
        </table>
      </article>

      <article className="glass-card page-section">
        <div className="section-header">
          <div>
            <h2>年终奖单独计税税率表</h2>
            <p>显示当前生效税率版本下的年终奖单独计税档位。</p>
          </div>
        </div>

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
            {policy?.currentSettings.bonusTaxBrackets.map((bracket) => (
              <tr key={bracket.level}>
                <td>{bracket.level}</td>
                <td>{bracket.rangeText}</td>
                <td>{bracket.rate}%</td>
                <td>{bracket.quickDeduction}</td>
              </tr>
            )) ?? (
              <tr>
                <td colSpan={4}>暂无税率数据</td>
              </tr>
            )}
          </tbody>
        </table>
      </article>

      <article className="glass-card page-section placeholder-card">
        <div className="section-header">
          <div>
            <h2>扣除项说明</h2>
            <p>由系统维护模块维护标题、正文与插图。</p>
          </div>
        </div>

        <div className="current-policy-card">
          <strong>{policy?.policyTitle || "未设置标题"}</strong>
          {policy?.policyIllustrationDataUrl ? (
            <img
              alt={policy.policyTitle || "当前政策插图"}
              className="policy-illustration"
              src={policy.policyIllustrationDataUrl}
            />
          ) : null}

          {policyBlocks.length ? (
            <div className="rich-text-preview">
              {policyBlocks.map((block, index) => renderPolicyBlock(block, index))}
            </div>
          ) : (
            <div className="empty-state">
              <strong>当前还没有维护扣除项说明。</strong>
              <p>请前往系统维护模块填写标题、正文和插图。</p>
            </div>
          )}
        </div>
      </article>
    </section>
  );
};
