import assert from "node:assert/strict";
import test from "node:test";
import type { HistoryAnnualTaxResult } from "../../../../packages/core/src/index";
import * as exportModule from "./history-query-export";

const createHistoryResult = (
  overrides: Partial<HistoryAnnualTaxResult> = {},
): HistoryAnnualTaxResult => ({
  unitId: 1,
  unitName: "测试单位",
  employeeId: 1,
  employeeCode: "EMP-HIS-001",
  employeeName: "张三",
  taxYear: 2026,
  completedMonthCount: 12,
  salaryIncomeTotal: 120000,
  annualBonusTotal: 24000,
  insuranceAndHousingFundTotal: 12000,
  specialAdditionalDeductionTotal: 24000,
  otherDeductionTotal: 0,
  basicDeductionTotal: 60000,
  taxReductionExemptionTotal: 0,
  selectedScheme: "separate_bonus",
  selectedTaxAmount: 3000,
  annualTaxPayable: 3000,
  annualTaxWithheld: 2000,
  annualTaxSettlement: 1000,
  settlementDirection: "payable",
  calculatedAt: "2026-03-25T14:30:00.000Z",
  schemeResults: {
    separateBonus: {
      scheme: "separate_bonus",
      taxableComprehensiveIncome: 48000,
      comprehensiveIncomeTax: 2280,
      annualBonusTax: 720,
      grossTax: 3000,
      taxReductionExemptionTotal: 0,
      finalTax: 3000,
      comprehensiveBracketLevel: 2,
      bonusBracketLevel: 2,
    },
    combinedBonus: {
      scheme: "combined_bonus",
      taxableComprehensiveIncome: 72000,
      comprehensiveIncomeTax: 4680,
      annualBonusTax: 0,
      grossTax: 4680,
      taxReductionExemptionTotal: 0,
      finalTax: 4680,
      comprehensiveBracketLevel: 2,
      bonusBracketLevel: null,
    },
  },
  isInvalidated: false,
  invalidatedReason: null,
  ...overrides,
});

test("历史查询导出模块暴露 CSV、Workbook 和文件名函数", () => {
  assert.equal(typeof Reflect.get(exportModule, "buildHistoryQueryExportCsv"), "function");
  assert.equal(typeof Reflect.get(exportModule, "buildHistoryQueryExportWorkbook"), "function");
  assert.equal(typeof Reflect.get(exportModule, "buildHistoryQueryExportFilename"), "function");
  assert.equal(
    typeof Reflect.get(exportModule, "buildHistoryQueryExportWorkbookFilename"),
    "function",
  );
});

test("历史查询 CSV 导出包含结果状态列", () => {
  const buildHistoryQueryExportCsv = Reflect.get(exportModule, "buildHistoryQueryExportCsv") as (
    rows: HistoryAnnualTaxResult[],
  ) => string;

  const csv = buildHistoryQueryExportCsv([
    createHistoryResult(),
    createHistoryResult({
      employeeId: 2,
      employeeCode: "EMP-HIS-002",
      employeeName: '李"四, Jr.',
      selectedScheme: "combined_bonus",
      annualTaxPayable: 4680,
      annualTaxWithheld: 5000,
      annualTaxSettlement: -320,
      settlementDirection: "refund",
      isInvalidated: true,
      invalidatedReason: "tax_policy_changed",
    }),
  ]);

  const lines = csv.split("\r\n");
  assert.equal(
    lines[0],
    "单位名称,年度,员工工号,员工姓名,结果状态,当前方案,年度应纳税额,已预扣税额,应补/应退税额,结算方向,计算时间",
  );
  assert.match(lines[1] ?? "", /当前有效/);
  assert.match(lines[2] ?? "", /已失效/);
  assert.match(lines[2] ?? "", /"李""四, Jr\."|李""四, Jr\./);
});

test("历史查询 XLSX 导出工作表为历史结果", () => {
  const buildHistoryQueryExportWorkbook = Reflect.get(
    exportModule,
    "buildHistoryQueryExportWorkbook",
  ) as (rows: HistoryAnnualTaxResult[]) => {
    getWorksheet: (name: string) => {
      getCell: (cell: string) => {
        value: string | number | null;
        fill?: { fgColor?: { argb?: string } };
      };
      views?: Array<{ state?: string; ySplit?: number }>;
      getColumn: (index: number) => { width?: number; numFmt?: string };
    };
    worksheets: Array<{ name: string }>;
  };

  const workbook = buildHistoryQueryExportWorkbook([createHistoryResult()]);
  assert.equal(workbook.worksheets[0]?.name, "历史结果");
  assert.equal(workbook.worksheets[1]?.name, "导出说明");
  assert.equal(workbook.getWorksheet("历史结果")?.getCell("A1")?.value, "单位名称");
  assert.equal(workbook.getWorksheet("历史结果")?.getCell("E1")?.value, "结果状态");
  assert.equal(workbook.getWorksheet("历史结果")?.getCell("E2")?.value, "当前有效");
  assert.equal(workbook.getWorksheet("历史结果")?.views?.[0]?.state, "frozen");
  assert.equal(workbook.getWorksheet("历史结果")?.views?.[0]?.ySplit, 1);
  assert.ok((workbook.getWorksheet("历史结果")?.getColumn(1)?.width ?? 0) >= 12);
  assert.equal(workbook.getWorksheet("导出说明")?.getCell("A1")?.value, "说明项");
  assert.equal(workbook.getWorksheet("导出说明")?.getCell("B2")?.value, "测试单位");
  assert.equal(workbook.getWorksheet("导出说明")?.views?.[0]?.state, "frozen");
  assert.equal(workbook.getWorksheet("历史结果")?.getColumn(7)?.numFmt, "#,##0.00");
  const historyFill = workbook.getWorksheet("历史结果")?.getCell("A2")?.fill;
  assert.equal(
    historyFill && "fgColor" in historyFill ? historyFill.fgColor?.argb : undefined,
    "FFF8FBFF",
  );
});

test("历史查询导出文件名带作用域信息", () => {
  const buildHistoryQueryExportFilename = Reflect.get(
    exportModule,
    "buildHistoryQueryExportFilename",
  ) as (scopeLabel: string) => string;
  const buildHistoryQueryExportWorkbookFilename = Reflect.get(
    exportModule,
    "buildHistoryQueryExportWorkbookFilename",
  ) as (scopeLabel: string) => string;

  assert.equal(buildHistoryQueryExportFilename("全部单位_全部年份_已失效"), "工资薪金历史结果_全部单位_全部年份_已失效.csv");
  assert.equal(
    buildHistoryQueryExportWorkbookFilename("测试单位_2026_当前有效"),
    "工资薪金历史结果_测试单位_2026_当前有效.xlsx",
  );
});
