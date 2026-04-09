# 项目任务列表

## 当前阶段

- Execution

## 任务列表

### [ ] Windows / Electron 手工烟测录入模型精简后的主流程
- 类型：Test
- 模块：`apps/desktop`
- 描述：手工检查月度数据录入、快速计算、结果确认、历史查询 4 个主页面在桌面壳中的交互、弹层、滚动与导出行为，重点确认“其他收入”“减除费用只读列”“空白确认月”表现。
- 依赖：录入模型精简优化已完成
- 风险：中
- 优先级：4

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
