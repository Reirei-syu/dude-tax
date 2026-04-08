import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, test } from "node:test";
import Database from "better-sqlite3";

const testDatabasePath = path.join(process.cwd(), "data", "test", "db-constraints.test.db");
process.env.DUDE_TAX_DB_PATH = testDatabasePath;

let modulesPromise: Promise<
  [
    typeof import("./repositories/unit-repository.js"),
    typeof import("./repositories/employee-repository.js"),
    typeof import("./db/database.js"),
  ]
>;

before(() => {
  fs.mkdirSync(path.dirname(testDatabasePath), { recursive: true });
  fs.rmSync(testDatabasePath, { force: true });

  const legacyDatabase = new Database(testDatabasePath);
  const now = new Date().toISOString();

  legacyDatabase.exec(`
    CREATE TABLE units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_name TEXT NOT NULL UNIQUE,
      remark TEXT DEFAULT '',
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE app_preferences (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE tax_policy_versions (
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

    CREATE TABLE employees (
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
      UNIQUE(unit_id, employee_code),
      UNIQUE(unit_id, id_number)
    );

    CREATE TABLE employee_month_records (
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
      supplementary_salary_income REAL NOT NULL DEFAULT 0,
      supplementary_withheld_tax_adjustment REAL NOT NULL DEFAULT 0,
      supplementary_source_period_label TEXT DEFAULT '',
      supplementary_remark TEXT DEFAULT '',
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
      UNIQUE(unit_id, employee_id, tax_year, tax_month)
    );

    CREATE TABLE annual_calculation_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id INTEGER NOT NULL,
      employee_id INTEGER NOT NULL,
      tax_year INTEGER NOT NULL,
      last_status TEXT NOT NULL,
      policy_signature TEXT NOT NULL DEFAULT '',
      data_signature TEXT NOT NULL DEFAULT '',
      last_calculated_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(unit_id, employee_id, tax_year)
    );

    CREATE TABLE annual_tax_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id INTEGER NOT NULL,
      employee_id INTEGER NOT NULL,
      tax_year INTEGER NOT NULL,
      selected_scheme TEXT NOT NULL,
      selected_tax_amount REAL NOT NULL DEFAULT 0,
      policy_signature TEXT NOT NULL DEFAULT '',
      data_signature TEXT NOT NULL DEFAULT '',
      calculation_snapshot TEXT NOT NULL,
      calculated_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(unit_id, employee_id, tax_year)
    );

    CREATE TABLE annual_tax_result_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id INTEGER NOT NULL,
      employee_id INTEGER NOT NULL,
      tax_year INTEGER NOT NULL,
      version_sequence INTEGER NOT NULL,
      policy_signature TEXT NOT NULL DEFAULT '',
      data_signature TEXT NOT NULL DEFAULT '',
      selected_scheme TEXT NOT NULL,
      selected_tax_amount REAL NOT NULL DEFAULT 0,
      calculation_snapshot TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX idx_annual_tax_result_versions_scope
      ON annual_tax_result_versions (unit_id, employee_id, tax_year, version_sequence DESC, id DESC);
  `);

  legacyDatabase
    .prepare(
      `
        INSERT INTO units (id, unit_name, remark, is_archived, created_at, updated_at)
        VALUES (1, '迁移测试单位', '', 0, ?, ?)
      `,
    )
    .run(now, now);
  legacyDatabase
    .prepare(
      `
        INSERT INTO employees (
          id,
          unit_id,
          employee_code,
          employee_name,
          id_number,
          hire_date,
          leave_date,
          remark,
          created_at,
          updated_at
        )
        VALUES (1, 1, 'EMP-LEGACY-001', '迁移测试员工', '110101199001014444', NULL, NULL, '', ?, ?)
      `,
    )
    .run(now, now);
  legacyDatabase
    .prepare(
      `
        INSERT INTO employee_month_records (
          unit_id,
          employee_id,
          tax_year,
          tax_month,
          status,
          salary_income,
          withheld_tax,
          created_at,
          updated_at
        )
        VALUES (1, 1, 2026, 1, 'completed', 10000, 100, ?, ?)
      `,
    )
    .run(now, now);

  legacyDatabase.close();

  modulesPromise = Promise.all([
    import("./repositories/unit-repository.js"),
    import("./repositories/employee-repository.js"),
    import("./db/database.js"),
  ]);
});

after(async () => {
  const [, , { closeDatabase }] = await modulesPromise;
  closeDatabase();
  fs.rmSync(testDatabasePath, { force: true });
});

test("legacy employee_month_records table migrates and preserves valid rows", async () => {
  const [, , { database }] = await modulesPromise;
  const row = database
    .prepare(
      `
        SELECT tax_year, tax_month, status, salary_income, withheld_tax
        FROM employee_month_records
        WHERE unit_id = 1 AND employee_id = 1 AND tax_year = 2026 AND tax_month = 1
      `,
    )
    .get() as Record<string, unknown> | undefined;

  assert.ok(row);
  assert.equal(row?.tax_year, 2026);
  assert.equal(row?.tax_month, 1);
  assert.equal(row?.status, "completed");
  assert.equal(row?.salary_income, 10_000);
  assert.equal(row?.withheld_tax, 100);
});

test("sqlite CHECK constraints reject invalid month record and result writes", async () => {
  const [, , { database }] = await modulesPromise;
  const now = new Date().toISOString();

  assert.throws(
    () =>
      database
        .prepare(
          `
            INSERT INTO employee_month_records (
              unit_id,
              employee_id,
              tax_year,
              tax_month,
              status,
              created_at,
              updated_at
            )
            VALUES (1, 1, 2026, 13, 'completed', ?, ?)
          `,
        )
        .run(now, now),
    /CHECK constraint failed/,
  );

  assert.throws(
    () =>
      database
        .prepare(
          `
            INSERT INTO employee_month_records (
              unit_id,
              employee_id,
              tax_year,
              tax_month,
              status,
              salary_income,
              created_at,
              updated_at
            )
            VALUES (1, 1, 2026, 2, 'completed', -1, ?, ?)
          `,
        )
        .run(now, now),
    /CHECK constraint failed/,
  );

  assert.throws(
    () =>
      database
        .prepare(
          `
            INSERT INTO annual_calculation_runs (
              unit_id,
              employee_id,
              tax_year,
              last_status,
              policy_signature,
              data_signature,
              last_calculated_at,
              updated_at
            )
            VALUES (1, 1, 2026, 'invalid', '', '', ?, ?)
          `,
        )
        .run(now, now),
    /CHECK constraint failed/,
  );

  assert.throws(
    () =>
      database
        .prepare(
          `
            INSERT INTO annual_tax_results (
              unit_id,
              employee_id,
              tax_year,
              selected_scheme,
              selected_tax_amount,
              calculation_snapshot,
              calculated_at,
              updated_at
            )
            VALUES (1, 1, 2026, 'invalid_scheme', 0, '{}', ?, ?)
          `,
        )
        .run(now, now),
    /CHECK constraint failed/,
  );
});
