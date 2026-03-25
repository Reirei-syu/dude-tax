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
