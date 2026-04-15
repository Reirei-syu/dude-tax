import {
  NAVIGATION_MODULE_PATHS,
  WORKSPACE_LAYOUT_UNIT_STEP,
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
import { getDefaultUiPreferences } from "../default-ui-preferences.js";

const SIDEBAR_COLLAPSED_KEY = "ui_sidebar_collapsed";
const NAVIGATION_ORDER_KEY = "ui_nav_order";
const PAGE_LAYOUT_KEY_PREFIX = "ui_layout::";
const DIALOG_LAYOUT_KEY_PREFIX = "ui_dialog::";
const WORKSPACE_LAYOUT_UNIT_FACTOR = 1 / WORKSPACE_LAYOUT_UNIT_STEP;

const roundWorkspaceUnit = (value: number) =>
  Math.round(value * WORKSPACE_LAYOUT_UNIT_FACTOR) / WORKSPACE_LAYOUT_UNIT_FACTOR;

const clampWorkspaceUnit = (value: number, minValue: number, maxValue: number) =>
  Math.min(Math.max(roundWorkspaceUnit(value), minValue), maxValue);

const workspaceCardLayoutSchema = z
  .object({
    cardId: z.string().trim().min(1),
    canvasId: z.string().trim().min(1).optional(),
    x: z.number().finite().min(0),
    y: z.number().finite().min(0),
    w: z.number().finite().min(WORKSPACE_LAYOUT_UNIT_STEP).max(12),
    h: z.number().finite().min(WORKSPACE_LAYOUT_UNIT_STEP),
    z: z.number().int().min(0).optional(),
  })
  .refine((value) => value.x + value.w <= 12, {
    message: "卡片宽度超出工作区列数",
    path: ["w"],
  });

const workspaceLayoutStateSchema = z.object({
  scope: z.enum(WORKSPACE_PAGE_SCOPES),
  cards: z.array(workspaceCardLayoutSchema),
  collapsedSections: z.record(z.string().trim().min(1), z.boolean()).optional(),
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
type WorkspaceCardLayoutInput = Pick<WorkspaceCardLayout, "cardId" | "x" | "y" | "w" | "h"> &
  Partial<Pick<WorkspaceCardLayout, "canvasId" | "z">>;

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

const normalizeCards = (cards: WorkspaceCardLayoutInput[]) =>
  cards.map((card, index) => {
    const normalizedWidth = clampWorkspaceUnit(
      card.w,
      WORKSPACE_LAYOUT_UNIT_STEP,
      12,
    );

    return {
      ...card,
      canvasId: card.canvasId ?? "root",
      x: clampWorkspaceUnit(card.x, 0, roundWorkspaceUnit(12 - normalizedWidth)),
      y: Math.max(0, roundWorkspaceUnit(card.y)),
      w: normalizedWidth,
      h: Math.max(WORKSPACE_LAYOUT_UNIT_STEP, roundWorkspaceUnit(card.h)),
      z: Math.max(Math.round(card.z ?? index), 0),
    };
  });

const normalizeCollapsedSections = (collapsedSections?: Record<string, boolean>) =>
  Object.fromEntries(
    Object.entries(collapsedSections ?? {}).filter(
      ([key, value]) => key.trim().length > 0 && typeof value === "boolean",
    ),
  );

const buildPageLayoutKey = (scope: WorkspacePageScope) => `${PAGE_LAYOUT_KEY_PREFIX}${scope}`;
const buildDialogLayoutKey = (scope: WorkspaceDialogScope) => `${DIALOG_LAYOUT_KEY_PREFIX}${scope}`;

const getDefaultPageLayout = (scope: WorkspacePageScope): WorkspaceLayoutState => {
  const defaultSeed = getDefaultUiPreferences().pageLayouts[scope];
  if (!defaultSeed) {
    return {
      scope,
      cards: [],
      collapsedSections: {},
    };
  }

  return {
    scope,
    cards: normalizeCards(defaultSeed.cards),
    collapsedSections: normalizeCollapsedSections(defaultSeed.collapsedSections),
  };
};

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
        collapsedSections: {},
      };
    }

    return {
      scope,
      cards: normalizeCards(parsed.cards),
      collapsedSections: normalizeCollapsedSections(parsed.collapsedSections),
    };
  },

  setPageLayout(
    scope: WorkspacePageScope,
    state: {
      cards: WorkspaceCardLayoutInput[];
      collapsedSections?: Record<string, boolean>;
    },
  ): WorkspaceLayoutState {
    const nextState: WorkspaceLayoutState = {
      scope,
      cards: normalizeCards(state.cards),
      collapsedSections: normalizeCollapsedSections(state.collapsedSections),
    };
    setPreference(buildPageLayoutKey(scope), JSON.stringify(nextState));
    return nextState;
  },

  resetPageLayout(scope: WorkspacePageScope) {
    const defaultState = getDefaultPageLayout(scope);
    if (!defaultState.cards.length && !Object.keys(defaultState.collapsedSections).length) {
      deletePreference(buildPageLayoutKey(scope));
      return defaultState;
    }

    setPreference(buildPageLayoutKey(scope), JSON.stringify(defaultState));
    return defaultState;
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
