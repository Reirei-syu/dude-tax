import {
  buildMonthRecordDataSignature,
  type AnnualTaxRuleSourceSummary,
  type AnnualTaxWithholdingContext,
  type EmployeeMonthRecord,
} from "@dude-tax/core";
import { employeeRepository } from "../repositories/employee-repository.js";
import { monthRecordRepository } from "../repositories/month-record-repository.js";

export type AnnualTaxWithholdingBridgeContext = {
  carryInCompletedRecords: EmployeeMonthRecord[];
  derivedPreviousYearIncomeUnder60k: boolean;
  derivedFirstSalaryMonthInYear: number | null;
  relatedEmployeeIds: number[];
};

const getSalaryIncomeForSignature = (record: EmployeeMonthRecord) =>
  Math.round(
    (record.salaryIncome + (record.otherIncome ?? 0) + Number.EPSILON) * 100,
  ) / 100;

const hasPositiveValue = (value: number | null | undefined) => Boolean(value && value > 0);

const hasMonthRecordContent = (record: EmployeeMonthRecord) =>
  record.id !== null ||
  hasPositiveValue(record.salaryIncome) ||
  hasPositiveValue(record.annualBonus) ||
  hasPositiveValue(record.pensionInsurance) ||
  hasPositiveValue(record.medicalInsurance) ||
  hasPositiveValue(record.occupationalAnnuity) ||
  hasPositiveValue(record.housingFund) ||
  hasPositiveValue(record.supplementaryHousingFund) ||
  hasPositiveValue(record.unemploymentInsurance) ||
  hasPositiveValue(record.workInjuryInsurance) ||
  hasPositiveValue(record.withheldTax) ||
  hasPositiveValue(record.otherIncome) ||
  hasPositiveValue(record.infantCareDeduction) ||
  hasPositiveValue(record.childEducationDeduction) ||
  hasPositiveValue(record.continuingEducationDeduction) ||
  hasPositiveValue(record.housingLoanInterestDeduction) ||
  hasPositiveValue(record.housingRentDeduction) ||
  hasPositiveValue(record.elderCareDeduction) ||
  hasPositiveValue(record.otherDeduction) ||
  hasPositiveValue(record.taxReductionExemption) ||
  Boolean(record.otherIncomeRemark?.trim()) ||
  Boolean(record.remark?.trim());

export const buildWithholdingBridgeContext = (
  unitId: number,
  taxYear: number,
  employeeId: number,
): AnnualTaxWithholdingBridgeContext => {
  const currentEmployee = employeeRepository.getById(employeeId);
  if (!currentEmployee) {
    return {
      carryInCompletedRecords: [],
      derivedPreviousYearIncomeUnder60k: false,
      derivedFirstSalaryMonthInYear: null,
      relatedEmployeeIds: [],
    };
  }

  const relatedEmployees = employeeRepository.listByIdNumber(currentEmployee.idNumber);
  const relatedEmployeeIds = relatedEmployees.map((employee) => employee.id);
  const currentYearCompletedRecords = monthRecordRepository.listCompletedByEmployeeIdsAndYear(
    relatedEmployeeIds,
    taxYear,
  );
  const previousYearCompletedRecords = monthRecordRepository.listCompletedByEmployeeIdsAndYear(
    relatedEmployeeIds,
    taxYear - 1,
  );

  const carryInCompletedRecords = currentYearCompletedRecords.filter(
    (record) => record.unitId !== unitId,
  );
  const derivedFirstSalaryMonthInYear = currentYearCompletedRecords[0]?.taxMonth ?? null;
  const previousYearIncome = previousYearCompletedRecords.reduce(
    (sum, record) => sum + getSalaryIncomeForSignature(record),
    0,
  );
  const previousYearDistinctMonths = new Set(
    previousYearCompletedRecords.map((record) => record.taxMonth),
  ).size;
  const derivedPreviousYearIncomeUnder60k =
    previousYearDistinctMonths === 12 && previousYearIncome > 0 && previousYearIncome <= 60_000;

  return {
    carryInCompletedRecords,
    derivedPreviousYearIncomeUnder60k,
    derivedFirstSalaryMonthInYear,
    relatedEmployeeIds,
  };
};

export const resolveWithholdingContext = (
  bridgeContext: AnnualTaxWithholdingBridgeContext,
  explicitContext: AnnualTaxWithholdingContext,
): AnnualTaxWithholdingContext => ({
  ...explicitContext,
  carryInCompletedRecords: bridgeContext.carryInCompletedRecords,
  previousYearIncomeUnder60k:
    explicitContext.previousYearIncomeUnder60k ?? bridgeContext.derivedPreviousYearIncomeUnder60k,
  firstSalaryMonthInYear:
    explicitContext.firstSalaryMonthInYear ?? bridgeContext.derivedFirstSalaryMonthInYear,
});

export const buildRuleSourceSummary = (
  bridgeContext: AnnualTaxWithholdingBridgeContext,
  resolvedContext: AnnualTaxWithholdingContext,
): AnnualTaxRuleSourceSummary => ({
  hasCrossUnitCarryIn: bridgeContext.carryInCompletedRecords.length > 0,
  crossUnitRecordCount: bridgeContext.carryInCompletedRecords.length,
  crossUnitUnitCount: new Set(bridgeContext.carryInCompletedRecords.map((record) => record.unitId))
    .size,
  usedPreviousYearIncomeReference:
    resolvedContext.previousYearIncomeUnder60k !== undefined ||
    bridgeContext.derivedPreviousYearIncomeUnder60k,
  previousYearIncomeUnder60k: resolvedContext.previousYearIncomeUnder60k ?? null,
  usedFirstSalaryMonthReference:
    resolvedContext.firstSalaryMonthInYear !== undefined &&
    resolvedContext.firstSalaryMonthInYear !== null,
  firstSalaryMonthInYear: resolvedContext.firstSalaryMonthInYear ?? null,
});

export const buildAnnualTaxDataSignatureFromRecords = (
  records: EmployeeMonthRecord[],
  bridgeContext: AnnualTaxWithholdingBridgeContext,
) =>
  JSON.stringify({
    currentYearRecords: buildMonthRecordDataSignature(records),
    carryInCompletedRecords: buildMonthRecordDataSignature(bridgeContext.carryInCompletedRecords),
    carryInUnitIds: Array.from(
      new Set(bridgeContext.carryInCompletedRecords.map((record) => record.unitId)),
    ).sort((leftId, rightId) => leftId - rightId),
    previousYearIncomeUnder60k: bridgeContext.derivedPreviousYearIncomeUnder60k,
    firstSalaryMonthInYear: bridgeContext.derivedFirstSalaryMonthInYear,
  });

export const buildAnnualTaxDataSignature = (unitId: number, taxYear: number, employeeId: number) =>
  buildAnnualTaxDataSignatureFromRecords(
    monthRecordRepository
      .listByEmployeeAndYear(unitId, employeeId, taxYear)
      .filter((record) => hasMonthRecordContent(record)),
    buildWithholdingBridgeContext(unitId, taxYear, employeeId),
  );
