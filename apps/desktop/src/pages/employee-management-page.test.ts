import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const employeeManagementPageSource = fs.readFileSync(
  path.join(process.cwd(), "src", "pages", "EmployeeManagementPage.tsx"),
  "utf8",
);

test("员工信息页内嵌员工批量导入区块", () => {
  assert.equal(employeeManagementPageSource.includes("员工批量导入"), true);
  assert.equal(employeeManagementPageSource.includes("员工批量导入工作区"), true);
  assert.equal(
    employeeManagementPageSource.includes("默认收起，展开后处理模板下载、导入预览和导入回执。"),
    true,
  );
  assert.equal(employeeManagementPageSource.includes("defaultCollapsed={true}"), true);
  assert.equal(employeeManagementPageSource.includes("下载员工模板"), true);
  assert.equal(employeeManagementPageSource.includes("ImportWorkflowSection"), true);
  assert.equal(employeeManagementPageSource.includes('importType="employee"'), true);
});

test("员工信息页主卡片与员工列表接入共享折叠组件，不改导入工作区默认折叠", () => {
  assert.equal(employeeManagementPageSource.includes("CollapsibleSectionCard"), true);
  assert.equal(employeeManagementPageSource.includes('title="员工信息"'), true);
  assert.equal(employeeManagementPageSource.includes('title="员工列表"'), true);
  assert.equal(employeeManagementPageSource.includes("defaultCollapsed={true}"), true);
});

test("员工信息页接入独立编辑弹窗与已离职隐藏开关", () => {
  assert.equal(employeeManagementPageSource.includes("EmployeeEditDialog"), true);
  assert.equal(employeeManagementPageSource.includes("隐藏已离职员工"), true);
  assert.equal(
    employeeManagementPageSource.includes('selectedEmployee ? "编辑员工" : "新增员工"'),
    false,
  );
});
