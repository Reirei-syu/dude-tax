import {
  buildDefaultTaxPolicySettings,
  isSameTaxPolicySettings,
  normalizeTaxPolicySettings,
  type TaxPolicyResponse,
  type TaxPolicySaveResponse,
  type TaxPolicySettingsInput,
  type TaxPolicyUpdatePayload,
} from "../../../../packages/core/src/index.js";
import { database } from "../db/database.js";
import { annualTaxResultRepository } from "./annual-tax-result-repository.js";
import { calculationRunRepository } from "./calculation-run-repository.js";

const TAX_POLICY_SETTINGS_KEY = "tax_policy_settings";
const TAX_POLICY_MAINTENANCE_NOTES_KEY = "tax_policy_maintenance_notes";
const DEFAULT_TAX_POLICY_MAINTENANCE_NOTES = "";

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

const getStoredSettings = () => {
  const storedValue = getPreference(TAX_POLICY_SETTINGS_KEY);
  if (!storedValue) {
    return null;
  }

  try {
    return normalizeTaxPolicySettings(JSON.parse(storedValue) as TaxPolicySettingsInput);
  } catch {
    deletePreference(TAX_POLICY_SETTINGS_KEY);
    return null;
  }
};

const getStoredMaintenanceNotes = () => getPreference(TAX_POLICY_MAINTENANCE_NOTES_KEY);

const buildResponse = (): TaxPolicyResponse => {
  const defaultSettings = buildDefaultTaxPolicySettings();
  const storedSettings = getStoredSettings();
  const storedMaintenanceNotes = getStoredMaintenanceNotes();

  return {
    currentSettings: storedSettings ?? defaultSettings,
    defaultSettings,
    isCustomized: Boolean(storedSettings),
    currentNotes: storedMaintenanceNotes ?? DEFAULT_TAX_POLICY_MAINTENANCE_NOTES,
    defaultNotes: DEFAULT_TAX_POLICY_MAINTENANCE_NOTES,
    notesCustomized: Boolean(storedMaintenanceNotes),
  };
};

export const taxPolicyRepository = {
  get(): TaxPolicyResponse {
    return buildResponse();
  },
  save(payload: TaxPolicyUpdatePayload): TaxPolicySaveResponse {
    const currentResponse = buildResponse();
    const nextSettings = normalizeTaxPolicySettings(payload);
    const nextNotes = payload.maintenanceNotes?.trim() ?? DEFAULT_TAX_POLICY_MAINTENANCE_NOTES;
    const defaultSettings = buildDefaultTaxPolicySettings();
    const settingsChanged = !isSameTaxPolicySettings(currentResponse.currentSettings, nextSettings);
    const notesChanged = currentResponse.currentNotes !== nextNotes;

    if (!settingsChanged && !notesChanged) {
      return {
        ...currentResponse,
        invalidatedResults: false,
      };
    }

    const saveTransaction = database.transaction(() => {
      if (isSameTaxPolicySettings(defaultSettings, nextSettings)) {
        deletePreference(TAX_POLICY_SETTINGS_KEY);
      } else {
        setPreference(TAX_POLICY_SETTINGS_KEY, JSON.stringify(nextSettings));
      }

      if (nextNotes === DEFAULT_TAX_POLICY_MAINTENANCE_NOTES) {
        deletePreference(TAX_POLICY_MAINTENANCE_NOTES_KEY);
      } else {
        setPreference(TAX_POLICY_MAINTENANCE_NOTES_KEY, nextNotes);
      }

      if (settingsChanged) {
        annualTaxResultRepository.deleteAll();
        calculationRunRepository.deleteAll();
      }
    });

    saveTransaction();

    return {
      ...buildResponse(),
      invalidatedResults: settingsChanged,
    };
  },
};
