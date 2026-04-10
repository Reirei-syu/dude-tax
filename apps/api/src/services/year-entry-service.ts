import {
  calculateEmployeeAnnualTax,
  isEmployeeActiveInTaxMonth,
  isEmployeeActiveInTaxYear,
  type AnnualTaxWithholdingContext,
  type BatchUpsertEmployeeYearRecordsPayload,
  type EmployeeAnnualTaxResult,
  type EmployeeMonthRecord,
  type EmployeeYearEntryOverview,
  type EmployeeYearRecordWorkspace,
  type MonthConfirmationState,
  type YearEntryCalculationResponse,
  type YearEntryCalculationSummaryRow,
  type YearEntryResultCoverage,
} from "@dude-tax/core";
import { annualTaxResultRepository } from "../repositories/annual-tax-result-repository.js";
import { calculationRunRepository } from "../repositories/calculation-run-repository.js";
import { employeeRepository } from "../repositories/employee-repository.js";
import { monthConfirmationRepository } from "../repositories/month-confirmation-repository.js";
import { monthRecordRepository } from "../repositories/month-record-repository.js";
import { taxPolicyRepository } from "../repositories/tax-policy-repository.js";
import {
  buildAnnualTaxDataSignatureFromRecords,
  buildRuleSourceSummary,
  buildWithholdingBridgeContext,
  resolveWithholdingContext,
} from "../domain/annual-tax-calculation-context.js";

const TAX_MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

const hasPositiveValue = (value: number | null | undefined) => Boolean(value && value > 0);

const hasMonthRecordContent = (record: EmployeeMonthRecord | null) => {
  if (!record) {
    return false;
  }

  return (
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
    Boolean(record.remark?.trim())
  );
};

const getEmployeeGroup = (
  employee: Pick<NonNullable<ReturnType<typeof employeeRepository.getById>>, "leaveDate">,
  taxYear: number,
): EmployeeYearEntryOverview["employeeGroup"] => {
  const leaveDate = employee.leaveDate?.trim() ?? "";
  if (leaveDate.startsWith(`${taxYear}-`)) {
    return "left_this_year";
  }

  return "active";
};

const getYearActiveEmployees = (unitId: number, taxYear: number) =>
  employeeRepository
    .listByUnitId(unitId)
    .filter((employee) => isEmployeeActiveInTaxYear(employee, taxYear));

const getEmployeeRecords = (unitId: number, employeeId: number, taxYear: number) =>
  monthRecordRepository.listByEmployeeAndYear(unitId, employeeId, taxYear);

const getMonthRecordByTaxMonth = (records: EmployeeMonthRecord[], taxMonth: number) =>
  records.find((record) => record.taxMonth === taxMonth) ?? null;

const getRecordedMonthRecords = (records: EmployeeMonthRecord[]) =>
  records.filter((record) => hasMonthRecordContent(record));

const buildYearEntryResultCoverage = (
  unitId: number,
  taxYear: number,
  effectiveEmployeeIds: number[],
): YearEntryResultCoverage => {
  const currentPolicySignature = taxPolicyRepository.getCurrentPolicySignature(unitId, taxYear);
  const calculatedEmployeeIdSet = new Set(
    annualTaxResultRepository
      .listByUnitAndYear(unitId, taxYear, currentPolicySignature)
      .map((result) => result.employeeId),
  );
  const uncoveredEmployeeIds = effectiveEmployeeIds.filter(
    (employeeId) => !calculatedEmployeeIdSet.has(employeeId),
  ).sort((left, right) => left - right);

  return {
    totalEffectiveEmployeeCount: effectiveEmployeeIds.length,
    calculatedEmployeeCount: effectiveEmployeeIds.length - uncoveredEmployeeIds.length,
    uncoveredEmployeeIds,
    isComplete: uncoveredEmployeeIds.length === 0,
  };
};

const buildYearEntryCalculationSummaryRow = (
  result: EmployeeAnnualTaxResult,
): YearEntryCalculationSummaryRow => {
  const alternativeSchemeResult =
    result.selectedScheme === "separate_bonus"
      ? result.schemeResults.combinedBonus
      : result.schemeResults.separateBonus;
  const lastTraceItem = result.withholdingTraceItems?.at(-1) ?? null;

  return {
    employeeId: result.employeeId,
    employeeCode: result.employeeCode,
    employeeName: result.employeeName,
    cumulativeExpectedWithheldTax:
      lastTraceItem?.cumulativeExpectedWithheldTax ?? result.withholdingSummary.expectedWithheldTaxTotal,
    lastAppliedRate: lastTraceItem?.appliedRate ?? null,
    selectedScheme: result.selectedScheme,
    alternativeTaxAmount: alternativeSchemeResult.finalTax,
  };
};

type ConfirmabilityResult = {
  canConfirm: boolean;
  blockedReason: string | null;
};

const getMonthConfirmability = (
  unitId: number,
  taxYear: number,
  taxMonth: number,
  coverage: YearEntryResultCoverage,
): ConfirmabilityResult => {
  const lastConfirmedMonth = monthConfirmationRepository.getLastConfirmedMonth(unitId, taxYear);
  if (monthConfirmationRepository.isConfirmed(unitId, taxYear, taxMonth)) {
    return {
      canConfirm: false,
      blockedReason: "already_confirmed",
    };
  }

  if (taxMonth !== lastConfirmedMonth + 1) {
    return {
      canConfirm: false,
      blockedReason: "previous_month_unconfirmed",
    };
  }

  if (!coverage.isComplete) {
    return {
      canConfirm: false,
      blockedReason: "results_incomplete",
    };
  }

  return {
    canConfirm: true,
    blockedReason: null,
  };
};

export class MonthConfirmationConflictError extends Error {
  constructor(
    message: string,
    readonly lockedMonths: number[] = [],
  ) {
    super(message);
  }
}

export const yearEntryService = {
  hasMonthRecordContent,

  buildYearEntryOverview(unitId: number, taxYear: number) {
    const effectiveSettings = taxPolicyRepository.getEffectiveSettingsForScope(unitId, taxYear);
    const confirmedMonthSet = new Set(monthConfirmationRepository.getLockedMonths(unitId, taxYear));
    const employees = getYearActiveEmployees(unitId, taxYear);
    const effectiveEmployeeIds = employees.map((employee) => employee.id);

    const employeeRows: EmployeeYearEntryOverview[] = employees.map((employee) => {
      const records = getEmployeeRecords(unitId, employee.id, taxYear);
      const recordedRecords = getRecordedMonthRecords(records);
      const activeMonths = TAX_MONTHS.filter((taxMonth) =>
        isEmployeeActiveInTaxMonth(employee, taxYear, taxMonth),
      );
      const uneditedMonths = activeMonths.filter((taxMonth) => {
        const record = getMonthRecordByTaxMonth(records, taxMonth);
        return !confirmedMonthSet.has(taxMonth) && !hasMonthRecordContent(record);
      });

      let optimalScheme: EmployeeYearEntryOverview["optimalScheme"] = null;
      if (recordedRecords.length) {
        optimalScheme = calculateEmployeeAnnualTax(recordedRecords, effectiveSettings).selectedScheme;
      }

      return {
        employeeId: employee.id,
        employeeCode: employee.employeeCode,
        employeeName: employee.employeeName,
        hireDate: employee.hireDate,
        leaveDate: employee.leaveDate,
        employeeGroup: getEmployeeGroup(employee, taxYear),
        recordedMonthCount: recordedRecords.length,
        totalWithheldTax: recordedRecords.reduce(
          (sum, record) => sum + Number(record.withheldTax ?? 0),
          0,
        ),
        optimalScheme,
        uneditedMonths,
      };
    });

    return {
      totalEffectiveEmployeeCount: effectiveEmployeeIds.length,
      currentResultCoverage: buildYearEntryResultCoverage(unitId, taxYear, effectiveEmployeeIds),
      employees: employeeRows,
    };
  },

  calculateYearEntryResults(
    unitId: number,
    taxYear: number,
    employeeIds: number[],
    withholdingContext: AnnualTaxWithholdingContext = {},
  ): YearEntryCalculationResponse {
    const effectiveSettings = taxPolicyRepository.getEffectiveSettingsForScope(unitId, taxYear);
    const currentPolicySignature = taxPolicyRepository.getCurrentPolicySignature(unitId, taxYear);
    const effectiveEmployees = getYearActiveEmployees(unitId, taxYear);
    const effectiveEmployeeIds = effectiveEmployees.map((employee) => employee.id);
    const selectedEmployeeIdSet = new Set(
      employeeIds.filter((employeeId) => effectiveEmployeeIds.includes(employeeId)),
    );

    effectiveEmployees.forEach((employee) => {
      if (!selectedEmployeeIdSet.has(employee.id)) {
        annualTaxResultRepository.deleteByEmployeeAndYear(unitId, employee.id, taxYear);
        calculationRunRepository.deleteByEmployeeAndYear(unitId, employee.id, taxYear);
        return;
      }

      const records = getRecordedMonthRecords(getEmployeeRecords(unitId, employee.id, taxYear));
      if (!records.length) {
        annualTaxResultRepository.deleteByEmployeeAndYear(unitId, employee.id, taxYear);
        calculationRunRepository.deleteByEmployeeAndYear(unitId, employee.id, taxYear);
        return;
      }

      const bridgeContext = buildWithholdingBridgeContext(unitId, taxYear, employee.id);
      const resolvedWithholdingContext = resolveWithholdingContext(bridgeContext, withholdingContext);
      const calculation = calculateEmployeeAnnualTax(records, effectiveSettings, resolvedWithholdingContext);
      const nextCalculation = {
        ...calculation,
        ruleSourceSummary: buildRuleSourceSummary(bridgeContext, resolvedWithholdingContext),
      };
      const dataSignature = buildAnnualTaxDataSignatureFromRecords(records, bridgeContext);

      annualTaxResultRepository.upsert(
        unitId,
        employee.id,
        taxYear,
        nextCalculation,
        currentPolicySignature,
        dataSignature,
      );
      calculationRunRepository.markCalculated(
        unitId,
        employee.id,
        taxYear,
        "ready",
        currentPolicySignature,
        dataSignature,
      );
    });

    const currentResultMap = new Map(
      annualTaxResultRepository
        .listByUnitAndYear(unitId, taxYear, currentPolicySignature)
        .map((result) => [result.employeeId, result] as const),
    );
    const coverage = buildYearEntryResultCoverage(unitId, taxYear, effectiveEmployeeIds);

    return {
      status: "success",
      coverage: {
        ...coverage,
        requestedEmployeeCount: selectedEmployeeIdSet.size,
      },
      summaryRows: effectiveEmployees
        .filter((employee) => selectedEmployeeIdSet.has(employee.id))
        .map((employee) => currentResultMap.get(employee.id))
        .filter((result): result is NonNullable<typeof result> => Boolean(result))
        .map((result) => buildYearEntryCalculationSummaryRow(result)),
    };
  },

  buildEmployeeYearWorkspace(unitId: number, taxYear: number, employeeId: number): EmployeeYearRecordWorkspace {
    const employee = employeeRepository.getById(employeeId);
    if (!employee || employee.unitId !== unitId) {
      throw new Error("employee_not_found");
    }

    return {
      unitId,
      employeeId,
      employeeCode: employee.employeeCode,
      employeeName: employee.employeeName,
      taxYear,
      lockedMonths: monthConfirmationRepository.getLockedMonths(unitId, taxYear),
      months: getEmployeeRecords(unitId, employeeId, taxYear),
    };
  },

  saveEmployeeYearWorkspace(
    unitId: number,
    taxYear: number,
    employeeId: number,
    payload: BatchUpsertEmployeeYearRecordsPayload,
  ) {
    const lockedMonths = monthConfirmationRepository.getLockedMonths(unitId, taxYear);
    const targetLockedMonths = payload.months
      .map((item) => item.taxMonth)
      .filter(
        (taxMonth, index, source) =>
          lockedMonths.includes(taxMonth) && source.indexOf(taxMonth) === index,
      );

    if (targetLockedMonths.length) {
      throw new MonthConfirmationConflictError("目标月份已确认，禁止修改。", targetLockedMonths);
    }

    payload.months.forEach((item) => {
      monthRecordRepository.upsert(unitId, employeeId, taxYear, item.taxMonth, item);
    });

    return this.buildEmployeeYearWorkspace(unitId, taxYear, employeeId);
  },

  getMonthConfirmationState(unitId: number, taxYear: number): MonthConfirmationState {
    const confirmedRecords = monthConfirmationRepository.listByUnitAndYear(unitId, taxYear);
    const confirmedAtMap = new Map(
      confirmedRecords.map((record) => [record.taxMonth, record.confirmedAt]),
    );
    const lastConfirmedMonth = monthConfirmationRepository.getLastConfirmedMonth(unitId, taxYear);
    const coverage = buildYearEntryResultCoverage(
      unitId,
      taxYear,
      getYearActiveEmployees(unitId, taxYear).map((employee) => employee.id),
    );

    return {
      lastConfirmedMonth,
      coverage,
      months: TAX_MONTHS.map((taxMonth) => {
        const isConfirmed = confirmedAtMap.has(taxMonth);
        const { canConfirm, blockedReason } = getMonthConfirmability(
          unitId,
          taxYear,
          taxMonth,
          coverage,
        );

        return {
          taxMonth,
          isConfirmed,
          confirmedAt: confirmedAtMap.get(taxMonth) ?? null,
          canConfirm,
          canUnconfirm: isConfirmed,
          blockedReason: isConfirmed ? "already_confirmed" : blockedReason,
        };
      }),
    };
  },

  confirmMonth(unitId: number, taxYear: number, taxMonth: number) {
    const coverage = buildYearEntryResultCoverage(
      unitId,
      taxYear,
      getYearActiveEmployees(unitId, taxYear).map((employee) => employee.id),
    );
    const { canConfirm, blockedReason } = getMonthConfirmability(
      unitId,
      taxYear,
      taxMonth,
      coverage,
    );
    if (!canConfirm) {
      throw new MonthConfirmationConflictError(
        blockedReason === "results_incomplete"
          ? "当前计算结果未覆盖全部有效员工，无法确认当前月份。"
          : "当前月份不满足确认条件。",
        blockedReason ? [taxMonth] : [],
      );
    }

    monthConfirmationRepository.confirm(unitId, taxYear, taxMonth);
    return this.getMonthConfirmationState(unitId, taxYear);
  },

  unconfirmMonth(unitId: number, taxYear: number, taxMonth: number) {
    monthConfirmationRepository.unconfirmFromMonth(unitId, taxYear, taxMonth);
    return this.getMonthConfirmationState(unitId, taxYear);
  },
};
