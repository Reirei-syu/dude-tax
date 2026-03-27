import assert from "node:assert/strict";
import test from "node:test";
import type { ImportPreviewRow } from "../../../../packages/core/src/index";
import { buildImportPreviewDetail } from "./import-preview-details";

test("员工冲突预览会突出冲突字段并显示关键信息", () => {
  const row: ImportPreviewRow = {
    rowNumber: 2,
    status: "conflict",
    conflictType: "employee_code_conflict",
    errors: [],
    parsedData: {
      employeeCode: "EMP001",
      employeeName: "张三",
      idNumber: "110101199001010011",
      hireDate: "",
      leaveDate: "",
      remark: "测试备注",
    },
  };

  const detail = buildImportPreviewDetail("employee", row);

  assert.equal(detail.primaryText, "EMP001 / 张三");
  assert.equal(detail.secondaryText, "110101199001010011");
  assert.deepEqual(detail.conflictFieldLabels, ["工号"]);
  assert.equal(detail.fields[0]?.label, "工号");
  assert.equal(detail.fields[0]?.isHighlighted, true);
});

test("月度预览会保留关键字段并折叠零值字段", () => {
  const row: ImportPreviewRow = {
    rowNumber: 2,
    status: "ready",
    conflictType: null,
    errors: [],
    parsedData: {
      employeeCode: "EMP200",
      taxYear: "2026",
      taxMonth: "1",
      status: "completed",
      salaryIncome: "8000",
      annualBonus: "0",
      withheldTax: "100",
      pensionInsurance: "0",
      remark: "",
    },
  };

  const detail = buildImportPreviewDetail("month_record", row);

  assert.equal(detail.primaryText, "EMP200 / 2026 年 / 1 月");
  assert.equal(detail.secondaryText, "已完成");
  assert.equal(detail.fields.some((field) => field.label === "工资收入"), true);
  assert.equal(detail.fields.some((field) => field.label === "年终奖"), false);
});
