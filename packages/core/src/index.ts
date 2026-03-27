export type Unit = {
  id: number;
  unitName: string;
  remark: string;
  isArchived: boolean;
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

export type EmployeeMonthRecord = {
  id: number | null;
  unitId: number;
  employeeId: number;
  taxYear: number;
  taxMonth: number;
  status: MonthRecordStatus;
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
};

export type UpsertEmployeeMonthRecordPayload = {
  status: MonthRecordStatus;
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
};

export type CalculationPreparationStatus = "not_started" | "draft" | "ready";

export type ResultInvalidationReason = "tax_policy_changed";
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

export type TaxPolicyVersionSummary = {
  id: number;
  versionName: string;
  policySignature: string;
  isActive: boolean;
  createdAt: string;
  activatedAt: string | null;
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
} & TaxPolicyMaintenanceNotes;

export type TaxPolicySaveResponse = TaxPolicyResponse & {
  invalidatedResults: boolean;
};

export type TaxPolicyUpdatePayload = TaxPolicySettingsInput & {
  maintenanceNotes?: string;
};

export type QuickCalculateMonthInput = UpsertEmployeeMonthRecordPayload & {
  taxMonth: number;
};

export type QuickCalculatePayload = {
  unitId: number;
  taxYear: number;
  records: QuickCalculateMonthInput[];
};

export type ImportType = "employee" | "month_record";
export type ImportConflictStrategy = "skip" | "overwrite" | "abort";

export type ImportPreviewRow = {
  rowNumber: number;
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

export type HistoryAnnualTaxQuery = {
  unitId?: number;
  taxYear?: number;
  employeeId?: number;
  settlementDirection?: TaxSettlementDirection;
  resultStatus?: HistoryResultStatus;
};

export { calculateEmployeeAnnualTax } from "./annual-tax-calculator.js";
export {
  buildDefaultTaxPolicySettings,
  buildTaxPolicySignature,
  isSameTaxPolicySettings,
  normalizeBonusTaxBrackets,
  normalizeComprehensiveTaxBrackets,
  normalizeTaxPolicySettings,
} from "./tax-policy.js";
