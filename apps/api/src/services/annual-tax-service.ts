import {
  type AnnualTaxRuleSourceSummary,
  type AnnualTaxExportPreviewRow,
  taxCalculationSchemeLabelMap,
  taxSettlementDirectionLabelMap,
  calculateEmployeeAnnualTax,
  type AnnualTaxCalculation,
  type AnnualTaxWithholdingContext,
  type EmployeeCalculationStatus,
  type EmployeeAnnualTaxResult,
  type HistoryAnnualTaxQuery,
  type HistoryResultRecalculationResponse,
  type TaxCalculationScheme,
} from "@dude-tax/core";
import { annualTaxResultRepository } from "../repositories/annual-tax-result-repository.js";
import { calculationRunRepository } from "../repositories/calculation-run-repository.js";
import { monthRecordRepository } from "../repositories/month-record-repository.js";
import { taxPolicyRepository } from "../repositories/tax-policy-repository.js";
import { unitRepository } from "../repositories/unit-repository.js";
import {
  buildAnnualTaxDataSignatureFromRecords,
  buildRuleSourceSummary,
  buildWithholdingBridgeContext,
  resolveWithholdingContext,
  type AnnualTaxWithholdingBridgeContext,
} from "../domain/annual-tax-calculation-context.js";
import { buildHistoryResultRecalculationComparisonItems } from "../domain/history-result-recalculation.js";

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
  const annualTaxSettlement =
    Math.round((annualTaxPayable - calculation.annualTaxWithheld + Number.EPSILON) * 100) / 100;
  const settlementDirection =
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
    selectedSchemeLabel: taxCalculationSchemeLabelMap[result.selectedScheme],
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
    settlementDirectionLabel: taxSettlementDirectionLabelMap[result.settlementDirection],
    selectedTaxableComprehensiveIncome: selectedSchemeResult.taxableComprehensiveIncome,
    selectedComprehensiveIncomeTax: selectedSchemeResult.comprehensiveIncomeTax,
    selectedAnnualBonusTax: selectedSchemeResult.annualBonusTax,
    selectedGrossTax: selectedSchemeResult.grossTax,
    selectedFinalTax: result.annualTaxPayable,
    calculatedAt: result.calculatedAt,
  };
};

const recalculateReadyStatus = (
  unitId: number,
  taxYear: number,
  status: EmployeeCalculationStatus,
  currentSettings: ReturnType<typeof taxPolicyRepository.get>["currentSettings"],
  currentPolicySignature: string,
  withholdingContext: AnnualTaxWithholdingContext,
  bridgeContext: AnnualTaxWithholdingBridgeContext,
  ruleSourceSummary: AnnualTaxRuleSourceSummary,
) => {
  const records = monthRecordRepository.listByEmployeeAndYear(unitId, status.employeeId, taxYear);
  const calculation = calculateEmployeeAnnualTax(records, currentSettings, withholdingContext);
  const dataSignature = buildAnnualTaxDataSignatureFromRecords(records, bridgeContext);
  const existingResult = annualTaxResultRepository.getByEmployeeAndYear(
    unitId,
    status.employeeId,
    taxYear,
    currentPolicySignature,
  );
  const nextCalculation = applySelectedScheme(
    calculation,
    existingResult?.selectedScheme ?? calculation.selectedScheme,
  );

  annualTaxResultRepository.upsert(
    unitId,
    status.employeeId,
    taxYear,
    {
      ...nextCalculation,
      ruleSourceSummary,
    },
    currentPolicySignature,
    dataSignature,
  );
  calculationRunRepository.markCalculated(
    unitId,
    status.employeeId,
    taxYear,
    status.preparationStatus,
    currentPolicySignature,
    dataSignature,
  );
};

export const annualTaxService = {
  buildWithholdingBridgeContext,
  searchHistory(filters: HistoryAnnualTaxQuery) {
    return annualTaxResultRepository.searchHistory(filters);
  },
  listResultVersions(unitId: number, taxYear: number, employeeId: number) {
    return annualTaxResultRepository.listVersionsByEmployeeAndYear(
      unitId,
      employeeId,
      taxYear,
      taxPolicyRepository.getCurrentPolicySignature(unitId, taxYear),
    );
  },
  listResults(unitId: number, taxYear: number) {
    return annualTaxResultRepository.listByUnitAndYear(
      unitId,
      taxYear,
      taxPolicyRepository.getCurrentPolicySignature(unitId, taxYear),
    );
  },
  recalculateHistoryResult(
    unitId: number,
    taxYear: number,
    employeeId: number,
  ): HistoryResultRecalculationResponse {
    const snapshotResult = annualTaxResultRepository.getHistoryByEmployeeAndYear(
      unitId,
      employeeId,
      taxYear,
    );

    if (!snapshotResult) {
      throw new AnnualTaxResultNotFoundError();
    }

    const effectiveSettings = taxPolicyRepository.getEffectiveSettingsForScope(unitId, taxYear);
    const currentRecords = monthRecordRepository.listByEmployeeAndYear(unitId, employeeId, taxYear);
    const bridgeContext = buildWithholdingBridgeContext(unitId, taxYear, employeeId);
    const resolvedWithholdingContext = resolveWithholdingContext(bridgeContext, {});
    const recalculatedResult = {
      ...calculateEmployeeAnnualTax(currentRecords, effectiveSettings, resolvedWithholdingContext),
      ruleSourceSummary: buildRuleSourceSummary(bridgeContext, resolvedWithholdingContext),
    };

    return {
      snapshotResult,
      recalculatedResult,
      comparisonItems: buildHistoryResultRecalculationComparisonItems(
        snapshotResult,
        recalculatedResult,
      ),
      invalidatedReason: snapshotResult.invalidatedReason,
    };
  },
  listExportPreview(unitId: number, taxYear: number) {
    const unit = unitRepository.getById(unitId);
    const unitName = unit?.unitName ?? "未知单位";

    return annualTaxResultRepository
      .listByUnitAndYear(
        unitId,
        taxYear,
        taxPolicyRepository.getCurrentPolicySignature(unitId, taxYear),
      )
      .map((result) => buildExportPreviewRow(unitName, result));
  },
  updateSelectedScheme(
    unitId: number,
    employeeId: number,
    taxYear: number,
    selectedScheme: TaxCalculationScheme,
  ) {
    const result = annualTaxResultRepository.getByEmployeeAndYear(
      unitId,
      employeeId,
      taxYear,
      taxPolicyRepository.getCurrentPolicySignature(unitId, taxYear),
    );
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

    return annualTaxResultRepository.getByEmployeeAndYear(
      unitId,
      employeeId,
      taxYear,
      taxPolicyRepository.getCurrentPolicySignature(unitId, taxYear),
    );
  },
  recalculate(
    unitId: number,
    taxYear: number,
    employeeId?: number,
    withholdingContext: AnnualTaxWithholdingContext = {},
  ) {
    const effectiveSettings = taxPolicyRepository.getEffectiveSettingsForScope(unitId, taxYear);
    const currentPolicySignature = taxPolicyRepository.getCurrentPolicySignature(unitId, taxYear);
    const statuses = calculationRunRepository.listStatuses(unitId, taxYear, currentPolicySignature);
    const targetStatuses = employeeId
      ? statuses.filter((status) => status.employeeId === employeeId)
      : statuses;

    if (employeeId && targetStatuses.some((status) => status.preparationStatus !== "ready")) {
      throw new EmployeeCalculationNotReadyError();
    }

    targetStatuses
      .filter((status) => status.preparationStatus === "ready")
      .forEach((status) => {
        const bridgeContext = buildWithholdingBridgeContext(unitId, taxYear, status.employeeId);
        const resolvedWithholdingContext = resolveWithholdingContext(
          bridgeContext,
          withholdingContext,
        );
        recalculateReadyStatus(
          unitId,
          taxYear,
          status,
          effectiveSettings,
          currentPolicySignature,
          resolvedWithholdingContext,
          bridgeContext,
          buildRuleSourceSummary(bridgeContext, resolvedWithholdingContext),
        );
      });

    return calculationRunRepository.listStatuses(unitId, taxYear, currentPolicySignature);
  },
};
