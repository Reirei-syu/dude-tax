import { DEFAULT_TAX_YEAR } from "../../../../packages/config/src/index.js";
import type { AppContext } from "../../../../packages/core/src/index.js";
import { database } from "../db/database.js";
import { unitRepository } from "./unit-repository.js";

const CURRENT_UNIT_KEY = "current_unit_id";
const CURRENT_YEAR_KEY = "current_tax_year";

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

const getCurrentUnitId = (): number | null => {
  const storedValue = getPreference(CURRENT_UNIT_KEY);
  const units = unitRepository.list();

  if (!storedValue) {
    const firstUnit = units[0];
    if (!firstUnit) {
      return null;
    }

    setPreference(CURRENT_UNIT_KEY, String(firstUnit.id));
    return firstUnit.id;
  }

  const unitId = Number(storedValue);
  const unitExists = units.some((unit) => unit.id === unitId);

  if (!unitExists) {
    const firstUnit = units[0];
    if (!firstUnit) {
      return null;
    }

    setPreference(CURRENT_UNIT_KEY, String(firstUnit.id));
    return firstUnit.id;
  }

  return unitId;
};

const getCurrentTaxYear = () => {
  const storedValue = getPreference(CURRENT_YEAR_KEY);
  if (!storedValue) {
    setPreference(CURRENT_YEAR_KEY, String(DEFAULT_TAX_YEAR));
    return DEFAULT_TAX_YEAR;
  }

  return Number(storedValue);
};

export const contextRepository = {
  get(): AppContext {
    return {
      currentUnitId: getCurrentUnitId(),
      currentTaxYear: getCurrentTaxYear(),
      units: unitRepository.list(),
    };
  },
  setCurrentUnitId(unitId: number | null) {
    if (unitId === null) {
      database.prepare("DELETE FROM app_preferences WHERE key = ?").run(CURRENT_UNIT_KEY);
      return;
    }

    setPreference(CURRENT_UNIT_KEY, String(unitId));
  },
  setCurrentTaxYear(taxYear: number) {
    setPreference(CURRENT_YEAR_KEY, String(taxYear));
  },
};
