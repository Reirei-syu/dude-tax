import assert from "node:assert/strict";
import { test } from "node:test";
import type { Employee } from "@dude-tax/core";
import { filterVisibleEmployeesForMonth } from "./month-record-employee-filter";

const employees: Employee[] = [
  {
    id: 1,
    unitId: 1,
    employeeCode: "EMP001",
    employeeName: "在职员工",
    idNumber: "110101199001011111",
    hireDate: "2024-01-01",
    leaveDate: null,
    remark: "",
    createdAt: "2026-04-08T00:00:00.000Z",
    updatedAt: "2026-04-08T00:00:00.000Z",
  },
  {
    id: 2,
    unitId: 1,
    employeeCode: "EMP002",
    employeeName: "当月离职员工",
    idNumber: "110101199001012222",
    hireDate: "2024-01-01",
    leaveDate: "2026-06-30",
    remark: "",
    createdAt: "2026-04-08T00:00:00.000Z",
    updatedAt: "2026-04-08T00:00:00.000Z",
  },
  {
    id: 3,
    unitId: 1,
    employeeCode: "EMP003",
    employeeName: "已离职员工",
    idNumber: "110101199001013333",
    hireDate: "2024-01-01",
    leaveDate: "2026-05-31",
    remark: "",
    createdAt: "2026-04-08T00:00:00.000Z",
    updatedAt: "2026-04-08T00:00:00.000Z",
  },
];

test("月度录入页会隐藏所选月份已离职员工，但保留当月离职员工", () => {
  const visibleEmployees = filterVisibleEmployeesForMonth(employees, 2026, 6);

  assert.deepEqual(
    visibleEmployees.map((employee) => employee.employeeCode),
    ["EMP001", "EMP002"],
  );
});
