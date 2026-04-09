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
  assert.equal(employeeManagementPageSource.includes("下载员工模板"), true);
  assert.equal(employeeManagementPageSource.includes("ImportWorkflowSection"), true);
  assert.equal(employeeManagementPageSource.includes('importType="employee"'), true);
});
