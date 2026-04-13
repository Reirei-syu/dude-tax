import type { WorkspaceCardLayout, WorkspaceLayoutState, WorkspacePageScope } from "@dude-tax/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiClient } from "../api/client";

const normalizeCards = (cards: WorkspaceCardLayout[]) =>
  cards.map((card) => ({
    ...card,
    canvasId: card.canvasId ?? "root",
    z: Math.max(Math.round(card.z ?? 0), 0),
  }));

export const useWorkspaceLayout = (scope: WorkspacePageScope) => {
  const [layoutState, setLayoutState] = useState<WorkspaceLayoutState>({
    scope,
    cards: [],
  });
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const layoutStateRef = useRef(layoutState);

  useEffect(() => {
    layoutStateRef.current = layoutState;
  }, [layoutState]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setErrorMessage(null);
        const nextState = await apiClient.getWorkspaceLayout(scope);
        const normalizedState = {
          scope,
          cards: normalizeCards(nextState.cards),
        };
        layoutStateRef.current = normalizedState;
        setLayoutState(normalizedState);
      } catch (error) {
        const fallbackState = {
          scope,
          cards: [],
        };
        setErrorMessage(error instanceof Error ? error.message : "加载工作区布局失败");
        layoutStateRef.current = fallbackState;
        setLayoutState(fallbackState);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [scope]);

  const saveCanvasLayouts = useCallback(async (canvasId: string, cards: WorkspaceCardLayout[]) => {
    const currentState = layoutStateRef.current;
    const nextState: WorkspaceLayoutState = {
      scope,
      cards: [
        ...currentState.cards.filter((card) => (card.canvasId ?? "root") !== canvasId),
        ...normalizeCards(cards).map((card) => ({
          ...card,
          canvasId,
        })),
      ],
    };

    layoutStateRef.current = nextState;
    setLayoutState(nextState);
    try {
      setErrorMessage(null);
      const persistedState = await apiClient.updateWorkspaceLayout(scope, nextState.cards);
      const normalizedState = {
        scope,
        cards: normalizeCards(persistedState.cards),
      };
      layoutStateRef.current = normalizedState;
      setLayoutState(normalizedState);
    } catch (error) {
      layoutStateRef.current = currentState;
      setLayoutState(currentState);
      setErrorMessage(error instanceof Error ? error.message : "保存工作区布局失败");
    }
  }, [scope]);

  const resetLayout = useCallback(async () => {
    const currentState = layoutStateRef.current;
    const resetState = {
      scope,
      cards: [],
    };
    layoutStateRef.current = resetState;
    setLayoutState(resetState);
    try {
      setErrorMessage(null);
      await apiClient.resetWorkspaceLayout(scope);
    } catch (error) {
      layoutStateRef.current = currentState;
      setLayoutState(currentState);
      setErrorMessage(error instanceof Error ? error.message : "恢复默认布局失败");
    }
  }, [scope]);

  const hasCustomLayout = useMemo(() => layoutState.cards.length > 0, [layoutState.cards.length]);

  return {
    scope,
    layoutState,
    loading,
    errorMessage,
    hasCustomLayout,
    saveCanvasLayouts,
    resetLayout,
  };
};
