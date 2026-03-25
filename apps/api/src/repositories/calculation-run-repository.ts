import type {
  CalculationPreparationStatus,
  EmployeeCalculationStatus,
} from "../../../../packages/core/src/index.js";
import { database } from "../db/database.js";

const derivePreparationStatus = (
  recordedMonthCount: number,
  completedMonthCount: number,
): CalculationPreparationStatus => {
  if (recordedMonthCount === 0) {
    return "not_started";
  }

  if (completedMonthCount < recordedMonthCount) {
    return "draft";
  }

  return "ready";
};

export const calculationRunRepository = {
  listStatuses(unitId: number, taxYear: number): EmployeeCalculationStatus[] {
    const rows = database
      .prepare(
        `
          SELECT
            e.id AS employee_id,
            e.employee_code,
            e.employee_name,
            COUNT(r.id) AS recorded_month_count,
            COALESCE(SUM(CASE WHEN r.status = 'completed' THEN 1 ELSE 0 END), 0) AS completed_month_count,
            run.last_calculated_at
          FROM employees e
          LEFT JOIN employee_month_records r
            ON r.unit_id = e.unit_id
            AND r.employee_id = e.id
            AND r.tax_year = ?
          LEFT JOIN annual_calculation_runs run
            ON run.unit_id = e.unit_id
            AND run.employee_id = e.id
            AND run.tax_year = ?
          WHERE e.unit_id = ?
          GROUP BY e.id, e.employee_code, e.employee_name, run.last_calculated_at
          ORDER BY e.created_at DESC
        `,
      )
      .all(taxYear, taxYear, unitId) as Record<string, unknown>[];

    return rows.map((row) => {
      const recordedMonthCount = Number(row.recorded_month_count);
      const completedMonthCount = Number(row.completed_month_count);

      return {
        employeeId: Number(row.employee_id),
        employeeCode: String(row.employee_code),
        employeeName: String(row.employee_name),
        recordedMonthCount,
        completedMonthCount,
        preparationStatus: derivePreparationStatus(recordedMonthCount, completedMonthCount),
        lastCalculatedAt: row.last_calculated_at ? String(row.last_calculated_at) : null,
      };
    });
  },
  markCalculated(
    unitId: number,
    employeeId: number,
    taxYear: number,
    status: CalculationPreparationStatus,
  ) {
    const now = new Date().toISOString();

    database
      .prepare(
        `
          INSERT INTO annual_calculation_runs (
            unit_id,
            employee_id,
            tax_year,
            last_status,
            last_calculated_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(unit_id, employee_id, tax_year) DO UPDATE SET
            last_status = excluded.last_status,
            last_calculated_at = excluded.last_calculated_at,
            updated_at = excluded.updated_at
        `,
      )
      .run(unitId, employeeId, taxYear, status, now, now);
  },
  deleteByEmployeeAndYear(unitId: number, employeeId: number, taxYear: number) {
    database
      .prepare(
        `
          DELETE FROM annual_calculation_runs
          WHERE unit_id = ? AND employee_id = ? AND tax_year = ?
        `,
      )
      .run(unitId, employeeId, taxYear);
  },
};
