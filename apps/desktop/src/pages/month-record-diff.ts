import type {
  EmployeeMonthRecord,
  UpsertEmployeeMonthRecordPayload,
} from "../../../../packages/core/src/index";
import type { MonthRecordDraftMap } from "./month-record-batch-edit";

export type MonthRecordDraftDiff = {
  field: keyof UpsertEmployeeMonthRecordPayload;
  label: string;
  currentValue: EmployeeMonthRecord[keyof EmployeeMonthRecord];
  draftValue: UpsertEmployeeMonthRecordPayload[keyof UpsertEmployeeMonthRecordPayload];
};

export type MonthRecordDraftDiffSummary = {
  changedMonths: number[];
  changedFieldCountByMonth: Partial<Record<number, number>>;
};

const diffFields: Array<{
  key: keyof UpsertEmployeeMonthRecordPayload;
  label: string;
}> = [
  { key: "status", label: "记录状态" },
  { key: "salaryIncome", label: "工资收入" },
  { key: "annualBonus", label: "年终奖" },
  { key: "pensionInsurance", label: "养老保险" },
  { key: "medicalInsurance", label: "医疗保险" },
  { key: "occupationalAnnuity", label: "职业年金" },
  { key: "housingFund", label: "公积金" },
  { key: "supplementaryHousingFund", label: "补充公积金" },
  { key: "unemploymentInsurance", label: "失业保险" },
  { key: "workInjuryInsurance", label: "工伤保险" },
  { key: "withheldTax", label: "已预扣税额" },
  { key: "infantCareDeduction", label: "婴幼儿照护" },
  { key: "childEducationDeduction", label: "子女教育" },
  { key: "continuingEducationDeduction", label: "继续教育" },
  { key: "housingLoanInterestDeduction", label: "住房贷款利息" },
  { key: "housingRentDeduction", label: "住房租金" },
  { key: "elderCareDeduction", label: "赡养老人" },
  { key: "otherDeduction", label: "其他依法扣除" },
  { key: "taxReductionExemption", label: "减免税额" },
  { key: "remark", label: "备注" },
];

export const getMonthRecordDraftDiffs = (
  record: EmployeeMonthRecord,
  draft: UpsertEmployeeMonthRecordPayload | undefined,
): MonthRecordDraftDiff[] => {
  if (!draft) {
    return [];
  }

  return diffFields.flatMap(({ key, label }) => {
    const currentValue = record[key];
    const draftValue = draft[key];

    if (currentValue === draftValue) {
      return [];
    }

    return [
      {
        field: key,
        label,
        currentValue,
        draftValue,
      },
    ];
  });
};

export const buildMonthRecordDraftDiffSummary = (
  records: EmployeeMonthRecord[],
  drafts: MonthRecordDraftMap,
): MonthRecordDraftDiffSummary => {
  const changedMonths: number[] = [];
  const changedFieldCountByMonth: Partial<Record<number, number>> = {};

  records.forEach((record) => {
    const diffs = getMonthRecordDraftDiffs(record, drafts[record.taxMonth]);
    if (!diffs.length) {
      return;
    }

    changedMonths.push(record.taxMonth);
    changedFieldCountByMonth[record.taxMonth] = diffs.length;
  });

  return {
    changedMonths,
    changedFieldCountByMonth,
  };
};
