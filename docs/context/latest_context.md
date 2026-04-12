# 当前上下文摘要

## 当前阶段

- Execution

## 当前任务

- 员工信息模块编辑弹窗与四态状态优化已完成

## 已完成

- `packages/core` 新增 `EmployeeRosterStatusKind`
  - `hired_this_year`
  - `active`
  - `left_this_year`
  - `left`
- `packages/core` 新增 `deriveEmployeeRosterStatus(employee, taxYear)`
- `apps/desktop` 新增 `EmployeeEditDialog`
- `EmployeeManagementPage` 已拆分为：
  - 固定“新增员工”卡片
  - 独立“编辑员工”对话框
- 员工列表已接入基于 `currentTaxYear` 的四态状态文案
- 页面新增“隐藏已离职员工”开关，仅过滤以前年度离职员工
- 已补齐：
  - `docs/context_memory/memory.md`
  - `.gitignore` 中的 Agent 内部文档忽略规则

## 关键决策

- “本年/以前年度”统一相对 `AppContext.currentTaxYear`
- 本年入职且本年离职时，状态优先显示为 `YYYY-MM-DD离职`
- “隐藏已离职员工”默认关闭，不做本地持久化
- 本轮不改数据库结构、不改 API 路由

## 当前测试状态

- 已通过：
  - `npm run test --workspace @dude-tax/core -- employee-status.test.ts`
  - `npm run test --workspace @dude-tax/desktop -- employee-list-filter.test.ts employee-management-page.test.ts`
  - `npm run typecheck --workspace @dude-tax/core`
  - `npm run typecheck --workspace @dude-tax/desktop`
  - `npm run typecheck --workspace @dude-tax/api`
  - `git status --ignored --short`

## 剩余任务

- 如需更高置信度，可补真实 Electron 壳手工回放：
  - 编辑已有员工
  - 切换年份观察四态变化
  - 打开“隐藏已离职员工”验证列表过滤

## 下一步计划

1. 如有需要，将员工列表四态复用到其他员工选择场景
2. 评估是否补一个桌面壳交互级 smoke
3. 继续处理 `docs/tasks.md` 中下一个高优先级未完成任务
