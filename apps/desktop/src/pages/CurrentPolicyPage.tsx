import { useEffect, useMemo, useRef, useState } from "react";
import { apiClient } from "../api/client";
import { CollapsibleSectionCard } from "../components/CollapsibleSectionCard";
import { WorkspaceCanvas, WorkspaceItem, WorkspaceLayoutRoot } from "../components/WorkspaceLayout";
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
  const MAX_ILLUSTRATION_SCALE = 4;
  const MIN_ILLUSTRATION_SCALE = 1;
  const { context } = useAppContext();
  const currentUnitId = context?.currentUnitId ?? undefined;
  const currentTaxYear = context?.currentTaxYear ?? undefined;
  const currentUnit = context?.units.find((unit) => unit.id === currentUnitId) ?? null;

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [policy, setPolicy] = useState<Awaited<ReturnType<typeof apiClient.getTaxPolicy>> | null>(
    null,
  );
  const [selectedIllustration, setSelectedIllustration] = useState<{
    src: string;
    alt: string;
  } | null>(null);
  const [illustrationScale, setIllustrationScale] = useState(1);
  const [illustrationOffset, setIllustrationOffset] = useState({ x: 0, y: 0 });
  const [isIllustrationDragging, setIsIllustrationDragging] = useState(false);
  const illustrationDragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const closeIllustrationPreview = () => {
    illustrationDragStateRef.current = null;
    setIsIllustrationDragging(false);
    setSelectedIllustration(null);
  };

  const updateIllustrationScale = (nextScale: number) => {
    const clampedScale = Math.min(
      MAX_ILLUSTRATION_SCALE,
      Math.max(MIN_ILLUSTRATION_SCALE, Number(nextScale.toFixed(2))),
    );

    setIllustrationScale(clampedScale);
    if (clampedScale === MIN_ILLUSTRATION_SCALE) {
      setIllustrationOffset({ x: 0, y: 0 });
    }
  };

  useEffect(() => {
    const loadPolicy = async () => {
      try {
        setLoading(true);
        setErrorMessage(null);
        const nextPolicy = await apiClient.getTaxPolicy(currentUnitId, currentTaxYear);
        setPolicy(nextPolicy);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "加载政策参考失败");
        setPolicy(null);
      } finally {
        setLoading(false);
      }
    };

    void loadPolicy();
  }, [currentTaxYear, currentUnitId]);

  useEffect(() => {
    if (!selectedIllustration) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeIllustrationPreview();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIllustration]);

  useEffect(() => {
    if (!selectedIllustration) {
      return;
    }

    setIllustrationScale(1);
    setIllustrationOffset({ x: 0, y: 0 });
    illustrationDragStateRef.current = null;
    setIsIllustrationDragging(false);
  }, [selectedIllustration]);

  const policyItemBlocks = useMemo(
    () =>
      Object.fromEntries(
        (policy?.policyItems ?? []).map((item) => [item.id, parseMaintenanceRichText(item.body)]),
      ),
    [policy?.policyItems],
  );

  const handleIllustrationWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    updateIllustrationScale(illustrationScale + (event.deltaY < 0 ? 0.2 : -0.2));
  };

  const handleIllustrationPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || illustrationScale <= 1) {
      return;
    }

    illustrationDragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: illustrationOffset.x,
      originY: illustrationOffset.y,
    };
    setIsIllustrationDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleIllustrationPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (
      !illustrationDragStateRef.current ||
      illustrationDragStateRef.current.pointerId !== event.pointerId
    ) {
      return;
    }

    setIllustrationOffset({
      x:
        illustrationDragStateRef.current.originX +
        event.clientX -
        illustrationDragStateRef.current.startX,
      y:
        illustrationDragStateRef.current.originY +
        event.clientY -
        illustrationDragStateRef.current.startY,
    });
  };

  const stopIllustrationDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (
      !illustrationDragStateRef.current ||
      illustrationDragStateRef.current.pointerId !== event.pointerId
    ) {
      return;
    }

    illustrationDragStateRef.current = null;
    setIsIllustrationDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <WorkspaceLayoutRoot scope="page:policy">
      <WorkspaceCanvas>
        <WorkspaceItem
          cardId="policy-overview"
          defaultLayout={{ x: 0, y: 0, w: 12, h: 8 }}
          minH={8}
          resizable={false}
        >
          <CollapsibleSectionCard
            cardId="policy-overview"
            className="placeholder-card"
            description={`当前房间：${currentUnit?.unitName ?? "未选择单位"} / ${currentTaxYear ?? "-"} 年`}
            headingTag="h1"
            headerExtras={<span className="tag">{loading ? "加载中" : "已同步"}</span>}
            title="政策参考"
          >
            {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}
          </CollapsibleSectionCard>
        </WorkspaceItem>

        <WorkspaceItem
          cardId="policy-comprehensive"
          defaultLayout={{ x: 0, y: 8, w: 6, h: 14 }}
          minH={12}
        >
          <CollapsibleSectionCard
            cardId="policy-comprehensive"
            defaultCollapsed
            description="显示当前生效税率版本下的综合所得税率档位。"
            title="综合税率表"
          >
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
          </CollapsibleSectionCard>
        </WorkspaceItem>

        <WorkspaceItem
          cardId="policy-bonus"
          defaultLayout={{ x: 6, y: 8, w: 6, h: 14 }}
          minH={12}
        >
          <CollapsibleSectionCard
            cardId="policy-bonus"
            defaultCollapsed
            description="显示当前生效税率版本下的年终奖单独计税档位。"
            title="年终奖单独计税税率表"
          >
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
          </CollapsibleSectionCard>
        </WorkspaceItem>

        <WorkspaceItem
          cardId="policy-items"
          defaultLayout={{ x: 0, y: 22, w: 12, h: 18 }}
          minH={16}
        >
          <CollapsibleSectionCard
            cardId="policy-items"
            className="placeholder-card"
            description="条目由系统维护模块统一维护，可按顺序展示多条政策说明。"
            title="扣除项说明"
          >
            {(policy?.policyItems.length ?? 0) ? (
              <div className="policy-item-list">
                {policy?.policyItems.map((item, index) => (
                  <div className="current-policy-card policy-item-card" key={item.id}>
                    <strong>{item.title || `未命名说明 ${index + 1}`}</strong>
                    {item.illustrationDataUrl ? (
                      <button
                        aria-label={`查看${item.title || `政策参考插图 ${index + 1}`}原图`}
                        className="policy-illustration-button"
                        type="button"
                        onClick={() =>
                          setSelectedIllustration({
                            src: item.illustrationDataUrl,
                            alt: item.title || `政策参考插图 ${index + 1}`,
                          })
                        }
                      >
                        <img
                          alt={item.title || `政策参考插图 ${index + 1}`}
                          className="policy-illustration"
                          src={item.illustrationDataUrl}
                        />
                        <span className="field-hint">点击查看原图</span>
                      </button>
                    ) : null}
                    {(policyItemBlocks[item.id] ?? []).length ? (
                      <div className="rich-text-preview">
                        {(policyItemBlocks[item.id] ?? []).map((block, blockIndex) =>
                          renderPolicyBlock(block, blockIndex),
                        )}
                      </div>
                    ) : (
                      <div className="empty-state">
                        <strong>当前条目正文为空。</strong>
                        <p>请前往系统维护模块补充该说明的正文内容。</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="current-policy-card">
                <div className="empty-state">
                  <strong>当前还没有维护扣除项说明。</strong>
                  <p>请前往系统维护模块新增并填写说明条目。</p>
                </div>
              </div>
            )}
          </CollapsibleSectionCard>
        </WorkspaceItem>
      </WorkspaceCanvas>

      {selectedIllustration ? (
        <div className="workspace-overlay" role="presentation" onClick={closeIllustrationPreview}>
          <div
            aria-modal="true"
            className="policy-illustration-lightbox"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-header">
              <div>
                <h2>原图预览</h2>
                <p>{selectedIllustration.alt}</p>
              </div>
              <button className="ghost-button" type="button" onClick={closeIllustrationPreview}>
                关闭
              </button>
            </div>
            <div className="policy-illustration-toolbar">
              <span className="field-hint">滚轮缩放，按住鼠标左键拖动图片。</span>
              <div className="button-row compact">
                <button
                  className="ghost-button"
                  disabled={illustrationScale <= MIN_ILLUSTRATION_SCALE}
                  type="button"
                  onClick={() => updateIllustrationScale(illustrationScale - 0.25)}
                >
                  缩小
                </button>
                <button
                  className="ghost-button"
                  disabled={illustrationScale >= MAX_ILLUSTRATION_SCALE}
                  type="button"
                  onClick={() => updateIllustrationScale(illustrationScale + 0.25)}
                >
                  放大
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => {
                    setIllustrationOffset({ x: 0, y: 0 });
                    setIllustrationScale(1);
                  }}
                >
                  重置
                </button>
              </div>
            </div>
            <div
              className={
                isIllustrationDragging
                  ? "policy-illustration-lightbox-viewport is-draggable is-dragging"
                  : illustrationScale > 1
                    ? "policy-illustration-lightbox-viewport is-draggable"
                    : "policy-illustration-lightbox-viewport"
              }
              onPointerCancel={stopIllustrationDrag}
              onPointerDown={handleIllustrationPointerDown}
              onPointerMove={handleIllustrationPointerMove}
              onPointerUp={stopIllustrationDrag}
              onWheel={handleIllustrationWheel}
            >
              <img
                alt={selectedIllustration.alt}
                className="policy-illustration-lightbox-image"
                draggable={false}
                src={selectedIllustration.src}
                style={{
                  transform: `translate(${illustrationOffset.x}px, ${illustrationOffset.y}px) scale(${illustrationScale})`,
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </WorkspaceLayoutRoot>
  );
};
