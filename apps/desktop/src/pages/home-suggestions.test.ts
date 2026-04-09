import assert from "node:assert/strict";
import test from "node:test";
import type { EmployeeCalculationStatus } from "../../../../packages/core/src/index";
import { buildHomeSuggestions } from "./home-suggestions";

const createStatus = (
  overrides: Partial<EmployeeCalculationStatus> = {},
): EmployeeCalculationStatus => ({
  employeeId: 1,
  employeeCode: "EMP001",
  employeeName: "员工1",
  recordedMonthCount: 12,
  completedMonthCount: 12,
  preparationStatus: "ready",
  lastCalculatedAt: null,
  isInvalidated: false,
  invalidatedReason: null,
  ...overrides,
});

test("未选择单位年份时优先提示确定工作房间", () => {
  const suggestions = buildHomeSuggestions({
    currentUnitId: null,
    currentTaxYear: null,
    employeeCount: 0,
    incompleteMonthCount: 0,
    pendingRecalculateCount: 0,
    invalidatedCount: 0,
    statuses: [],
  });

  assert.equal(suggestions[0]?.title, "先确定工作房间");
});

test("无员工时优先提示先补员工基础档案", () => {
  const suggestions = buildHomeSuggestions({
    currentUnitId: 1,
    currentTaxYear: 2026,
    employeeCount: 0,
    incompleteMonthCount: 0,
    pendingRecalculateCount: 0,
    invalidatedCount: 0,
    statuses: [],
  });

  assert.equal(suggestions[0]?.title, "先补员工基础档案");
  assert.equal(suggestions[0]?.path, "/employees");
});

test("无导入问题时按录入、重算、结果顺序分发建议", () => {
  const suggestions = buildHomeSuggestions({
    currentUnitId: 1,
    currentTaxYear: 2026,
    employeeCount: 3,
    incompleteMonthCount: 5,
    pendingRecalculateCount: 2,
    invalidatedCount: 1,
    statuses: [createStatus({ completedMonthCount: 6 })],
  });

  assert.equal(suggestions[0]?.title, "优先补齐月度数据");
  assert.equal(suggestions[1]?.title, "执行年度重算");
});

test("已有完成月份时仍会给出快速计算复核建议", () => {
  const suggestions = buildHomeSuggestions({
    currentUnitId: 1,
    currentTaxYear: 2026,
    employeeCount: 1,
    incompleteMonthCount: 0,
    pendingRecalculateCount: 0,
    invalidatedCount: 0,
    statuses: [createStatus({ completedMonthCount: 3 })],
  });

  assert.equal(suggestions.some((item) => item.path === "/quick-calc"), true);
});
