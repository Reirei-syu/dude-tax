# 月度录入、快速计算与结果确认重构方案

## 1. 背景

当前月度数据录入、快速计算、计算中心、结果中心与历史查询仍以“单员工单月编辑”和“旧年度结果快照”为主，难以快速查看全局数据，也不具备按月份顺序确认和冻结数据的能力。

## 2. 目标

- 将月度数据录入重构为“年度员工列表 + 可最大化编辑工作台”。
- 将快速计算重构为“单案例总览 + 可最大化编辑工作台 + 结果概览”。
- 合并计算中心与结果中心为“结果确认”，支持按月份顺序确认和级联取消确认。
- 将历史查询收敛为“仅查询已确认数据”的年度员工列表与明细查看。
- 统一导出为“汇总 sheet + 每员工 1 个 sheet”的 Excel 结构。

## 3. 设计方案

- 前端新增共享年度工作台弹层组件，统一承载 12 个月数据表格、月份高亮、复制到下月和复制到后续月份。
- 后端新增 `month_confirmations` 表，使用确认月份作为结果确认与历史查询的唯一边界。
- 月度录入与结果确认不再依赖旧 `annual_tax_results` 主流程；已确认结果改为按当前确认月份即时计算。
- 历史查询直接复用已确认结果接口，不再展示失效结果、版本历史和版本对比。
- 旧 `/calculation` 与 `/results` 路由保留跳转，新主入口改为 `/result-confirmation`。

## 4. 涉及模块

- `packages/core`
- `packages/config`
- `apps/api`
- `apps/desktop`

## 5. 数据结构变更

- 新增 `month_confirmations`
  - `unit_id`
  - `tax_year`
  - `tax_month`
  - `confirmed_at`
  - `updated_at`
- 新增 core DTO
  - `YearEntryOverviewResponse`
  - `EmployeeYearRecordWorkspace`
  - `MonthConfirmationState`
  - `ConfirmedAnnualResultSummary`
  - `ConfirmedAnnualResultDetail`

## 6. 接口变更

- 新增年度总览接口
  - `GET /api/units/:unitId/years/:taxYear/year-entry-overview`
- 新增年度工作台接口
  - `GET /api/units/:unitId/years/:taxYear/employees/:employeeId/year-record-workspace`
  - `PUT /api/units/:unitId/years/:taxYear/employees/:employeeId/year-record-workspace`
- 新增确认状态接口
  - `GET /api/units/:unitId/years/:taxYear/month-confirmations`
  - `POST /api/units/:unitId/years/:taxYear/month-confirmations/:taxMonth/confirm`
  - `POST /api/units/:unitId/years/:taxYear/month-confirmations/:taxMonth/unconfirm`
- 新增已确认结果接口
  - `GET /api/units/:unitId/years/:taxYear/confirmed-results`
  - `GET /api/units/:unitId/years/:taxYear/confirmed-results/:employeeId`
- 兼容保留单月保存接口，但加确认锁校验

## 7. 风险评估

- 中高风险：模块入口、工作流和导出结构都发生变化。
- 主要风险：
  - 旧结果中心/计算中心路径与新路径脱节
  - 月度确认锁遗漏导致已确认数据被改写
  - 导出结构变化导致现有导出测试失效
  - 首页与政策参考等用户可见文案残留旧模块名

## 8. 回退方案

- 保留旧 `annual_calculation_runs`、`annual_tax_results`、`annual_tax_result_versions` 表，不做删表。
- 保留旧 `/calculation`、`/results` 路由，通过前端跳转兼容历史入口。
- 若新确认流出现问题，可回退到本次提交前版本，数据库新增表不会破坏旧逻辑。

## 9. 任务拆解

- [x] 新增 core helper 与 DTO，补纯函数测试
- [x] 新增 `month_confirmations` 表与仓储
- [x] 新增年度总览、工作台、确认状态和已确认结果 API
- [x] 单月保存接口补确认锁
- [x] 重构导航、月度数据录入、快速计算、结果确认、历史查询页面
- [x] 新增共享工作台组件与统一 Excel workbook builder
- [x] 更新首页与政策参考相关用户文案
- [x] 通过测试、typecheck 与前后端 build
- [ ] 补 Windows/Electron 手工烟测
