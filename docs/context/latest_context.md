# 当前上下文摘要

## 当前阶段

- Execution

## 当前任务

- 完成月度数据录入模块年度化计算改造后的文档同步与最终验证

## 已完成

- 月度数据录入页取消月份按钮，改为全年员工名单 + 计算结果汇总双区块
- 月度数据录入页新增“选择员工”“预扣模式”“执行计算”入口
- 选择员工弹层按“在职员工 / 本年离职员工”分组，默认纳入全部有效员工
- 年度录入批量计算接口已写入当前结果快照，并会清理未纳入名单的旧结果
- 结果确认页改读当前待确认结果，并新增全员覆盖门禁提示
- 当前年度结果快照已接入数据签名校验，录入后旧结果不会再被视为可确认结果
- 快速计算结果展示组件已抽离并复用到明细弹层
- 自动化验证通过：
  - `npm run test --workspace @dude-tax/api`
  - `npm run test --workspace @dude-tax/desktop`
  - `npm run typecheck --workspace @dude-tax/api`
  - `npm run typecheck --workspace @dude-tax/desktop`
  - `npm test`
  - `npm run typecheck`
  - `npm run build --workspace @dude-tax/desktop`
  - `npm run build --workspace @dude-tax/api`

## 剩余任务

- 在 Windows / Electron 环境下补月度录入年度化计算主流程的手工烟测

## 关键决策

- 保留全局月份确认模型，不改成按员工确认
- 结果确认前必须保证当前结果覆盖全部有效员工
- 选择员工只影响当前录入/计算名单，不改变确认模型
- 当前结果快照继续复用 `annual_tax_results` / `annual_calculation_runs`

## 当前问题

- Legacy 单月接口与导入仍保留少量旧字段兼容别名，后续如继续清理，需要单独做删除计划
- 仍未完成桌面壳人工烟测；此前尝试用 Playwright 做本地预览烟测，但被当前环境的浏览器 profile 权限限制阻断

## 下一步计划

1. 在桌面壳中手工检查月度录入页的员工选择、折叠区块、执行计算、结果明细弹层
2. 在结果确认页手工验证全员覆盖门禁、确认/取消确认与锁定行为
3. 根据烟测结果决定是否继续清理 legacy 单月接口与旧辅助工具
