import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildDefaultTaxPolicySettings,
  buildTaxPolicySignature,
  normalizeTaxPolicySettings,
  type TaxPolicySettingsInput,
} from "@dude-tax/core";
import { getDefaultPolicyContentJson } from "../default-policy-content.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const ACTIVE_TAX_POLICY_VERSION_ID_KEY = "active_tax_policy_version_id";
const fallbackDataDir =
  process.platform === "win32"
    ? path.join(
        process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming"),
        "dude-tax",
        "data",
      )
    : path.join(os.homedir(), ".dude-tax", "data");
const databaseFile = process.env.DUDE_TAX_DB_PATH
  ? path.resolve(process.env.DUDE_TAX_DB_PATH)
  : path.join(fallbackDataDir, "dude-tax.db");

fs.mkdirSync(path.dirname(databaseFile), { recursive: true });

export const database = new Database(databaseFile);

database.pragma("journal_mode = WAL");
database.pragma("foreign_keys = ON");

const DEFAULT_SEEDED_UNIT_YEAR = new Date().getFullYear();

const ensureColumnExists = (tableName: string, columnName: string, columnSql: string) => {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
    name: string;
  }>;

  if (!columns.some((column) => column.name === columnName)) {
    database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnSql}`);
  }
};

const employeeMonthRecordAmountColumns = [
  "salary_income",
  "annual_bonus",
  "pension_insurance",
  "medical_insurance",
  "occupational_annuity",
  "housing_fund",
  "supplementary_housing_fund",
  "unemployment_insurance",
  "work_injury_insurance",
  "withheld_tax",
  "supplementary_salary_income",
  "supplementary_withheld_tax_adjustment",
  "infant_care_deduction",
  "child_education_deduction",
  "continuing_education_deduction",
  "housing_loan_interest_deduction",
  "housing_rent_deduction",
  "elder_care_deduction",
  "other_deduction",
  "tax_reduction_exemption",
] as const;

const employeeMonthRecordCopyColumns = [
  "id",
  "unit_id",
  "employee_id",
  "tax_year",
  "tax_month",
  "status",
  "salary_income",
  "annual_bonus",
  "pension_insurance",
  "medical_insurance",
  "occupational_annuity",
  "housing_fund",
  "supplementary_housing_fund",
  "unemployment_insurance",
  "work_injury_insurance",
  "withheld_tax",
  "supplementary_salary_income",
  "supplementary_withheld_tax_adjustment",
  "supplementary_source_period_label",
  "supplementary_remark",
  "infant_care_deduction",
  "child_education_deduction",
  "continuing_education_deduction",
  "housing_loan_interest_deduction",
  "housing_rent_deduction",
  "elder_care_deduction",
  "other_deduction",
  "tax_reduction_exemption",
  "remark",
  "created_at",
  "updated_at",
] as const;

const annualCalculationRunCopyColumns = [
  "id",
  "unit_id",
  "employee_id",
  "tax_year",
  "last_status",
  "policy_signature",
  "data_signature",
  "last_calculated_at",
  "updated_at",
] as const;

const annualTaxResultCopyColumns = [
  "id",
  "unit_id",
  "employee_id",
  "tax_year",
  "selected_scheme",
  "selected_tax_amount",
  "policy_signature",
  "data_signature",
  "calculation_snapshot",
  "calculated_at",
  "updated_at",
] as const;

const annualTaxResultVersionCopyColumns = [
  "id",
  "unit_id",
  "employee_id",
  "tax_year",
  "version_sequence",
  "policy_signature",
  "data_signature",
  "selected_scheme",
  "selected_tax_amount",
  "calculation_snapshot",
  "created_at",
] as const;

const buildEmployeeMonthRecordsTableSql = (tableName = "employee_month_records") => `
  CREATE TABLE IF NOT EXISTS ${tableName} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unit_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    tax_year INTEGER NOT NULL CHECK(tax_year >= 2000),
    tax_month INTEGER NOT NULL CHECK(tax_month BETWEEN 1 AND 12),
    status TEXT NOT NULL DEFAULT 'incomplete' CHECK(status IN ('incomplete', 'completed')),
    salary_income REAL NOT NULL DEFAULT 0 CHECK(salary_income >= 0),
    annual_bonus REAL NOT NULL DEFAULT 0 CHECK(annual_bonus >= 0),
    pension_insurance REAL NOT NULL DEFAULT 0 CHECK(pension_insurance >= 0),
    medical_insurance REAL NOT NULL DEFAULT 0 CHECK(medical_insurance >= 0),
    occupational_annuity REAL NOT NULL DEFAULT 0 CHECK(occupational_annuity >= 0),
    housing_fund REAL NOT NULL DEFAULT 0 CHECK(housing_fund >= 0),
    supplementary_housing_fund REAL NOT NULL DEFAULT 0 CHECK(supplementary_housing_fund >= 0),
    unemployment_insurance REAL NOT NULL DEFAULT 0 CHECK(unemployment_insurance >= 0),
    work_injury_insurance REAL NOT NULL DEFAULT 0 CHECK(work_injury_insurance >= 0),
    withheld_tax REAL NOT NULL DEFAULT 0 CHECK(withheld_tax >= 0),
    supplementary_salary_income REAL NOT NULL DEFAULT 0 CHECK(supplementary_salary_income >= 0),
    supplementary_withheld_tax_adjustment REAL NOT NULL DEFAULT 0 CHECK(supplementary_withheld_tax_adjustment >= 0),
    supplementary_source_period_label TEXT DEFAULT '',
    supplementary_remark TEXT DEFAULT '',
    infant_care_deduction REAL NOT NULL DEFAULT 0 CHECK(infant_care_deduction >= 0),
    child_education_deduction REAL NOT NULL DEFAULT 0 CHECK(child_education_deduction >= 0),
    continuing_education_deduction REAL NOT NULL DEFAULT 0 CHECK(continuing_education_deduction >= 0),
    housing_loan_interest_deduction REAL NOT NULL DEFAULT 0 CHECK(housing_loan_interest_deduction >= 0),
    housing_rent_deduction REAL NOT NULL DEFAULT 0 CHECK(housing_rent_deduction >= 0),
    elder_care_deduction REAL NOT NULL DEFAULT 0 CHECK(elder_care_deduction >= 0),
    other_deduction REAL NOT NULL DEFAULT 0 CHECK(other_deduction >= 0),
    tax_reduction_exemption REAL NOT NULL DEFAULT 0 CHECK(tax_reduction_exemption >= 0),
    remark TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(unit_id) REFERENCES units(id) ON DELETE CASCADE,
    FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    UNIQUE(unit_id, employee_id, tax_year, tax_month)
  );
`;

const buildAnnualCalculationRunsTableSql = (tableName = "annual_calculation_runs") => `
  CREATE TABLE IF NOT EXISTS ${tableName} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unit_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    tax_year INTEGER NOT NULL CHECK(tax_year >= 2000),
    last_status TEXT NOT NULL CHECK(last_status IN ('not_started', 'draft', 'ready')),
    policy_signature TEXT NOT NULL DEFAULT '',
    data_signature TEXT NOT NULL DEFAULT '',
    last_calculated_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(unit_id) REFERENCES units(id) ON DELETE CASCADE,
    FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    UNIQUE(unit_id, employee_id, tax_year)
  );
`;

const buildAnnualTaxResultsTableSql = (tableName = "annual_tax_results") => `
  CREATE TABLE IF NOT EXISTS ${tableName} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unit_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    tax_year INTEGER NOT NULL CHECK(tax_year >= 2000),
    selected_scheme TEXT NOT NULL CHECK(selected_scheme IN ('separate_bonus', 'combined_bonus')),
    selected_tax_amount REAL NOT NULL DEFAULT 0 CHECK(selected_tax_amount >= 0),
    policy_signature TEXT NOT NULL DEFAULT '',
    data_signature TEXT NOT NULL DEFAULT '',
    calculation_snapshot TEXT NOT NULL,
    calculated_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(unit_id) REFERENCES units(id) ON DELETE CASCADE,
    FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    UNIQUE(unit_id, employee_id, tax_year)
  );
`;

const buildAnnualTaxResultVersionsTableSql = (tableName = "annual_tax_result_versions") => `
  CREATE TABLE IF NOT EXISTS ${tableName} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unit_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    tax_year INTEGER NOT NULL CHECK(tax_year >= 2000),
    version_sequence INTEGER NOT NULL CHECK(version_sequence >= 1),
    policy_signature TEXT NOT NULL DEFAULT '',
    data_signature TEXT NOT NULL DEFAULT '',
    selected_scheme TEXT NOT NULL CHECK(selected_scheme IN ('separate_bonus', 'combined_bonus')),
    selected_tax_amount REAL NOT NULL DEFAULT 0 CHECK(selected_tax_amount >= 0),
    calculation_snapshot TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(unit_id) REFERENCES units(id) ON DELETE CASCADE,
    FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE
  );
`;

const annualTaxResultVersionsIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_annual_tax_result_versions_scope
    ON annual_tax_result_versions (unit_id, employee_id, tax_year, version_sequence DESC, id DESC);
`;

const getTableSql = (tableName: string) =>
  (
    database
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(tableName) as { sql: string } | undefined
  )?.sql ?? null;

const getInvalidRowCount = (validationSql: string) =>
  Number((database.prepare(validationSql).get() as { total: number }).total);

const shouldRebuildTableWithChecks = (tableName: string, markers: string[]) => {
  const tableSql = getTableSql(tableName);

  if (!tableSql) {
    return false;
  }

  return markers.some((marker) => !tableSql.includes(marker));
};

type TableConstraintMigration = {
  tableName: string;
  buildCreateSql: (tableName: string) => string;
  markers: string[];
  copyColumns: readonly string[];
  validationSql: string;
  invalidDataMessage: (invalidCount: number) => string;
  indexSqls?: string[];
};

const rebuildTableWithChecks = ({
  tableName,
  buildCreateSql,
  markers,
  copyColumns,
  validationSql,
  invalidDataMessage,
  indexSqls = [],
}: TableConstraintMigration) => {
  if (!shouldRebuildTableWithChecks(tableName, markers)) {
    return;
  }

  const invalidRowCount = getInvalidRowCount(validationSql);
  if (invalidRowCount > 0) {
    throw new Error(invalidDataMessage(invalidRowCount));
  }

  const tempTableName = `${tableName}__next`;
  const createTempTableSql = buildCreateSql(tempTableName).replace(
    "CREATE TABLE IF NOT EXISTS",
    "CREATE TABLE",
  );
  const selectedColumns = copyColumns.join(", ");

  const rebuildTransaction = database.transaction(() => {
    database.exec(`DROP TABLE IF EXISTS ${tempTableName}`);
    database.exec(createTempTableSql);
    database.exec(
      `INSERT INTO ${tempTableName} (${selectedColumns}) SELECT ${selectedColumns} FROM ${tableName}`,
    );
    database.exec(`DROP TABLE ${tableName}`);
    database.exec(`ALTER TABLE ${tempTableName} RENAME TO ${tableName}`);
    indexSqls.forEach((indexSql) => {
      database.exec(indexSql);
    });
  });

  rebuildTransaction();
};

const employeeMonthRecordConstraintMarkers = [
  "CHECK(tax_year >= 2000)",
  "CHECK(tax_month BETWEEN 1 AND 12)",
  "CHECK(status IN ('incomplete', 'completed'))",
  ...employeeMonthRecordAmountColumns.map((columnName) => `CHECK(${columnName} >= 0)`),
];

const migrateEmployeeMonthRecordsWithChecks = () =>
  rebuildTableWithChecks({
    tableName: "employee_month_records",
    buildCreateSql: buildEmployeeMonthRecordsTableSql,
    markers: employeeMonthRecordConstraintMarkers,
    copyColumns: employeeMonthRecordCopyColumns,
    validationSql: `
      SELECT COUNT(*) AS total
      FROM employee_month_records
      WHERE tax_year < 2000
        OR tax_month < 1
        OR tax_month > 12
        OR status NOT IN ('incomplete', 'completed')
        OR ${employeeMonthRecordAmountColumns.map((columnName) => `${columnName} < 0`).join(" OR ")}
    `,
    invalidDataMessage: (invalidCount) =>
      `数据库迁移失败：employee_month_records 中存在 ${invalidCount} 条不满足新约束的旧数据，请先清理后再启动。`,
  });

const migrateAnnualCalculationRunsWithChecks = () =>
  rebuildTableWithChecks({
    tableName: "annual_calculation_runs",
    buildCreateSql: buildAnnualCalculationRunsTableSql,
    markers: ["CHECK(tax_year >= 2000)", "CHECK(last_status IN ('not_started', 'draft', 'ready'))"],
    copyColumns: annualCalculationRunCopyColumns,
    validationSql: `
      SELECT COUNT(*) AS total
      FROM annual_calculation_runs
      WHERE tax_year < 2000
        OR last_status NOT IN ('not_started', 'draft', 'ready')
    `,
    invalidDataMessage: (invalidCount) =>
      `数据库迁移失败：annual_calculation_runs 中存在 ${invalidCount} 条不满足新约束的旧数据，请先清理后再启动。`,
  });

const migrateAnnualTaxResultsWithChecks = () =>
  rebuildTableWithChecks({
    tableName: "annual_tax_results",
    buildCreateSql: buildAnnualTaxResultsTableSql,
    markers: [
      "CHECK(tax_year >= 2000)",
      "CHECK(selected_scheme IN ('separate_bonus', 'combined_bonus'))",
      "CHECK(selected_tax_amount >= 0)",
    ],
    copyColumns: annualTaxResultCopyColumns,
    validationSql: `
      SELECT COUNT(*) AS total
      FROM annual_tax_results
      WHERE tax_year < 2000
        OR selected_scheme NOT IN ('separate_bonus', 'combined_bonus')
        OR selected_tax_amount < 0
    `,
    invalidDataMessage: (invalidCount) =>
      `数据库迁移失败：annual_tax_results 中存在 ${invalidCount} 条不满足新约束的旧数据，请先清理后再启动。`,
  });

const migrateAnnualTaxResultVersionsWithChecks = () =>
  rebuildTableWithChecks({
    tableName: "annual_tax_result_versions",
    buildCreateSql: buildAnnualTaxResultVersionsTableSql,
    markers: [
      "CHECK(tax_year >= 2000)",
      "CHECK(version_sequence >= 1)",
      "CHECK(selected_scheme IN ('separate_bonus', 'combined_bonus'))",
      "CHECK(selected_tax_amount >= 0)",
    ],
    copyColumns: annualTaxResultVersionCopyColumns,
    validationSql: `
      SELECT COUNT(*) AS total
      FROM annual_tax_result_versions
      WHERE tax_year < 2000
        OR version_sequence < 1
        OR selected_scheme NOT IN ('separate_bonus', 'combined_bonus')
        OR selected_tax_amount < 0
    `,
    invalidDataMessage: (invalidCount) =>
      `数据库迁移失败：annual_tax_result_versions 中存在 ${invalidCount} 条不满足新约束的旧数据，请先清理后再启动。`,
    indexSqls: [annualTaxResultVersionsIndexSql],
  });

database.exec(`
  CREATE TABLE IF NOT EXISTS units (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unit_name TEXT NOT NULL UNIQUE,
    remark TEXT DEFAULT '',
    is_archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS unit_years (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unit_id INTEGER NOT NULL,
    tax_year INTEGER NOT NULL CHECK(tax_year >= 1900),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(unit_id) REFERENCES units(id) ON DELETE CASCADE,
    UNIQUE(unit_id, tax_year)
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

  ${buildEmployeeMonthRecordsTableSql()}

  CREATE TABLE IF NOT EXISTS month_confirmations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unit_id INTEGER NOT NULL,
    tax_year INTEGER NOT NULL CHECK(tax_year >= 2000),
    tax_month INTEGER NOT NULL CHECK(tax_month BETWEEN 1 AND 12),
    confirmed_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(unit_id) REFERENCES units(id) ON DELETE CASCADE,
    UNIQUE(unit_id, tax_year, tax_month)
  );

  ${buildAnnualCalculationRunsTableSql()}

  ${buildAnnualTaxResultsTableSql()}

  ${buildAnnualTaxResultVersionsTableSql()}

  CREATE TABLE IF NOT EXISTS import_preview_summaries (
    unit_id INTEGER PRIMARY KEY,
    import_type TEXT NOT NULL,
    total_rows INTEGER NOT NULL DEFAULT 0,
    ready_rows INTEGER NOT NULL DEFAULT 0,
    conflict_rows INTEGER NOT NULL DEFAULT 0,
    error_rows INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(unit_id) REFERENCES units(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tax_policy_audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action_type TEXT NOT NULL,
    actor_label TEXT NOT NULL DEFAULT '本地用户',
    tax_policy_version_id INTEGER DEFAULT NULL,
    unit_id INTEGER DEFAULT NULL,
    tax_year INTEGER DEFAULT NULL,
    summary TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(tax_policy_version_id) REFERENCES tax_policy_versions(id) ON DELETE SET NULL,
    FOREIGN KEY(unit_id) REFERENCES units(id) ON DELETE SET NULL
  );
`);

database.exec(annualTaxResultVersionsIndexSql);

ensureColumnExists(
  "employee_month_records",
  "withheld_tax",
  "withheld_tax REAL NOT NULL DEFAULT 0",
);

ensureColumnExists(
  "employee_month_records",
  "supplementary_salary_income",
  "supplementary_salary_income REAL NOT NULL DEFAULT 0",
);

ensureColumnExists(
  "employee_month_records",
  "supplementary_withheld_tax_adjustment",
  "supplementary_withheld_tax_adjustment REAL NOT NULL DEFAULT 0",
);

ensureColumnExists(
  "employee_month_records",
  "supplementary_source_period_label",
  "supplementary_source_period_label TEXT DEFAULT ''",
);

ensureColumnExists(
  "employee_month_records",
  "supplementary_remark",
  "supplementary_remark TEXT DEFAULT ''",
);

ensureColumnExists(
  "annual_calculation_runs",
  "policy_signature",
  "policy_signature TEXT NOT NULL DEFAULT ''",
);

ensureColumnExists(
  "annual_calculation_runs",
  "data_signature",
  "data_signature TEXT NOT NULL DEFAULT ''",
);

ensureColumnExists(
  "annual_tax_results",
  "policy_signature",
  "policy_signature TEXT NOT NULL DEFAULT ''",
);

ensureColumnExists(
  "annual_tax_results",
  "data_signature",
  "data_signature TEXT NOT NULL DEFAULT ''",
);

ensureColumnExists(
  "annual_tax_result_versions",
  "data_signature",
  "data_signature TEXT NOT NULL DEFAULT ''",
);

migrateEmployeeMonthRecordsWithChecks();
migrateAnnualCalculationRunsWithChecks();
migrateAnnualTaxResultsWithChecks();
migrateAnnualTaxResultVersionsWithChecks();

const getPreference = (key: string) =>
  (
    database.prepare("SELECT value FROM app_preferences WHERE key = ?").get(key) as
      | { value: string }
      | undefined
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

const getLegacyInitialNotes = () => {
  const storedValue = getPreference("tax_policy_maintenance_notes");
  if (storedValue?.trim()) {
    return storedValue;
  }

  return getDefaultPolicyContentJson();
};

const ensureActiveTaxPolicyVersion = () => {
  const versionCount = Number(
    (
      database.prepare("SELECT COUNT(*) AS total FROM tax_policy_versions").get() as {
        total: number;
      }
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

const ensureUnitYearsSeeded = () => {
  const units = database.prepare("SELECT id FROM units ORDER BY id ASC").all() as Array<{
    id: number;
  }>;

  const insertStatement = database.prepare(
    `
      INSERT OR IGNORE INTO unit_years (unit_id, tax_year, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `,
  );

  const collectCandidateYears = (unitId: number) => {
    const years = new Set<number>();
    const sources = [
      "SELECT DISTINCT tax_year FROM employee_month_records WHERE unit_id = ?",
      "SELECT DISTINCT tax_year FROM annual_calculation_runs WHERE unit_id = ?",
      "SELECT DISTINCT tax_year FROM annual_tax_results WHERE unit_id = ?",
      "SELECT DISTINCT tax_year FROM annual_tax_result_versions WHERE unit_id = ?",
      "SELECT DISTINCT tax_year FROM tax_policy_scopes WHERE unit_id = ?",
    ];

    sources.forEach((sql) => {
      const rows = database.prepare(sql).all(unitId) as Array<{ tax_year: number }>;
      rows.forEach((row) => {
        if (Number.isInteger(row.tax_year)) {
          years.add(Number(row.tax_year));
        }
      });
    });

    return years;
  };

  const seedTransaction = database.transaction(() => {
    units.forEach((unit) => {
      const existingCount = Number(
        (
          database
            .prepare("SELECT COUNT(*) AS total FROM unit_years WHERE unit_id = ?")
            .get(unit.id) as { total: number }
        ).total,
      );

      if (existingCount > 0) {
        return;
      }

      const now = new Date().toISOString();
      const candidateYears = Array.from(collectCandidateYears(unit.id)).sort(
        (left, right) => left - right,
      );
      const yearsToSeed = candidateYears.length ? candidateYears : [DEFAULT_SEEDED_UNIT_YEAR];

      yearsToSeed.forEach((taxYear) => {
        insertStatement.run(unit.id, taxYear, now, now);
      });
    });
  });

  seedTransaction();
};

ensureUnitYearsSeeded();

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
