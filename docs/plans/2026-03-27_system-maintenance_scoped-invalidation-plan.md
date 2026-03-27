# 系统维护更细粒度结果失效方案

## 1. 背景
- 当前系统已经支持税率版本管理与历史版本激活，结果有效性通过 `policy_signature` 判断。
- 但当前活动税率一旦切换，所有单位、所有年份的结果都会按全局活动版本重新判定有效或失效。
- 这会带来两个实际问题：
  - 某次税率调整只想影响特定年度时，当前实现仍会波及全部年份
  - 某些单位还未切到新税率时，当前实现无法表达“不同单位采用不同活动口径”

## 2. 目标
- 将当前“全局活动税率 -> 全局结果有效性”的模型，细化为“按单位 / 年度范围决定活动税率”。
- 在不推翻现有 `policy_signature` 判定链路的前提下，让结果有效性判断支持更细粒度作用域。
- 保持现有版本表、历史版本激活和结果恢复机制可复用。

## 3. 设计方案
### 3.1 核心思路
- 当前版本表 `tax_policy_versions` 保留不变，继续存“税率版本本身”。
- 新增“税率作用域绑定表”，不再只用单一活动版本指针。
- 结果是否有效，不再只比较“结果签名 vs 全局当前签名”，而是比较：
  - 该结果所属 `unitId + taxYear`
  - 当前对这个作用域生效的税率版本签名

### 3.2 新增表设计
- 新增表：`tax_policy_scopes`
- 字段建议：
  - `id`
  - `scope_type`
    - 取值首版固定为 `unit_year`
  - `unit_id`
  - `tax_year`
  - `tax_policy_version_id`
  - `created_at`
  - `updated_at`
- 唯一约束：
  - `(scope_type, unit_id, tax_year)` 唯一
- 含义：
  - 某个单位在某个年度当前生效的税率版本是哪一个

### 3.3 兼容策略
- 现有 `app_preferences.active_tax_policy_version_id` 作为“默认活动版本”继续保留。
- 当某个 `unitId + taxYear` 没有显式作用域绑定时：
  - 回落到全局默认活动版本
- 这意味着系统初始行为与现在一致，不会因为新表上线立刻改变全部结果语义。

### 3.4 仓储层调整
- `taxPolicyRepository` 新增能力：
  - `getEffectivePolicyForScope(unitId, taxYear)`
  - `bindVersionToScope(unitId, taxYear, versionId)`
  - `clearScopeBinding(unitId, taxYear)` 可选，首版可不开放 UI
- `get()` 保留当前全局活动版本和版本列表
- 新增“作用域绑定摘要”返回：
  - 当前单位 / 年度若有上下文，可返回该作用域当前生效版本
  - 或提供独立查询接口获取某个作用域的绑定状态

### 3.5 API 设计
- 保留：
  - `GET /api/tax-policy`
  - `PUT /api/tax-policy`
  - `POST /api/tax-policy/versions/:versionId/activate`
- 新增：
  - `POST /api/tax-policy/versions/:versionId/bind-scope`
- 请求体首版：
  - `unitId`
  - `taxYear`
- 语义：
  - 将某个历史税率版本绑定为某单位某年度的当前生效版本

### 3.6 结果有效性判定
- `annual_tax_results`、`annual_calculation_runs` 继续保留已有 `policy_signature`
- 判定逻辑改为：
  - 先找到该条结果所属 `unitId + taxYear` 的当前生效税率版本
  - 取其 `policy_signature`
  - 再与结果记录上的 `policy_signature` 比较
- 一致：结果有效
- 不一致：结果失效

### 3.7 前端系统维护页
- 系统维护页首版新增一个低复杂度绑定区：
  - 使用当前全局上下文中的 `当前单位 + 当前年份`
  - 在版本列表上增加“绑定到当前单位 / 年度”按钮
- 不做：
  - 全局矩阵视图
  - 批量绑定多个单位 / 年度
  - 复杂解绑交互
- 这样可以先完成最小闭环：
  - 在当前上下文下把某个版本绑定到该单位 / 年度

### 3.8 首页 / 计算中心 / 结果中心 / 历史查询联动
- 首页待重算统计：
  - 改为按员工所属单位和当前年度对应的生效税率签名判断
- 计算中心：
  - “需按新税率重算”改为“需按当前作用域税率重算”
- 结果中心：
  - 当前有效结果过滤使用作用域版本签名
- 历史查询：
  - 当前有效 / 已失效判断同样改为作用域版本签名

## 4. 涉及模块
- `apps/api/src/db/database.ts`
- `apps/api/src/repositories/tax-policy-repository.ts`
- `apps/api/src/repositories/annual-tax-result-repository.ts`
- `apps/api/src/repositories/calculation-run-repository.ts`
- `apps/api/src/services/annual-tax-service.ts`
- `apps/api/src/routes/tax-policy.ts`
- `apps/api/src/tax-policy.test.ts`
- `apps/desktop/src/pages/MaintenancePage.tsx`
- `apps/desktop/src/pages/HomePage.tsx`
- `apps/desktop/src/pages/CalculationCenterPage.tsx`
- `apps/desktop/src/pages/AnnualResultsPage.tsx`
- `apps/desktop/src/pages/HistoryQueryPage.tsx`

## 5. 数据结构变更
- 新增表：
  - `tax_policy_scopes`
- 现有表不新增字段，继续复用：
  - `tax_policy_versions`
  - `annual_tax_results.policy_signature`
  - `annual_calculation_runs.policy_signature`

## 6. 接口变更
- 新增：
  - `POST /api/tax-policy/versions/:versionId/bind-scope`
- 可能扩展：
  - `GET /api/tax-policy` 返回当前上下文作用域下的绑定版本摘要

## 7. 风险评估
- 风险 1：结果有效性判定从“全局签名”改成“作用域签名”后，首页、计算中心、结果中心、历史查询必须统一口径，否则状态会互相打架。
- 风险 2：需要明确“没有绑定时”的回退规则，否则老数据会出现无法判定当前版本的问题。
- 风险 3：如果后续还要支持“按年度全局”或“按单位全局”作用域，当前表结构需要预留可扩展性。
- 风险 4：前端如果直接暴露过多绑定入口，会增加用户认知负担；首版必须控制在“当前上下文绑定”的最小交互。

## 8. 回退方案
- 若作用域绑定实现后导致状态混乱，可回退到当前 `master`，恢复“全局活动税率版本”判定模型。
- 若仅前端交互风险过高，可先在后端落地作用域表和判定逻辑，前端继续隐藏绑定入口。
- 若作用域模型仍不稳定，可先只支持“按单位 + 年度”单一路径，不扩展更泛化作用域类型。
