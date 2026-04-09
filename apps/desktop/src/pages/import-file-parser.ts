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

export const parseCsvText = (csvText: string) => {
  const parsedRows: string[][] = [];
  const normalizedText = csvText.replace(/^\uFEFF/, "");
  let currentRow: string[] = [];
  let currentValue = "";
  let inQuotes = false;

  for (let index = 0; index < normalizedText.length; index += 1) {
    const character = normalizedText[index]!;

    if (inQuotes) {
      if (character === '"') {
        const nextCharacter = normalizedText[index + 1];
        if (nextCharacter === '"') {
          currentValue += '"';
          index += 1;
          continue;
        }

        inQuotes = false;
        continue;
      }

      currentValue += character;
      continue;
    }

    if (character === '"') {
      inQuotes = true;
      continue;
    }

    if (character === ",") {
      currentRow.push(currentValue.trim());
      currentValue = "";
      continue;
    }

    if (character === "\r" || character === "\n") {
      currentRow.push(currentValue.trim());
      currentValue = "";

      if (!isEmptyRow(currentRow)) {
        parsedRows.push(currentRow);
      }

      currentRow = [];

      if (character === "\r" && normalizedText[index + 1] === "\n") {
        index += 1;
      }

      continue;
    }

    currentValue += character;
  }

  if (currentValue.length || currentRow.length) {
    currentRow.push(currentValue.trim());
    if (!isEmptyRow(currentRow)) {
      parsedRows.push(currentRow);
    }
  }

  return parsedRows;
};

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

export const buildWorkbookBufferFromCsvText = async (
  worksheetName: string,
  csvText: string,
) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(worksheetName);
  const rows = parseCsvText(csvText);

  rows.forEach((row) => {
    worksheet.addRow(row);
  });

  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2F75DD" },
  };

  worksheet.columns.forEach((column) => {
    column.width = 18;
  });

  return workbook.xlsx.writeBuffer();
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
