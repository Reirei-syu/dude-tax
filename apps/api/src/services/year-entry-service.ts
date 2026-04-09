import {
  calculateEmployeeAnnualTax,
  isEmployeeActiveInTaxMonth,
  isEmployeeActiveInTaxYear,
  type BatchUpsertEmployeeYearRecordsPayload,
  type EmployeeMonthRecord,
  type EmployeeYearEntryOverview,
  type EmployeeYearRecordWorkspace,
  type MonthConfirmationState,
} from "@dude-tax/core";
import { employeeRepository } from "../repositories/employee-repository.js";
import { monthConfirmationRepository } from "../repositories/month-confirmation-repository.js";
import { monthRecordRepository } from "../repositories/month-record-repository.js";
import { taxPolicyRepository } from "../repositories/tax-policy-repository.js";

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

const normalizeSelectedMonths = (selectedMonths: number[]) => {
  const selectedMonthSet = new Set(
    selectedMonths.filter((taxMonth) => Number.isInteger(taxMonth) && taxMonth >= 1 && taxMonth <= 12),
  );

  return TAX_MONTHS.filter((taxMonth) => selectedMonthSet.has(taxMonth));
};

const getYearActiveEmployees = (unitId: number, taxYear: number) =>
  employeeRepository
    .listByUnitId(unitId)
    .filter((employee) => isEmployeeActiveInTaxYear(employee, taxYear));

const getEmployeeRecords = (unitId: number, employeeId: number, taxYear: number) =>
  monthRecordRepository.listByEmployeeAndYear(unitId, employeeId, taxYear);

const getMonthRecordByTaxMonth = (records: EmployeeMonthRecord[], taxMonth: number) =>
  records.find((record) => record.taxMonth === taxMonth) ?? null;

const buildEffectiveMonthRecord = (
  records: EmployeeMonthRecord[],
  taxMonth: number,
  shouldForceZeroRow: boolean,
) => {
  const record = getMonthRecordByTaxMonth(records, taxMonth);
  if (!record) {
    return null;
  }

  if (shouldForceZeroRow || hasMonthRecordContent(record)) {
    return record;
  }

  return null;
};

type ConfirmabilityResult = {
  canConfirm: boolean;
  blockedReason: string | null;
};

const getMonthConfirmability = (unitId: number, taxYear: number, taxMonth: number): ConfirmabilityResult => {
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

  buildYearEntryOverview(unitId: number, taxYear: number, selectedMonths: number[]) {
    const normalizedMonths = normalizeSelectedMonths(selectedMonths);
    const effectiveSettings = taxPolicyRepository.getEffectiveSettingsForScope(unitId, taxYear);
    const confirmedMonthSet = new Set(monthConfirmationRepository.getLockedMonths(unitId, taxYear));
    const employees = getYearActiveEmployees(unitId, taxYear);

    const employeeRows: EmployeeYearEntryOverview[] = employees.map((employee) => {
      const records = getEmployeeRecords(unitId, employee.id, taxYear);
      const activeMonths = TAX_MONTHS.filter((taxMonth) =>
        isEmployeeActiveInTaxMonth(employee, taxYear, taxMonth),
      );
      const uneditedMonths = activeMonths.filter((taxMonth) => {
        const record = getMonthRecordByTaxMonth(records, taxMonth);
        return !confirmedMonthSet.has(taxMonth) && !hasMonthRecordContent(record);
      });

      const selectedEffectiveRecords = normalizedMonths
        .filter((taxMonth) => isEmployeeActiveInTaxMonth(employee, taxYear, taxMonth))
        .map((taxMonth) =>
          buildEffectiveMonthRecord(records, taxMonth, confirmedMonthSet.has(taxMonth)),
        )
        .filter((record): record is EmployeeMonthRecord => Boolean(record));

      let optimalScheme: EmployeeYearEntryOverview["optimalScheme"] = null;
      if (selectedEffectiveRecords.length) {
        optimalScheme = calculateEmployeeAnnualTax(selectedEffectiveRecords, effectiveSettings).selectedScheme;
      }

      return {
        employeeId: employee.id,
        employeeCode: employee.employeeCode,
        employeeName: employee.employeeName,
        totalWithheldTax: selectedEffectiveRecords.reduce(
          (sum, record) => sum + Number(record.withheldTax ?? 0),
          0,
        ),
        optimalScheme,
        uneditedMonths,
      };
    });

    return {
      selectedMonths: normalizedMonths,
      totalWithheldTax: employeeRows.reduce((sum, employee) => sum + employee.totalWithheldTax, 0),
      employees: employeeRows,
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

    return {
      lastConfirmedMonth,
      months: TAX_MONTHS.map((taxMonth) => {
        const isConfirmed = confirmedAtMap.has(taxMonth);
        const { canConfirm, blockedReason } = getMonthConfirmability(unitId, taxYear, taxMonth);

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
    const { canConfirm, blockedReason } = getMonthConfirmability(unitId, taxYear, taxMonth);
    if (!canConfirm) {
      throw new MonthConfirmationConflictError(
        "当前月份不满足确认条件。",
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
