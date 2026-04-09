import {
  calculateEmployeeAnnualTaxForMonths,
  isEmployeeActiveInTaxMonth,
  isEmployeeActiveInTaxYear,
  type ConfirmedAnnualResultDetail,
  type ConfirmedAnnualResultSummary,
  type EmployeeMonthRecord,
} from "@dude-tax/core";
import { employeeRepository } from "../repositories/employee-repository.js";
import { monthConfirmationRepository } from "../repositories/month-confirmation-repository.js";
import { monthRecordRepository } from "../repositories/month-record-repository.js";
import { taxPolicyRepository } from "../repositories/tax-policy-repository.js";

const getConfirmedMonths = (unitId: number, taxYear: number, throughMonth?: number) =>
  monthConfirmationRepository
    .getLockedMonths(unitId, taxYear)
    .filter((taxMonth) => (throughMonth ? taxMonth <= throughMonth : true));

const getConfirmedRecordsForEmployee = (
  unitId: number,
  taxYear: number,
  employeeId: number,
  confirmedMonths: number[],
) => {
  const employee = employeeRepository.getById(employeeId);
  if (!employee || employee.unitId !== unitId || !isEmployeeActiveInTaxYear(employee, taxYear)) {
    return [];
  }

  const records = monthRecordRepository.listByEmployeeAndYear(unitId, employeeId, taxYear);
  return confirmedMonths
    .filter((taxMonth) => isEmployeeActiveInTaxMonth(employee, taxYear, taxMonth))
    .map((taxMonth) => records.find((record) => record.taxMonth === taxMonth) ?? null)
    .filter((record): record is EmployeeMonthRecord => Boolean(record));
};

const buildCalculatedAt = (unitId: number, taxYear: number, confirmedMonths: number[]) => {
  const confirmationMap = new Map(
    monthConfirmationRepository
      .listByUnitAndYear(unitId, taxYear)
      .map((record) => [record.taxMonth, record.confirmedAt]),
  );

  return confirmedMonths
    .map((taxMonth) => confirmationMap.get(taxMonth) ?? "")
    .sort()
    .at(-1) ?? new Date().toISOString();
};

const buildSummary = (
  unitId: number,
  taxYear: number,
  employeeId: number,
  confirmedMonths: number[],
): ConfirmedAnnualResultSummary | null => {
  const employee = employeeRepository.getById(employeeId);
  if (!employee || employee.unitId !== unitId) {
    return null;
  }

  const effectiveSettings = taxPolicyRepository.getEffectiveSettingsForScope(unitId, taxYear);
  const confirmedRecords = getConfirmedRecordsForEmployee(unitId, taxYear, employeeId, confirmedMonths);
  if (!confirmedRecords.length) {
    return null;
  }

  const calculation = calculateEmployeeAnnualTaxForMonths(
    confirmedRecords,
    confirmedMonths,
    effectiveSettings,
  );

  return {
    ...calculation,
    unitId,
    employeeId,
    employeeCode: employee.employeeCode,
    employeeName: employee.employeeName,
    taxYear,
    calculatedAt: buildCalculatedAt(unitId, taxYear, confirmedMonths),
    confirmedMonthCount: confirmedRecords.length,
    confirmedMonths: confirmedRecords.map((record) => record.taxMonth),
  };
};

export const confirmedResultsService = {
  listResults(unitId: number, taxYear: number, throughMonth?: number) {
    const confirmedMonths = getConfirmedMonths(unitId, taxYear, throughMonth);
    if (!confirmedMonths.length) {
      return [] as ConfirmedAnnualResultSummary[];
    }

    return employeeRepository
      .listByUnitId(unitId)
      .map((employee) => buildSummary(unitId, taxYear, employee.id, confirmedMonths))
      .filter((result): result is ConfirmedAnnualResultSummary => Boolean(result));
  },

  getResultDetail(unitId: number, taxYear: number, employeeId: number, throughMonth?: number) {
    const confirmedMonths = getConfirmedMonths(unitId, taxYear, throughMonth);
    if (!confirmedMonths.length) {
      return null;
    }

    const summary = buildSummary(unitId, taxYear, employeeId, confirmedMonths);
    if (!summary) {
      return null;
    }

    return {
      ...summary,
      months: getConfirmedRecordsForEmployee(unitId, taxYear, employeeId, confirmedMonths),
    } satisfies ConfirmedAnnualResultDetail;
  },
};
