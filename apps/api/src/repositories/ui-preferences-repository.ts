import {
  NAVIGATION_MODULE_PATHS,
  WORKSPACE_DIALOG_SCOPES,
  WORKSPACE_PAGE_SCOPES,
  type FloatingDialogLayout,
  type NavigationModulePath,
  type WorkspaceCardLayout,
  type WorkspaceDialogScope,
  type WorkspaceLayoutState,
  type WorkspacePageScope,
} from "@dude-tax/core";
import { z } from "zod";
import { database } from "../db/database.js";

const SIDEBAR_COLLAPSED_KEY = "ui_sidebar_collapsed";
const NAVIGATION_ORDER_KEY = "ui_nav_order";
const PAGE_LAYOUT_KEY_PREFIX = "ui_layout::";
const DIALOG_LAYOUT_KEY_PREFIX = "ui_dialog::";

const workspaceCardLayoutSchema = z
  .object({
    cardId: z.string().trim().min(1),
    canvasId: z.string().trim().min(1).optional(),
    x: z.number().int().min(0),
    y: z.number().int().min(0),
    w: z.number().int().min(1).max(12),
    h: z.number().int().min(1),
  })
  .refine((value) => value.x + value.w <= 12, {
    message: "卡片宽度超出工作区列数",
    path: ["w"],
  });

const workspaceLayoutStateSchema = z.object({
  scope: z.enum(WORKSPACE_PAGE_SCOPES),
  cards: z.array(workspaceCardLayoutSchema),
});

const floatingDialogLayoutSchema = z.object({
  scope: z.enum(WORKSPACE_DIALOG_SCOPES),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  width: z.number().int().min(240),
  height: z.number().int().min(180),
  isMaximized: z.boolean(),
});

const navigationOrderSchema = z.array(z.string().trim().min(1));

const getPreference = (key: string): string | null => {
  const row = database
    .prepare("SELECT value FROM app_preferences WHERE key = ?")
    .get(key) as { value: string } | undefined;

  return row?.value ?? null;
};

const setPreference = (key: string, value: string) => {
  database
    .prepare(
      `
        INSERT INTO app_preferences (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `,
    )
    .run(key, value);
};

const deletePreference = (key: string) => {
  database.prepare("DELETE FROM app_preferences WHERE key = ?").run(key);
};

const parsePreference = <T>(rawValue: string | null, schema: z.ZodSchema<T>): T | null => {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    const result = schema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
};

const normalizeCards = (cards: WorkspaceCardLayout[]) =>
  cards.map((card) => ({
    ...card,
    canvasId: card.canvasId ?? "root",
  }));

const buildPageLayoutKey = (scope: WorkspacePageScope) => `${PAGE_LAYOUT_KEY_PREFIX}${scope}`;
const buildDialogLayoutKey = (scope: WorkspaceDialogScope) => `${DIALOG_LAYOUT_KEY_PREFIX}${scope}`;

export const uiPreferenceSchemas = {
  navigationOrderSchema,
  workspaceCardLayoutSchema,
  floatingDialogLayoutSchema,
};

const defaultNavigationOrder = [...NAVIGATION_MODULE_PATHS];

const normalizeNavigationOrder = (order: readonly string[]): NavigationModulePath[] => {
  const validSet = new Set<NavigationModulePath>(NAVIGATION_MODULE_PATHS);
  const uniqueValidOrder = order.filter(
    (path, index): path is NavigationModulePath =>
      validSet.has(path as NavigationModulePath) && order.indexOf(path) === index,
  );

  NAVIGATION_MODULE_PATHS.forEach((path) => {
    if (!uniqueValidOrder.includes(path)) {
      uniqueValidOrder.push(path);
    }
  });

  return uniqueValidOrder;
};

export const uiPreferencesRepository = {
  getSidebarCollapsed() {
    return getPreference(SIDEBAR_COLLAPSED_KEY) === "true";
  },

  setSidebarCollapsed(collapsed: boolean) {
    setPreference(SIDEBAR_COLLAPSED_KEY, collapsed ? "true" : "false");
    return { collapsed };
  },

  getNavigationOrder() {
    const parsed = parsePreference(
      getPreference(NAVIGATION_ORDER_KEY),
      navigationOrderSchema,
    );

    return {
      order: normalizeNavigationOrder(parsed ?? defaultNavigationOrder),
    };
  },

  setNavigationOrder(order: readonly string[]) {
    const normalizedOrder = normalizeNavigationOrder(order);
    setPreference(NAVIGATION_ORDER_KEY, JSON.stringify(normalizedOrder));
    return {
      order: normalizedOrder,
    };
  },

  getPageLayout(scope: WorkspacePageScope): WorkspaceLayoutState {
    const parsed = parsePreference(
      getPreference(buildPageLayoutKey(scope)),
      workspaceLayoutStateSchema,
    );

    if (!parsed) {
      return {
        scope,
        cards: [],
      };
    }

    return {
      scope,
      cards: normalizeCards(parsed.cards),
    };
  },

  setPageLayout(scope: WorkspacePageScope, cards: WorkspaceCardLayout[]): WorkspaceLayoutState {
    const nextState: WorkspaceLayoutState = {
      scope,
      cards: normalizeCards(cards),
    };
    setPreference(buildPageLayoutKey(scope), JSON.stringify(nextState));
    return nextState;
  },

  resetPageLayout(scope: WorkspacePageScope) {
    deletePreference(buildPageLayoutKey(scope));
  },

  getDialogLayout(scope: WorkspaceDialogScope): FloatingDialogLayout | null {
    return parsePreference(
      getPreference(buildDialogLayoutKey(scope)),
      floatingDialogLayoutSchema,
    );
  },

  setDialogLayout(
    scope: WorkspaceDialogScope,
    layout: Omit<FloatingDialogLayout, "scope">,
  ): FloatingDialogLayout {
    const nextLayout: FloatingDialogLayout = {
      scope,
      ...layout,
    };
    setPreference(buildDialogLayoutKey(scope), JSON.stringify(nextLayout));
    return nextLayout;
  },

  resetDialogLayout(scope: WorkspaceDialogScope) {
    deletePreference(buildDialogLayoutKey(scope));
  },
};
