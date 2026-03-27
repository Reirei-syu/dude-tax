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

### [ ] 结果中心：导出结果模板管理
- 类型：体验增强
- 模块：ui
- 描述：增强结果中心导出模板的管理与切换体验，支持更清晰的模板语义和使用反馈
- 依赖：无
- 风险：中低

## 状态
- [ ] 未完成
- [x] 已完成
- [-] 已废弃
