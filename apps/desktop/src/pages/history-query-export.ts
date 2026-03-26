import type { HistoryAnnualTaxResult } from "../../../../packages/core/src/index";
import ExcelJS from "exceljs";

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
};

const settlementDirectionLabelMap = {
  payable: "应补税",
  refund: "应退税",
  balanced: "已平",
} as const;

const schemeLabelMap = {
  separate_bonus: "年终奖单独计税",
  combined_bonus: "并入综合所得",
} as const;

const formatCsvNumber = (value: number) => value.toFixed(2);
const padNumber = (value: number) => String(value).padStart(2, "0");

const formatExportDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(
    date.getDate(),
  )} ${padNumber(date.getHours())}:${padNumber(date.getMinutes())}:${padNumber(
    date.getSeconds(),
  )}`;
};

const escapeCsvValue = (value: string) => {
  if (!/[",\r\n]/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, "\"\"")}"`;
};

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
  },
  {
    key: "annualTaxWithheld",
    label: "已预扣税额",
    getValue: (row) => formatCsvNumber(row.annualTaxWithheld),
    getWorkbookValue: (row) => row.annualTaxWithheld,
  },
  {
    key: "annualTaxSettlement",
    label: "应补/应退税额",
    getValue: (row) => formatCsvNumber(row.annualTaxSettlement),
    getWorkbookValue: (row) => row.annualTaxSettlement,
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
  selectedSchemeLabel: schemeLabelMap[row.selectedScheme],
  annualTaxPayable: row.annualTaxPayable,
  annualTaxWithheld: row.annualTaxWithheld,
  annualTaxSettlement: row.annualTaxSettlement,
  settlementDirectionLabel: settlementDirectionLabelMap[row.settlementDirection],
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
    worksheet.getColumn(columnIndex + 1).width = Math.min(Math.max(maxContentLength + 4, 12), 28);
  });
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
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("历史结果");
  const exportRows = rows.map(mapHistoryResultToExportRow);

  worksheet.addRow(columns.map((column) => column.label));
  exportRows.forEach((row) => {
    worksheet.addRow(columns.map((column) => column.getWorkbookValue(row)));
  });
  applyWorksheetPresentation(worksheet, exportRows, columns);

  return workbook;
};

export const buildHistoryQueryExportWorkbookBuffer = (rows: HistoryAnnualTaxResult[]) =>
  buildHistoryQueryExportWorkbook(rows).xlsx.writeBuffer();

export const buildHistoryQueryExportFilename = (scopeLabel: string) =>
  `工资薪金历史结果_${scopeLabel}.csv`;

export const buildHistoryQueryExportWorkbookFilename = (scopeLabel: string) =>
  `工资薪金历史结果_${scopeLabel}.xlsx`;
