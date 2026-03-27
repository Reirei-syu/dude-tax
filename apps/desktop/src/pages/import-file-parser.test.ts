import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { convertWorksheetToCsvText } from "./import-file-parser";

test("Excel 工作表可转换为现有导入链路可用的 CSV 文本", () => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("导入");

  worksheet.addRow(["employeeCode", "employeeName", "remark"]);
  worksheet.addRow(["EMP001", "张三", "第一行"]);
  worksheet.addRow(["EMP002", "李四", "含,逗号"]);

  const csvText = convertWorksheetToCsvText(worksheet);

  assert.equal(
    csvText,
    'employeeCode,employeeName,remark\nEMP001,张三,第一行\nEMP002,李四,"含,逗号"',
  );
});

test("空白行会在 Excel 转 CSV 时被自动跳过", () => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("导入");

  worksheet.addRow(["employeeCode", "employeeName"]);
  worksheet.addRow([]);
  worksheet.addRow(["EMP001", "张三"]);

  const csvText = convertWorksheetToCsvText(worksheet);

  assert.equal(csvText, "employeeCode,employeeName\nEMP001,张三");
});
