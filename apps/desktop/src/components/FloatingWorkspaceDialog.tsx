import type { ReactNode } from "react";
import type { FloatingDialogLayout, WorkspaceDialogScope } from "@dude-tax/core";
import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../api/client";
import { clampFloatingDialogLayout, clampWorkspaceContentScale } from "../layout/workspace-layout";

type Props = {
  open: boolean;
  scope: WorkspaceDialogScope;
  title: string;
  subtitle?: string;
  defaultLayout: Omit<FloatingDialogLayout, "scope">;
  onClose: () => void;
  headerActions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  showMaximizeToggle?: boolean;
};

type ActiveInteraction =
  | {
      kind: "drag";
      pointerId: number;
      startX: number;
      startY: number;
      startLayout: FloatingDialogLayout;
    }
  | {
      kind: "resize-left" | "resize-right";
      pointerId: number;
      startX: number;
      startY: number;
      startLayout: FloatingDialogLayout;
    };

const isInteractiveTarget = (target: HTMLElement) =>
  Boolean(target.closest("button, input, select, textarea, a, label"));

const getViewport = () => ({
  width: Math.max(window.innerWidth - 32, 720),
  height: Math.max(window.innerHeight - 32, 360),
});

export const FloatingWorkspaceDialog = ({
  open,
  scope,
  title,
  subtitle,
  defaultLayout,
  onClose,
  headerActions,
  footer,
  children,
  className,
  bodyClassName,
  showMaximizeToggle = true,
}: Props) => {
  const [layout, setLayout] = useState<FloatingDialogLayout>({
    scope,
    ...defaultLayout,
  });
  const [activeInteraction, setActiveInteraction] = useState<ActiveInteraction | null>(null);
  const [renderedLayout, setRenderedLayout] = useState<FloatingDialogLayout>({
    scope,
    ...defaultLayout,
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    const load = async () => {
      const persistedLayout = await apiClient.getFloatingDialogLayout(scope);
      const nextLayout = clampFloatingDialogLayout(
        persistedLayout ?? {
          scope,
          ...defaultLayout,
        },
        getViewport(),
      );
      setLayout(nextLayout);
      setRenderedLayout(nextLayout);
    };

    void load();
  }, [defaultLayout, open, scope]);

  useEffect(() => {
    if (!activeInteraction || !open) {
      return;
    }

    document.body.classList.add("workspace-interacting");

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== activeInteraction.pointerId) {
        return;
      }

      const deltaX = event.clientX - activeInteraction.startX;
      const deltaY = event.clientY - activeInteraction.startY;
      const viewport = getViewport();

      const nextLayout =
        activeInteraction.kind === "drag"
          ? clampFloatingDialogLayout(
              {
                ...activeInteraction.startLayout,
                x: activeInteraction.startLayout.x + deltaX,
                y: activeInteraction.startLayout.y + deltaY,
              },
              viewport,
            )
          : clampFloatingDialogLayout(
              activeInteraction.kind === "resize-left"
                ? {
                    ...activeInteraction.startLayout,
                    x: activeInteraction.startLayout.x + deltaX,
                    width: activeInteraction.startLayout.width - deltaX,
                    height: activeInteraction.startLayout.height + deltaY,
                  }
                : {
                    ...activeInteraction.startLayout,
                    width: activeInteraction.startLayout.width + deltaX,
                    height: activeInteraction.startLayout.height + deltaY,
                  },
              viewport,
            );

      setLayout(nextLayout);
      setRenderedLayout(nextLayout);
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerId !== activeInteraction.pointerId) {
        return;
      }

      void apiClient.updateFloatingDialogLayout(scope, {
        x: layout.x,
        y: layout.y,
        width: layout.width,
        height: layout.height,
        isMaximized: layout.isMaximized,
      });
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
  }, [activeInteraction, layout, open, scope]);

  const visualLayout = useMemo(() => {
    const viewport = getViewport();
    if (renderedLayout.isMaximized) {
      return {
        x: 16,
        y: 16,
        width: viewport.width,
        height: viewport.height,
      };
    }

    return renderedLayout;
  }, [renderedLayout]);

  const dialogContentScale = useMemo(
    () =>
      clampWorkspaceContentScale({
        width: Math.max(visualLayout.width - 40, 1),
        height: Math.max(visualLayout.height - (footer ? 148 : 108), 1),
        defaultWidth: Math.max(defaultLayout.width - 40, 1),
        defaultHeight: Math.max(defaultLayout.height - (footer ? 148 : 108), 1),
      }),
    [defaultLayout.height, defaultLayout.width, footer, visualLayout.height, visualLayout.width],
  );

  if (!open) {
    return null;
  }

  return (
    <div className="workspace-overlay">
      <div
        aria-modal="true"
        className={["workspace-dialog", "workspace-floating-dialog", className].filter(Boolean).join(" ")}
        role="dialog"
        style={{
          left: `${visualLayout.x}px`,
          top: `${visualLayout.y}px`,
          width: `${visualLayout.width}px`,
          height: `${visualLayout.height}px`,
        }}
      >
        <div
          className="workspace-header"
          data-workspace-drag-handle="true"
          onPointerDown={(event) => {
            if (layout.isMaximized) {
              return;
            }

            const target = event.target as HTMLElement;
            if (isInteractiveTarget(target)) {
              return;
            }

            event.preventDefault();
            setActiveInteraction({
              kind: "drag",
              pointerId: event.pointerId,
              startX: event.clientX,
              startY: event.clientY,
              startLayout: layout,
            });
          }}
        >
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <div className="button-row compact">
            {headerActions}
            {showMaximizeToggle ? (
              <button
                className="ghost-button"
                type="button"
                onClick={() => {
                  const nextLayout = {
                    ...layout,
                    isMaximized: !layout.isMaximized,
                  };
                  setLayout(nextLayout);
                  setRenderedLayout(nextLayout);
                  void apiClient.updateFloatingDialogLayout(scope, {
                    x: nextLayout.x,
                    y: nextLayout.y,
                    width: nextLayout.width,
                    height: nextLayout.height,
                    isMaximized: nextLayout.isMaximized,
                  });
                }}
              >
                {layout.isMaximized ? "还原窗口" : "最大化"}
              </button>
            ) : null}
            <button className="ghost-button" type="button" onClick={onClose}>
              关闭
            </button>
          </div>
        </div>

        <div
          className={["workspace-dialog-body", bodyClassName].filter(Boolean).join(" ")}
          style={{
            ["--workspace-dialog-content-zoom" as string]: String(dialogContentScale),
          }}
        >
          <div className="workspace-dialog-content-zoom">{children}</div>
        </div>

        {footer ? <div className="workspace-dialog-footer">{footer}</div> : null}

        {!layout.isMaximized ? (
          <>
            <button
              aria-label="从左下角调整窗口大小"
              className="workspace-item-resize-handle workspace-item-resize-handle-left workspace-dialog-resize-handle"
              type="button"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setActiveInteraction({
                  kind: "resize-left",
                  pointerId: event.pointerId,
                  startX: event.clientX,
                  startY: event.clientY,
                  startLayout: layout,
                });
              }}
            />
            <button
              aria-label="从右下角调整窗口大小"
              className="workspace-item-resize-handle workspace-item-resize-handle-right workspace-dialog-resize-handle"
              type="button"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setActiveInteraction({
                  kind: "resize-right",
                  pointerId: event.pointerId,
                  startX: event.clientX,
                  startY: event.clientY,
                  startLayout: layout,
                });
              }}
            />
          </>
        ) : null}
      </div>
    </div>
  );
};
