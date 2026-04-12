import assert from "node:assert/strict";
import { test } from "node:test";
import type { Employee } from "@dude-tax/core";
import {
  buildEmployeeRosterStatusLabel,
  filterEmployeeListByFormerEmployeeVisibility,
} from "./employee-list-filter";

const buildEmployee = (
  overrides: Partial<Employee> & Pick<Employee, "id" | "employeeCode" | "employeeName">,
): Employee => ({
  unitId: 1,
  idNumber: "110101199001011111",
  hireDate: null,
  leaveDate: null,
  remark: "",
  createdAt: "2026-04-08T00:00:00.000Z",
  updatedAt: "2026-04-08T00:00:00.000Z",
  ...overrides,
});

test("员工列表状态文案会输出四类标签", () => {
  assert.equal(buildEmployeeRosterStatusLabel(buildEmployee({
    id: 1,
    employeeCode: "EMP001",
    employeeName: "本年入职",
    hireDate: "2026-03-15",
  }), 2026), "2026-03-15入职");

  assert.equal(buildEmployeeRosterStatusLabel(buildEmployee({
    id: 2,
    employeeCode: "EMP002",
    employeeName: "在职员工",
    hireDate: "2025-03-15",
  }), 2026), "在职");

  assert.equal(buildEmployeeRosterStatusLabel(buildEmployee({
    id: 3,
    employeeCode: "EMP003",
    employeeName: "本年离职",
    hireDate: "2025-03-15",
    leaveDate: "2026-08-31",
  }), 2026), "2026-08-31离职");

  assert.equal(buildEmployeeRosterStatusLabel(buildEmployee({
    id: 4,
    employeeCode: "EMP004",
    employeeName: "以前年度离职",
    hireDate: "2024-03-15",
    leaveDate: "2025-08-31",
  }), 2026), "已离职");
});

test("隐藏已离职员工时仅过滤以前年度离职员工", () => {
  const employees = [
    buildEmployee({
      id: 1,
      employeeCode: "EMP001",
      employeeName: "本年入职",
      hireDate: "2026-03-15",
    }),
    buildEmployee({
      id: 2,
      employeeCode: "EMP002",
      employeeName: "在职员工",
      hireDate: "2025-03-15",
    }),
    buildEmployee({
      id: 3,
      employeeCode: "EMP003",
      employeeName: "本年离职",
      hireDate: "2025-03-15",
      leaveDate: "2026-08-31",
    }),
    buildEmployee({
      id: 4,
      employeeCode: "EMP004",
      employeeName: "以前年度离职",
      hireDate: "2024-03-15",
      leaveDate: "2025-08-31",
    }),
  ];

  assert.deepEqual(
    filterEmployeeListByFormerEmployeeVisibility(employees, 2026, true).map(
      (employee) => employee.employeeCode,
    ),
    ["EMP001", "EMP002", "EMP003"],
  );
});

test("切换税年后员工列表状态与过滤结果会变化", () => {
  const employee = buildEmployee({
    id: 1,
    employeeCode: "EMP001",
    employeeName: "跨年状态变化",
    hireDate: "2025-03-15",
    leaveDate: "2026-08-31",
  });

  assert.equal(buildEmployeeRosterStatusLabel(employee, 2026), "2026-08-31离职");
  assert.equal(buildEmployeeRosterStatusLabel(employee, 2027), "已离职");

  assert.deepEqual(
    filterEmployeeListByFormerEmployeeVisibility([employee], 2026, true).map(
      (item) => item.employeeCode,
    ),
    ["EMP001"],
  );
  assert.deepEqual(filterEmployeeListByFormerEmployeeVisibility([employee], 2027, true), []);
});
