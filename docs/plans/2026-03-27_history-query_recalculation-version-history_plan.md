# 历史查询重算版本历史方案

## 1. 背景
- 当前历史查询只能读取 `annual_tax_results` 中的当前年度结果快照。
- 系统已经支持真实重算、税率版本切换、作用域税率绑定和结果逻辑失效，但每次重算都会覆盖当前结果，无法回看同一员工同一年度的重算演进过程。
- `PENDING_GOALS.md` 中仍存在未完成项：`历史查询增强 -> 重算版本历史查询`。

## 2. 目标
- 为每次年度重算保留可查询的结果版本快照。
- 在历史查询页展示当前选中员工年度结果的重算版本时间线。
- 不破坏现有“当前结果投影表 + 逻辑失效”语义。

## 3. 设计方案
- 保留 `annual_tax_results` 作为“当前结果投影表”，继续承担结果中心和历史查询列表的当前读取职责。
- 新增 `annual_tax_result_versions` 表，按 `单位 + 员工 + 年度` 追加保存每次重算后的结果快照。
- 仅在“真实重算”成功后写入版本快照；手动切换方案仍只更新当前投影，不额外写入版本历史。
- 新增本地 API：`GET /api/units/:unitId/years/:taxYear/employees/:employeeId/annual-result-versions`
- 历史查询页在选中结果后加载对应版本历史，展示版本序号、重算时间、结算方向、应纳税额、应补/应退税额以及当前是否已失效。

## 4. 涉及模块
- `apps/api/src/db`
- `apps/api/src/repositories`
- `apps/api/src/services`
- `apps/api/src/routes`
- `apps/api/src/*.test.ts`
- `apps/desktop/src/api`
- `apps/desktop/src/pages`
- `packages/core/src`

## 5. 数据结构变更
- 新增表 `annual_tax_result_versions`
  - `id`
  - `unit_id`
  - `employee_id`
  - `tax_year`
  - `version_sequence`
  - `policy_signature`
  - `selected_scheme`
  - `selected_tax_amount`
  - `calculation_snapshot`
  - `created_at`
- 新增索引：
  - `(unit_id, employee_id, tax_year, version_sequence DESC)`

## 6. 接口变更
- 新增：
  - `GET /api/units/:unitId/years/:taxYear/employees/:employeeId/annual-result-versions`
- 无破坏性修改：
  - 现有 `/api/history-results`
  - 现有 `/api/units/:unitId/years/:taxYear/annual-results`

## 7. 风险评估
- 风险等级：中高
- 风险点：
  - 新增结果版本表后，重算链路会多一次写库，需确保不影响现有重算成功路径。
  - 若版本序号生成不稳定，会导致历史顺序错误。
  - 当前历史页展示的是“重算版本”，不是“所有变更版本”，需要在 UI 文案中说清楚。

## 8. 回退方案
- 如版本快照链路出现问题，可回退到不写 `annual_tax_result_versions` 的旧逻辑。
- 新表为追加式结构，回退时不需要删除历史数据，只需停用查询入口和写入逻辑。

## 9. 任务拆解
- 建立 `annual_tax_result_versions` 表和版本序号生成逻辑。
- 在重算成功后写入结果版本快照。
- 暴露版本历史查询 API 与共享类型。
- 在历史查询页展示重算版本历史。
- 补测试、同步文档和进度。
