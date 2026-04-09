import { apiClient } from "../api/client";
import { saveFileWithDesktopFallback } from "../utils/file-save";
import { buildWorkbookBufferFromCsvText } from "./import-file-parser";

const EXCEL_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const saveTemplateWorkbook = async (
  defaultPath: string,
  worksheetName: string,
  csvText: string,
) => {
  const workbookBuffer = await buildWorkbookBufferFromCsvText(worksheetName, csvText);
  await saveFileWithDesktopFallback({
    defaultPath,
    filters: [{ name: "Excel 文件", extensions: ["xlsx"] }],
    mimeType: EXCEL_MIME_TYPE,
    content: workbookBuffer,
  });
};

export const downloadEmployeeImportTemplateWorkbook = async () => {
  const templateText = await apiClient.downloadImportTemplate("employee");
  await saveTemplateWorkbook("员工导入模板.xlsx", "员工导入模板", templateText);
};

export const downloadMonthRecordImportTemplateWorkbook = async (
  unitId: number,
  taxYear: number,
) => {
  const templateText = await apiClient.downloadImportTemplate("month_record", unitId, taxYear);
  await saveTemplateWorkbook(
    `月度数据导入模板_${taxYear}.xlsx`,
    "月度数据导入模板",
    templateText,
  );
};
