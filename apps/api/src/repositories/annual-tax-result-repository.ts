import type {
  AnnualTaxCalculation,
  EmployeeAnnualTaxResult,
  HistoryAnnualTaxQuery,
  HistoryAnnualTaxResult,
  ResultInvalidationReason,
  TaxSettlementDirection,
  TaxCalculationScheme,
} from "../../../../packages/core/src/index.js";
import { database } from "../db/database.js";

const mapRowToAnnualTaxResult = (row: Record<string, unknown>): EmployeeAnnualTaxResult => {
  const snapshot = JSON.parse(String(row.calculation_snapshot)) as AnnualTaxCalculation;
  const annualTaxPayable = Number(snapshot.annualTaxPayable ?? snapshot.selectedTaxAmount ?? 0);
  const annualTaxWithheld = Number(snapshot.annualTaxWithheld ?? 0);
  const annualTaxSettlement = Number(
    snapshot.annualTaxSettlement ?? annualTaxPayable - annualTaxWithheld,
  );
  const settlementDirection = String(
    snapshot.settlementDirection ??
      (annualTaxSettlement > 0 ? "payable" : annualTaxSettlement < 0 ? "refund" : "balanced"),
  ) as TaxSettlementDirection;

  return {
    ...snapshot,
    unitId: Number(row.unit_id),
    employeeId: Number(row.employee_id),
    employeeCode: String(row.employee_code),
    employeeName: String(row.employee_name),
    taxYear: Number(row.tax_year),
    selectedScheme: String(row.selected_scheme) as TaxCalculationScheme,
    selectedTaxAmount: Number(row.selected_tax_amount),
    annualTaxPayable,
    annualTaxWithheld,
    annualTaxSettlement,
    settlementDirection,
    calculatedAt: String(row.calculated_at),
  };
};

export const annualTaxResultRepository = {
  searchHistory(
    filters: HistoryAnnualTaxQuery,
    currentPolicySignature: string,
  ): HistoryAnnualTaxResult[] {
    const conditions: string[] = [];
    const params: Array<number | string> = [];

    if (filters.unitId) {
      conditions.push("result.unit_id = ?");
      params.push(filters.unitId);
    }

    if (filters.taxYear) {
      conditions.push("result.tax_year = ?");
      params.push(filters.taxYear);
    }

    if (filters.employeeId) {
      conditions.push("result.employee_id = ?");
      params.push(filters.employeeId);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const rows = database
      .prepare(
        `
          SELECT
            result.unit_id,
            result.employee_id,
            result.tax_year,
            result.selected_scheme,
            result.selected_tax_amount,
            result.policy_signature,
            result.calculation_snapshot,
            result.calculated_at,
            e.employee_code,
            e.employee_name,
            u.unit_name
          FROM annual_tax_results result
          INNER JOIN employees e
            ON e.id = result.employee_id
          INNER JOIN units u
            ON u.id = result.unit_id
          ${whereClause}
          ORDER BY result.tax_year DESC, u.created_at ASC, e.created_at DESC
        `,
      )
      .all(...params) as Record<string, unknown>[];

    return rows
      .map((row) => {
        const isInvalidated = String(row.policy_signature ?? "") !== currentPolicySignature;
        const invalidatedReason: ResultInvalidationReason | null = isInvalidated
          ? "tax_policy_changed"
          : null;

        return {
          ...mapRowToAnnualTaxResult(row),
          unitName: String(row.unit_name),
          isInvalidated,
          invalidatedReason,
        };
      })
      .filter((result) => {
        if (!filters.resultStatus || filters.resultStatus === "current") {
          return !result.isInvalidated;
        }

        if (filters.resultStatus === "invalidated") {
          return result.isInvalidated;
        }

        return true;
      })
      .filter((result) =>
        filters.settlementDirection ? result.settlementDirection === filters.settlementDirection : true,
      );
  },
  getByEmployeeAndYear(
    unitId: number,
    employeeId: number,
    taxYear: number,
    currentPolicySignature?: string,
  ) {
    const row = database
      .prepare(
        `
          SELECT
            result.unit_id,
            result.employee_id,
            result.tax_year,
            result.selected_scheme,
            result.selected_tax_amount,
            result.calculation_snapshot,
            result.calculated_at,
            e.employee_code,
            e.employee_name
          FROM annual_tax_results result
          INNER JOIN employees e
            ON e.id = result.employee_id
          WHERE result.unit_id = ? AND result.employee_id = ? AND result.tax_year = ?
            ${currentPolicySignature ? "AND result.policy_signature = ?" : ""}
        `,
      )
      .get(
        ...(currentPolicySignature
          ? [unitId, employeeId, taxYear, currentPolicySignature]
          : [unitId, employeeId, taxYear]),
      ) as Record<string, unknown> | undefined;

    return row ? mapRowToAnnualTaxResult(row) : null;
  },
  listByUnitAndYear(
    unitId: number,
    taxYear: number,
    currentPolicySignature?: string,
  ): EmployeeAnnualTaxResult[] {
    const rows = database
      .prepare(
        `
          SELECT
            result.unit_id,
            result.employee_id,
            result.tax_year,
            result.selected_scheme,
            result.selected_tax_amount,
            result.calculation_snapshot,
            result.calculated_at,
            e.employee_code,
            e.employee_name
          FROM annual_tax_results result
          INNER JOIN employees e
            ON e.id = result.employee_id
          WHERE result.unit_id = ? AND result.tax_year = ?
            ${currentPolicySignature ? "AND result.policy_signature = ?" : ""}
          ORDER BY e.created_at DESC
        `,
      )
      .all(
        ...(currentPolicySignature
          ? [unitId, taxYear, currentPolicySignature]
          : [unitId, taxYear]),
      ) as Record<string, unknown>[];

    return rows.map(mapRowToAnnualTaxResult);
  },
  upsert(
    unitId: number,
    employeeId: number,
    taxYear: number,
    calculation: AnnualTaxCalculation,
    policySignature: string,
  ) {
    const now = new Date().toISOString();

    database
      .prepare(
        `
          INSERT INTO annual_tax_results (
            unit_id,
            employee_id,
            tax_year,
            selected_scheme,
            selected_tax_amount,
            policy_signature,
            calculation_snapshot,
            calculated_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(unit_id, employee_id, tax_year) DO UPDATE SET
            selected_scheme = excluded.selected_scheme,
            selected_tax_amount = excluded.selected_tax_amount,
            policy_signature = excluded.policy_signature,
            calculation_snapshot = excluded.calculation_snapshot,
            calculated_at = excluded.calculated_at,
            updated_at = excluded.updated_at
        `,
      )
      .run(
        unitId,
        employeeId,
        taxYear,
        calculation.selectedScheme,
        calculation.selectedTaxAmount,
        policySignature,
        JSON.stringify(calculation),
        now,
        now,
      );
  },
  updateSelectedScheme(
    unitId: number,
    employeeId: number,
    taxYear: number,
    selectedScheme: TaxCalculationScheme,
    selectedTaxAmount: number,
    calculation: AnnualTaxCalculation,
  ) {
    database
      .prepare(
        `
          UPDATE annual_tax_results
          SET selected_scheme = ?,
              selected_tax_amount = ?,
              calculation_snapshot = ?,
              updated_at = ?
          WHERE unit_id = ? AND employee_id = ? AND tax_year = ?
        `,
      )
      .run(
        selectedScheme,
        selectedTaxAmount,
        JSON.stringify(calculation),
        new Date().toISOString(),
        unitId,
        employeeId,
        taxYear,
      );
  },
  deleteByEmployeeAndYear(unitId: number, employeeId: number, taxYear: number) {
    database
      .prepare(
        `
          DELETE FROM annual_tax_results
          WHERE unit_id = ? AND employee_id = ? AND tax_year = ?
        `,
      )
      .run(unitId, employeeId, taxYear);
  },
  deleteAll() {
    database.prepare("DELETE FROM annual_tax_results").run();
  },
};
