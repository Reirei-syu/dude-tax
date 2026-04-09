import assert from "node:assert/strict";
import test from "node:test";
import type { YearRecordUpsertItem } from "@dude-tax/core";
import { buildYearRecordWorkbook, buildYearRecordWorkbookBuffer } from "./year-record-export";

const createRow = (taxMonth: number, overrides: Partial<YearRecordUpsertItem> = {}): YearRecordUpsertItem => ({
  taxMonth,
  salaryIncome: 10_000,
  annualBonus: 0,
  pensionInsurance: 0,
  medicalInsurance: 0,
  occupationalAnnuity: 0,
  housingFund: 0,
  supplementaryHousingFund: 0,
  unemploymentInsurance: 0,
  workInjuryInsurance: 0,
  withheldTax: 100,
  otherIncome: 0,
  otherIncomeRemark: "",
  infantCareDeduction: 0,
  childEducationDeduction: 0,
  continuingEducationDeduction: 0,
  housingLoanInterestDeduction: 0,
  housingRentDeduction: 0,
  elderCareDeduction: 0,
  otherDeduction: 0,
  taxReductionExemption: 0,
  remark: "",
  ...overrides,
});

test("年度导出工作簿包含汇总 sheet 和每员工明细 sheet", () => {
  const workbook = buildYearRecordWorkbook({
    summarySheetName: "汇总",
    summaryColumns: [
      { key: "employeeCode", label: "工号" },
      { key: "employeeName", label: "姓名" },
      { key: "withheldTax", label: "预扣税额" },
    ],
    summaryRows: [
      {
        employeeCode: "EMP-001",
        employeeName: "张三",
        withheldTax: "100.00",
      },
    ],
    employees: [
      {
        employeeCode: "EMP-001",
        employeeName: "张三",
        rows: [createRow(1), createRow(2)],
      },
    ],
    basicDeductionAmount: 5000,
  });

  assert.equal(workbook.worksheets[0]?.name, "汇总");
  assert.equal(workbook.worksheets[1]?.name, "EMP-001-张三");
  assert.equal(workbook.getWorksheet("汇总")?.getCell("A1")?.value, "工号");
  assert.equal(workbook.getWorksheet("汇总")?.getCell("B2")?.value, "张三");
  assert.equal(workbook.getWorksheet("EMP-001-张三")?.getCell("A1")?.value, "月份");
  assert.equal(workbook.getWorksheet("EMP-001-张三")?.getCell("A2")?.value, "1月");
  assert.equal(workbook.getWorksheet("EMP-001-张三")?.getCell("V1")?.value, "减除费用");
  assert.equal(workbook.getWorksheet("EMP-001-张三")?.getCell("V2")?.value, 5000);
});

test("年度导出工作簿 buffer 可生成有效内容", async () => {
  const buffer = await buildYearRecordWorkbookBuffer({
    summarySheetName: "汇总",
    summaryColumns: [
      { key: "employeeCode", label: "工号" },
      { key: "employeeName", label: "姓名" },
    ],
    summaryRows: [
      {
        employeeCode: "EMP-001",
        employeeName: "张三",
      },
    ],
    employees: [
      {
        employeeCode: "EMP-001",
        employeeName: "张三",
        rows: [createRow(1)],
      },
    ],
    basicDeductionAmount: 5000,
  });

  assert.ok(buffer.byteLength > 0);
});
