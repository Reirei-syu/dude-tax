import type {
  AnnualTaxCalculation,
  AnnualTaxSchemeResult,
  AnnualTaxWithholdingContext,
  AnnualTaxWithholdingMode,
  AnnualTaxWithholdingTrace,
  AnnualTaxWithholdingTraceItem,
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

const getSupplementarySalaryIncome = (record: EmployeeMonthRecord) =>
  roundCurrency(record.supplementarySalaryIncome ?? 0);

const getSupplementaryWithheldTaxAdjustment = (record: EmployeeMonthRecord) =>
  roundCurrency(record.supplementaryWithheldTaxAdjustment ?? 0);

export const getSalaryIncomeForWithholding = (record: EmployeeMonthRecord) =>
  roundCurrency(record.salaryIncome + getSupplementarySalaryIncome(record));

export const getActualWithheldTaxForWithholding = (record: EmployeeMonthRecord) =>
  roundCurrency(record.withheldTax + getSupplementaryWithheldTaxAdjustment(record));

export const hasSupplementaryAdjustments = (record: EmployeeMonthRecord) =>
  getSupplementarySalaryIncome(record) !== 0 ||
  getSupplementaryWithheldTaxAdjustment(record) !== 0 ||
  Boolean(record.supplementarySourcePeriodLabel?.trim()) ||
  Boolean(record.supplementaryRemark?.trim());

const resolveWithholdingMode = (
  context: AnnualTaxWithholdingContext,
): AnnualTaxWithholdingMode => {
  if (context.mode && context.mode !== "auto") {
    return context.mode;
  }

  if (context.previousYearIncomeUnder60k) {
    return "annual_60000_upfront";
  }

  if ((context.firstSalaryMonthInYear ?? 1) > 1) {
    return "first_salary_month_cumulative";
  }

  return "standard_cumulative";
};

const getCumulativeBasicDeduction = (
  mode: AnnualTaxWithholdingMode,
  taxMonth: number,
  processedMonthCount: number,
  monthlyBasicDeduction: number,
) => {
  if (mode === "annual_60000_upfront") {
    return roundCurrency(monthlyBasicDeduction * 12);
  }

  if (mode === "first_salary_month_cumulative") {
    return roundCurrency(monthlyBasicDeduction * taxMonth);
  }

  return roundCurrency(monthlyBasicDeduction * processedMonthCount);
};

export const buildMonthlyWithholdingTrace = (
  records: EmployeeMonthRecord[],
  context: AnnualTaxWithholdingContext = {},
  taxPolicy: TaxPolicySettings = buildDefaultTaxPolicySettings(),
): AnnualTaxWithholdingTrace => {
  const completedRecords = [...records]
    .filter((record) => record.status === "completed")
    .sort((leftRecord, rightRecord) => leftRecord.taxMonth - rightRecord.taxMonth);

  if (!completedRecords.length) {
    throw new Error("当前员工暂无已完成月份，无法生成预扣预缴轨迹");
  }

  const mode = resolveWithholdingMode(context);
  let cumulativeSalaryIncome = 0;
  let cumulativeInsuranceAndHousingFund = 0;
  let cumulativeSpecialAdditionalDeduction = 0;
  let cumulativeOtherDeduction = 0;
  let cumulativeTaxReductionExemption = 0;
  let previousCumulativeExpectedWithheldTax = 0;

  const items = completedRecords.map((record, index) => {
    cumulativeSalaryIncome = roundCurrency(
      cumulativeSalaryIncome + getSalaryIncomeForWithholding(record),
    );
    cumulativeInsuranceAndHousingFund = roundCurrency(
      cumulativeInsuranceAndHousingFund + getInsuranceAndHousingFundTotal(record),
    );
    cumulativeSpecialAdditionalDeduction = roundCurrency(
      cumulativeSpecialAdditionalDeduction + getSpecialAdditionalDeductionTotal(record),
    );
    cumulativeOtherDeduction = roundCurrency(cumulativeOtherDeduction + record.otherDeduction);
    cumulativeTaxReductionExemption = roundCurrency(
      cumulativeTaxReductionExemption + record.taxReductionExemption,
    );

    const cumulativeBasicDeduction = getCumulativeBasicDeduction(
      mode,
      record.taxMonth,
      index + 1,
      taxPolicy.basicDeductionAmount,
    );
    const cumulativeTaxableIncome = calculateTaxableIncome(
      cumulativeSalaryIncome -
        cumulativeBasicDeduction -
        cumulativeInsuranceAndHousingFund -
        cumulativeSpecialAdditionalDeduction -
        cumulativeOtherDeduction,
    );
    const cumulativeBracket =
      cumulativeTaxableIncome > 0
        ? pickComprehensiveBracket(cumulativeTaxableIncome, taxPolicy)
        : null;
    const cumulativeExpectedWithheldTax = cumulativeBracket
      ? roundCurrency(
          Math.max(
            cumulativeTaxableIncome * (cumulativeBracket.rate / 100) -
              cumulativeBracket.quickDeduction -
              cumulativeTaxReductionExemption,
            0,
          ),
        )
      : 0;
    const currentMonthExpectedWithheldTax = roundCurrency(
      cumulativeExpectedWithheldTax - previousCumulativeExpectedWithheldTax,
    );

    previousCumulativeExpectedWithheldTax = cumulativeExpectedWithheldTax;

    const item: AnnualTaxWithholdingTraceItem = {
      taxMonth: record.taxMonth,
      withholdingMode: mode,
      salaryIncome: getSalaryIncomeForWithholding(record),
      actualWithheldTax: getActualWithheldTaxForWithholding(record),
      cumulativeSalaryIncome,
      cumulativeBasicDeduction,
      cumulativeInsuranceAndHousingFund,
      cumulativeSpecialAdditionalDeduction,
      cumulativeOtherDeduction,
      cumulativeTaxReductionExemption,
      cumulativeTaxableIncome,
      cumulativeExpectedWithheldTax,
      currentMonthExpectedWithheldTax,
      currentMonthWithholdingVariance: roundCurrency(
        getActualWithheldTaxForWithholding(record) - currentMonthExpectedWithheldTax,
      ),
    };

    return item;
  });

  const expectedWithheldTaxTotal = roundCurrency(
    items.reduce((sum, item) => sum + item.currentMonthExpectedWithheldTax, 0),
  );
  const actualWithheldTaxTotal = roundCurrency(
    items.reduce((sum, item) => sum + item.actualWithheldTax, 0),
  );

  return {
    mode,
    items,
    summary: {
      withholdingMode: mode,
      expectedWithheldTaxTotal,
      actualWithheldTaxTotal,
      withholdingVariance: roundCurrency(actualWithheldTaxTotal - expectedWithheldTaxTotal),
      traceCount: items.length,
    },
  };
};

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
  withholdingContext: AnnualTaxWithholdingContext = {},
): AnnualTaxCalculation => {
  const completedRecords = records.filter((record) => record.status === "completed");
  if (!completedRecords.length) {
    throw new Error("当前员工暂无已完成月份，无法执行年度计算");
  }

  const completedMonthCount = completedRecords.length;
  const salaryIncomeTotal = roundCurrency(
    completedRecords.reduce((sum, record) => sum + getSalaryIncomeForWithholding(record), 0),
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
  const withholdingTrace = buildMonthlyWithholdingTrace(records, withholdingContext, taxPolicy);
  const annualTaxWithheld = withholdingTrace.summary.actualWithheldTaxTotal;
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
    withholdingSummary: withholdingTrace.summary,
    schemeResults: {
      separateBonus,
      combinedBonus,
    },
  };
};
