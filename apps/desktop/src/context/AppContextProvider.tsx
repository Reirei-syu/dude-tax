import type { AppContext } from "@salary-tax/core";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiClient } from "../api/client";

type AppContextValue = {
  context: AppContext | null;
  loading: boolean;
  errorMessage: string | null;
  refresh: () => Promise<void>;
  updateContext: (payload: Partial<Pick<AppContext, "currentUnitId" | "currentTaxYear">>) => Promise<void>;
};

const AppContextStore = createContext<AppContextValue | null>(null);

export const AppContextProvider = ({ children }: { children: React.ReactNode }) => {
  const [context, setContext] = useState<AppContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const nextContext = await apiClient.getContext();
      setContext(nextContext);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "加载上下文失败");
    } finally {
      setLoading(false);
    }
  };

  const updateContext = async (
    payload: Partial<Pick<AppContext, "currentUnitId" | "currentTaxYear">>,
  ) => {
    try {
      setErrorMessage(null);
      const nextContext = await apiClient.updateContext(payload);
      setContext(nextContext);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "更新上下文失败");
      throw error;
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      context,
      loading,
      errorMessage,
      refresh,
      updateContext,
    }),
    [context, errorMessage, loading],
  );

  return <AppContextStore.Provider value={value}>{children}</AppContextStore.Provider>;
};

export const useAppContext = () => {
  const value = useContext(AppContextStore);
  if (!value) {
    throw new Error("useAppContext 必须在 AppContextProvider 内使用");
  }

  return value;
};

