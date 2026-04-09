# 项目任务列表

## 当前阶段

- Execution

## 任务列表

### [ ] Windows / Electron 手工烟测月度录入年度化计算主流程
- 类型：Test
- 模块：`apps/desktop`
- 描述：手工检查月度数据录入页的员工选择弹层、折叠区块、年度工作台、执行计算、结果汇总与明细弹层，以及结果确认页的全员覆盖门禁与当前待确认结果展示。
- 依赖：月度数据录入模块年度化计算改造已完成
- 风险：中
- 优先级：4

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
