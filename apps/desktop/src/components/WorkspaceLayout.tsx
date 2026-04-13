import type { Dispatch, ReactElement, ReactNode, SetStateAction } from "react";
import { WORKSPACE_LAYOUT_UNIT_STEP, type WorkspaceCardLayout, type WorkspacePageScope } from "@dude-tax/core";
import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useWorkspaceLayout } from "../hooks/useWorkspaceLayout";
import {
  WORKSPACE_TAIL_EXTENSION_STEP_ROWS,
  DEFAULT_WORKSPACE_CANVAS_ID,
  WORKSPACE_GRID_GAP,
  WORKSPACE_INTERACTION_THRESHOLD_PX,
  WORKSPACE_MIN_INTERACTIVE_WIDTH,
  WORKSPACE_ROW_HEIGHT,
  autoArrangeWorkspaceCards,
  bringCardToFront,
  clampWorkspaceCardLayout,
  clampWorkspaceContentScale,
  createWorkspaceCardLayout,
  mergeLayoutState,
  getWorkspaceCanvasHeight,
  getWorkspaceCardKey,
  getWorkspaceCardStyle,
  pinCardToHorizontalEdge,
  type WorkspaceCardDefinition,
} from "../layout/workspace-layout";

type WorkspaceLayoutContextValue = ReturnType<typeof useWorkspaceLayout>;

const WorkspaceLayoutContext = createContext<WorkspaceLayoutContextValue | null>(null);

type WorkspaceLayoutRootProps = {
  scope: WorkspacePageScope;
  children: ReactNode;
};

type WorkspaceItemProps = WorkspaceCardDefinition & {
  children: ReactNode;
};

type WorkspaceCanvasProps = {
  canvasId?: string;
  className?: string;
  children: ReactNode;
};

type WorkspaceCanvasActions = {
  autoArrange: () => void;
  resetTransientState: () => void;
};

const MIN_RESIZABLE_CARD_HEIGHT_UNITS = 4;
const roundWorkspaceUnit = (value: number) =>
  Math.round(value / WORKSPACE_LAYOUT_UNIT_STEP) * WORKSPACE_LAYOUT_UNIT_STEP;

type ActiveInteraction =
  | {
      kind: "drag";
      cardId: string;
      pointerId: number;
      startClientX: number;
      startClientY: number;
      startLayout: WorkspaceCardLayout;
    }
  | {
      kind: "resize-left" | "resize-right";
      cardId: string;
      pointerId: number;
      startClientX: number;
      startClientY: number;
      startLayout: WorkspaceCardLayout;
    };

type WorkspaceContextMenuState = {
  cardId: string;
  left: number;
  top: number;
};

const isInteractiveTarget = (target: HTMLElement) =>
  Boolean(
    target.closest(
      "button, input, select, textarea, a, label, [contenteditable='true'], [role='button'], [data-drag-exempt='true']",
    ),
  );

const useWorkspaceLayoutContext = () => {
  const value = useContext(WorkspaceLayoutContext);
  if (!value) {
    throw new Error("WorkspaceCanvas 必须在 WorkspaceLayoutRoot 内使用");
  }

  return value;
};

const WorkspaceCanvasActionsContext = createContext<{
  setCanvasActions: Dispatch<SetStateAction<WorkspaceCanvasActions | null>>;
} | null>(null);

const useWorkspaceCanvasActionsContext = () => {
  const value = useContext(WorkspaceCanvasActionsContext);
  if (!value) {
    throw new Error("WorkspaceCanvas 必须在 WorkspaceLayoutRoot 内使用");
  }

  return value;
};

export const WorkspaceLayoutRoot = ({ scope, children }: WorkspaceLayoutRootProps) => {
  const layoutController = useWorkspaceLayout(scope);
  const [canvasActions, setCanvasActions] = useState<WorkspaceCanvasActions | null>(null);

  return (
    <WorkspaceLayoutContext.Provider value={layoutController}>
      <WorkspaceCanvasActionsContext.Provider value={{ setCanvasActions }}>
        <div className="workspace-layout-root">
          <div className="workspace-layout-toolbar">
            <span className="field-hint">工作区卡片支持拖拽与缩放；当前页布局会自动记忆。</span>
            <button
              className="ghost-button"
              disabled={layoutController.loading}
              type="button"
              onClick={() => canvasActions?.autoArrange()}
            >
              自动排列
            </button>
            <button
              className="ghost-button"
              disabled={layoutController.loading || !layoutController.hasCustomLayout}
              type="button"
              onClick={() => {
                canvasActions?.resetTransientState();
                void layoutController.resetLayout();
              }}
            >
              恢复默认布局
            </button>
          </div>
          {layoutController.errorMessage ? (
            <div className="error-banner">{layoutController.errorMessage}</div>
          ) : null}
          {children}
        </div>
      </WorkspaceCanvasActionsContext.Provider>
    </WorkspaceLayoutContext.Provider>
  );
};

export const WorkspaceItem = ({ children }: WorkspaceItemProps) => <>{children}</>;

export const WorkspaceCanvas = ({
  canvasId = DEFAULT_WORKSPACE_CANVAS_ID,
  className,
  children,
}: WorkspaceCanvasProps) => {
  const { layoutState, scope, saveCanvasLayouts } = useWorkspaceLayoutContext();
  const { setCanvasActions } = useWorkspaceCanvasActionsContext();
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const cardsRef = useRef<WorkspaceCardLayout[]>([]);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [activeInteraction, setActiveInteraction] = useState<ActiveInteraction | null>(null);
  const pointerOwnerRef = useRef<HTMLElement | null>(null);
  const [tailExtensionRows, setTailExtensionRows] = useState(0);
  const [contextMenuState, setContextMenuState] = useState<WorkspaceContextMenuState | null>(null);

  const childElements = useMemo(
    () =>
      Children.toArray(children).filter((child): child is ReactElement<WorkspaceItemProps> =>
        isValidElement<WorkspaceItemProps>(child),
      ),
    [children],
  );

  const definitions = useMemo(
    () =>
      childElements.map((child) => ({
        cardId: child.props.cardId,
        canvasId: child.props.canvasId ?? canvasId,
        defaultLayout: child.props.defaultLayout,
        minW: child.props.minW,
        minH:
          child.props.resizable === false
            ? child.props.minH
            : Math.min(child.props.minH ?? MIN_RESIZABLE_CARD_HEIGHT_UNITS, MIN_RESIZABLE_CARD_HEIGHT_UNITS),
        movable: child.props.movable ?? true,
        resizable: child.props.resizable ?? true,
      })),
    [canvasId, childElements],
  );

  const definitionMap = useMemo(
    () =>
      new Map(
        definitions.map((definition) => [definition.cardId, definition] as const),
      ),
    [definitions],
  );

  const mergedState = useMemo(
    () => mergeLayoutState(scope, definitions.map(createWorkspaceCardLayout), layoutState),
    [definitions, layoutState, scope],
  );

  const canvasCards = useMemo(
    () =>
      mergedState.cards.filter((card) => (card.canvasId ?? DEFAULT_WORKSPACE_CANVAS_ID) === canvasId),
    [canvasId, mergedState.cards],
  );
  const storedCanvasCards = useMemo(
    () =>
      layoutState.cards.filter(
        (card) => (card.canvasId ?? DEFAULT_WORKSPACE_CANVAS_ID) === canvasId,
      ),
    [canvasId, layoutState.cards],
  );

  const [cards, setCards] = useState<WorkspaceCardLayout[]>(canvasCards);

  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  useEffect(() => {
    setCards(canvasCards);
  }, [canvasCards]);

  const persistCanvasCards = useCallback(
    (nextCards: WorkspaceCardLayout[]) => {
      setCards(nextCards);
      void saveCanvasLayouts(canvasId, nextCards);
    },
    [canvasId, saveCanvasLayouts],
  );

  useEffect(() => {
    const staleStoredCards = storedCanvasCards.filter((card) => !definitionMap.has(card.cardId));
    if (!staleStoredCards.length) {
      return;
    }

    const validStoredCanvasCards = storedCanvasCards.filter((card) =>
      definitionMap.has(card.cardId),
    );
    persistCanvasCards(validStoredCanvasCards);
  }, [definitionMap, persistCanvasCards, storedCanvasCards]);

  const autoArrange = useCallback(() => {
    const arrangedCards = autoArrangeWorkspaceCards(cardsRef.current);
    setContextMenuState(null);
    persistCanvasCards(arrangedCards);
  }, [persistCanvasCards]);

  const resetTransientState = useCallback(() => {
    setTailExtensionRows(0);
    setContextMenuState(null);
  }, []);

  useEffect(() => {
    setCanvasActions((currentActions) => {
      if (
        currentActions?.autoArrange === autoArrange &&
        currentActions.resetTransientState === resetTransientState
      ) {
        return currentActions;
      }

      return {
        autoArrange,
        resetTransientState,
      };
    });

    return () => {
      setCanvasActions((currentActions) => {
        if (
          currentActions?.autoArrange === autoArrange &&
          currentActions.resetTransientState === resetTransientState
        ) {
          return null;
        }

        return currentActions;
      });
    };
  }, [autoArrange, resetTransientState, setCanvasActions]);

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) {
      return;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width ?? 0;
      setCanvasWidth(nextWidth);
    });
    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, []);

  const isInteractive = canvasWidth >= WORKSPACE_MIN_INTERACTIVE_WIDTH;
  const columnUnitWidth =
    canvasWidth > 0 ? (canvasWidth - WORKSPACE_GRID_GAP * 11) / 12 : 0;

  useEffect(() => {
    if (!contextMenuState) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && contextMenuRef.current?.contains(target)) {
        return;
      }
      setContextMenuState(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setContextMenuState(null);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenuState]);

  useEffect(() => {
    if (!activeInteraction || !isInteractive || columnUnitWidth <= 0) {
      return;
    }

    document.body.classList.add("workspace-interacting");

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== activeInteraction.pointerId) {
        return;
      }

      const definition = definitionMap.get(activeInteraction.cardId);
      if (!definition) {
        return;
      }

      const deltaX = event.clientX - activeInteraction.startClientX;
      const deltaY = event.clientY - activeInteraction.startClientY;

      const nextLayout =
        activeInteraction.kind === "drag"
          ? clampWorkspaceCardLayout(
              {
                ...activeInteraction.startLayout,
                x:
                  activeInteraction.startLayout.x +
                  roundWorkspaceUnit(deltaX / (columnUnitWidth + WORKSPACE_GRID_GAP)),
                y:
                  activeInteraction.startLayout.y +
                  roundWorkspaceUnit(deltaY / (WORKSPACE_ROW_HEIGHT + WORKSPACE_GRID_GAP)),
              },
              {
                minW: definition.minW,
                minH: definition.minH,
              },
            )
          : clampWorkspaceCardLayout(
              activeInteraction.kind === "resize-left"
                ? {
                    ...activeInteraction.startLayout,
                    x:
                      activeInteraction.startLayout.x +
                      roundWorkspaceUnit(deltaX / (columnUnitWidth + WORKSPACE_GRID_GAP)),
                    w:
                      activeInteraction.startLayout.w -
                      roundWorkspaceUnit(deltaX / (columnUnitWidth + WORKSPACE_GRID_GAP)),
                    h:
                      activeInteraction.startLayout.h +
                      roundWorkspaceUnit(deltaY / (WORKSPACE_ROW_HEIGHT + WORKSPACE_GRID_GAP)),
                  }
                : {
                    ...activeInteraction.startLayout,
                    w:
                      activeInteraction.startLayout.w +
                      roundWorkspaceUnit(deltaX / (columnUnitWidth + WORKSPACE_GRID_GAP)),
                    h:
                      activeInteraction.startLayout.h +
                      roundWorkspaceUnit(deltaY / (WORKSPACE_ROW_HEIGHT + WORKSPACE_GRID_GAP)),
                  },
              {
                minW: definition.minW,
                minH: definition.minH,
              },
            );

      setCards((currentCards) =>
        currentCards.map((card) =>
          card.cardId === activeInteraction.cardId ? nextLayout : card,
        ),
      );
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerId !== activeInteraction.pointerId) {
        return;
      }

      const currentCards = cardsRef.current;
      const movingCard = currentCards.find((card) => card.cardId === activeInteraction.cardId);
      if (!movingCard) {
        pointerOwnerRef.current?.releasePointerCapture?.(activeInteraction.pointerId);
        pointerOwnerRef.current = null;
        document.body.classList.remove("workspace-interacting");
        setActiveInteraction(null);
        return;
      }

      persistCanvasCards(currentCards);
      pointerOwnerRef.current?.releasePointerCapture?.(activeInteraction.pointerId);
      pointerOwnerRef.current = null;
      document.body.classList.remove("workspace-interacting");
      setActiveInteraction(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      document.body.classList.remove("workspace-interacting");
    };
  }, [activeInteraction, columnUnitWidth, definitionMap, isInteractive, persistCanvasCards]);

  const renderCards = useMemo(
    () =>
      [...cards].sort((left, right) => {
        if (left.z !== right.z) {
          return left.z - right.z;
        }
        if (left.y !== right.y) {
          return left.y - right.y;
        }
        return left.x - right.x;
      }),
    [cards],
  );

  const canvasStyle = isInteractive
    ? {
        minHeight: `${getWorkspaceCanvasHeight(cards) + tailExtensionRows * (32 + WORKSPACE_GRID_GAP)}px`,
      }
    : undefined;

  return (
    <div
      className={[
        "workspace-canvas",
        isInteractive ? "workspace-canvas-interactive" : "workspace-canvas-stacked",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      ref={canvasRef}
      style={canvasStyle}
      onWheelCapture={(event) => {
        if (!isInteractive || event.deltaY <= 0) {
          return;
        }

        const atDocumentBottom =
          window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
        if (!atDocumentBottom) {
          return;
        }

        const target = event.target as HTMLElement;
        const scrollableAncestor = target.closest(
          ".workspace-table-wrapper, .collapsible-card-body, .import-workflow-group-body, .workspace-dialog-content-zoom",
        ) as HTMLElement | null;
        if (
          scrollableAncestor &&
          scrollableAncestor.scrollTop + scrollableAncestor.clientHeight <
            scrollableAncestor.scrollHeight - 2
        ) {
          return;
        }

        setTailExtensionRows((currentRows) => currentRows + WORKSPACE_TAIL_EXTENSION_STEP_ROWS);
      }}
    >
      {renderCards.map((renderCard) => {
        const child = childElements.find((candidate) => candidate.props.cardId === renderCard.cardId);
        if (!child) {
          return null;
        }

        const definition = definitionMap.get(child.props.cardId);
        const defaultLayout = createWorkspaceCardLayout(
          {
            ...child.props,
            canvasId,
          },
          childElements.findIndex((candidate) => candidate.props.cardId === child.props.cardId),
        );
        const layout =
          cards.find((card) => getWorkspaceCardKey(card) === `${canvasId}::${child.props.cardId}`) ??
          defaultLayout;
        const style = isInteractive ? getWorkspaceCardStyle(layout, canvasWidth) : undefined;
        const defaultStyle = getWorkspaceCardStyle(defaultLayout, canvasWidth || 1);
        const contentScale = isInteractive
          ? clampWorkspaceContentScale({
              width: style?.width ?? defaultStyle.width,
              height: Math.max((style?.height ?? defaultStyle.height) - 92, 1),
              defaultWidth: defaultStyle.width,
              defaultHeight: Math.max(defaultStyle.height - 92, 1),
            })
          : 1;

        return (
          <div
            className={[
              "workspace-item",
              isInteractive ? "workspace-item-interactive" : "workspace-item-stacked",
            ].join(" ")}
            key={getWorkspaceCardKey(layout)}
            style={{
              ...style,
              ["--workspace-content-zoom" as string]: String(contentScale),
              zIndex: layout.z + 1,
            }}
            onContextMenu={(event) => {
              if (!isInteractive || !definition?.movable) {
                return;
              }

              const target = event.target as HTMLElement;
              if (isInteractiveTarget(target)) {
                return;
              }

              event.preventDefault();
              setContextMenuState({
                cardId: layout.cardId,
                left: event.clientX,
                top: event.clientY,
              });
            }}
            onPointerDown={(event) => {
              if (!isInteractive || !definition?.movable) {
                return;
              }

              const target = event.target as HTMLElement;
              if (isInteractiveTarget(target)) {
                return;
              }

              setContextMenuState(null);
              event.preventDefault();
              const pointerOwner = event.currentTarget as HTMLDivElement;
              pointerOwnerRef.current = pointerOwner;
              pointerOwner.setPointerCapture?.(event.pointerId);

              const handlePointerMove = (moveEvent: PointerEvent) => {
                if (moveEvent.pointerId !== event.pointerId) {
                  return;
                }

                if (
                  Math.abs(moveEvent.clientX - event.clientX) < WORKSPACE_INTERACTION_THRESHOLD_PX &&
                  Math.abs(moveEvent.clientY - event.clientY) < WORKSPACE_INTERACTION_THRESHOLD_PX
                ) {
                  return;
                }

                pointerOwner.removeEventListener("pointermove", handlePointerMove);
                pointerOwner.removeEventListener("pointerup", handlePointerUp);
                pointerOwner.removeEventListener("pointercancel", handlePointerUp);
                setActiveInteraction({
                  kind: "drag",
                  cardId: layout.cardId,
                  pointerId: event.pointerId,
                  startClientX: event.clientX,
                  startClientY: event.clientY,
                  startLayout: layout,
                });
              };

              const handlePointerUp = (upEvent: PointerEvent) => {
                if (upEvent.pointerId !== event.pointerId) {
                  return;
                }

                pointerOwner.releasePointerCapture?.(event.pointerId);
                pointerOwner.removeEventListener("pointermove", handlePointerMove);
                pointerOwner.removeEventListener("pointerup", handlePointerUp);
                pointerOwner.removeEventListener("pointercancel", handlePointerUp);
              };

              pointerOwner.addEventListener("pointermove", handlePointerMove);
              pointerOwner.addEventListener("pointerup", handlePointerUp);
              pointerOwner.addEventListener("pointercancel", handlePointerUp);
            }}
          >
            <div className="workspace-item-surface">{child.props.children}</div>
            {isInteractive && definition?.resizable !== false ? (
              <>
                <button
                  aria-label="从左下角调整卡片大小"
                  className="workspace-item-resize-handle workspace-item-resize-handle-left"
                  type="button"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    pointerOwnerRef.current = event.currentTarget as HTMLButtonElement;
                    pointerOwnerRef.current.setPointerCapture?.(event.pointerId);
                    setActiveInteraction({
                      kind: "resize-left",
                      cardId: layout.cardId,
                      pointerId: event.pointerId,
                      startClientX: event.clientX,
                      startClientY: event.clientY,
                      startLayout: layout,
                    });
                  }}
                />
                <button
                  aria-label="从右下角调整卡片大小"
                  className="workspace-item-resize-handle workspace-item-resize-handle-right"
                  type="button"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    pointerOwnerRef.current = event.currentTarget as HTMLButtonElement;
                    pointerOwnerRef.current.setPointerCapture?.(event.pointerId);
                    setActiveInteraction({
                      kind: "resize-right",
                      cardId: layout.cardId,
                      pointerId: event.pointerId,
                      startClientX: event.clientX,
                      startClientY: event.clientY,
                      startLayout: layout,
                    });
                  }}
                />
              </>
            ) : null}
          </div>
        );
      })}
      {contextMenuState ? (
        <div
          className="workspace-card-context-menu"
          ref={contextMenuRef}
          style={{
            left: contextMenuState.left,
            top: contextMenuState.top,
          }}
        >
          <button
            className="ghost-button"
            type="button"
            onClick={() => {
              const nextCards = bringCardToFront(cardsRef.current, contextMenuState.cardId, canvasId);
              setContextMenuState(null);
              persistCanvasCards(nextCards);
            }}
          >
            顶置
          </button>
          <button
            className="ghost-button"
            type="button"
            onClick={() => {
              const nextCards = cardsRef.current.map((card) =>
                card.cardId === contextMenuState.cardId && (card.canvasId ?? DEFAULT_WORKSPACE_CANVAS_ID) === canvasId
                  ? pinCardToHorizontalEdge(card, "left")
                  : card,
              );
              setContextMenuState(null);
              persistCanvasCards(nextCards);
            }}
          >
            靠左
          </button>
          <button
            className="ghost-button"
            type="button"
            onClick={() => {
              const nextCards = cardsRef.current.map((card) =>
                card.cardId === contextMenuState.cardId && (card.canvasId ?? DEFAULT_WORKSPACE_CANVAS_ID) === canvasId
                  ? pinCardToHorizontalEdge(card, "right")
                  : card,
              );
              setContextMenuState(null);
              persistCanvasCards(nextCards);
            }}
          >
            靠右
          </button>
        </div>
      ) : null}
    </div>
  );
};
