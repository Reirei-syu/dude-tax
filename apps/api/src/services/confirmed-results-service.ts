import {
  calculateEmployeeAnnualTaxForMonths,
  isEmployeeActiveInTaxMonth,
  isEmployeeActiveInTaxYear,
  type ConfirmedAnnualResultDetail,
  type ConfirmedAnnualResultSummary,
  type EmployeeMonthRecord,
} from "@dude-tax/core";
import type { Employee } from "@dude-tax/core";
import { employeeRepository } from "../repositories/employee-repository.js";
import { monthConfirmationRepository } from "../repositories/month-confirmation-repository.js";
import { monthRecordRepository } from "../repositories/month-record-repository.js";
import { taxPolicyRepository } from "../repositories/tax-policy-repository.js";

type ConfirmedResultsContext = {
  taxYear: number;
  confirmedMonths: number[];
  confirmationMap: Map<number, string>;
  effectiveSettings: ReturnType<typeof taxPolicyRepository.getEffectiveSettingsForScope>;
  recordsByEmployeeId: Map<number, Map<number, EmployeeMonthRecord>>;
};

const buildConfirmedResultsContext = (
  unitId: number,
  taxYear: number,
  throughMonth?: number,
): ConfirmedResultsContext => {
  const confirmationRecords = monthConfirmationRepository
    .listByUnitAndYear(unitId, taxYear)
    .filter((record) => (throughMonth ? record.taxMonth <= throughMonth : true));
  const confirmationMap = new Map(
    confirmationRecords.map((record) => [record.taxMonth, record.confirmedAt]),
  );
  const recordsByEmployeeId = new Map<number, Map<number, EmployeeMonthRecord>>();

  monthRecordRepository.listExistingByUnitAndYears(unitId, [taxYear]).forEach((record) => {
    const employeeRecordMap =
      recordsByEmployeeId.get(record.employeeId) ?? new Map<number, EmployeeMonthRecord>();
    employeeRecordMap.set(record.taxMonth, record);
    recordsByEmployeeId.set(record.employeeId, employeeRecordMap);
  });

  return {
    taxYear,
    confirmedMonths: confirmationRecords.map((record) => record.taxMonth),
    confirmationMap,
    effectiveSettings: taxPolicyRepository.getEffectiveSettingsForScope(unitId, taxYear),
    recordsByEmployeeId,
  };
};

const getConfirmedRecordsForEmployee = (
  employee: Employee,
  context: ConfirmedResultsContext,
) => {
  if (!isEmployeeActiveInTaxYear(employee, context.taxYear)) {
    return [];
  }

  const employeeRecords = context.recordsByEmployeeId.get(employee.id) ?? new Map();
  return context.confirmedMonths
    .filter((taxMonth) => isEmployeeActiveInTaxMonth(employee, context.taxYear, taxMonth))
    .map((taxMonth) => employeeRecords.get(taxMonth) ?? null)
    .filter((record): record is EmployeeMonthRecord => Boolean(record));
};

const buildCalculatedAt = (context: ConfirmedResultsContext) =>
  context.confirmedMonths
    .map((taxMonth) => context.confirmationMap.get(taxMonth) ?? "")
    .sort()
    .at(-1) ?? new Date().toISOString();

const buildSummary = (
  unitId: number,
  employee: Employee,
  context: ConfirmedResultsContext,
): ConfirmedAnnualResultSummary | null => {
  if (employee.unitId !== unitId) {
    return null;
  }

  const confirmedRecords = getConfirmedRecordsForEmployee(employee, context);
  if (!confirmedRecords.length) {
    return null;
  }

  const calculation = calculateEmployeeAnnualTaxForMonths(
    confirmedRecords,
    context.confirmedMonths,
    context.effectiveSettings,
  );

  return {
    ...calculation,
    unitId,
    employeeId: employee.id,
    employeeCode: employee.employeeCode,
    employeeName: employee.employeeName,
    taxYear: context.taxYear,
    calculatedAt: buildCalculatedAt(context),
    confirmedMonthCount: confirmedRecords.length,
    confirmedMonths: confirmedRecords.map((record) => record.taxMonth),
  };
};

export const confirmedResultsService = {
  listResults(unitId: number, taxYear: number, throughMonth?: number) {
    const context = buildConfirmedResultsContext(unitId, taxYear, throughMonth);
    if (!context.confirmedMonths.length) {
      return [] as ConfirmedAnnualResultSummary[];
    }

    return employeeRepository
      .listByUnitId(unitId)
      .map((employee) => buildSummary(unitId, employee, context))
      .filter((result): result is ConfirmedAnnualResultSummary => Boolean(result));
  },

  getResultDetail(unitId: number, taxYear: number, employeeId: number, throughMonth?: number) {
    const context = buildConfirmedResultsContext(unitId, taxYear, throughMonth);
    if (!context.confirmedMonths.length) {
      return null;
    }

    const employee = employeeRepository.getById(employeeId);
    if (!employee || employee.unitId !== unitId) {
      return null;
    }

    const summary = buildSummary(unitId, employee, context);
    if (!summary) {
      return null;
    }

    return {
      ...summary,
      months: getConfirmedRecordsForEmployee(employee, context),
    } satisfies ConfirmedAnnualResultDetail;
  },
};
