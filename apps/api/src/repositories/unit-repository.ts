import type { CreateUnitPayload, Unit } from "@dude-tax/core";
import { database } from "../db/database.js";

type UnitRow = {
  id: number;
  unit_name: string;
  remark: string;
  is_archived: number;
  created_at: string;
  updated_at: string;
};

const mapRowToUnit = (row: UnitRow, availableTaxYears: number[]): Unit => ({
  id: Number(row.id),
  unitName: String(row.unit_name),
  remark: String(row.remark ?? ""),
  isArchived: Number(row.is_archived) === 1,
  availableTaxYears,
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at),
});

const listAvailableTaxYears = (unitId: number) =>
  (
    database
      .prepare(
        `
          SELECT tax_year
          FROM unit_years
          WHERE unit_id = ?
          ORDER BY tax_year ASC
        `,
      )
      .all(unitId) as Array<{ tax_year: number }>
  ).map((row) => Number(row.tax_year));

const getYearRelatedDataCount = (unitId: number, taxYear: number) => {
  const sources = [
    "SELECT COUNT(*) AS total FROM employee_month_records WHERE unit_id = ? AND tax_year = ?",
    "SELECT COUNT(*) AS total FROM annual_calculation_runs WHERE unit_id = ? AND tax_year = ?",
    "SELECT COUNT(*) AS total FROM annual_tax_results WHERE unit_id = ? AND tax_year = ?",
    "SELECT COUNT(*) AS total FROM annual_tax_result_versions WHERE unit_id = ? AND tax_year = ?",
    "SELECT COUNT(*) AS total FROM tax_policy_scopes WHERE unit_id = ? AND tax_year = ?",
  ];

  return sources.reduce((sum, sql) => {
    const total = Number(
      (database.prepare(sql).get(unitId, taxYear) as { total: number } | undefined)?.total ?? 0,
    );
    return sum + total;
  }, 0);
};

const getUnitRowById = (unitId: number) =>
  (database
    .prepare(
      `
        SELECT id, unit_name, remark, is_archived, created_at, updated_at
        FROM units
        WHERE id = ?
      `,
    )
    .get(unitId) as UnitRow | undefined) ?? null;

const insertUnitYear = (unitId: number, taxYear: number) => {
  const now = new Date().toISOString();
  database
    .prepare(
      `
        INSERT OR IGNORE INTO unit_years (unit_id, tax_year, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `,
    )
    .run(unitId, taxYear, now, now);
};

export const unitRepository = {
  list(): Unit[] {
    const rows = database
      .prepare(
        `
          SELECT id, unit_name, remark, is_archived, created_at, updated_at
          FROM units
          ORDER BY created_at ASC
        `,
      )
      .all() as UnitRow[];

    return rows.map((row) => mapRowToUnit(row, listAvailableTaxYears(row.id)));
  },

  getById(unitId: number): Unit | null {
    const row = getUnitRowById(unitId);
    if (!row) {
      return null;
    }

    return mapRowToUnit(row, listAvailableTaxYears(unitId));
  },

  listAvailableTaxYears(unitId: number): number[] {
    return listAvailableTaxYears(unitId);
  },

  hasYear(unitId: number, taxYear: number) {
    return listAvailableTaxYears(unitId).includes(taxYear);
  },

  create(payload: CreateUnitPayload): Unit {
    const now = new Date().toISOString();
    const transaction = database.transaction(() => {
      const result = database
        .prepare(
          `
            INSERT INTO units (unit_name, remark, created_at, updated_at)
            VALUES (?, ?, ?, ?)
          `,
        )
        .run(payload.unitName.trim(), payload.remark?.trim() ?? "", now, now);

      const unitId = Number(result.lastInsertRowid);
      insertUnitYear(unitId, payload.startYear ?? new Date().getFullYear());
      return unitId;
    });

    const unitId = transaction();
    return this.getById(unitId) as Unit;
  },

  addYear(unitId: number, taxYear: number): Unit {
    insertUnitYear(unitId, taxYear);
    return this.getById(unitId) as Unit;
  },

  canDeleteYear(unitId: number, taxYear: number) {
    const availableTaxYears = listAvailableTaxYears(unitId);
    if (!availableTaxYears.includes(taxYear)) {
      return {
        canDelete: false,
        reason: "目标年份不存在",
      };
    }

    if (availableTaxYears.length <= 1) {
      return {
        canDelete: false,
        reason: "单位至少需要保留一个年份",
      };
    }

    if (getYearRelatedDataCount(unitId, taxYear) > 0) {
      return {
        canDelete: false,
        reason: "该年份已有业务数据，暂不允许删除",
      };
    }

    return {
      canDelete: true,
      reason: null,
    };
  },

  deleteYear(unitId: number, taxYear: number): Unit {
    database
      .prepare(
        `
          DELETE FROM unit_years
          WHERE unit_id = ? AND tax_year = ?
        `,
      )
      .run(unitId, taxYear);

    return this.getById(unitId) as Unit;
  },

  deleteById(unitId: number) {
    database.prepare("DELETE FROM units WHERE id = ?").run(unitId);
  },
};
