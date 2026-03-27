# 项目任务列表

## 当前阶段
- Execution

## 任务列表

### [x] 历史查询：重算版本历史查询
- 完成时间：2026-03-27 12:02
- 修改文件：
  - `apps/api/src/db/database.ts`
  - `apps/api/src/repositories/annual-tax-result-repository.ts`
  - `apps/api/src/services/annual-tax-service.ts`
  - `apps/api/src/routes/calculations.ts`
  - `apps/api/src/annual-results.test.ts`
  - `apps/desktop/src/api/client.ts`
  - `apps/desktop/src/pages/HistoryQueryPage.tsx`
  - `packages/core/src/index.ts`
- 影响范围：
  - 年度结果重算链路
  - 历史查询版本时间线展示
  - 结果版本快照存储与查询 API

### [x] 结果中心：历史版本查看
- 完成时间：2026-03-27 12:12
- 修改文件：
  - `apps/desktop/src/pages/AnnualResultsPage.tsx`
- 影响范围：
  - 结果中心明细页
  - 当前员工年度结果的版本时间线查看

### [x] 结果中心：结果版本差异对比
- 完成时间：2026-03-27 12:20
- 修改文件：
  - `apps/desktop/src/pages/AnnualResultsPage.tsx`
  - `apps/desktop/src/pages/annual-result-version-diff.ts`
  - `apps/desktop/src/pages/annual-result-version-diff.test.ts`
- 影响范围：
  - 结果中心版本差异对比区块
  - 双版本选择与关键字段差异展示

### [x] 批量导入：Excel 解析支持
- 完成时间：2026-03-27 12:31
- 修改文件：
  - `apps/desktop/src/pages/ImportPage.tsx`
  - `apps/desktop/src/pages/import-file-parser.ts`
  - `apps/desktop/src/pages/import-file-parser.test.ts`
- 影响范围：
  - 批量导入文件选择入口
  - Excel 到 CSV 的前端解析复用链路

### [x] 批量导入：更细粒度的预览字段展示
- 完成时间：2026-03-27 12:40
- 修改文件：
  - `apps/desktop/src/pages/ImportPage.tsx`
  - `apps/desktop/src/pages/import-preview-details.ts`
  - `apps/desktop/src/pages/import-preview-details.test.ts`
  - `apps/desktop/src/styles.css`
- 影响范围：
  - 批量导入预览表格
  - 字段映射、冲突字段和值的细粒度展示

### [x] 系统维护：富文本说明维护
- 完成时间：2026-03-27 12:50
- 修改文件：
  - `apps/desktop/src/pages/MaintenancePage.tsx`
  - `apps/desktop/src/pages/maintenance-rich-text.tsx`
  - `apps/desktop/src/pages/maintenance-rich-text.test.ts`
  - `apps/desktop/src/styles.css`
- 影响范围：
  - 系统维护说明编辑区
  - 富文本预览与格式工具栏

### [x] 结果中心：导出结果模板管理
- 完成时间：2026-03-27 13:00
- 修改文件：
  - `apps/desktop/src/pages/AnnualResultsPage.tsx`
  - `apps/desktop/src/pages/annual-tax-export.ts`
  - `apps/desktop/src/pages/annual-tax-export-template-manager.ts`
  - `apps/desktop/src/pages/annual-tax-export-template-manager.test.ts`
  - `apps/desktop/src/styles.css`
- 影响范围：
  - 结果中心导出模板管理区
  - 模板摘要、字段分组统计和导出反馈

### [x] 个税计算核心：完整预扣预缴规则方案
- 完成时间：2026-03-27 13:10
- 修改文件：
  - `docs/plans/2026-03-27_withholding-prepayment-complete-plan.md`
  - `docs/tasks.md`
  - `PROGRESS.md`
  - `docs/context/latest_context.md`
- 影响范围：
  - 复杂预扣预缴规则方案沉淀
  - 后续实施任务拆解

### [x] 个税计算核心：预扣预缴共享类型与月度轨迹纯函数
- 完成时间：2026-03-27 13:20
- 修改文件：
  - `packages/core/src/index.ts`
  - `packages/core/src/annual-tax-calculator.ts`
  - `packages/core/src/annual-tax-calculator.test.ts`
- 影响范围：
  - 预扣预缴共享类型
  - 月度预扣轨迹纯函数
  - 核心层测试覆盖

### [x] 个税计算核心：年度计算器接入预扣轨迹摘要
- 完成时间：2026-03-27 13:28
- 修改文件：
  - `packages/core/src/index.ts`
  - `packages/core/src/annual-tax-calculator.ts`
  - `packages/core/src/annual-tax-calculator.test.ts`
  - `apps/desktop/src/pages/annual-result-version-diff.test.ts`
  - `apps/desktop/src/pages/annual-tax-explanation.test.ts`
  - `apps/desktop/src/pages/history-query-diff.test.ts`
  - `apps/desktop/src/pages/history-query-export.test.ts`
  - `apps/desktop/src/pages/history-query-year-summary.test.ts`
- 影响范围：
  - 年度计算结果结构
  - 预扣轨迹摘要接入
  - 相关前端测试数据结构

### [x] 结果中心：预扣轨迹摘要展示
- 完成时间：2026-03-27 13:35
- 修改文件：
  - `apps/desktop/src/pages/AnnualResultsPage.tsx`
  - `apps/desktop/src/pages/annual-tax-withholding-summary.ts`
  - `apps/desktop/src/pages/annual-tax-withholding-summary.test.ts`
  - `PENDING_GOALS.md`
  - `PROGRESS.md`
  - `docs/context/latest_context.md`
- 影响范围：
  - 结果中心明细页
  - 预扣模式、规则应预扣、实际已预扣和差异额展示

### [x] 个税计算核心：补发补扣场景方案
- 完成时间：2026-03-27 13:45
- 修改文件：
  - `docs/plans/2026-03-27_supplementary-payment-withholding-plan.md`
  - `docs/tasks.md`
  - `PROGRESS.md`
  - `docs/context/latest_context.md`
- 影响范围：
  - 补发补扣口径方案沉淀
  - 后续实施任务拆解

### [x] 个税计算核心：补发补扣字段与共享类型
- 完成时间：2026-03-27 13:55
- 修改文件：
  - `packages/core/src/index.ts`
  - `packages/core/src/annual-tax-calculator.ts`
  - `packages/core/src/annual-tax-calculator.test.ts`
- 影响范围：
  - 补发补扣共享类型
  - 补发补扣金额 helper
  - 核心层测试覆盖

### [x] 个税计算核心：补发补扣并入预扣轨迹
- 完成时间：2026-03-27 14:05
- 修改文件：
  - `packages/core/src/annual-tax-calculator.ts`
  - `packages/core/src/annual-tax-calculator.test.ts`
  - `PROGRESS.md`
- 影响范围：
  - 预扣轨迹算法
  - 年度汇算收入与已预扣口径
  - 核心层测试覆盖

### [ ] 月度录入：补发补扣区块与校验
- 类型：功能增强
- 模块：ui
- 描述：在月度录入页新增补发补扣区块，并明确提示“支付当月补发”和“往期更正”不是一回事
- 依赖：个税计算核心：补发补扣字段与共享类型
- 风险：中

## 状态
- [ ] 未完成
- [x] 已完成
- [-] 已废弃
