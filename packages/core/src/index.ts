export type Unit = {
  id: number;
  unitName: string;
  remark: string;
  isArchived: boolean;
  availableTaxYears: number[];
  createdAt: string;
  updatedAt: string;
};

export type AppContext = {
  currentUnitId: number | null;
  currentTaxYear: number;
  units: Unit[];
};

export type CreateUnitPayload = {
  unitName: string;
  remark?: string;
  startYear?: number;
};

export type DeleteUnitChallenge = {
  challengeId: string;
  confirmationCode: string;
  expiresAt: string;
};

export type Employee = {
  id: number;
  unitId: number;
  employeeCode: string;
  employeeName: string;
  idNumber: string;
  hireDate: string | null;
  leaveDate: string | null;
  remark: string;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeGeneralStatus = "active" | "left";
export type EmployeeMonthStatus = "active" | "left_this_month" | "left";

export type CreateEmployeePayload = {
  employeeCode: string;
  employeeName: string;
  idNumber: string;
  hireDate?: string | null;
  leaveDate?: string | null;
  remark?: string;
};

export type UpdateEmployeePayload = CreateEmployeePayload;

export type MonthRecordStatus = "incomplete" | "completed";

export type EmployeeMonthOtherIncomeFields = {
  otherIncome?: number;
  otherIncomeRemark?: string;
};

export type EmployeeMonthLegacyCompatibilityFields = {
  status?: MonthRecordStatus;
  supplementarySalaryIncome?: number;
  supplementaryWithheldTaxAdjustment?: number;
  supplementarySourcePeriodLabel?: string;
  supplementaryRemark?: string;
};

export type EmployeeMonthRecord = {
  id: number | null;
  unitId: number;
  employeeId: number;
  taxYear: number;
  taxMonth: number;
  salaryIncome: number;
  annualBonus: number;
  pensionInsurance: number;
  medicalInsurance: number;
  occupationalAnnuity: number;
  housingFund: number;
  supplementaryHousingFund: number;
  unemploymentInsurance: number;
  workInjuryInsurance: number;
  withheldTax: number;
  infantCareDeduction: number;
  childEducationDeduction: number;
  continuingEducationDeduction: number;
  housingLoanInterestDeduction: number;
  housingRentDeduction: number;
  elderCareDeduction: number;
  otherDeduction: number;
  taxReductionExemption: number;
  remark: string;
  createdAt: string | null;
  updatedAt: string | null;
} & EmployeeMonthOtherIncomeFields &
  EmployeeMonthLegacyCompatibilityFields;

export type EmployeeYearEntryOverview = {
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  hireDate: string | null;
  leaveDate: string | null;
  employeeGroup: "active" | "left_this_year";
  recordedMonthCount: number;
  totalWithheldTax: number;
  optimalScheme: TaxCalculationScheme | null;
  uneditedMonths: number[];
};

export type YearEntryResultCoverage = {
  totalEffectiveEmployeeCount: number;
  calculatedEmployeeCount: number;
  uncoveredEmployeeIds: number[];
  isComplete: boolean;
};

export type YearEntryOverviewResponse = {
  totalEffectiveEmployeeCount: number;
  currentResultCoverage: YearEntryResultCoverage;
  employees: EmployeeYearEntryOverview[];
};

export type YearEntryCalculationSummaryRow = {
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  cumulativeExpectedWithheldTax: number;
  lastAppliedRate: number | null;
  selectedScheme: TaxCalculationScheme;
  alternativeTaxAmount: number;
};

export type YearEntryCalculationResponse = {
  status: "success";
  coverage: YearEntryResultCoverage & {
    requestedEmployeeCount: number;
  };
  summaryRows: YearEntryCalculationSummaryRow[];
};

export type EmployeeYearRecordWorkspace = {
  unitId: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  taxYear: number;
  lockedMonths: number[];
  months: EmployeeMonthRecord[];
};

export type UpsertEmployeeMonthRecordPayload = {
  salaryIncome: number;
  annualBonus: number;
  pensionInsurance: number;
  medicalInsurance: number;
  occupationalAnnuity: number;
  housingFund: number;
  supplementaryHousingFund: number;
  unemploymentInsurance: number;
  workInjuryInsurance: number;
  withheldTax: number;
  infantCareDeduction: number;
  childEducationDeduction: number;
  continuingEducationDeduction: number;
  housingLoanInterestDeduction: number;
  housingRentDeduction: number;
  elderCareDeduction: number;
  otherDeduction: number;
  taxReductionExemption: number;
  remark?: string;
} & EmployeeMonthOtherIncomeFields &
  EmployeeMonthLegacyCompatibilityFields;

export type YearRecordUpsertItem = UpsertEmployeeMonthRecordPayload & {
  taxMonth: number;
};

export type BatchUpsertEmployeeYearRecordsPayload = {
  months: YearRecordUpsertItem[];
};

export type CalculationPreparationStatus = "not_started" | "draft" | "ready";

export type ResultInvalidationReason = "tax_policy_changed" | "month_record_changed";
export type HistoryResultStatus = "current" | "invalidated" | "all";

export type EmployeeCalculationStatus = {
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  recordedMonthCount: number;
  completedMonthCount: number;
  preparationStatus: CalculationPreparationStatus;
  lastCalculatedAt: string | null;
  isInvalidated: boolean;
  invalidatedReason: ResultInvalidationReason | null;
};

export type TaxCalculationScheme = "separate_bonus" | "combined_bonus";

export type TaxSettlementDirection = "payable" | "refund" | "balanced";

export type AnnualTaxWithholdingMode =
  | "standard_cumulative"
  | "annual_60000_upfront"
  | "first_salary_month_cumulative";

export type AnnualTaxWithholdingContext = {
  mode?: AnnualTaxWithholdingMode | "auto";
  previousYearIncomeUnder60k?: boolean;
  firstSalaryMonthInYear?: number | null;
  carryInCompletedRecords?: EmployeeMonthRecord[];
};

export type AnnualTaxWithholdingTraceItem = {
  taxMonth: number;
  withholdingMode: AnnualTaxWithholdingMode;
  salaryIncome: number;
  actualWithheldTax: number;
  cumulativeActualWithheldTaxBeforeCurrentMonth: number;
  cumulativeSalaryIncome: number;
  cumulativeBasicDeduction: number;
  cumulativeInsuranceAndHousingFund: number;
  cumulativeSpecialAdditionalDeduction: number;
  cumulativeOtherDeduction: number;
  cumulativeTaxReductionExemption: number;
  cumulativeTaxableIncome: number;
  cumulativeExpectedWithheldTax: number;
  currentMonthExpectedWithheldTax: number;
  currentMonthWithholdingVariance: number;
  appliedRate: number;
};

export type AnnualTaxWithholdingSummary = {
  withholdingMode: AnnualTaxWithholdingMode;
  expectedWithheldTaxTotal: number;
  actualWithheldTaxTotal: number;
  withholdingVariance: number;
  traceCount: number;
};

export type AnnualTaxRuleSourceSummary = {
  hasCrossUnitCarryIn: boolean;
  crossUnitRecordCount: number;
  crossUnitUnitCount: number;
  usedPreviousYearIncomeReference: boolean;
  previousYearIncomeUnder60k: boolean | null;
  usedFirstSalaryMonthReference: boolean;
  firstSalaryMonthInYear: number | null;
};

export type AnnualTaxWithholdingTrace = {
  mode: AnnualTaxWithholdingMode;
  items: AnnualTaxWithholdingTraceItem[];
  summary: AnnualTaxWithholdingSummary;
};

export type ComprehensiveTaxBracket = {
  level: number;
  rangeText: string;
  maxAnnualIncome: number | null;
  rate: number;
  quickDeduction: number;
};

export type BonusTaxBracket = {
  level: number;
  rangeText: string;
  maxAverageMonthlyIncome: number | null;
  rate: number;
  quickDeduction: number;
};

export type ComprehensiveTaxBracketInput = Omit<ComprehensiveTaxBracket, "rangeText"> & {
  rangeText?: string;
};

export type BonusTaxBracketInput = Omit<BonusTaxBracket, "rangeText"> & {
  rangeText?: string;
};

export type TaxPolicySettingsInput = {
  basicDeductionAmount: number;
  comprehensiveTaxBrackets: ComprehensiveTaxBracketInput[];
  bonusTaxBrackets: BonusTaxBracketInput[];
};

export type TaxPolicySettings = {
  basicDeductionAmount: number;
  comprehensiveTaxBrackets: ComprehensiveTaxBracket[];
  bonusTaxBrackets: BonusTaxBracket[];
};

export type TaxPolicyMaintenanceNotes = {
  currentNotes: string;
  defaultNotes: string;
  notesCustomized: boolean;
};

export type TaxPolicyContent = {
  policyTitle: string;
  policyBody: string;
  policyIllustrationDataUrl: string;
};

export type TaxPolicyVersionSummary = {
  id: number;
  versionName: string;
  policySignature: string;
  isActive: boolean;
  createdAt: string;
  activatedAt: string | null;
};

export type TaxPolicyAuditAction =
  | "save_settings"
  | "update_notes"
  | "activate_version"
  | "bind_scope"
  | "unbind_scope";

export type TaxPolicyAuditLog = {
  id: number;
  actionType: TaxPolicyAuditAction;
  actorLabel: string;
  versionId: number | null;
  versionName: string | null;
  unitId: number | null;
  taxYear: number | null;
  summary: string;
  createdAt: string;
};

export type TaxPolicyVersionDiffItem = {
  label: string;
  baselineValue: string;
  targetValue: string;
};

export type TaxPolicyVersionImpactPreview = {
  unitId: number;
  taxYear: number;
  currentVersionId: number;
  currentVersionName: string;
  targetVersionId: number;
  targetVersionName: string;
  currentBindingMode: "bound" | "inherited";
  targetBindingMode: "bound" | "inherited";
  affectedResultCount: number;
  invalidatedResultCount: number;
  affectedRunCount: number;
  invalidatedRunCount: number;
  diffItems: TaxPolicyVersionDiffItem[];
};

export type TaxPolicyScopeBindingSummary = {
  unitId: number;
  taxYear: number;
  versionId: number;
  versionName: string;
  policySignature: string;
  isInherited: boolean;
};

export type TaxPolicyResponse = {
  currentSettings: TaxPolicySettings;
  defaultSettings: TaxPolicySettings;
  isCustomized: boolean;
  currentVersionId: number;
  currentVersionName: string;
  versions: TaxPolicyVersionSummary[];
  currentScopeBinding: TaxPolicyScopeBindingSummary | null;
  auditLogs: TaxPolicyAuditLog[];
  policyTitle: string;
  policyBody: string;
  policyIllustrationDataUrl: string;
  defaultPolicyTitle: string;
  defaultPolicyBody: string;
  defaultPolicyIllustrationDataUrl: string;
  policyCustomized: boolean;
} & TaxPolicyMaintenanceNotes;

export type TaxPolicySaveResponse = TaxPolicyResponse & {
  invalidatedResults: boolean;
};

export type TaxPolicyUpdatePayload = TaxPolicySettingsInput & {
  maintenanceNotes?: string;
  policyTitle?: string;
  policyBody?: string;
  policyIllustrationDataUrl?: string;
};

export type QuickCalculateMonthInput = UpsertEmployeeMonthRecordPayload & {
  taxMonth: number;
};

export type QuickCalculatePayload = {
  unitId: number;
  taxYear: number;
  records: QuickCalculateMonthInput[];
  withholdingContext?: AnnualTaxWithholdingContext;
};

export type ImportType = "employee" | "month_record";
export type ImportConflictStrategy = "skip" | "overwrite" | "abort";

export type ImportPreviewRow = {
  rowNumber: number;
  rowLabel?: string | null;
  status: "ready" | "conflict" | "error";
  conflictType: string | null;
  errors: string[];
  parsedData: Record<string, unknown>;
};

export type ImportPreviewResponse = {
  importType: ImportType;
  totalRows: number;
  readyRows: number;
  conflictRows: number;
  errorRows: number;
  autoFillZeroRowCount?: number;
  autoFillZeroEmployeeCount?: number;
  rows: ImportPreviewRow[];
};

export type ImportCommitResponse = {
  importType: ImportType;
  totalRows: number;
  successCount: number;
  skippedCount: number;
  failureCount: number;
  failures: Array<{
    rowNumber: number;
    rowLabel?: string | null;
    reason: string;
  }>;
};

export type ImportSummary = {
  unitId: number;
  importType: ImportType;
  totalRows: number;
  readyRows: number;
  conflictRows: number;
  errorRows: number;
  updatedAt: string;
};

export type TaxPolicyBindScopePayload = {
  unitId: number;
  taxYear: number;
};

export type AnnualTaxSchemeResult = {
  scheme: TaxCalculationScheme;
  taxableComprehensiveIncome: number;
  comprehensiveIncomeTax: number;
  annualBonusTax: number;
  grossTax: number;
  taxReductionExemptionTotal: number;
  finalTax: number;
  comprehensiveBracketLevel: number | null;
  bonusBracketLevel: number | null;
};

export type AnnualTaxCalculation = {
  completedMonthCount: number;
  salaryIncomeTotal: number;
  annualBonusTotal: number;
  insuranceAndHousingFundTotal: number;
  specialAdditionalDeductionTotal: number;
  otherDeductionTotal: number;
  basicDeductionTotal: number;
  taxReductionExemptionTotal: number;
  selectedScheme: TaxCalculationScheme;
  selectedTaxAmount: number;
  annualTaxPayable: number;
  annualTaxWithheld: number;
  annualTaxSettlement: number;
  settlementDirection: TaxSettlementDirection;
  withholdingSummary: AnnualTaxWithholdingSummary;
  withholdingTraceItems?: AnnualTaxWithholdingTraceItem[];
  ruleSourceSummary?: AnnualTaxRuleSourceSummary | null;
  schemeResults: {
    separateBonus: AnnualTaxSchemeResult;
    combinedBonus: AnnualTaxSchemeResult;
  };
};

export type EmployeeAnnualTaxResult = AnnualTaxCalculation & {
  unitId: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  taxYear: number;
  calculatedAt: string;
};

export type AnnualTaxResultVersion = EmployeeAnnualTaxResult & {
  versionId: number;
  versionSequence: number;
  policySignature: string;
  isInvalidated: boolean;
  invalidatedReason: ResultInvalidationReason | null;
};

export type MonthConfirmationStatus = {
  taxMonth: number;
  isConfirmed: boolean;
  confirmedAt: string | null;
  canConfirm: boolean;
  canUnconfirm: boolean;
  blockedReason: string | null;
};

export type MonthConfirmationState = {
  lastConfirmedMonth: number;
  coverage: YearEntryResultCoverage;
  months: MonthConfirmationStatus[];
};

export type ConfirmedAnnualResultSummary = EmployeeAnnualTaxResult & {
  confirmedMonthCount: number;
  confirmedMonths: number[];
};

export type ConfirmedAnnualResultDetail = ConfirmedAnnualResultSummary & {
  months: EmployeeMonthRecord[];
};

export type UpdateAnnualResultSelectedSchemePayload = {
  selectedScheme: TaxCalculationScheme;
};

export type AnnualTaxExportPreviewRow = {
  unitId: number;
  unitName: string;
  taxYear: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  completedMonthCount: number;
  selectedScheme: TaxCalculationScheme;
  selectedSchemeLabel: string;
  salaryIncomeTotal: number;
  annualBonusTotal: number;
  insuranceAndHousingFundTotal: number;
  specialAdditionalDeductionTotal: number;
  otherDeductionTotal: number;
  basicDeductionTotal: number;
  taxReductionExemptionTotal: number;
  annualTaxPayable: number;
  annualTaxWithheld: number;
  annualTaxSettlement: number;
  settlementDirection: TaxSettlementDirection;
  settlementDirectionLabel: string;
  selectedTaxableComprehensiveIncome: number;
  selectedComprehensiveIncomeTax: number;
  selectedAnnualBonusTax: number;
  selectedGrossTax: number;
  selectedFinalTax: number;
  calculatedAt: string;
};

export type HistoryAnnualTaxResult = EmployeeAnnualTaxResult & {
  unitName: string;
  isInvalidated: boolean;
  invalidatedReason: ResultInvalidationReason | null;
};

export type HistoryResultRecalculationComparisonItem = {
  label: string;
  snapshotValue: string;
  currentValue: string;
  deltaValue: string;
};

export type HistoryResultRecalculationResponse = {
  snapshotResult: HistoryAnnualTaxResult;
  recalculatedResult: AnnualTaxCalculation;
  comparisonItems: HistoryResultRecalculationComparisonItem[];
  invalidatedReason: ResultInvalidationReason | null;
};

export type HistoryAnnualTaxQuery = {
  unitId?: number;
  taxYear?: number;
  employeeId?: number;
  settlementDirection?: TaxSettlementDirection;
  resultStatus?: HistoryResultStatus;
};

export {
  buildMonthlyWithholdingTrace,
  calculateEmployeeAnnualTax,
  calculateEmployeeAnnualTaxForMonths,
  getActualWithheldTaxForWithholding,
  getSalaryIncomeForWithholding,
  hasOtherIncomeEntry,
} from "./annual-tax-calculator.js";
export {
  deriveEmployeeGeneralStatus,
  deriveEmployeeMonthStatus,
  isEmployeeActiveInTaxMonth,
  isEmployeeActiveInTaxYear,
} from "./employee-status.js";
export { buildMonthRecordDataSignature } from "./month-record-data-signature.js";
export {
  annualTaxWithholdingModeLabelMap,
  taxCalculationSchemeLabelMap,
  taxSettlementDirectionLabelMap,
} from "./display-mappings.js";
export {
  buildDefaultTaxPolicySettings,
  buildTaxPolicySignature,
  isSameTaxPolicySettings,
  normalizeBonusTaxBrackets,
  normalizeComprehensiveTaxBrackets,
  normalizeTaxPolicySettings,
} from "./tax-policy.js";
