import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const maintenancePageSource = fs.readFileSync(
  path.join(process.cwd(), "src", "pages", "MaintenancePage.tsx"),
  "utf8",
);

test("系统维护页将审计日志动作枚举映射为中文标签", () => {
  assert.equal(maintenancePageSource.includes("taxPolicyAuditActionLabelMap"), true);
  assert.equal(maintenancePageSource.includes('save_settings: "保存税率"'), true);
  assert.equal(maintenancePageSource.includes('update_notes: "更新政策说明"'), true);
  assert.equal(maintenancePageSource.includes('activate_version: "激活版本"'), true);
  assert.equal(maintenancePageSource.includes('bind_scope: "绑定作用域"'), true);
  assert.equal(maintenancePageSource.includes('unbind_scope: "解除作用域绑定"'), true);
  assert.equal(maintenancePageSource.includes('rename_version: "重命名版本"'), true);
  assert.equal(
    maintenancePageSource.includes(
      "taxPolicyAuditActionLabelMap[log.actionType] ?? log.actionType",
    ),
    true,
  );
});

test("系统维护页支持新增并维护多条专项附加扣除政策条目", () => {
  assert.equal((maintenancePageSource.match(/新增说明条目/g) ?? []).length >= 2, true);
  assert.equal(maintenancePageSource.includes("policyItems.length"), true);
  assert.equal(maintenancePageSource.includes("policy-item-editor-card"), true);
  assert.equal(maintenancePageSource.includes("可维护标题、正文与插图"), true);
  assert.equal(maintenancePageSource.includes("policyItems,"), true);
  assert.equal(maintenancePageSource.includes("savePolicyItem"), true);
  assert.equal(maintenancePageSource.includes("当前说明条目已保存"), true);
  assert.equal(maintenancePageSource.includes("collapsedPolicyItems"), true);
  assert.equal(maintenancePageSource.includes("togglePolicyItem"), true);
  assert.equal(
    maintenancePageSource.includes('{collapsedPolicyItems[item.id] ? "展开" : "折叠"}'),
    true,
  );
  assert.equal(
    /className="collapsible-card-body"[\s\S]*hidden=\{collapsedPolicyItems\[item\.id\] \?\? false\}/.test(
      maintenancePageSource,
    ),
    true,
  );
  assert.equal(maintenancePageSource.includes("removePolicyItem"), true);
  assert.equal(
    /savePolicyItem\(item\.id\)[\s\S]*删除[\s\S]*togglePolicyItem\(item\.id\)/.test(
      maintenancePageSource,
    ),
    true,
  );
  assert.equal(maintenancePageSource.includes("删除后需重新保存才会生效"), true);
  assert.equal(maintenancePageSource.includes("保存专项附加扣除政策维护"), true);
});

test("系统维护页所有主要卡片支持默认折叠", () => {
  assert.equal(maintenancePageSource.includes("defaultCollapsedSections"), true);
  assert.equal(maintenancePageSource.includes("taxMaintenance: true"), true);
  assert.equal(maintenancePageSource.includes("policyItems: true"), true);
  assert.equal(maintenancePageSource.includes("basic: true"), true);
  assert.equal(maintenancePageSource.includes("comprehensive: true"), true);
  assert.equal(maintenancePageSource.includes("bonus: true"), true);
  assert.equal(maintenancePageSource.includes("versions: true"), true);
  assert.equal(maintenancePageSource.includes("impact: true"), true);
  assert.equal(maintenancePageSource.includes("audit: true"), true);
  assert.equal(maintenancePageSource.includes('className="collapsible-card-body"'), true);
  assert.equal(maintenancePageSource.includes("hidden={collapsedSections.taxMaintenance}"), true);
  assert.equal(maintenancePageSource.includes("hidden={collapsedSections.policyItems}"), true);
  assert.equal(maintenancePageSource.includes("hidden={collapsedSections.basic}"), true);
  assert.equal(maintenancePageSource.includes("hidden={collapsedSections.comprehensive}"), true);
  assert.equal(maintenancePageSource.includes("hidden={collapsedSections.bonus}"), true);
  assert.equal(maintenancePageSource.includes("hidden={collapsedSections.versions}"), true);
  assert.equal(maintenancePageSource.includes("hidden={collapsedSections.impact}"), true);
  assert.equal(maintenancePageSource.includes("hidden={collapsedSections.audit}"), true);
});

test("系统维护页移除模块总览卡片并改为独立页头", () => {
  assert.equal(
    maintenancePageSource.includes(
      'className="page-section placeholder-card maintenance-page-header"',
    ),
    true,
  );
  assert.equal(maintenancePageSource.includes('toggleSection("overview")'), false);
  assert.equal(maintenancePageSource.includes("collapsedSections.overview"), false);
});

test("系统维护页将四张税率相关卡片收纳到税率维护父卡片内", () => {
  assert.equal(maintenancePageSource.includes("税率维护"), true);
  assert.equal(maintenancePageSource.includes('toggleSection("taxMaintenance")'), true);
  assert.equal(maintenancePageSource.includes("hidden={collapsedSections.taxMaintenance}"), true);
  assert.equal(maintenancePageSource.includes("maintenance-tax-config-stack"), true);
  assert.equal(maintenancePageSource.includes("maintenance-tax-rate-grid"), true);
  assert.equal(
    /税率维护[\s\S]*专项附加扣除政策维护[\s\S]*基本减除费用[\s\S]*综合所得税率表[\s\S]*年终奖单独计税税率表/.test(
      maintenancePageSource,
    ),
    true,
  );
});

test("系统维护页支持输入自定义税率版本名称", () => {
  assert.equal(maintenancePageSource.includes("customVersionName"), true);
  assert.equal(maintenancePageSource.includes("新版本名称（选填）"), true);
  assert.equal(
    maintenancePageSource.includes("versionName: customVersionName.trim() || undefined"),
    true,
  );
  assert.equal(maintenancePageSource.includes("编辑名称"), true);
  assert.equal(maintenancePageSource.includes("保存名称"), true);
  assert.equal(maintenancePageSource.includes("await apiClient.renameTaxPolicyVersion"), true);
  assert.equal(
    maintenancePageSource.includes("const refreshedTaxPolicy = await apiClient.getTaxPolicy("),
    true,
  );
  assert.equal(maintenancePageSource.includes("formatLocalDateTime"), true);
  assert.equal(maintenancePageSource.includes('toLocaleString("zh-CN", { hour12: false })'), true);
});

test("系统维护页将专项附加扣除政策维护和基本减除费用改为全宽上下结构", () => {
  assert.equal(
    maintenancePageSource.includes(
      '<article className="glass-card page-section placeholder-card">',
    ),
    true,
  );
  assert.equal(maintenancePageSource.includes("专项附加扣除政策维护"), true);
  assert.equal(maintenancePageSource.includes("基本减除费用"), true);
});

test("系统维护页新增单位备份卡片并展示最近路径与建议文件名", () => {
  assert.equal(maintenancePageSource.includes("单位备份"), true);
  assert.equal(maintenancePageSource.includes("选择备份位置"), true);
  assert.equal(maintenancePageSource.includes("开始备份"), true);
  assert.equal(maintenancePageSource.includes("最近备份目录"), true);
  assert.equal(maintenancePageSource.includes("建议文件名"), true);
  assert.equal(maintenancePageSource.includes("纳入备份年份"), true);
  assert.equal(maintenancePageSource.includes("请先选择单位"), true);
});

test("系统维护页通过桌面桥接选择备份路径并调用备份接口", () => {
  assert.equal(maintenancePageSource.includes("apiClient.getUnitBackupDraft"), true);
  assert.equal(maintenancePageSource.includes("apiClient.createUnitBackup"), true);
  assert.equal(maintenancePageSource.includes("window.salaryTaxDesktop?.pickSavePath"), true);
  assert.equal(maintenancePageSource.includes("backupDraft"), true);
  assert.equal(maintenancePageSource.includes("backupExecutionResult"), true);
});
