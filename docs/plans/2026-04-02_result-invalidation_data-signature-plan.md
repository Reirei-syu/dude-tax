# 结果失效判定改为 policy_signature + data_signature 方案

## 1. 背景
- 当前结果有效性只基于 `policy_signature`
- 当月度数据发生变更但税率未变化时，旧结果和旧版本仍可能被错误地视为有效
- 历史查询中的失效语义因此不完整，无法区分“税率变化失效”和“数据变化失效”

## 2. 目标
- 为年度结果与重算状态增加 `data_signature`
- 让结果有效性同时受税率签名和数据签名控制
- 保持现有结果表、历史版本表和重算状态表的兼容迁移能力

## 3. 设计方案
- 在服务层为“单位 + 员工 + 年度”的完整月度记录计算稳定的 `data_signature`
- `annual_tax_results`、`annual_tax_result_versions`、`annual_calculation_runs` 增加 `data_signature`
- 当前有效判定：
  - `policy_signature` 一致
  - `data_signature` 一致
  - 二者同时成立才算有效
- `invalidatedReason` 扩展为：
  - `tax_policy_changed`
  - `month_record_changed`
- 旧数据兼容策略：
  - 首轮迁移时为空值视为“需重算”
  - 后续重算后写回完整签名

## 4. 涉及模块
- `packages/core`
- `apps/api/src/db/database.ts`
- `apps/api/src/repositories/annual-tax-result-repository.ts`
- `apps/api/src/repositories/calculation-run-repository.ts`
- `apps/api/src/services/annual-tax-service.ts`
- `apps/api/src/routes/calculations.ts`
- `apps/desktop/src/pages/AnnualResultsPage.tsx`
- `apps/desktop/src/pages/HistoryQueryPage.tsx`

## 5. 数据结构变更
- 新增字段：
  - `annual_tax_results.data_signature`
  - `annual_tax_result_versions.data_signature`
  - `annual_calculation_runs.data_signature`
- 兼容旧库迁移采用非破坏性 `ALTER TABLE ... ADD COLUMN`

## 6. 接口变更
- 年度结果查询和历史查询的返回结构会继续包含 `isInvalidated`，但失效原因会增加 `month_record_changed`
- 无需新增接口

## 7. 风险评估
- 风险高：会影响结果中心、历史查询、计算中心的失效语义
- 若签名算法不稳定，会导致“无变化也被判失效”
- 若旧数据策略处理不当，会造成大量历史结果状态突变

## 8. 回退方案
- 所有新增字段保留默认空值
- 如签名语义异常，可临时回退到仅使用 `policy_signature` 判定，并保留字段不启用

## 9. 任务拆解
- [ ] 设计并实现年度月度记录 `data_signature` 计算规则
- [ ] 为结果表、历史版本表、重算状态表补 `data_signature`
- [ ] 更新当前有效 / 已失效判定逻辑
- [ ] 扩展 `invalidatedReason`
- [ ] 补测试：税率变化 / 数据变化 / 无变化三类场景
