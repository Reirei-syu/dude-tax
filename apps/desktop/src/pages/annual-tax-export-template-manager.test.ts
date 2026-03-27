import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_ANNUAL_TAX_EXPORT_COLUMN_KEYS } from "./annual-tax-export";
import { buildAnnualTaxExportSelectionSummary } from "./annual-tax-export-template-manager";

test("当字段集合与预置模板一致时，选择摘要能识别匹配模板", () => {
  const summary = buildAnnualTaxExportSelectionSummary(DEFAULT_ANNUAL_TAX_EXPORT_COLUMN_KEYS);

  assert.equal(summary.isCustomSelection, false);
  assert.equal(summary.matchedTemplateId, "finance");
  assert.equal(summary.selectedColumnCount, DEFAULT_ANNUAL_TAX_EXPORT_COLUMN_KEYS.length);
  assert.ok(summary.templates.some((template) => template.id === "finance" && template.isActive));
});

test("当字段集合被修改后，选择摘要会回落为自定义模板", () => {
  const summary = buildAnnualTaxExportSelectionSummary([
    "employeeCode",
    "employeeName",
    "selectedFinalTax",
  ]);

  assert.equal(summary.isCustomSelection, true);
  assert.equal(summary.matchedTemplateId, null);
  assert.equal(summary.selectedGroupCount >= 1, true);
  assert.equal(summary.groups[0]?.labels.includes("员工工号"), true);
});
