import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "../../../../");
const dataDir = path.join(repoRoot, "data");
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

export const closeDatabase = () => {
  database.close();
};
