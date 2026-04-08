# 税率变更后的细粒度结果失效方案

## 1. 背景
- 当前系统维护在保存税率时，会直接清空 `annual_tax_results` 与 `annual_calculation_runs`。
- 这个策略虽然简单，但影响范围过大：
  - 结果中心会立即变空
  - 历史查询中的最新快照会直接消失
  - 无法区分“结果失效”与“结果不存在”
- 项目已进入“可用闭环”阶段，继续使用全量清空会影响用户的心智和后续历史能力扩展。

## 2. 目标
- 将当前“物理删除结果”的失效策略，改为“逻辑失效”策略。
- 税率变更后，只让旧口径结果标记为失效，而不是直接删除。
- 计算中心、结果中心、首页提醒和历史查询都能正确识别“失效但仍存在”的状态。
- 为后续税率版本管理和历史结果对比留出扩展空间。

## 3. 设计方案
### 3.1 核心思路
- 为当前生效税率生成一个稳定的 `policy_signature`。
- 在计算结果和重算记录中都保存当时使用的 `policy_signature`。
- 页面和 API 在读取结果时，将存储的 `policy_signature` 与当前生效税率签名比较：
  - 一致：视为有效
  - 不一致：视为失效

### 3.2 存储策略
- 为 `annual_tax_results` 增加字段：
  - `policy_signature TEXT NOT NULL DEFAULT ''`
- 为 `annual_calculation_runs` 增加字段：
  - `policy_signature TEXT NOT NULL DEFAULT ''`
- `policy_signature` 采用当前税率配置的稳定 JSON 串做哈希或直接序列化摘要。
- 首版不做独立版本表。

### 3.3 API 与仓储调整
- 税率仓储保存时不再删除结果，只更新当前税率配置。
- 年度计算保存结果和重算记录时，写入当前 `policy_signature`。
- 计算状态查询需要新增失效判断：
  - 若员工月份数据已完成，但 `annual_calculation_runs.policy_signature` 与当前税率不一致，则视为“待重算”
- 结果中心查询需要新增失效过滤：
  - 默认只返回当前税率下有效结果
- 历史查询首版策略：
  - 仍只返回当前有效结果
  - 旧签名结果继续保留在表里，但不默认展示

### 3.4 前端联动
- 首页“待重算”统计要把“税率变更导致失效”的员工计入。
- 计算中心可沿用现有按钮，不新增复杂交互，但状态文案要能表达“需按新税率重算”。
- 结果中心在没有当前有效结果时，要给出“结果已因税率变更失效，请重新计算”的提示。

## 4. 涉及模块
- `apps/api/src/db/database.ts`
- `apps/api/src/repositories/annual-tax-result-repository.ts`
- `apps/api/src/repositories/calculation-run-repository.ts`
- `apps/api/src/repositories/tax-policy-repository.ts`
- `apps/api/src/services/annual-tax-service.ts`
- `apps/desktop/src/pages/HomePage.tsx`
- `apps/desktop/src/pages/CalculationCenterPage.tsx`
- `apps/desktop/src/pages/AnnualResultsPage.tsx`
- `apps/desktop/src/pages/HistoryQueryPage.tsx`

## 5. 数据结构变更
- `annual_tax_results.policy_signature`
- `annual_calculation_runs.policy_signature`
- 不新增新表。

## 6. 接口变更
- 不一定新增新接口，但以下现有接口返回语义会变化：
  - `GET /api/units/:unitId/years/:taxYear/calculation-statuses`
  - `GET /api/units/:unitId/years/:taxYear/annual-results`
  - `GET /api/history-results`
- 必要时可为状态接口补一个失效原因字段，例如：
  - `invalidatedReason: "tax_policy_changed" | null`

## 7. 风险评估
- 风险 1：数据库字段迁移会影响已有测试数据和历史库文件。
- 风险 2：如果首页、计算中心、结果中心三处失效判断不一致，会导致用户看到互相矛盾的状态。
- 风险 3：历史查询当前只做“当前有效结果”，旧签名结果虽然保留，但还不能真正按版本对外呈现，容易让用户误解。

## 8. 回退方案
- 若实施后状态判断混乱，可回退到当前 `master`，恢复“保存税率即全量清空”的策略。
- 若仅结果中心受影响，可暂时只在后端保留 `policy_signature` 字段，但前端继续沿用当前有效结果过滤逻辑。
- 若签名方案不稳定，可改为存储税率 JSON 快照全文，后续再抽摘要字段。

