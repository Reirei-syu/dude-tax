# 当前上下文摘要

## 当前阶段

- Execution

## 当前任务

- 月度录入新增入离职月份收入强提示已完成

## 已完成

- `packages/core` 新增就业月份收入冲突判定：
  - `detectEmploymentIncomeConflictType`
  - `collectEmploymentIncomeConflictMonths`
  - `EmploymentIncomeConflictResponse`
- `EmployeeYearRecordWorkspace` 已新增 `hireDate`、`leaveDate`
- `apps/api` 已新增后端硬阻断：
  - 年度工作台保存接口支持 `acknowledgedEmploymentConflictMonths`
  - 单月保存接口支持 `acknowledgedEmploymentConflictMonths`
  - 未确认的入职前 / 离职后收入录入返回 409 结构化冲突信息
- `apps/desktop` 已新增：
  - `EmploymentIncomeConflictDialog`
  - `month-record-employment-conflict.ts`
  - 保存当前改动、应用到下月、应用到后续月份三选强提示
  - “跳过异常月份，仅保存/复制合法月份”快捷分支
  - 已修复复制场景下“跳过异常月份”会保留当前异常源月份、并错误保留离职后月份收入的问题

## 关键决策

- 强提示只针对三类收入字段：`salaryIncome`、`annualBonus`、`otherIncome`
- 交互为自定义三选弹层，不使用原生确认框
- 后端硬阻断覆盖：
  - `/api/units/:unitId/years/:taxYear/employees/:employeeId/year-record-workspace`
  - `/api/units/:unitId/years/:taxYear/employees/:employeeId/month-records/:taxMonth`
- 入职月/离职月当月允许录入；仅入职前月份、离职后月份触发冲突
- `QuickCalculatePage`、导入链路、员工列表筛选逻辑本轮不变

## 当前测试状态

- 已通过：
  - `npm run test --workspace @dude-tax/core -- employee-status.test.ts`
  - `npm run test --workspace @dude-tax/api -- year-entry.test.ts month-records.test.ts`
  - `npm run test --workspace @dude-tax/desktop -- month-record-entry-page.test.ts month-record-employment-conflict.test.ts`
  - `npm run typecheck --workspace @dude-tax/desktop`
  - `npm run typecheck --workspaces --if-present`
  - `npm run build:api`
  - `npm run build:desktop`

## 剩余任务

- 当前实现任务已完成
- 如需更高置信度，可补真实 Electron 手工回放：保存冲突、复制冲突、跳过异常月份

## 下一步计划

1. 如有需要，将同一“就业月份收入冲突”规则扩展到导入链路
2. 评估是否将预扣税额也纳入强提示范围
3. 在真实 Electron 壳里补一次人工交互回放
