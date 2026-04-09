import { database } from "../db/database.js";

export type MonthConfirmationRecord = {
  taxMonth: number;
  confirmedAt: string;
};

const mapRowToMonthConfirmationRecord = (
  row: Record<string, unknown>,
): MonthConfirmationRecord => ({
  taxMonth: Number(row.tax_month),
  confirmedAt: String(row.confirmed_at),
});

export const monthConfirmationRepository = {
  listByUnitAndYear(unitId: number, taxYear: number): MonthConfirmationRecord[] {
    const rows = database
      .prepare(
        `
          SELECT tax_month, confirmed_at
          FROM month_confirmations
          WHERE unit_id = ? AND tax_year = ?
          ORDER BY tax_month ASC
        `,
      )
      .all(unitId, taxYear) as Record<string, unknown>[];

    return rows.map(mapRowToMonthConfirmationRecord);
  },

  getLastConfirmedMonth(unitId: number, taxYear: number) {
    return Number(
      (
        database
          .prepare(
            `
              SELECT COALESCE(MAX(tax_month), 0) AS last_confirmed_month
              FROM month_confirmations
              WHERE unit_id = ? AND tax_year = ?
            `,
          )
          .get(unitId, taxYear) as { last_confirmed_month: number }
      ).last_confirmed_month,
    );
  },

  getLockedMonths(unitId: number, taxYear: number) {
    return this.listByUnitAndYear(unitId, taxYear).map((record) => record.taxMonth);
  },

  isConfirmed(unitId: number, taxYear: number, taxMonth: number) {
    const row = database
      .prepare(
        `
          SELECT 1 AS exists_flag
          FROM month_confirmations
          WHERE unit_id = ? AND tax_year = ? AND tax_month = ?
        `,
      )
      .get(unitId, taxYear, taxMonth) as { exists_flag: number } | undefined;

    return Boolean(row?.exists_flag);
  },

  confirm(unitId: number, taxYear: number, taxMonth: number) {
    const now = new Date().toISOString();
    database
      .prepare(
        `
          INSERT INTO month_confirmations (
            unit_id,
            tax_year,
            tax_month,
            confirmed_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(unit_id, tax_year, tax_month) DO UPDATE SET
            confirmed_at = excluded.confirmed_at,
            updated_at = excluded.updated_at
        `,
      )
      .run(unitId, taxYear, taxMonth, now, now);
  },

  unconfirmFromMonth(unitId: number, taxYear: number, taxMonth: number) {
    database
      .prepare(
        `
          DELETE FROM month_confirmations
          WHERE unit_id = ? AND tax_year = ? AND tax_month >= ?
        `,
      )
      .run(unitId, taxYear, taxMonth);
  },
};
