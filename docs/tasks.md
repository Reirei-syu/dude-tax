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

### [ ] 结果中心：历史版本查看
- 类型：功能增强
- 模块：ui
- 描述：在结果中心复用结果版本快照能力，查看当前结果的历史版本
- 依赖：历史查询：重算版本历史查询
- 风险：中

### [ ] 结果中心：结果版本差异对比
- 类型：功能增强
- 模块：ui
- 描述：支持在结果中心对两个历史版本进行关键字段差异对比
- 依赖：结果中心：历史版本查看
- 风险：中

### [ ] 批量导入：Excel 解析支持
- 类型：功能增强
- 模块：service / ui
- 描述：在保留 CSV 能力的基础上支持 Excel 文件解析导入
- 依赖：无
- 风险：中

### [ ] 批量导入：更细粒度的预览字段展示
- 类型：体验增强
- 模块：ui
- 描述：在导入预览中细化展示字段映射、冲突字段和值
- 依赖：无
- 风险：中低

### [ ] 系统维护：富文本说明维护
- 类型：功能增强
- 模块：config / service / ui
- 描述：将当前纯文本说明升级为可控的富文本说明维护能力
- 依赖：无
- 风险：中高

## 状态
- [ ] 未完成
- [x] 已完成
- [-] 已废弃
