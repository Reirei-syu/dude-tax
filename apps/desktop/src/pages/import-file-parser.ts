import ExcelJS from "exceljs";

const normalizeCellValue = (value: ExcelJS.CellValue | undefined | null) => {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") {
      return value.text;
    }

    if ("result" in value && value.result !== undefined && value.result !== null) {
      return String(value.result);
    }

    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((item) => item.text).join("");
    }

    if ("hyperlink" in value && typeof value.hyperlink === "string") {
      return value.hyperlink;
    }

    if ("formula" in value && typeof value.formula === "string") {
      return value.formula;
    }
  }

  return String(value);
};

const escapeCsvCell = (value: string) => {
  if (!/[",\r\n]/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, "\"\"")}"`;
};

const buildCsvLine = (values: string[]) => values.map(escapeCsvCell).join(",");

const isEmptyRow = (values: string[]) => values.every((value) => !value.trim());

export const convertWorksheetToCsvText = (worksheet: ExcelJS.Worksheet) => {
  const lines: string[] = [];

  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const rowValues = Array.isArray(row.values) ? row.values : [];
    const values = rowValues
      .slice(1)
      .map((cellValue: ExcelJS.CellValue | undefined) => normalizeCellValue(cellValue));

    if (isEmptyRow(values)) {
      return;
    }

    lines.push(buildCsvLine(values));
  });

  return lines.join("\n");
};

export const parseImportFileToCsvText = async (file: File) => {
  const lowerCaseName = file.name.toLowerCase();

  if (lowerCaseName.endsWith(".csv")) {
    return file.text();
  }

  if (lowerCaseName.endsWith(".xlsx") || lowerCaseName.endsWith(".xlsm")) {
    const workbook = new ExcelJS.Workbook();
    const fileBuffer = await file.arrayBuffer();
    await workbook.xlsx.load(fileBuffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error("Excel 文件中没有可读取的工作表");
    }

    return convertWorksheetToCsvText(worksheet);
  }

  throw new Error("当前仅支持 CSV、XLSX 和 XLSM 文件");
};
