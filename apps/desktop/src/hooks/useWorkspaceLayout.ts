import type { WorkspaceCardLayout, WorkspaceLayoutState, WorkspacePageScope } from "@dude-tax/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiClient } from "../api/client";

const normalizeCards = (cards: WorkspaceCardLayout[]) =>
  cards.map((card) => ({
    ...card,
    canvasId: card.canvasId ?? "root",
    z: Math.max(Math.round(card.z ?? 0), 0),
  }));

const normalizeCollapsedSections = (collapsedSections?: Record<string, boolean>) =>
  Object.fromEntries(
    Object.entries(collapsedSections ?? {}).filter(
      ([key, value]) => key.trim().length > 0 && typeof value === "boolean",
    ),
  );

export const useWorkspaceLayout = (scope: WorkspacePageScope) => {
  const [layoutState, setLayoutState] = useState<WorkspaceLayoutState>({
    scope,
    cards: [],
    collapsedSections: {},
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
          collapsedSections: normalizeCollapsedSections(nextState.collapsedSections),
        };
        layoutStateRef.current = normalizedState;
        setLayoutState(normalizedState);
      } catch (error) {
        const fallbackState = {
          scope,
          cards: [],
          collapsedSections: {},
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
      collapsedSections: currentState.collapsedSections,
    };

    layoutStateRef.current = nextState;
    setLayoutState(nextState);
    try {
      setErrorMessage(null);
      const persistedState = await apiClient.updateWorkspaceLayout(scope, nextState);
      const normalizedState = {
        scope,
        cards: normalizeCards(persistedState.cards),
        collapsedSections: normalizeCollapsedSections(persistedState.collapsedSections),
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
    try {
      setErrorMessage(null);
      const persistedState = await apiClient.resetWorkspaceLayout(scope);
      const normalizedState = {
        scope,
        cards: normalizeCards(persistedState.cards),
        collapsedSections: normalizeCollapsedSections(persistedState.collapsedSections),
      };
      layoutStateRef.current = normalizedState;
      setLayoutState(normalizedState);
    } catch (error) {
      layoutStateRef.current = currentState;
      setLayoutState(currentState);
      setErrorMessage(error instanceof Error ? error.message : "恢复默认布局失败");
    }
  }, [scope]);

  const setCollapsedSection = useCallback(
    async (sectionKey: string, collapsed: boolean) => {
      const currentState = layoutStateRef.current;
      const nextCollapsedSections = {
        ...currentState.collapsedSections,
        [sectionKey]: collapsed,
      };
      const nextState: WorkspaceLayoutState = {
        ...currentState,
        collapsedSections: nextCollapsedSections,
      };

      layoutStateRef.current = nextState;
      setLayoutState(nextState);
      try {
        setErrorMessage(null);
        const persistedState = await apiClient.updateWorkspaceLayout(scope, nextState);
        const normalizedState = {
          scope,
          cards: normalizeCards(persistedState.cards),
          collapsedSections: normalizeCollapsedSections(persistedState.collapsedSections),
        };
        layoutStateRef.current = normalizedState;
        setLayoutState(normalizedState);
      } catch (error) {
        layoutStateRef.current = currentState;
        setLayoutState(currentState);
        setErrorMessage(error instanceof Error ? error.message : "保存工作区折叠状态失败");
      }
    },
    [scope],
  );

  const toggleCollapsedSection = useCallback(
    async (sectionKey: string, defaultValue = false) => {
      const currentValue = layoutStateRef.current.collapsedSections[sectionKey] ?? defaultValue;
      await setCollapsedSection(sectionKey, !currentValue);
    },
    [setCollapsedSection],
  );

  const hasCustomLayout = useMemo(
    () => layoutState.cards.length > 0 || Object.keys(layoutState.collapsedSections).length > 0,
    [layoutState.cards.length, layoutState.collapsedSections],
  );

  return {
    scope,
    layoutState,
    loading,
    errorMessage,
    hasCustomLayout,
    saveCanvasLayouts,
    resetLayout,
    setCollapsedSection,
    toggleCollapsedSection,
  };
};
