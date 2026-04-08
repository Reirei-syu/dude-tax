# 历史结果重算对比迁移到 API 方案

## 1. 背景

- 当前 [HistoryQueryPage.tsx](/D:/coding/dude-tax/apps/desktop/src/pages/HistoryQueryPage.tsx) 直接 `import { calculateEmployeeAnnualTax } from "@dude-tax/core"` 并在前端发起“月度记录 + 税率配置”双请求后自行重算。
- 这条链路违反现有分层约束 `UI -> Service -> Core`，也让差异解释逻辑散落在前端。
- 当前 [calculations.ts](/D:/coding/dude-tax/apps/api/src/routes/calculations.ts) 仍存在对 `packages/core/src/index.js` 的源码级引用，和本轮收口目标不一致。

## 2. 目标

- 删除前端对核心计算的直接调用。
- 由本地 API 提供“历史结果重算对比”统一入口。
- 将差异解释收口到服务层，前端只负责展示。
- 保持当前页面功能与交互语义不变。

## 3. 设计方案

- 新增接口：`POST /api/history-results/recalculate`
- 请求体：
  - `unitId`
  - `taxYear`
  - `employeeId`
- 返回体：
  - `snapshotResult`：当前选中的历史结果快照
  - `recalculatedResult`：按当前有效税率与当前月度数据重算后的结果
  - `comparisonItems`：服务层生成的差异项列表
  - `invalidatedReason`
- 服务层新增统一入口，例如 `annualTaxService.recalculateHistoryResult(...)`
  - 读取目标历史结果
  - 读取当前有效税率
  - 读取当前月度记录
  - 复用现有桥接上下文构造和年度计算逻辑
  - 生成差异项
- 差异项生成逻辑从前端迁到 API，可放在 `apps/api/src/services` 或 `apps/api/src/domain` 下的专用 helper。
- 前端 [HistoryQueryPage.tsx](/D:/coding/dude-tax/apps/desktop/src/pages/HistoryQueryPage.tsx) 改为只调用 `apiClient.recalculateHistoryResult(...)`。
- 路由层同时清理 [calculations.ts](/D:/coding/dude-tax/apps/api/src/routes/calculations.ts) 对 `packages/core/src` 的源码级引用，统一改回 workspace 包入口。

## 4. 涉及模块

- `apps/api/src/routes/calculations.ts`
- `apps/api/src/services/annual-tax-service.ts`
- `apps/api/src/domain/*` 或 `apps/api/src/services/*` 中新增历史结果对比 helper
- `apps/api/src/annual-results.test.ts`
- `apps/desktop/src/api/client.ts`
- `apps/desktop/src/pages/HistoryQueryPage.tsx`
- 如需共享返回类型：`packages/core/src/index.ts`

## 5. 数据结构变更

- 不涉及 SQLite 表结构变更。
- 如需前后端共享返回类型，仅增加 TypeScript 类型，不改数据库。

## 6. 接口变更

- 新增 `POST /api/history-results/recalculate`
- 前端新增 `apiClient.recalculateHistoryResult(...)`
- 现有历史查询列表接口保持不变。

## 7. 风险评估

- 中风险：会调整前后端交互方式，并影响历史查询页的差异展示链路。
- 如果返回结构设计不稳，容易让前端继续保留本地差异拼装逻辑，导致职责没有真正收口。
- 如果服务层没有严格复用现有年度计算上下文，重算结果可能与正式计算中心口径再次分叉。

## 8. 回退方案

- 保留现有历史查询列表接口不动。
- 若新接口行为异常，可仅回退：
  - 新增路由
  - 前端 `apiClient` 新方法
  - 历史查询页对新接口的调用
- 回退后恢复为原前端本地重算方式，但需保留本次问题记录。

## 9. 任务拆解

- [ ] 设计并新增历史结果重算对比接口返回类型
- [ ] 在 API 服务层实现历史结果重算与差异项生成
- [ ] 在路由层新增 `POST /api/history-results/recalculate` 并完成参数校验
- [ ] 在前端 `apiClient` 增加对应调用，删除 `HistoryQueryPage` 对核心计算的直接引用
- [ ] 调整历史查询页展示逻辑，改为消费 API 返回的 `comparisonItems`
- [ ] 补 API 回归测试与前端类型检查验证
