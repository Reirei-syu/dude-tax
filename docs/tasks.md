# 项目任务列表

## 当前阶段

- Execution

## 任务列表

### [x] 修复月度批量导入工作区折叠样式失效
- 类型：Fix
- 模块：`apps/desktop`
- 描述：修复月度批量导入工作区在默认折叠状态下仍然显示内容的问题，确保折叠视觉与状态一致。
- 依赖：月度批量导入工作区默认折叠优化已完成
- 风险：低
- 优先级：4
- 完成时间：2026-04-09
- 修改文件：
  - `apps/desktop/src/styles.css`
  - `apps/desktop/src/components/import-workflow-section.test.ts`
- 影响范围：
  - 补齐折叠内容区的显式隐藏样式
  - 新增回归测试覆盖 `hidden` 与样式联动

### [x] 月度批量导入工作区默认折叠优化
- 类型：Fix
- 模块：`apps/desktop`
- 描述：将月度数据页中的“月度数据批量导入 / 导入预览 / 导入回执”归入专门的批量导入工作区，并在首次进入页面时默认折叠。
- 依赖：批量导入并入员工信息与月度数据录入已完成
- 风险：低
- 优先级：4
- 完成时间：2026-04-09
- 修改文件：
  - `apps/desktop/src/components/ImportWorkflowSection.tsx`
  - `apps/desktop/src/pages/MonthRecordEntryPage.tsx`
  - `apps/desktop/src/pages/month-record-entry-page.test.ts`
  - `apps/desktop/src/styles.css`
- 影响范围：
  - 月度数据页批量导入能力统一归入专门工作区
  - 工作区默认折叠，展开后保留原有模板下载、导入预览与导入回执流程
  - 员工信息页导入区块不受影响

### [ ] Windows / Electron 手工烟测导入合并后的主流程
- 类型：Test
- 模块：`apps/desktop`
- 描述：手工检查员工信息页和月度数据录入页的页内导入、模板下载、预览、执行导入、自动补零、结果刷新，以及结果汇总导出链路。
- 依赖：批量导入并入员工信息与月度数据录入已完成
- 风险：中
- 优先级：4

### [x] 批量导入并入员工信息与月度数据录入
- 完成时间：2026-04-09
- 修改文件：
  - `packages/config/src/index.ts`
  - `packages/core/src/index.ts`
  - `apps/api/src/services/import-service.ts`
  - `apps/api/src/import-template.test.ts`
  - `apps/api/src/import.test.ts`
  - `apps/desktop/src/main.tsx`
  - `apps/desktop/src/components/ImportWorkflowSection.tsx`
  - `apps/desktop/src/pages/EmployeeManagementPage.tsx`
  - `apps/desktop/src/pages/MonthRecordEntryPage.tsx`
  - `apps/desktop/src/pages/HomePage.tsx`
  - `apps/desktop/src/pages/home-suggestions.ts`
  - `apps/desktop/src/pages/import-file-parser.ts`
  - `apps/desktop/src/pages/import-template.ts`
- 影响范围：
  - 取消独立批量导入导航与路由
  - 员工导入并入员工信息页
  - 月度导入并入月度数据录入页
  - 月度导入支持缺失行自动补零
  - 月度录入导出迁移到计算结果汇总卡片

### [x] 月度数据录入模块年度化计算改造
- 完成时间：2026-04-09
- 修改文件：
  - `packages/core/src/index.ts`
  - `apps/api/src/repositories/annual-tax-result-repository.ts`
  - `apps/api/src/routes/year-entry.ts`
  - `apps/api/src/services/year-entry-service.ts`
  - `apps/api/src/year-entry.test.ts`
  - `apps/desktop/src/api/client.ts`
  - `apps/desktop/src/components/AnnualTaxCalculationResultPanel.tsx`
  - `apps/desktop/src/components/AnnualTaxResultDialog.tsx`
  - `apps/desktop/src/components/YearEntryEmployeeSelectionDialog.tsx`
  - `apps/desktop/src/pages/MonthRecordEntryPage.tsx`
  - `apps/desktop/src/pages/QuickCalculatePage.tsx`
  - `apps/desktop/src/pages/ResultConfirmationPage.tsx`
  - `apps/desktop/src/styles.css`
- 影响范围：
  - 月度录入改为全年员工名单 + 结果汇总双区块
  - 新增年度录入批量计算接口与结果覆盖校验
  - 结果确认页改读当前待确认结果

### [x] 录入模型精简优化
- 完成时间：2026-04-09
- 修改文件：
  - `packages/core/src/index.ts`
  - `packages/core/src/annual-tax-calculator.ts`
  - `packages/core/src/month-record-data-signature.ts`
  - `apps/api/src/repositories/month-record-repository.ts`
  - `apps/api/src/services/annual-tax-service.ts`
  - `apps/api/src/services/year-entry-service.ts`
  - `apps/api/src/routes/month-records.ts`
  - `apps/api/src/routes/year-entry.ts`
  - `apps/api/src/routes/calculations.ts`
  - `apps/api/src/services/import-service.ts`
  - `apps/desktop/src/components/YearRecordWorkspaceDialog.tsx`
  - `apps/desktop/src/pages/year-record-workspace.ts`
  - `apps/desktop/src/pages/year-record-export.ts`
  - `apps/desktop/src/pages/MonthRecordEntryPage.tsx`
  - `apps/desktop/src/pages/QuickCalculatePage.tsx`
  - `apps/desktop/src/pages/ResultConfirmationPage.tsx`
  - `apps/desktop/src/pages/HistoryQueryPage.tsx`
- 影响范围：
  - 其他收入替代补发收入
  - 记录状态退出主流程
  - 减除费用改为工作台只读预填
  - 已确认空白月按零值月参与计算
