import assert from "node:assert/strict";
import { test } from "node:test";
import {
  deriveEmployeeGeneralStatus,
  deriveEmployeeMonthStatus,
  isEmployeeActiveInTaxMonth,
  isEmployeeActiveInTaxYear,
  type Employee,
} from "./index.js";

const buildEmployee = (leaveDate: string | null): Employee => ({
  id: 1,
  unitId: 1,
  employeeCode: "EMP001",
  employeeName: "张三",
  idNumber: "110101199001011234",
  hireDate: "2024-01-01",
  leaveDate,
  remark: "",
  createdAt: "2026-04-08T00:00:00.000Z",
  updatedAt: "2026-04-08T00:00:00.000Z",
});

test("未填写离职日期的员工通用状态与月度状态均为在职", () => {
  const employee = buildEmployee(null);

  assert.equal(deriveEmployeeGeneralStatus(employee), "active");
  assert.equal(deriveEmployeeMonthStatus(employee, 2026, 4), "active");
});

test("填写离职日期的员工在员工页显示离职", () => {
  const employee = buildEmployee("2026-06-30");

  assert.equal(deriveEmployeeGeneralStatus(employee), "left");
});

test("填写离职日期的员工在离职当月显示本月离职本月，后续月份显示离职", () => {
  const employee = buildEmployee("2026-06-30");

  assert.equal(deriveEmployeeMonthStatus(employee, 2026, 5), "active");
  assert.equal(deriveEmployeeMonthStatus(employee, 2026, 6), "left_this_month");
  assert.equal(deriveEmployeeMonthStatus(employee, 2026, 7), "left");
});

test("税年在职判定会纳入当年曾经在职的员工", () => {
  const employee: Employee = {
    ...buildEmployee("2026-03-31"),
    hireDate: "2026-01-01",
  };

  assert.equal(isEmployeeActiveInTaxYear(employee, 2026), true);
});

test("税年在职判定会排除全年未在职的员工", () => {
  const employee: Employee = {
    ...buildEmployee("2025-12-31"),
    hireDate: "2024-01-01",
  };

  assert.equal(isEmployeeActiveInTaxYear(employee, 2026), false);
});

test("税年在职判定会排除次年才入职的员工", () => {
  const employee: Employee = {
    ...buildEmployee(null),
    hireDate: "2027-01-01",
  };

  assert.equal(isEmployeeActiveInTaxYear(employee, 2026), false);
});

test("税月在职判定会排除入职前月份并纳入入职当月", () => {
  const employee: Employee = {
    ...buildEmployee(null),
    hireDate: "2026-07-01",
  };

  assert.equal(isEmployeeActiveInTaxMonth(employee, 2026, 6), false);
  assert.equal(isEmployeeActiveInTaxMonth(employee, 2026, 7), true);
});

test("税月在职判定会排除离职后月份并纳入离职当月", () => {
  const employee: Employee = {
    ...buildEmployee("2026-06-30"),
    hireDate: "2026-01-01",
  };

  assert.equal(isEmployeeActiveInTaxMonth(employee, 2026, 6), true);
  assert.equal(isEmployeeActiveInTaxMonth(employee, 2026, 7), false);
});
