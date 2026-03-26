import {
  type AnnualTaxExportPreviewRow,
  calculateEmployeeAnnualTax,
  type AnnualTaxCalculation,
  type EmployeeCalculationStatus,
  type EmployeeAnnualTaxResult,
  type HistoryAnnualTaxQuery,
  type TaxSettlementDirection,
  type TaxCalculationScheme,
} from "../../../../packages/core/src/index.js";
import { annualTaxResultRepository } from "../repositories/annual-tax-result-repository.js";
import { calculationRunRepository } from "../repositories/calculation-run-repository.js";
import { monthRecordRepository } from "../repositories/month-record-repository.js";
import { unitRepository } from "../repositories/unit-repository.js";

export class EmployeeCalculationNotReadyError extends Error {
  constructor() {
    super("目标员工当前数据未准备完成，无法重算");
  }
}

export class AnnualTaxResultNotFoundError extends Error {
  constructor() {
    super("目标员工当前还没有可切换的年度结果");
  }
}

const schemeLabelMap: Record<TaxCalculationScheme, string> = {
  separate_bonus: "年终奖单独计税",
  combined_bonus: "并入综合所得",
};

const settlementDirectionLabelMap: Record<TaxSettlementDirection, string> = {
  payable: "应补税",
  refund: "应退税",
  balanced: "已平",
};

const getSelectedTaxAmount = (
  calculation: AnnualTaxCalculation,
  selectedScheme: TaxCalculationScheme,
) =>
  selectedScheme === "separate_bonus"
    ? calculation.schemeResults.separateBonus.finalTax
    : calculation.schemeResults.combinedBonus.finalTax;

const applySelectedScheme = (
  calculation: AnnualTaxCalculation,
  selectedScheme: TaxCalculationScheme,
): AnnualTaxCalculation => {
  const annualTaxPayable = getSelectedTaxAmount(calculation, selectedScheme);
  const annualTaxSettlement = Math.round(
    (annualTaxPayable - calculation.annualTaxWithheld + Number.EPSILON) * 100,
  ) / 100;
  const settlementDirection: TaxSettlementDirection =
    annualTaxSettlement > 0 ? "payable" : annualTaxSettlement < 0 ? "refund" : "balanced";

  return {
    ...calculation,
    selectedScheme,
    selectedTaxAmount: annualTaxPayable,
    annualTaxPayable,
    annualTaxSettlement,
    settlementDirection,
  };
};

const buildExportPreviewRow = (
  unitName: string,
  result: EmployeeAnnualTaxResult,
): AnnualTaxExportPreviewRow => {
  const selectedSchemeResult =
    result.selectedScheme === "separate_bonus"
      ? result.schemeResults.separateBonus
      : result.schemeResults.combinedBonus;

  return {
    unitId: result.unitId,
    unitName,
    taxYear: result.taxYear,
    employeeId: result.employeeId,
    employeeCode: result.employeeCode,
    employeeName: result.employeeName,
    completedMonthCount: result.completedMonthCount,
    selectedScheme: result.selectedScheme,
    selectedSchemeLabel: schemeLabelMap[result.selectedScheme],
    salaryIncomeTotal: result.salaryIncomeTotal,
    annualBonusTotal: result.annualBonusTotal,
    insuranceAndHousingFundTotal: result.insuranceAndHousingFundTotal,
    specialAdditionalDeductionTotal: result.specialAdditionalDeductionTotal,
    otherDeductionTotal: result.otherDeductionTotal,
    basicDeductionTotal: result.basicDeductionTotal,
    taxReductionExemptionTotal: result.taxReductionExemptionTotal,
    annualTaxPayable: result.annualTaxPayable,
    annualTaxWithheld: result.annualTaxWithheld,
    annualTaxSettlement: result.annualTaxSettlement,
    settlementDirection: result.settlementDirection,
    settlementDirectionLabel: settlementDirectionLabelMap[result.settlementDirection],
    selectedTaxableComprehensiveIncome: selectedSchemeResult.taxableComprehensiveIncome,
    selectedComprehensiveIncomeTax: selectedSchemeResult.comprehensiveIncomeTax,
    selectedAnnualBonusTax: selectedSchemeResult.annualBonusTax,
    selectedGrossTax: selectedSchemeResult.grossTax,
    selectedFinalTax: result.annualTaxPayable,
    calculatedAt: result.calculatedAt,
  };
};

const recalculateReadyStatus = (unitId: number, taxYear: number, status: EmployeeCalculationStatus) => {
  const records = monthRecordRepository.listByEmployeeAndYear(unitId, status.employeeId, taxYear);
  const calculation = calculateEmployeeAnnualTax(records);
  const existingResult = annualTaxResultRepository.getByEmployeeAndYear(
    unitId,
    status.employeeId,
    taxYear,
  );
  const nextCalculation = applySelectedScheme(
    calculation,
    existingResult?.selectedScheme ?? calculation.selectedScheme,
  );

  annualTaxResultRepository.upsert(unitId, status.employeeId, taxYear, nextCalculation);
  calculationRunRepository.markCalculated(
    unitId,
    status.employeeId,
    taxYear,
    status.preparationStatus,
  );
};

export const annualTaxService = {
  searchHistory(filters: HistoryAnnualTaxQuery) {
    return annualTaxResultRepository.searchHistory(filters);
  },
  listResults(unitId: number, taxYear: number) {
    return annualTaxResultRepository.listByUnitAndYear(unitId, taxYear);
  },
  listExportPreview(unitId: number, taxYear: number) {
    const unit = unitRepository.getById(unitId);
    const unitName = unit?.unitName ?? "未知单位";

    return annualTaxResultRepository
      .listByUnitAndYear(unitId, taxYear)
      .map((result) => buildExportPreviewRow(unitName, result));
  },
  updateSelectedScheme(
    unitId: number,
    employeeId: number,
    taxYear: number,
    selectedScheme: TaxCalculationScheme,
  ) {
    const result = annualTaxResultRepository.getByEmployeeAndYear(unitId, employeeId, taxYear);
    if (!result) {
      throw new AnnualTaxResultNotFoundError();
    }

    const nextCalculation = applySelectedScheme(result, selectedScheme);
    annualTaxResultRepository.updateSelectedScheme(
      unitId,
      employeeId,
      taxYear,
      nextCalculation.selectedScheme,
      nextCalculation.selectedTaxAmount,
      nextCalculation,
    );

    return annualTaxResultRepository.getByEmployeeAndYear(unitId, employeeId, taxYear);
  },
  recalculate(unitId: number, taxYear: number, employeeId?: number) {
    const statuses = calculationRunRepository.listStatuses(unitId, taxYear);
    const targetStatuses = employeeId
      ? statuses.filter((status) => status.employeeId === employeeId)
      : statuses;

    if (employeeId && targetStatuses.some((status) => status.preparationStatus !== "ready")) {
      throw new EmployeeCalculationNotReadyError();
    }

    targetStatuses
      .filter((status) => status.preparationStatus === "ready")
      .forEach((status) => {
        recalculateReadyStatus(unitId, taxYear, status);
      });

    return calculationRunRepository.listStatuses(unitId, taxYear);
  },
};
