import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NavigationModulePath, WorkspaceLayoutState, WorkspacePageScope } from "@dude-tax/core";

type DefaultUiPreferencesSeed = {
  sidebarCollapsed: boolean;
  navigationOrder: NavigationModulePath[];
  pageLayouts: Partial<Record<WorkspacePageScope, WorkspaceLayoutState>>;
};

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const defaultUiPreferencesPath = path.join(currentDir, "default-ui-preferences.json");

const EMPTY_DEFAULT_UI_PREFERENCES: DefaultUiPreferencesSeed = {
  sidebarCollapsed: false,
  navigationOrder: [],
  pageLayouts: {},
};

let cachedDefaultUiPreferences: DefaultUiPreferencesSeed | null = null;

const cloneSeed = (seed: DefaultUiPreferencesSeed): DefaultUiPreferencesSeed =>
  JSON.parse(JSON.stringify(seed)) as DefaultUiPreferencesSeed;

export const getDefaultUiPreferences = (): DefaultUiPreferencesSeed => {
  if (cachedDefaultUiPreferences) {
    return cloneSeed(cachedDefaultUiPreferences);
  }

  try {
    const parsed = JSON.parse(
      fs.readFileSync(defaultUiPreferencesPath, "utf8"),
    ) as DefaultUiPreferencesSeed;
    cachedDefaultUiPreferences = parsed;
    return cloneSeed(parsed);
  } catch {
    cachedDefaultUiPreferences = EMPTY_DEFAULT_UI_PREFERENCES;
    return cloneSeed(EMPTY_DEFAULT_UI_PREFERENCES);
  }
};
