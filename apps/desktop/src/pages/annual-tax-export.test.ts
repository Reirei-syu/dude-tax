import assert from "node:assert/strict";
import test from "node:test";
import type { AnnualTaxExportPreviewRow } from "../../../../packages/core/src/index";
import * as exportModule from "./annual-tax-export";

const createExportRow = (
  overrides: Partial<AnnualTaxExportPreviewRow> = {},
): AnnualTaxExportPreviewRow => ({
  unitId: 1,
  unitName: "测试单位",
  taxYear: 2026,
  employeeId: 1,
  employeeCode: "EMP-001",
  employeeName: "张三",
  completedMonthCount: 12,
  selectedScheme: "separate_bonus",
  selectedSchemeLabel: "年终奖单独计税",
  salaryIncomeTotal: 120000,
  annualBonusTotal: 24000,
  insuranceAndHousingFundTotal: 12000,
  specialAdditionalDeductionTotal: 24000,
  otherDeductionTotal: 0,
  basicDeductionTotal: 60000,
  taxReductionExemptionTotal: 0,
  annualTaxPayable: 3000,
  annualTaxWithheld: 2000,
  annualTaxSettlement: 1000,
  settlementDirection: "payable",
  settlementDirectionLabel: "应补税",
  selectedTaxableComprehensiveIncome: 48000,
  selectedComprehensiveIncomeTax: 2280,
  selectedAnnualBonusTax: 720,
  selectedGrossTax: 3000,
  selectedFinalTax: 3000,
  calculatedAt: "2026-03-25T14:30:00.000Z",
  ...overrides,
});

test("导出模块暴露 CSV 构建函数与文件名函数", () => {
  assert.equal(typeof Reflect.get(exportModule, "buildAnnualTaxExportCsv"), "function");
  assert.equal(typeof Reflect.get(exportModule, "buildAnnualTaxExportFilename"), "function");
  assert.equal(typeof Reflect.get(exportModule, "buildAnnualTaxExportWorkbook"), "function");
  assert.equal(typeof Reflect.get(exportModule, "buildAnnualTaxExportWorkbookFilename"), "function");
  assert.equal(Array.isArray(Reflect.get(exportModule, "ANNUAL_TAX_EXPORT_COLUMNS")), true);
  assert.equal(Array.isArray(Reflect.get(exportModule, "DEFAULT_ANNUAL_TAX_EXPORT_COLUMN_KEYS")), true);
  assert.equal(Array.isArray(Reflect.get(exportModule, "ANNUAL_TAX_EXPORT_TEMPLATES")), true);
  assert.equal(typeof Reflect.get(exportModule, "getAnnualTaxExportTemplate"), "function");
});

test("CSV 导出内容包含固定表头与扁平化字段", () => {
  const buildAnnualTaxExportCsv = Reflect.get(exportModule, "buildAnnualTaxExportCsv") as (
    rows: AnnualTaxExportPreviewRow[],
    selectedColumnKeys?: string[],
  ) => string;
  const getAnnualTaxExportTemplate = Reflect.get(exportModule, "getAnnualTaxExportTemplate") as (
    templateId: string,
  ) => { columnKeys: string[] };
  const fullTemplate = getAnnualTaxExportTemplate("full");

  const csv = buildAnnualTaxExportCsv([
    createExportRow(),
    createExportRow({
      employeeId: 2,
      employeeCode: "EMP-002",
      employeeName: '李"四, Jr.',
      selectedScheme: "combined_bonus",
      selectedSchemeLabel: "并入综合所得",
      annualTaxPayable: 19080,
      annualTaxWithheld: 25000,
      annualTaxSettlement: -5920,
      settlementDirection: "refund",
      settlementDirectionLabel: "应退税",
      selectedFinalTax: 19080,
    }),
  ], fullTemplate.columnKeys);

  const lines = csv.split("\r\n");
  assert.equal(
    lines[0],
    "单位名称,年度,员工工号,员工姓名,完成月份,当前方案,工资收入合计,年终奖合计,五险一金合计,专项附加扣除合计,其他扣除合计,减除费用合计,税额减免合计,年度应纳税额,已预扣税额,应补/应退税额,结算方向,当前综合应税额,当前综合所得税,当前年终奖税额,当前税额合计,计算时间",
  );
  assert.match(lines[1] ?? "", /^测试单位,2026,EMP-001,张三,12,年终奖单独计税,/);
  assert.match(lines[2] ?? "", /"李""四, Jr\."|李""四, Jr\./);
  assert.match(lines[2] ?? "", /并入综合所得/);
  assert.match(lines[2] ?? "", /19080\.00/);
});

test("导出文件名带单位与年度信息", () => {
  const buildAnnualTaxExportFilename = Reflect.get(exportModule, "buildAnnualTaxExportFilename") as (
    unitName: string,
    taxYear: number,
  ) => string;

  const filename = buildAnnualTaxExportFilename("华北一分部", 2026);
  assert.equal(filename, "工资薪金个税结果_华北一分部_2026.csv");
});

test("支持按所选字段导出，并保持预定义列顺序", () => {
  const buildAnnualTaxExportCsv = Reflect.get(exportModule, "buildAnnualTaxExportCsv") as (
    rows: AnnualTaxExportPreviewRow[],
    selectedColumnKeys: string[],
  ) => string;

  const csv = buildAnnualTaxExportCsv(
    [
      createExportRow({
        employeeCode: "EMP-009",
        employeeName: "赵六",
        selectedFinalTax: 8888,
      }),
    ],
    ["selectedFinalTax", "employeeName", "employeeCode"],
  );

  const lines = csv.split("\r\n");
  assert.equal(lines[0], "员工工号,员工姓名,当前税额合计");
  assert.equal(lines[1], "EMP-009,赵六,8888.00");
});

test("财务模板按预定义字段导出，并输出 Excel 友好时间格式", () => {
  const buildAnnualTaxExportCsv = Reflect.get(exportModule, "buildAnnualTaxExportCsv") as (
    rows: AnnualTaxExportPreviewRow[],
    selectedColumnKeys: string[],
  ) => string;
  const getAnnualTaxExportTemplate = Reflect.get(exportModule, "getAnnualTaxExportTemplate") as (
    templateId: string,
  ) => { columnKeys: string[] };

  const financeTemplate = getAnnualTaxExportTemplate("finance");
  const csv = buildAnnualTaxExportCsv([createExportRow()], financeTemplate.columnKeys);
  const lines = csv.split("\r\n");

  assert.equal(
    lines[0],
    "员工工号,员工姓名,当前方案,工资收入合计,年终奖合计,五险一金合计,专项附加扣除合计,减除费用合计,年度应纳税额,已预扣税额,应补/应退税额,结算方向,计算时间",
  );
  assert.equal(
    lines[1],
    "EMP-001,张三,年终奖单独计税,120000.00,24000.00,12000.00,24000.00,60000.00,3000.00,2000.00,1000.00,应补税,2026-03-25 22:30:00",
  );
});

test("XLSX 导出内容包含工作表名和所选字段列", () => {
  const buildAnnualTaxExportWorkbook = Reflect.get(exportModule, "buildAnnualTaxExportWorkbook") as (
    rows: AnnualTaxExportPreviewRow[],
    selectedColumnKeys: string[],
  ) => {
    worksheets: Array<{
      name: string;
      views: Array<{ state?: string; ySplit?: number }>;
      getCell: (cell: string) => { value: string | number | null };
      getColumn: (index: number) => { width?: number; numFmt?: string };
    }>;
    getWorksheet: (name: string) => {
      getCell: (cell: string) => { value: string | number | null };
      getColumn: (index: number) => { width?: number; numFmt?: string };
      views: Array<{ state?: string; ySplit?: number }>;
      autoFilter?: { from: { row: number; column: number }; to: { row: number; column: number } };
    };
  };

  const workbook = buildAnnualTaxExportWorkbook(
    [createExportRow()],
    ["employeeCode", "employeeName", "selectedFinalTax"],
  );

  assert.equal(workbook.worksheets[0]?.name, "个税结果");
  assert.equal(workbook.getWorksheet("个税结果")?.getCell("A1")?.value, "员工工号");
  assert.equal(workbook.getWorksheet("个税结果")?.getCell("B1")?.value, "员工姓名");
  assert.equal(workbook.getWorksheet("个税结果")?.getCell("C1")?.value, "当前税额合计");
  assert.equal(workbook.getWorksheet("个税结果")?.getCell("A2")?.value, "EMP-001");
  assert.equal(workbook.getWorksheet("个税结果")?.getCell("B2")?.value, "张三");
  assert.equal(workbook.getWorksheet("个税结果")?.getCell("C2")?.value, 3000);
});

test("XLSX 导出附带冻结表头、列宽与数值格式", () => {
  const buildAnnualTaxExportWorkbook = Reflect.get(exportModule, "buildAnnualTaxExportWorkbook") as (
    rows: AnnualTaxExportPreviewRow[],
    selectedColumnKeys: string[],
  ) => {
    getWorksheet: (name: string) => {
      getCell: (cell: string) => {
        fill?: { fgColor?: { argb?: string } };
        font?: { bold?: boolean; color?: { argb?: string } };
      };
      getColumn: (index: number) => { width?: number; numFmt?: string };
      views: Array<{ state?: string; ySplit?: number }>;
      autoFilter?: { from: { row: number; column: number }; to: { row: number; column: number } };
    };
  };

  const workbook = buildAnnualTaxExportWorkbook(
    [
      createExportRow({
        settlementDirection: "refund",
        settlementDirectionLabel: "应退税",
        annualTaxSettlement: -5920,
      }),
    ],
    ["employeeCode", "annualTaxSettlement", "settlementDirectionLabel"],
  );
  const worksheet = workbook.getWorksheet("个税结果");

  assert.equal(worksheet.views[0]?.state, "frozen");
  assert.equal(worksheet.views[0]?.ySplit, 1);
  assert.deepEqual(worksheet.autoFilter, {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 3 },
  });
  assert.equal(worksheet.getCell("A1")?.fill?.fgColor?.argb, "FFDCEBFF");
  assert.equal(worksheet.getCell("B1")?.fill?.fgColor?.argb, "FFFEE2E2");
  assert.equal(worksheet.getColumn(1)?.width !== undefined && worksheet.getColumn(1).width! >= 12, true);
  assert.equal(worksheet.getColumn(2)?.numFmt, "#,##0.00");
  assert.equal(worksheet.getCell("B2")?.font?.color?.argb, "FF047857");
  assert.equal(worksheet.getCell("C2")?.font?.bold, true);
});

test("XLSX 导出文件名带单位与年度信息", () => {
  const buildAnnualTaxExportWorkbookFilename = Reflect.get(
    exportModule,
    "buildAnnualTaxExportWorkbookFilename",
  ) as (unitName: string, taxYear: number) => string;

  const filename = buildAnnualTaxExportWorkbookFilename("华北一分部", 2026);
  assert.equal(filename, "工资薪金个税结果_华北一分部_2026.xlsx");
});
