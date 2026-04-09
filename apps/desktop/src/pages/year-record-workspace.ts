import type { YearRecordUpsertItem } from "@dude-tax/core";

export const YEAR_RECORD_INCOME_FIELDS = [
  { key: "salaryIncome", label: "工资收入" },
  { key: "annualBonus", label: "年终奖" },
  { key: "withheldTax", label: "预扣税额" },
  { key: "otherIncome", label: "其他收入" },
] as const;

export const YEAR_RECORD_INCOME_TEXT_FIELDS = [
  { key: "otherIncomeRemark", label: "其他收入备注" },
] as const;

export const YEAR_RECORD_DEDUCTION_FIELDS = [
  { key: "pensionInsurance", label: "养老保险" },
  { key: "medicalInsurance", label: "医疗保险" },
  { key: "occupationalAnnuity", label: "职业年金" },
  { key: "housingFund", label: "住房公积金" },
  { key: "supplementaryHousingFund", label: "补充住房公积金" },
  { key: "unemploymentInsurance", label: "失业保险" },
  { key: "workInjuryInsurance", label: "工伤保险" },
  { key: "infantCareDeduction", label: "3岁以下婴幼儿照护" },
  { key: "childEducationDeduction", label: "子女教育" },
  { key: "continuingEducationDeduction", label: "继续教育" },
  { key: "housingLoanInterestDeduction", label: "住房贷款利息" },
  { key: "housingRentDeduction", label: "住房租金" },
  { key: "elderCareDeduction", label: "赡养老人" },
  { key: "otherDeduction", label: "其他依法扣除" },
  { key: "taxReductionExemption", label: "减免税额" },
] as const;

export const YEAR_RECORD_TEXT_FIELDS = [{ key: "remark", label: "备注" }] as const;

export type YearRecordFieldKey =
  | (typeof YEAR_RECORD_INCOME_FIELDS)[number]["key"]
  | (typeof YEAR_RECORD_INCOME_TEXT_FIELDS)[number]["key"]
  | (typeof YEAR_RECORD_DEDUCTION_FIELDS)[number]["key"]
  | (typeof YEAR_RECORD_TEXT_FIELDS)[number]["key"];

export const getVisibleYearRecordIncomeFields = (hiddenFieldKeys: YearRecordFieldKey[] = []) => {
  const hiddenFieldKeySet = new Set(hiddenFieldKeys);
  return YEAR_RECORD_INCOME_FIELDS.filter((field) => !hiddenFieldKeySet.has(field.key));
};

const COPYABLE_FIELD_KEYS = [
  ...YEAR_RECORD_INCOME_FIELDS.map((field) => field.key),
  ...YEAR_RECORD_INCOME_TEXT_FIELDS.map((field) => field.key),
  ...YEAR_RECORD_DEDUCTION_FIELDS.map((field) => field.key),
  ...YEAR_RECORD_TEXT_FIELDS.map((field) => field.key),
] as const;

export const hasWorkspaceMonthContent = (row: YearRecordUpsertItem) =>
  COPYABLE_FIELD_KEYS.some((fieldKey) => {
    const value = row[fieldKey];

    if (typeof value === "number") {
      return value > 0;
    }

    if (typeof value === "string") {
      return value.trim().length > 0;
    }

    return false;
  });

const buildCopiedMonth = (sourceRow: YearRecordUpsertItem, taxMonth: number): YearRecordUpsertItem => ({
  ...sourceRow,
  taxMonth,
});

export const applyWorkspaceMonthToNextMonth = (
  rows: YearRecordUpsertItem[],
  sourceMonth: number,
) => {
  const sourceRow = rows.find((row) => row.taxMonth === sourceMonth);
  if (!sourceRow) {
    return rows;
  }

  return rows.map((row) =>
    row.taxMonth === sourceMonth + 1 ? buildCopiedMonth(sourceRow, row.taxMonth) : row,
  );
};

export const applyWorkspaceMonthToFutureMonths = (
  rows: YearRecordUpsertItem[],
  sourceMonth: number,
) => {
  const sourceRow = rows.find((row) => row.taxMonth === sourceMonth);
  if (!sourceRow) {
    return rows;
  }

  return rows.map((row) =>
    row.taxMonth > sourceMonth ? buildCopiedMonth(sourceRow, row.taxMonth) : row,
  );
};

const isRowEqual = (leftRow: YearRecordUpsertItem, rightRow: YearRecordUpsertItem) =>
  COPYABLE_FIELD_KEYS.every((fieldKey) => leftRow[fieldKey] === rightRow[fieldKey]);

export const getDirtyWorkspaceMonths = (
  originalRows: YearRecordUpsertItem[],
  currentRows: YearRecordUpsertItem[],
) =>
  currentRows.filter((currentRow) => {
    const originalRow = originalRows.find((row) => row.taxMonth === currentRow.taxMonth);
    if (!originalRow) {
      return true;
    }

    return !isRowEqual(originalRow, currentRow);
  });
