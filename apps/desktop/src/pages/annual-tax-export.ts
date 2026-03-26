import type { AnnualTaxExportPreviewRow } from "../../../../packages/core/src/index";
import ExcelJS from "exceljs";

export type AnnualTaxExportColumnGroup = "基础信息" | "收入项目" | "扣除项目" | "税额结果";

export type AnnualTaxExportColumnKey =
  | "unitName"
  | "taxYear"
  | "employeeCode"
  | "employeeName"
  | "completedMonthCount"
  | "selectedSchemeLabel"
  | "salaryIncomeTotal"
  | "annualBonusTotal"
  | "insuranceAndHousingFundTotal"
  | "specialAdditionalDeductionTotal"
  | "otherDeductionTotal"
  | "basicDeductionTotal"
  | "taxReductionExemptionTotal"
  | "annualTaxPayable"
  | "annualTaxWithheld"
  | "annualTaxSettlement"
  | "settlementDirectionLabel"
  | "selectedTaxableComprehensiveIncome"
  | "selectedComprehensiveIncomeTax"
  | "selectedAnnualBonusTax"
  | "selectedFinalTax"
  | "calculatedAt";

type AnnualTaxExportColumnDefinition = {
  key: AnnualTaxExportColumnKey;
  label: string;
  group: AnnualTaxExportColumnGroup;
  getValue: (row: AnnualTaxExportPreviewRow) => string;
  getWorkbookValue: (row: AnnualTaxExportPreviewRow) => string | number;
  numFmt?: string;
  horizontalAlignment?: "left" | "center" | "right";
};

export type AnnualTaxExportTemplateId = "compact" | "finance" | "full";

type AnnualTaxExportTemplate = {
  id: AnnualTaxExportTemplateId;
  label: string;
  description: string;
  columnKeys: AnnualTaxExportColumnKey[];
};

const padNumber = (value: number) => String(value).padStart(2, "0");

const formatCsvNumber = (value: number) => value.toFixed(2);

const formatExportDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())} ${padNumber(
    date.getHours(),
  )}:${padNumber(date.getMinutes())}:${padNumber(date.getSeconds())}`;
};

const escapeCsvValue = (value: string) => {
  if (!/[",\r\n]/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, "\"\"")}"`;
};

export const ANNUAL_TAX_EXPORT_COLUMNS: AnnualTaxExportColumnDefinition[] = [
  {
    key: "unitName",
    label: "单位名称",
    group: "基础信息",
    getValue: (row) => row.unitName,
    getWorkbookValue: (row) => row.unitName,
  },
  {
    key: "taxYear",
    label: "年度",
    group: "基础信息",
    getValue: (row) => String(row.taxYear),
    getWorkbookValue: (row) => row.taxYear,
    horizontalAlignment: "center",
  },
  {
    key: "employeeCode",
    label: "员工工号",
    group: "基础信息",
    getValue: (row) => row.employeeCode,
    getWorkbookValue: (row) => row.employeeCode,
  },
  {
    key: "employeeName",
    label: "员工姓名",
    group: "基础信息",
    getValue: (row) => row.employeeName,
    getWorkbookValue: (row) => row.employeeName,
  },
  {
    key: "completedMonthCount",
    label: "完成月份",
    group: "基础信息",
    getValue: (row) => String(row.completedMonthCount),
    getWorkbookValue: (row) => row.completedMonthCount,
    horizontalAlignment: "center",
  },
  {
    key: "selectedSchemeLabel",
    label: "当前方案",
    group: "基础信息",
    getValue: (row) => row.selectedSchemeLabel,
    getWorkbookValue: (row) => row.selectedSchemeLabel,
  },
  {
    key: "salaryIncomeTotal",
    label: "工资收入合计",
    group: "收入项目",
    getValue: (row) => formatCsvNumber(row.salaryIncomeTotal),
    getWorkbookValue: (row) => row.salaryIncomeTotal,
    numFmt: "#,##0.00",
    horizontalAlignment: "right",
  },
  {
    key: "annualBonusTotal",
    label: "年终奖合计",
    group: "收入项目",
    getValue: (row) => formatCsvNumber(row.annualBonusTotal),
    getWorkbookValue: (row) => row.annualBonusTotal,
    numFmt: "#,##0.00",
    horizontalAlignment: "right",
  },
  {
    key: "insuranceAndHousingFundTotal",
    label: "五险一金合计",
    group: "扣除项目",
    getValue: (row) => formatCsvNumber(row.insuranceAndHousingFundTotal),
    getWorkbookValue: (row) => row.insuranceAndHousingFundTotal,
    numFmt: "#,##0.00",
    horizontalAlignment: "right",
  },
  {
    key: "specialAdditionalDeductionTotal",
    label: "专项附加扣除合计",
    group: "扣除项目",
    getValue: (row) => formatCsvNumber(row.specialAdditionalDeductionTotal),
    getWorkbookValue: (row) => row.specialAdditionalDeductionTotal,
    numFmt: "#,##0.00",
    horizontalAlignment: "right",
  },
  {
    key: "otherDeductionTotal",
    label: "其他扣除合计",
    group: "扣除项目",
    getValue: (row) => formatCsvNumber(row.otherDeductionTotal),
    getWorkbookValue: (row) => row.otherDeductionTotal,
    numFmt: "#,##0.00",
    horizontalAlignment: "right",
  },
  {
    key: "basicDeductionTotal",
    label: "减除费用合计",
    group: "扣除项目",
    getValue: (row) => formatCsvNumber(row.basicDeductionTotal),
    getWorkbookValue: (row) => row.basicDeductionTotal,
    numFmt: "#,##0.00",
    horizontalAlignment: "right",
  },
  {
    key: "taxReductionExemptionTotal",
    label: "税额减免合计",
    group: "扣除项目",
    getValue: (row) => formatCsvNumber(row.taxReductionExemptionTotal),
    getWorkbookValue: (row) => row.taxReductionExemptionTotal,
    numFmt: "#,##0.00",
    horizontalAlignment: "right",
  },
  {
    key: "annualTaxPayable",
    label: "年度应纳税额",
    group: "税额结果",
    getValue: (row) => formatCsvNumber(row.annualTaxPayable),
    getWorkbookValue: (row) => row.annualTaxPayable,
    numFmt: "#,##0.00",
    horizontalAlignment: "right",
  },
  {
    key: "annualTaxWithheld",
    label: "已预扣税额",
    group: "税额结果",
    getValue: (row) => formatCsvNumber(row.annualTaxWithheld),
    getWorkbookValue: (row) => row.annualTaxWithheld,
    numFmt: "#,##0.00",
    horizontalAlignment: "right",
  },
  {
    key: "annualTaxSettlement",
    label: "应补/应退税额",
    group: "税额结果",
    getValue: (row) => formatCsvNumber(row.annualTaxSettlement),
    getWorkbookValue: (row) => row.annualTaxSettlement,
    numFmt: "#,##0.00",
    horizontalAlignment: "right",
  },
  {
    key: "settlementDirectionLabel",
    label: "结算方向",
    group: "税额结果",
    getValue: (row) => row.settlementDirectionLabel,
    getWorkbookValue: (row) => row.settlementDirectionLabel,
  },
  {
    key: "selectedTaxableComprehensiveIncome",
    label: "当前综合应税额",
    group: "税额结果",
    getValue: (row) => formatCsvNumber(row.selectedTaxableComprehensiveIncome),
    getWorkbookValue: (row) => row.selectedTaxableComprehensiveIncome,
    numFmt: "#,##0.00",
    horizontalAlignment: "right",
  },
  {
    key: "selectedComprehensiveIncomeTax",
    label: "当前综合所得税",
    group: "税额结果",
    getValue: (row) => formatCsvNumber(row.selectedComprehensiveIncomeTax),
    getWorkbookValue: (row) => row.selectedComprehensiveIncomeTax,
    numFmt: "#,##0.00",
    horizontalAlignment: "right",
  },
  {
    key: "selectedAnnualBonusTax",
    label: "当前年终奖税额",
    group: "税额结果",
    getValue: (row) => formatCsvNumber(row.selectedAnnualBonusTax),
    getWorkbookValue: (row) => row.selectedAnnualBonusTax,
    numFmt: "#,##0.00",
    horizontalAlignment: "right",
  },
  {
    key: "selectedFinalTax",
    label: "当前税额合计",
    group: "税额结果",
    getValue: (row) => formatCsvNumber(row.selectedFinalTax),
    getWorkbookValue: (row) => row.selectedFinalTax,
    numFmt: "#,##0.00",
    horizontalAlignment: "right",
  },
  {
    key: "calculatedAt",
    label: "计算时间",
    group: "基础信息",
    getValue: (row) => formatExportDateTime(row.calculatedAt),
    getWorkbookValue: (row) => formatExportDateTime(row.calculatedAt),
  },
];

export const ANNUAL_TAX_EXPORT_TEMPLATES: AnnualTaxExportTemplate[] = [
  {
    id: "compact",
    label: "精简模板",
    description: "适合快速核对员工与税额结果。",
    columnKeys: ["employeeCode", "employeeName", "selectedSchemeLabel", "selectedFinalTax", "calculatedAt"],
  },
  {
    id: "finance",
    label: "财务模板",
    description: "适合财务核对收入、扣除与当前税额。",
    columnKeys: [
      "employeeCode",
      "employeeName",
      "selectedSchemeLabel",
      "salaryIncomeTotal",
      "annualBonusTotal",
      "insuranceAndHousingFundTotal",
      "specialAdditionalDeductionTotal",
      "basicDeductionTotal",
      "annualTaxPayable",
      "annualTaxWithheld",
      "annualTaxSettlement",
      "settlementDirectionLabel",
      "calculatedAt",
    ],
  },
  {
    id: "full",
    label: "全字段模板",
    description: "导出当前支持的全部扁平化结果字段。",
    columnKeys: ANNUAL_TAX_EXPORT_COLUMNS.map((column) => column.key),
  },
];

export const DEFAULT_ANNUAL_TAX_EXPORT_TEMPLATE_ID: AnnualTaxExportTemplateId = "finance";

export const getAnnualTaxExportTemplate = (templateId: AnnualTaxExportTemplateId) =>
  ANNUAL_TAX_EXPORT_TEMPLATES.find((template) => template.id === templateId) ??
  ANNUAL_TAX_EXPORT_TEMPLATES[1];

export const DEFAULT_ANNUAL_TAX_EXPORT_COLUMN_KEYS = getAnnualTaxExportTemplate(
  DEFAULT_ANNUAL_TAX_EXPORT_TEMPLATE_ID,
).columnKeys;

const resolveSelectedColumns = (selectedColumnKeys?: AnnualTaxExportColumnKey[]) => {
  const selectedSet = new Set(
    selectedColumnKeys?.length ? selectedColumnKeys : DEFAULT_ANNUAL_TAX_EXPORT_COLUMN_KEYS,
  );

  return ANNUAL_TAX_EXPORT_COLUMNS.filter((column) => selectedSet.has(column.key));
};

const applyWorksheetPresentation = (
  worksheet: ExcelJS.Worksheet,
  rows: AnnualTaxExportPreviewRow[],
  selectedColumns: AnnualTaxExportColumnDefinition[],
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
    fgColor: { argb: "FF2F75DD" },
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
      if (column?.key === "settlementDirectionLabel") {
        if (row.settlementDirectionLabel === "应补税") {
          cell.font = { color: { argb: "FFB42318" }, bold: true };
        } else if (row.settlementDirectionLabel === "应退税") {
          cell.font = { color: { argb: "FF1570EF" }, bold: true };
        } else {
          cell.font = { color: { argb: "FF667085" }, bold: true };
        }
      }
    });
  });
};

const buildAnnualTaxExportInfoRows = (
  rows: AnnualTaxExportPreviewRow[],
  selectedColumns: AnnualTaxExportColumnDefinition[],
) => {
  const firstRow = rows[0];

  return [
    ["说明项", "内容"],
    ["导出范围", firstRow ? `${firstRow.unitName} / ${firstRow.taxYear} 年度` : "当前结果为空"],
    ["结果条数", String(rows.length)],
    ["导出字段数", String(selectedColumns.length)],
    ["导出字段", selectedColumns.map((column) => column.label).join("、")],
    ["生成时间字段", "计算时间列采用 Excel 友好时间格式"],
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
    fgColor: { argb: "FF1B4878" },
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

export const buildAnnualTaxExportCsv = (
  rows: AnnualTaxExportPreviewRow[],
  selectedColumnKeys?: AnnualTaxExportColumnKey[],
) => {
  const selectedColumns = resolveSelectedColumns(selectedColumnKeys);
  const csvLines = [selectedColumns.map((column) => column.label).join(",")];

  rows.forEach((row) => {
    const line = selectedColumns.map((column) => escapeCsvValue(column.getValue(row))).join(",");
    csvLines.push(line);
  });

  return csvLines.join("\r\n");
};

export const buildAnnualTaxExportWorkbook = (
  rows: AnnualTaxExportPreviewRow[],
  selectedColumnKeys?: AnnualTaxExportColumnKey[],
) => {
  const selectedColumns = resolveSelectedColumns(selectedColumnKeys);
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("个税结果");
  const infoWorksheet = workbook.addWorksheet("导出说明");

  worksheet.addRow(selectedColumns.map((column) => column.label));
  rows.forEach((row) => {
    worksheet.addRow(selectedColumns.map((column) => column.getWorkbookValue(row)));
  });
  applyWorksheetPresentation(worksheet, rows, selectedColumns);

  buildAnnualTaxExportInfoRows(rows, selectedColumns).forEach((row) => infoWorksheet.addRow(row));
  applyInfoWorksheetPresentation(infoWorksheet);

  return workbook;
};

export const buildAnnualTaxExportWorkbookBuffer = (
  rows: AnnualTaxExportPreviewRow[],
  selectedColumnKeys?: AnnualTaxExportColumnKey[],
) => buildAnnualTaxExportWorkbook(rows, selectedColumnKeys).xlsx.writeBuffer();

export const buildAnnualTaxExportFilename = (unitName: string, taxYear: number) =>
  `工资薪金个税结果_${unitName}_${taxYear}.csv`;

export const buildAnnualTaxExportWorkbookFilename = (unitName: string, taxYear: number) =>
  `工资薪金个税结果_${unitName}_${taxYear}.xlsx`;
