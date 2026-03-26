import {
  buildDefaultTaxPolicySettings,
  isSameTaxPolicySettings,
  normalizeTaxPolicySettings,
  type TaxPolicyResponse,
  type TaxPolicySaveResponse,
  type TaxPolicySettingsInput,
} from "../../../../packages/core/src/index.js";
import { database } from "../db/database.js";
import { annualTaxResultRepository } from "./annual-tax-result-repository.js";
import { calculationRunRepository } from "./calculation-run-repository.js";

const TAX_POLICY_SETTINGS_KEY = "tax_policy_settings";

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

const buildResponse = (): TaxPolicyResponse => {
  const defaultSettings = buildDefaultTaxPolicySettings();
  const storedSettings = getStoredSettings();

  return {
    currentSettings: storedSettings ?? defaultSettings,
    defaultSettings,
    isCustomized: Boolean(storedSettings),
  };
};

export const taxPolicyRepository = {
  get(): TaxPolicyResponse {
    return buildResponse();
  },
  save(settings: TaxPolicySettingsInput): TaxPolicySaveResponse {
    const currentResponse = buildResponse();
    const nextSettings = normalizeTaxPolicySettings(settings);
    const defaultSettings = buildDefaultTaxPolicySettings();

    if (isSameTaxPolicySettings(currentResponse.currentSettings, nextSettings)) {
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

      annualTaxResultRepository.deleteAll();
      calculationRunRepository.deleteAll();
    });

    saveTransaction();

    return {
      ...buildResponse(),
      invalidatedResults: true,
    };
  },
};
