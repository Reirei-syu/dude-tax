import type {
  AnnualTaxCalculation,
  AnnualTaxResultVersion,
  EmployeeAnnualTaxResult,
  HistoryAnnualTaxQuery,
  HistoryAnnualTaxResult,
  ResultInvalidationReason,
  TaxSettlementDirection,
  TaxCalculationScheme,
} from "@dude-tax/core";
import { database } from "../db/database.js";
import { taxPolicyRepository } from "./tax-policy-repository.js";
import { buildAnnualTaxDataSignature } from "../domain/annual-tax-calculation-context.js";
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

const getInvalidatedReason = (
  storedPolicySignature: string,
  currentPolicySignature: string,
  storedDataSignature: string,
  currentDataSignature: string,
): ResultInvalidationReason | null => {
  if (storedPolicySignature !== currentPolicySignature) {
    return "tax_policy_changed";
  }

  if (!storedDataSignature || storedDataSignature !== currentDataSignature) {
    return "month_record_changed";
  }

  return null;
};

const mapRowToAnnualTaxResultVersion = (
  row: Record<string, unknown>,
  currentPolicySignature: string,
  currentDataSignature: string,
): AnnualTaxResultVersion => {
  const result = mapRowToAnnualTaxResult(row);
  const invalidatedReason = getInvalidatedReason(
    String(row.policy_signature ?? ""),
    currentPolicySignature,
    String(row.data_signature ?? ""),
    currentDataSignature,
  );
  return {
    ...result,
    versionId: Number(row.version_id),
    versionSequence: Number(row.version_sequence),
    policySignature: String(row.policy_signature ?? ""),
    isInvalidated: Boolean(invalidatedReason),
    invalidatedReason,
  };
};
export const annualTaxResultRepository = {
  searchHistory(filters: HistoryAnnualTaxQuery): HistoryAnnualTaxResult[] {
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
        `           SELECT             result.unit_id,             result.employee_id,             result.tax_year,             result.selected_scheme,             result.selected_tax_amount,             result.policy_signature,             result.data_signature,             result.calculation_snapshot,             result.calculated_at,             e.employee_code,             e.employee_name,             u.unit_name           FROM annual_tax_results result           INNER JOIN employees e             ON e.id = result.employee_id           INNER JOIN units u             ON u.id = result.unit_id           ${whereClause}           ORDER BY result.tax_year DESC, u.created_at ASC, e.created_at DESC         `,
      )
      .all(...params) as Record<string, unknown>[];
    const effectivePolicySignatureMap = new Map<string, string>();
    const effectiveDataSignatureMap = new Map<string, string>();
    return rows
      .map((row) => {
        const unitId = Number(row.unit_id);
        const employeeId = Number(row.employee_id);
        const taxYear = Number(row.tax_year);
        const scopeKey = `${unitId}:${taxYear}`;
        const dataKey = `${unitId}:${employeeId}:${taxYear}`;
        const currentPolicySignature =
          effectivePolicySignatureMap.get(scopeKey) ??
          taxPolicyRepository.getCurrentPolicySignature(unitId, taxYear);
        const currentDataSignature =
          effectiveDataSignatureMap.get(dataKey) ??
          buildAnnualTaxDataSignature(unitId, taxYear, employeeId);
        effectivePolicySignatureMap.set(scopeKey, currentPolicySignature);
        effectiveDataSignatureMap.set(dataKey, currentDataSignature);
        const invalidatedReason = getInvalidatedReason(
          String(row.policy_signature ?? ""),
          currentPolicySignature,
          String(row.data_signature ?? ""),
          currentDataSignature,
        );
        return {
          ...mapRowToAnnualTaxResult(row),
          unitName: String(row.unit_name),
          isInvalidated: Boolean(invalidatedReason),
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
        filters.settlementDirection
          ? result.settlementDirection === filters.settlementDirection
          : true,
      );
  },
  getHistoryByEmployeeAndYear(
    unitId: number,
    employeeId: number,
    taxYear: number,
  ): HistoryAnnualTaxResult | null {
    const row = database
      .prepare(
        `           SELECT             result.unit_id,             result.employee_id,             result.tax_year,             result.selected_scheme,             result.selected_tax_amount,             result.policy_signature,             result.data_signature,             result.calculation_snapshot,             result.calculated_at,             e.employee_code,             e.employee_name,             u.unit_name           FROM annual_tax_results result           INNER JOIN employees e             ON e.id = result.employee_id           INNER JOIN units u             ON u.id = result.unit_id           WHERE result.unit_id = ? AND result.employee_id = ? AND result.tax_year = ?         `,
      )
      .get(unitId, employeeId, taxYear) as Record<string, unknown> | undefined;

    if (!row) {
      return null;
    }

    const currentPolicySignature = taxPolicyRepository.getCurrentPolicySignature(unitId, taxYear);
    const currentDataSignature = buildAnnualTaxDataSignature(unitId, taxYear, employeeId);
    const invalidatedReason = getInvalidatedReason(
      String(row.policy_signature ?? ""),
      currentPolicySignature,
      String(row.data_signature ?? ""),
      currentDataSignature,
    );

    return {
      ...mapRowToAnnualTaxResult(row),
      unitName: String(row.unit_name),
      isInvalidated: Boolean(invalidatedReason),
      invalidatedReason,
    };
  },
  getByEmployeeAndYear(
    unitId: number,
    employeeId: number,
    taxYear: number,
    currentPolicySignature?: string,
  ) {
    const currentDataSignature =
      currentPolicySignature ? buildAnnualTaxDataSignature(unitId, taxYear, employeeId) : null;
    const row = database
      .prepare(
        `           SELECT             result.unit_id,             result.employee_id,             result.tax_year,             result.selected_scheme,             result.selected_tax_amount,             result.policy_signature,             result.data_signature,             result.calculation_snapshot,             result.calculated_at,             e.employee_code,             e.employee_name           FROM annual_tax_results result           INNER JOIN employees e             ON e.id = result.employee_id           WHERE result.unit_id = ? AND result.employee_id = ? AND result.tax_year = ?             ${currentPolicySignature ? "AND result.policy_signature = ? AND result.data_signature != ''" : ""}         `,
      )
      .get(
        ...(currentPolicySignature
          ? [unitId, employeeId, taxYear, currentPolicySignature]
          : [unitId, employeeId, taxYear]),
      ) as Record<string, unknown> | undefined;
    if (!row) {
      return null;
    }

    if (
      currentPolicySignature &&
      (String(row.policy_signature ?? "") !== currentPolicySignature ||
        String(row.data_signature ?? "") !== currentDataSignature)
    ) {
      return null;
    }

    return mapRowToAnnualTaxResult(row);
  },
  listByUnitAndYear(
    unitId: number,
    taxYear: number,
    currentPolicySignature?: string,
  ): EmployeeAnnualTaxResult[] {
    const rows = database
      .prepare(
        `           SELECT             result.unit_id,             result.employee_id,             result.tax_year,             result.selected_scheme,             result.selected_tax_amount,             result.policy_signature,             result.data_signature,             result.calculation_snapshot,             result.calculated_at,             e.employee_code,             e.employee_name           FROM annual_tax_results result           INNER JOIN employees e             ON e.id = result.employee_id           WHERE result.unit_id = ? AND result.tax_year = ?             ${currentPolicySignature ? "AND result.policy_signature = ? AND result.data_signature != ''" : ""}           ORDER BY e.created_at DESC         `,
      )
      .all(
        ...(currentPolicySignature ? [unitId, taxYear, currentPolicySignature] : [unitId, taxYear]),
      ) as Record<string, unknown>[];

    return rows
      .filter((row) => {
        if (!currentPolicySignature) {
          return true;
        }

        return (
          String(row.policy_signature ?? "") === currentPolicySignature &&
          String(row.data_signature ?? "") ===
            buildAnnualTaxDataSignature(unitId, taxYear, Number(row.employee_id))
        );
      })
      .map(mapRowToAnnualTaxResult);
  },
  listVersionsByEmployeeAndYear(
    unitId: number,
    employeeId: number,
    taxYear: number,
    currentPolicySignature: string,
  ): AnnualTaxResultVersion[] {
    const currentDataSignature = buildAnnualTaxDataSignature(unitId, taxYear, employeeId);
    const rows = database
      .prepare(
        `           SELECT             version.id AS version_id,             version.version_sequence,             version.unit_id,             version.employee_id,             version.tax_year,             version.selected_scheme,             version.selected_tax_amount,             version.policy_signature,             version.data_signature,             version.calculation_snapshot,             version.created_at AS calculated_at,             employee.employee_code,             employee.employee_name           FROM annual_tax_result_versions version           INNER JOIN employees employee             ON employee.id = version.employee_id           WHERE version.unit_id = ? AND version.employee_id = ? AND version.tax_year = ?           ORDER BY version.version_sequence DESC, version.id DESC         `,
      )
      .all(unitId, employeeId, taxYear) as Record<string, unknown>[];
    return rows.map((row) =>
      mapRowToAnnualTaxResultVersion(row, currentPolicySignature, currentDataSignature),
    );
  },
  upsert(
    unitId: number,
    employeeId: number,
    taxYear: number,
    calculation: AnnualTaxCalculation,
    policySignature: string,
    dataSignature: string,
  ) {
    const now = new Date().toISOString();
    const calculationSnapshot = JSON.stringify(calculation);
    const persistTransaction = database.transaction(() => {
      database
        .prepare(
          `             INSERT INTO annual_tax_results (               unit_id,               employee_id,               tax_year,               selected_scheme,               selected_tax_amount,               policy_signature,               data_signature,               calculation_snapshot,               calculated_at,               updated_at             )             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)             ON CONFLICT(unit_id, employee_id, tax_year) DO UPDATE SET               selected_scheme = excluded.selected_scheme,               selected_tax_amount = excluded.selected_tax_amount,               policy_signature = excluded.policy_signature,               data_signature = excluded.data_signature,               calculation_snapshot = excluded.calculation_snapshot,               calculated_at = excluded.calculated_at,               updated_at = excluded.updated_at           `,
        )
        .run(
          unitId,
          employeeId,
          taxYear,
          calculation.selectedScheme,
          calculation.selectedTaxAmount,
          policySignature,
          dataSignature,
          calculationSnapshot,
          now,
          now,
        );
      const nextVersionSequence = Number(
        (
          database
            .prepare(
              `                 SELECT COALESCE(MAX(version_sequence), 0) + 1 AS next_version_sequence                 FROM annual_tax_result_versions                 WHERE unit_id = ? AND employee_id = ? AND tax_year = ?               `,
            )
            .get(unitId, employeeId, taxYear) as { next_version_sequence: number }
        ).next_version_sequence,
      );
      database
        .prepare(
          `             INSERT INTO annual_tax_result_versions (               unit_id,               employee_id,               tax_year,               version_sequence,               policy_signature,               data_signature,               selected_scheme,               selected_tax_amount,               calculation_snapshot,               created_at             )             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)           `,
        )
        .run(
          unitId,
          employeeId,
          taxYear,
          nextVersionSequence,
          policySignature,
          dataSignature,
          calculation.selectedScheme,
          calculation.selectedTaxAmount,
          calculationSnapshot,
          now,
        );
    });
    persistTransaction();
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
        `           UPDATE annual_tax_results           SET selected_scheme = ?,               selected_tax_amount = ?,               calculation_snapshot = ?,               updated_at = ?           WHERE unit_id = ? AND employee_id = ? AND tax_year = ?         `,
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
        `           DELETE FROM annual_tax_results           WHERE unit_id = ? AND employee_id = ? AND tax_year = ?         `,
      )
      .run(unitId, employeeId, taxYear);
  },
  deleteAll() {
    database.prepare("DELETE FROM annual_tax_results").run();
  },
};
