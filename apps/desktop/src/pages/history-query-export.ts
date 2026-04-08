import ExcelJS from "exceljs";
import type { HistoryAnnualTaxResult } from "@dude-tax/core";
import { taxCalculationSchemeLabelMap, taxSettlementDirectionLabelMap } from "@dude-tax/core";

type HistoryQueryExportColumnKey =
  | "unitName"
  | "taxYear"
  | "employeeCode"
  | "employeeName"
  | "resultStatusLabel"
  | "selectedSchemeLabel"
  | "annualTaxPayable"
  | "annualTaxWithheld"
  | "annualTaxSettlement"
  | "settlementDirectionLabel"
  | "calculatedAt";

type HistoryQueryExportRow = {
  unitName: string;
  taxYear: number;
  employeeCode: string;
  employeeName: string;
  resultStatusLabel: string;
  selectedSchemeLabel: string;
  annualTaxPayable: number;
  annualTaxWithheld: number;
  annualTaxSettlement: number;
  settlementDirectionLabel: string;
  calculatedAt: string;
};

type HistoryQueryExportColumnDefinition = {
  key: HistoryQueryExportColumnKey;
  label: string;
  getValue: (row: HistoryQueryExportRow) => string;
  getWorkbookValue: (row: HistoryQueryExportRow) => string | number;
  numFmt?: string;
  horizontalAlignment?: "left" | "center" | "right";
};

const WORKBOOK_YIELD_BATCH_SIZE = 200;

const formatCsvNumber = (value: number) => value.toFixed(2);
const padNumber = (value: number) => String(value).padStart(2, "0");

const formatExportDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(
    date.getDate(),
  )} ${padNumber(date.getHours())}:${padNumber(date.getMinutes())}:${padNumber(date.getSeconds())}`;
};

const escapeCsvValue = (value: string) => {
  if (!/[",\r\n]/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '""')}"`;
};

const waitForNextTurn = () => new Promise((resolve) => setTimeout(resolve, 0));

const columns: HistoryQueryExportColumnDefinition[] = [
  {
    key: "unitName",
    label: "单位名称",
    getValue: (row) => row.unitName,
    getWorkbookValue: (row) => row.unitName,
  },
  {
    key: "taxYear",
    label: "年度",
    getValue: (row) => String(row.taxYear),
    getWorkbookValue: (row) => row.taxYear,
    horizontalAlignment: "center",
  },
  {
    key: "employeeCode",
    label: "员工工号",
    getValue: (row) => row.employeeCode,
    getWorkbookValue: (row) => row.employeeCode,
  },
  {
    key: "employeeName",
    label: "员工姓名",
    getValue: (row) => row.employeeName,
    getWorkbookValue: (row) => row.employeeName,
  },
  {
    key: "resultStatusLabel",
    label: "结果状态",
    getValue: (row) => row.resultStatusLabel,
    getWorkbookValue: (row) => row.resultStatusLabel,
  },
  {
    key: "selectedSchemeLabel",
    label: "当前方案",
    getValue: (row) => row.selectedSchemeLabel,
    getWorkbookValue: (row) => row.selectedSchemeLabel,
  },
  {
    key: "annualTaxPayable",
    label: "年度应纳税额",
    getValue: (row) => formatCsvNumber(row.annualTaxPayable),
    getWorkbookValue: (row) => row.annualTaxPayable,
    numFmt: "#,##0.00",
    horizontalAlignment: "right",
  },
  {
    key: "annualTaxWithheld",
    label: "已预扣税额",
    getValue: (row) => formatCsvNumber(row.annualTaxWithheld),
    getWorkbookValue: (row) => row.annualTaxWithheld,
    numFmt: "#,##0.00",
    horizontalAlignment: "right",
  },
  {
    key: "annualTaxSettlement",
    label: "应补/应退税额",
    getValue: (row) => formatCsvNumber(row.annualTaxSettlement),
    getWorkbookValue: (row) => row.annualTaxSettlement,
    numFmt: "#,##0.00",
    horizontalAlignment: "right",
  },
  {
    key: "settlementDirectionLabel",
    label: "结算方向",
    getValue: (row) => row.settlementDirectionLabel,
    getWorkbookValue: (row) => row.settlementDirectionLabel,
  },
  {
    key: "calculatedAt",
    label: "计算时间",
    getValue: (row) => row.calculatedAt,
    getWorkbookValue: (row) => row.calculatedAt,
  },
];

const mapHistoryResultToExportRow = (row: HistoryAnnualTaxResult): HistoryQueryExportRow => ({
  unitName: row.unitName,
  taxYear: row.taxYear,
  employeeCode: row.employeeCode,
  employeeName: row.employeeName,
  resultStatusLabel: row.isInvalidated ? "已失效" : "当前有效",
  selectedSchemeLabel: taxCalculationSchemeLabelMap[row.selectedScheme],
  annualTaxPayable: row.annualTaxPayable,
  annualTaxWithheld: row.annualTaxWithheld,
  annualTaxSettlement: row.annualTaxSettlement,
  settlementDirectionLabel: taxSettlementDirectionLabelMap[row.settlementDirection],
  calculatedAt: formatExportDateTime(row.calculatedAt),
});

const applyWorksheetPresentation = (
  worksheet: ExcelJS.Worksheet,
  rows: HistoryQueryExportRow[],
  selectedColumns: HistoryQueryExportColumnDefinition[],
) => {
  if (!selectedColumns.length) {
    return;
  }

  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: selectedColumns.length },
  };

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1B4878" },
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };

  selectedColumns.forEach((column, columnIndex) => {
    const maxContentLength = Math.max(
      column.label.length,
      ...rows.map((row) => String(column.getWorkbookValue(row)).length),
    );
    const excelColumn = worksheet.getColumn(columnIndex + 1);
    excelColumn.width = Math.min(Math.max(maxContentLength + 4, 12), 28);

    if (column.numFmt) {
      excelColumn.numFmt = column.numFmt;
    }

    if (column.horizontalAlignment) {
      excelColumn.alignment = {
        vertical: "middle",
        horizontal: column.horizontalAlignment,
      };
    }
  });

  rows.forEach((row, rowIndex) => {
    const excelRow = worksheet.getRow(rowIndex + 2);
    const isOddRow = rowIndex % 2 === 0;

    excelRow.eachCell((cell, columnNumber) => {
      if (isOddRow) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8FBFF" },
        };
      }

      const column = selectedColumns[columnNumber - 1];
      if (column?.key === "resultStatusLabel") {
        if (row.resultStatusLabel === "已失效") {
          cell.font = { color: { argb: "FFB42318" }, bold: true };
        } else {
          cell.font = { color: { argb: "FF1570EF" }, bold: true };
        }
      }
    });
  });
};

const buildHistoryQueryExportInfoRows = (rows: HistoryQueryExportRow[]) => {
  const years = Array.from(new Set(rows.map((row) => row.taxYear))).sort(
    (left, right) => right - left,
  );
  const statuses = Array.from(new Set(rows.map((row) => row.resultStatusLabel)));
  const unitNames = Array.from(new Set(rows.map((row) => row.unitName)));

  return [
    ["说明项", "内容"],
    ["导出单位", unitNames.length ? unitNames.join("、") : "当前结果为空"],
    ["导出年份", years.length ? years.join("、") : "-"],
    ["结果条数", String(rows.length)],
    ["结果状态", statuses.length ? statuses.join("、") : "-"],
  ];
};

const applyInfoWorksheetPresentation = (worksheet: ExcelJS.Worksheet) => {
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.getColumn(1).width = 18;
  worksheet.getColumn(2).width = 72;

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2F75DD" },
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };

  for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex += 1) {
    const row = worksheet.getRow(rowIndex);
    row.getCell(1).font = { bold: true, color: { argb: "FF344054" } };
    row.getCell(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFEAF2FF" },
    };
    row.getCell(2).alignment = { vertical: "middle", wrapText: true };
  }
};

const createHistoryQueryWorkbookSheets = (rows: HistoryQueryExportRow[]) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("历史结果");
  const infoWorksheet = workbook.addWorksheet("导出说明");

  worksheet.addRow(columns.map((column) => column.label));
  buildHistoryQueryExportInfoRows(rows).forEach((row) => infoWorksheet.addRow(row));
  applyInfoWorksheetPresentation(infoWorksheet);

  return {
    workbook,
    worksheet,
  };
};

const appendHistoryRowsInBatches = async (
  worksheet: ExcelJS.Worksheet,
  rows: HistoryQueryExportRow[],
) => {
  for (let index = 0; index < rows.length; index += WORKBOOK_YIELD_BATCH_SIZE) {
    const chunk = rows
      .slice(index, index + WORKBOOK_YIELD_BATCH_SIZE)
      .map((row) => columns.map((column) => column.getWorkbookValue(row)));

    worksheet.addRows(chunk);

    if (index + WORKBOOK_YIELD_BATCH_SIZE < rows.length) {
      await waitForNextTurn();
    }
  }
};

export const buildHistoryQueryExportCsv = (rows: HistoryAnnualTaxResult[]) => {
  const exportRows = rows.map(mapHistoryResultToExportRow);
  const csvLines = [columns.map((column) => column.label).join(",")];

  exportRows.forEach((row) => {
    csvLines.push(columns.map((column) => escapeCsvValue(column.getValue(row))).join(","));
  });

  return csvLines.join("\r\n");
};

export const buildHistoryQueryExportWorkbook = (rows: HistoryAnnualTaxResult[]) => {
  const exportRows = rows.map(mapHistoryResultToExportRow);
  const { workbook, worksheet } = createHistoryQueryWorkbookSheets(exportRows);
  exportRows.forEach((row) => {
    worksheet.addRow(columns.map((column) => column.getWorkbookValue(row)));
  });
  applyWorksheetPresentation(worksheet, exportRows, columns);

  return workbook;
};

export const buildHistoryQueryExportWorkbookBuffer = (rows: HistoryAnnualTaxResult[]) => {
  const exportRows = rows.map(mapHistoryResultToExportRow);
  const { workbook, worksheet } = createHistoryQueryWorkbookSheets(exportRows);

  return appendHistoryRowsInBatches(worksheet, exportRows).then(() => {
    applyWorksheetPresentation(worksheet, exportRows, columns);
    return workbook.xlsx.writeBuffer();
  });
};

export const buildHistoryQueryExportFilename = (scopeLabel: string) =>
  `工资薪金历史结果_${scopeLabel}.csv`;

export const buildHistoryQueryExportWorkbookFilename = (scopeLabel: string) =>
  `工资薪金历史结果_${scopeLabel}.xlsx`;
