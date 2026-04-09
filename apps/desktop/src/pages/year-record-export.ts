import ExcelJS from "exceljs";
import type { YearRecordUpsertItem } from "@dude-tax/core";
import {
  YEAR_RECORD_DEDUCTION_FIELDS,
  YEAR_RECORD_INCOME_FIELDS,
  YEAR_RECORD_INCOME_TEXT_FIELDS,
  YEAR_RECORD_TEXT_FIELDS,
} from "./year-record-workspace";

type SummaryColumn = {
  key: string;
  label: string;
};

type SummaryRow = Record<string, string | number>;

type EmployeeSheet = {
  employeeCode: string;
  employeeName: string;
  rows: YearRecordUpsertItem[];
};

type WorkbookOptions = {
  summarySheetName: string;
  summaryColumns: SummaryColumn[];
  summaryRows: SummaryRow[];
  employees: EmployeeSheet[];
  basicDeductionAmount: number;
};

const sanitizeSheetName = (value: string) =>
  value.replace(/[\\/*?:[\]]/g, "-").slice(0, 31) || "员工明细";

const detailColumns = [
  { key: "taxMonth", label: "月份" },
  ...YEAR_RECORD_INCOME_FIELDS,
  ...YEAR_RECORD_INCOME_TEXT_FIELDS,
  ...YEAR_RECORD_DEDUCTION_FIELDS,
  { key: "basicDeductionAmount", label: "减除费用" },
  ...YEAR_RECORD_TEXT_FIELDS,
] as const;

const addSummarySheet = (workbook: ExcelJS.Workbook, options: WorkbookOptions) => {
  const worksheet = workbook.addWorksheet(options.summarySheetName);
  worksheet.addRow(options.summaryColumns.map((column) => column.label));
  options.summaryRows.forEach((row) => {
    worksheet.addRow(options.summaryColumns.map((column) => row[column.key] ?? ""));
  });

  return worksheet;
};

const addEmployeeSheet = (
  workbook: ExcelJS.Workbook,
  employee: EmployeeSheet,
  basicDeductionAmount: number,
) => {
  const worksheet = workbook.addWorksheet(
    sanitizeSheetName(`${employee.employeeCode}-${employee.employeeName}`),
  );
  worksheet.addRow(detailColumns.map((column) => column.label));
  employee.rows.forEach((row) => {
    worksheet.addRow(
      detailColumns.map((column) => {
        if (column.key === "taxMonth") {
          return `${row.taxMonth}月`;
        }

        if (column.key === "basicDeductionAmount") {
          return basicDeductionAmount;
        }

        return row[column.key] ?? "";
      }),
    );
  });

  return worksheet;
};

const applyFrozenHeader = (worksheet: ExcelJS.Worksheet) => {
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2F75DD" },
  };
};

export const buildYearRecordWorkbook = (options: WorkbookOptions) => {
  const workbook = new ExcelJS.Workbook();
  const summarySheet = addSummarySheet(workbook, options);
  applyFrozenHeader(summarySheet);
  options.employees.forEach((employee) => {
    applyFrozenHeader(addEmployeeSheet(workbook, employee, options.basicDeductionAmount));
  });

  return workbook;
};

export const buildYearRecordWorkbookBuffer = async (options: WorkbookOptions) => {
  const workbook = buildYearRecordWorkbook(options);
  return workbook.xlsx.writeBuffer();
};
