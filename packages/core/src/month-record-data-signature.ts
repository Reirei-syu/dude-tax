import type { EmployeeMonthRecord } from "./index.js";

const roundAmount = (value: number | undefined | null) =>
  Math.round((Number(value ?? 0) + Number.EPSILON) * 100) / 100;

const mapRecordToSignaturePayload = (record: EmployeeMonthRecord) => ({
  taxMonth: record.taxMonth,
  salaryIncome: roundAmount(record.salaryIncome),
  annualBonus: roundAmount(record.annualBonus),
  pensionInsurance: roundAmount(record.pensionInsurance),
  medicalInsurance: roundAmount(record.medicalInsurance),
  occupationalAnnuity: roundAmount(record.occupationalAnnuity),
  housingFund: roundAmount(record.housingFund),
  supplementaryHousingFund: roundAmount(record.supplementaryHousingFund),
  unemploymentInsurance: roundAmount(record.unemploymentInsurance),
  workInjuryInsurance: roundAmount(record.workInjuryInsurance),
  withheldTax: roundAmount(record.withheldTax),
  otherIncome: roundAmount(record.otherIncome),
  infantCareDeduction: roundAmount(record.infantCareDeduction),
  childEducationDeduction: roundAmount(record.childEducationDeduction),
  continuingEducationDeduction: roundAmount(record.continuingEducationDeduction),
  housingLoanInterestDeduction: roundAmount(record.housingLoanInterestDeduction),
  housingRentDeduction: roundAmount(record.housingRentDeduction),
  elderCareDeduction: roundAmount(record.elderCareDeduction),
  otherDeduction: roundAmount(record.otherDeduction),
  taxReductionExemption: roundAmount(record.taxReductionExemption),
});

export const buildMonthRecordDataSignature = (records: EmployeeMonthRecord[]) =>
  JSON.stringify(
    [...records]
      .sort((leftRecord, rightRecord) => leftRecord.taxMonth - rightRecord.taxMonth)
      .map(mapRecordToSignaturePayload),
  );
