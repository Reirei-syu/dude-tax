import type {
  AnnualTaxCalculation,
  AnnualTaxSchemeResult,
  EmployeeMonthRecord,
  TaxPolicySettings,
  TaxSettlementDirection,
  TaxCalculationScheme,
} from "./index.js";
import { buildDefaultTaxPolicySettings } from "./tax-policy.js";

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const calculateTaxableIncome = (value: number) => roundCurrency(Math.max(value, 0));

const deriveSettlementDirection = (annualTaxSettlement: number): TaxSettlementDirection => {
  if (annualTaxSettlement > 0) {
    return "payable";
  }

  if (annualTaxSettlement < 0) {
    return "refund";
  }

  return "balanced";
};

const getInsuranceAndHousingFundTotal = (record: EmployeeMonthRecord) =>
  record.pensionInsurance +
  record.medicalInsurance +
  record.occupationalAnnuity +
  record.housingFund +
  record.supplementaryHousingFund +
  record.unemploymentInsurance +
  record.workInjuryInsurance;

const getSpecialAdditionalDeductionTotal = (record: EmployeeMonthRecord) =>
  record.infantCareDeduction +
  record.childEducationDeduction +
  record.continuingEducationDeduction +
  record.housingLoanInterestDeduction +
  record.housingRentDeduction +
  record.elderCareDeduction;

const pickComprehensiveBracket = (annualTaxableIncome: number, taxPolicy: TaxPolicySettings) =>
  taxPolicy.comprehensiveTaxBrackets.find(
    (bracket) => bracket.maxAnnualIncome === null || annualTaxableIncome <= bracket.maxAnnualIncome,
  ) ??
  taxPolicy.comprehensiveTaxBrackets[taxPolicy.comprehensiveTaxBrackets.length - 1];

const pickBonusBracket = (averageMonthlyBonus: number, taxPolicy: TaxPolicySettings) =>
  taxPolicy.bonusTaxBrackets.find(
    (bracket) =>
      bracket.maxAverageMonthlyIncome === null ||
      averageMonthlyBonus <= bracket.maxAverageMonthlyIncome,
  ) ?? taxPolicy.bonusTaxBrackets[taxPolicy.bonusTaxBrackets.length - 1];

const buildSchemeResult = (
  scheme: TaxCalculationScheme,
  taxableComprehensiveIncome: number,
  annualBonusTax: number,
  taxReductionExemptionTotal: number,
  bonusBracketLevel: number | null,
  taxPolicy: TaxPolicySettings,
): AnnualTaxSchemeResult => {
  const comprehensiveBracket =
    taxableComprehensiveIncome > 0
      ? pickComprehensiveBracket(taxableComprehensiveIncome, taxPolicy)
      : null;
  const comprehensiveIncomeTax = comprehensiveBracket
    ? roundCurrency(
        taxableComprehensiveIncome * (comprehensiveBracket.rate / 100) -
          comprehensiveBracket.quickDeduction,
      )
    : 0;

  const grossTax = roundCurrency(comprehensiveIncomeTax + annualBonusTax);
  const finalTax = roundCurrency(Math.max(grossTax - taxReductionExemptionTotal, 0));

  return {
    scheme,
    taxableComprehensiveIncome: roundCurrency(taxableComprehensiveIncome),
    comprehensiveIncomeTax,
    annualBonusTax: roundCurrency(annualBonusTax),
    grossTax,
    taxReductionExemptionTotal: roundCurrency(taxReductionExemptionTotal),
    finalTax,
    comprehensiveBracketLevel: comprehensiveBracket?.level ?? null,
    bonusBracketLevel,
  };
};

const buildSeparateBonusScheme = (
  salaryOnlyTaxableIncome: number,
  annualBonusTotal: number,
  taxReductionExemptionTotal: number,
  taxPolicy: TaxPolicySettings,
): AnnualTaxSchemeResult => {
  const averageMonthlyBonus = annualBonusTotal / 12;
  const bonusBracket = annualBonusTotal > 0 ? pickBonusBracket(averageMonthlyBonus, taxPolicy) : null;
  const annualBonusTax = bonusBracket
    ? roundCurrency(annualBonusTotal * (bonusBracket.rate / 100) - bonusBracket.quickDeduction)
    : 0;

  const schemeResult = buildSchemeResult(
    "separate_bonus",
    salaryOnlyTaxableIncome,
    annualBonusTax,
    taxReductionExemptionTotal,
    bonusBracket?.level ?? null,
    taxPolicy,
  );
  return schemeResult;
};

const buildCombinedBonusScheme = (
  combinedTaxableIncome: number,
  taxReductionExemptionTotal: number,
  taxPolicy: TaxPolicySettings,
): AnnualTaxSchemeResult => ({
  ...buildSchemeResult(
    "combined_bonus",
    combinedTaxableIncome,
    0,
    taxReductionExemptionTotal,
    null,
    taxPolicy,
  ),
});

export const calculateEmployeeAnnualTax = (
  records: EmployeeMonthRecord[],
  taxPolicy: TaxPolicySettings = buildDefaultTaxPolicySettings(),
): AnnualTaxCalculation => {
  const completedRecords = records.filter((record) => record.status === "completed");
  if (!completedRecords.length) {
    throw new Error("当前员工暂无已完成月份，无法执行年度计算");
  }

  const completedMonthCount = completedRecords.length;
  const salaryIncomeTotal = roundCurrency(
    completedRecords.reduce((sum, record) => sum + record.salaryIncome, 0),
  );
  const annualBonusTotal = roundCurrency(
    completedRecords.reduce((sum, record) => sum + record.annualBonus, 0),
  );
  const insuranceAndHousingFundTotal = roundCurrency(
    completedRecords.reduce((sum, record) => sum + getInsuranceAndHousingFundTotal(record), 0),
  );
  const specialAdditionalDeductionTotal = roundCurrency(
    completedRecords.reduce((sum, record) => sum + getSpecialAdditionalDeductionTotal(record), 0),
  );
  const otherDeductionTotal = roundCurrency(
    completedRecords.reduce((sum, record) => sum + record.otherDeduction, 0),
  );
  const taxReductionExemptionTotal = roundCurrency(
    completedRecords.reduce((sum, record) => sum + record.taxReductionExemption, 0),
  );
  const annualTaxWithheld = roundCurrency(
    completedRecords.reduce((sum, record) => sum + record.withheldTax, 0),
  );
  const basicDeductionTotal = roundCurrency(
    taxPolicy.basicDeductionAmount * completedMonthCount,
  );
  const deductibleTotal = roundCurrency(
    insuranceAndHousingFundTotal +
      specialAdditionalDeductionTotal +
      otherDeductionTotal +
      basicDeductionTotal,
  );

  const salaryOnlyTaxableIncome = calculateTaxableIncome(
    salaryIncomeTotal - deductibleTotal,
  );
  const combinedTaxableIncome = calculateTaxableIncome(
    salaryIncomeTotal + annualBonusTotal - deductibleTotal,
  );

  const separateBonus = buildSeparateBonusScheme(
    salaryOnlyTaxableIncome,
    annualBonusTotal,
    taxReductionExemptionTotal,
    taxPolicy,
  );
  const combinedBonus = buildCombinedBonusScheme(
    combinedTaxableIncome,
    taxReductionExemptionTotal,
    taxPolicy,
  );

  const selectedScheme =
    separateBonus.finalTax <= combinedBonus.finalTax ? "separate_bonus" : "combined_bonus";
  const selectedTaxAmount =
    selectedScheme === "separate_bonus" ? separateBonus.finalTax : combinedBonus.finalTax;
  const annualTaxPayable = selectedTaxAmount;
  const annualTaxSettlement = roundCurrency(annualTaxPayable - annualTaxWithheld);
  const settlementDirection = deriveSettlementDirection(annualTaxSettlement);

  return {
    completedMonthCount,
    salaryIncomeTotal,
    annualBonusTotal,
    insuranceAndHousingFundTotal,
    specialAdditionalDeductionTotal,
    otherDeductionTotal,
    basicDeductionTotal,
    taxReductionExemptionTotal,
    selectedScheme,
    selectedTaxAmount,
    annualTaxPayable,
    annualTaxWithheld,
    annualTaxSettlement,
    settlementDirection,
    schemeResults: {
      separateBonus,
      combinedBonus,
    },
  };
};
