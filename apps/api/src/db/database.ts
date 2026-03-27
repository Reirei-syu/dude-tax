import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildDefaultTaxPolicySettings,
  buildTaxPolicySignature,
  normalizeTaxPolicySettings,
  type TaxPolicySettingsInput,
} from "../../../../packages/core/src/index.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "../../../../");
const dataDir = path.join(repoRoot, "data");
const ACTIVE_TAX_POLICY_VERSION_ID_KEY = "active_tax_policy_version_id";
const databaseFile = process.env.DUDE_TAX_DB_PATH
  ? path.resolve(process.env.DUDE_TAX_DB_PATH)
  : path.join(dataDir, "dude-tax.db");

fs.mkdirSync(path.dirname(databaseFile), { recursive: true });

export const database = new Database(databaseFile);

database.pragma("journal_mode = WAL");
database.pragma("foreign_keys = ON");

const ensureColumnExists = (tableName: string, columnName: string, columnSql: string) => {
  const columns = database
    .prepare(`PRAGMA table_info(${tableName})`)
    .all() as Array<{ name: string }>;

  if (!columns.some((column) => column.name === columnName)) {
    database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnSql}`);
  }
};

database.exec(`
  CREATE TABLE IF NOT EXISTS units (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unit_name TEXT NOT NULL UNIQUE,
    remark TEXT DEFAULT '',
    is_archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS app_preferences (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tax_policy_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version_name TEXT NOT NULL,
    policy_signature TEXT NOT NULL UNIQUE,
    settings_json TEXT NOT NULL,
    maintenance_notes TEXT NOT NULL DEFAULT '',
    is_active INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    activated_at TEXT DEFAULT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tax_policy_scopes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scope_type TEXT NOT NULL,
    unit_id INTEGER NOT NULL,
    tax_year INTEGER NOT NULL,
    tax_policy_version_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(unit_id) REFERENCES units(id) ON DELETE CASCADE,
    FOREIGN KEY(tax_policy_version_id) REFERENCES tax_policy_versions(id) ON DELETE CASCADE,
    UNIQUE(scope_type, unit_id, tax_year)
  );

  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unit_id INTEGER NOT NULL,
    employee_code TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    id_number TEXT NOT NULL,
    hire_date TEXT DEFAULT NULL,
    leave_date TEXT DEFAULT NULL,
    remark TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(unit_id) REFERENCES units(id) ON DELETE CASCADE,
    UNIQUE(unit_id, employee_code),
    UNIQUE(unit_id, id_number)
  );

  CREATE TABLE IF NOT EXISTS employee_month_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unit_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    tax_year INTEGER NOT NULL,
    tax_month INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'incomplete',
    salary_income REAL NOT NULL DEFAULT 0,
    annual_bonus REAL NOT NULL DEFAULT 0,
    pension_insurance REAL NOT NULL DEFAULT 0,
    medical_insurance REAL NOT NULL DEFAULT 0,
    occupational_annuity REAL NOT NULL DEFAULT 0,
    housing_fund REAL NOT NULL DEFAULT 0,
    supplementary_housing_fund REAL NOT NULL DEFAULT 0,
    unemployment_insurance REAL NOT NULL DEFAULT 0,
    work_injury_insurance REAL NOT NULL DEFAULT 0,
    withheld_tax REAL NOT NULL DEFAULT 0,
    infant_care_deduction REAL NOT NULL DEFAULT 0,
    child_education_deduction REAL NOT NULL DEFAULT 0,
    continuing_education_deduction REAL NOT NULL DEFAULT 0,
    housing_loan_interest_deduction REAL NOT NULL DEFAULT 0,
    housing_rent_deduction REAL NOT NULL DEFAULT 0,
    elder_care_deduction REAL NOT NULL DEFAULT 0,
    other_deduction REAL NOT NULL DEFAULT 0,
    tax_reduction_exemption REAL NOT NULL DEFAULT 0,
    remark TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(unit_id) REFERENCES units(id) ON DELETE CASCADE,
    FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    UNIQUE(unit_id, employee_id, tax_year, tax_month)
  );

  CREATE TABLE IF NOT EXISTS annual_calculation_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unit_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    tax_year INTEGER NOT NULL,
    last_status TEXT NOT NULL,
    policy_signature TEXT NOT NULL DEFAULT '',
    last_calculated_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(unit_id) REFERENCES units(id) ON DELETE CASCADE,
    FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    UNIQUE(unit_id, employee_id, tax_year)
  );

  CREATE TABLE IF NOT EXISTS annual_tax_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unit_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    tax_year INTEGER NOT NULL,
    selected_scheme TEXT NOT NULL,
    selected_tax_amount REAL NOT NULL DEFAULT 0,
    policy_signature TEXT NOT NULL DEFAULT '',
    calculation_snapshot TEXT NOT NULL,
    calculated_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(unit_id) REFERENCES units(id) ON DELETE CASCADE,
    FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    UNIQUE(unit_id, employee_id, tax_year)
  );
`);

ensureColumnExists(
  "employee_month_records",
  "withheld_tax",
  "withheld_tax REAL NOT NULL DEFAULT 0",
);

ensureColumnExists(
  "annual_calculation_runs",
  "policy_signature",
  "policy_signature TEXT NOT NULL DEFAULT ''",
);

ensureColumnExists(
  "annual_tax_results",
  "policy_signature",
  "policy_signature TEXT NOT NULL DEFAULT ''",
);

const getPreference = (key: string) =>
  (
    database
      .prepare("SELECT value FROM app_preferences WHERE key = ?")
      .get(key) as { value: string } | undefined
  )?.value ?? null;

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

const getLegacyStoredSettings = () => {
  const storedValue = getPreference("tax_policy_settings");

  if (!storedValue) {
    return buildTaxPolicySignature(buildDefaultTaxPolicySettings());
  }

  try {
    return buildTaxPolicySignature(
      normalizeTaxPolicySettings(JSON.parse(storedValue) as TaxPolicySettingsInput),
    );
  } catch {
    return buildTaxPolicySignature(buildDefaultTaxPolicySettings());
  }
};

const getLegacyInitialSettings = () => {
  const storedValue = getPreference("tax_policy_settings");
  if (!storedValue) {
    return buildDefaultTaxPolicySettings();
  }

  try {
    return normalizeTaxPolicySettings(JSON.parse(storedValue) as TaxPolicySettingsInput);
  } catch {
    return buildDefaultTaxPolicySettings();
  }
};

const getLegacyInitialNotes = () => getPreference("tax_policy_maintenance_notes") ?? "";

const ensureActiveTaxPolicyVersion = () => {
  const versionCount = Number(
    (
      database
        .prepare("SELECT COUNT(*) AS total FROM tax_policy_versions")
        .get() as { total: number }
    ).total,
  );

  if (versionCount === 0) {
    const initialSettings = getLegacyInitialSettings();
    const initialNotes = getLegacyInitialNotes();
    const now = new Date().toISOString();
    const insertResult = database
      .prepare(
        `
          INSERT INTO tax_policy_versions (
            version_name,
            policy_signature,
            settings_json,
            maintenance_notes,
            is_active,
            created_at,
            activated_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, 1, ?, ?, ?)
        `,
      )
      .run(
        "初始税率版本",
        buildTaxPolicySignature(initialSettings),
        JSON.stringify(initialSettings),
        initialNotes,
        now,
        now,
        now,
      );

    setPreference(ACTIVE_TAX_POLICY_VERSION_ID_KEY, String(insertResult.lastInsertRowid));
    return;
  }

  const preferredActiveId = Number(getPreference(ACTIVE_TAX_POLICY_VERSION_ID_KEY) ?? 0);
  const existingActiveRow =
    preferredActiveId > 0
      ? (database
          .prepare("SELECT id FROM tax_policy_versions WHERE id = ?")
          .get(preferredActiveId) as { id: number } | undefined)
      : undefined;

  const activeRow =
    existingActiveRow ??
    (database
      .prepare(
        `
          SELECT id
          FROM tax_policy_versions
          WHERE is_active = 1
          ORDER BY activated_at DESC, created_at DESC, id DESC
          LIMIT 1
        `,
      )
      .get() as { id: number } | undefined) ??
    (database
      .prepare(
        `
          SELECT id
          FROM tax_policy_versions
          ORDER BY created_at DESC, id DESC
          LIMIT 1
        `,
      )
      .get() as { id: number } | undefined);

  if (!activeRow) {
    return;
  }

  const now = new Date().toISOString();
  const syncTransaction = database.transaction(() => {
    database.prepare("UPDATE tax_policy_versions SET is_active = 0").run();
    database
      .prepare(
        `
          UPDATE tax_policy_versions
          SET is_active = 1,
              activated_at = COALESCE(activated_at, ?),
              updated_at = ?
          WHERE id = ?
        `,
      )
      .run(now, now, activeRow.id);
    setPreference(ACTIVE_TAX_POLICY_VERSION_ID_KEY, String(activeRow.id));
  });

  syncTransaction();
};

ensureActiveTaxPolicyVersion();

const getCurrentPolicySignature = () => {
  const activeVersion = database
    .prepare(
      `
        SELECT settings_json
        FROM tax_policy_versions
        WHERE is_active = 1
        ORDER BY activated_at DESC, created_at DESC, id DESC
        LIMIT 1
      `,
    )
    .get() as { settings_json: string } | undefined;

  if (!activeVersion?.settings_json) {
    return getLegacyStoredSettings();
  }

  try {
    return buildTaxPolicySignature(
      normalizeTaxPolicySettings(JSON.parse(activeVersion.settings_json) as TaxPolicySettingsInput),
    );
  } catch {
    return getLegacyStoredSettings();
  }
};

const backfillPolicySignature = (tableName: "annual_calculation_runs" | "annual_tax_results") => {
  const currentPolicySignature = getCurrentPolicySignature();
  database
    .prepare(`UPDATE ${tableName} SET policy_signature = ? WHERE policy_signature = ''`)
    .run(currentPolicySignature);
};

backfillPolicySignature("annual_calculation_runs");
backfillPolicySignature("annual_tax_results");

export const closeDatabase = () => {
  database.close();
};
