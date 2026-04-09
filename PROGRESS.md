# 项目进度与状态

- 更新时间：2026-04-09
- 项目标识：dude-tax
- 产品显示名：工资薪金个税计算器
- 当前阶段：Execution
- 当前版本：v0.1.0-alpha
- 当前任务：月度数据录入模块年度化计算改造
- 方案路径：`/docs/plans/2026-04-09_year-entry-annualized-plan.md`

## 本轮修改

- Core / API：
  - 扩展 `YearEntryOverviewResponse`、`YearEntryResultCoverage`、`YearEntryCalculationResponse`
  - 新增 `POST /api/units/:unitId/years/:taxYear/year-entry-calculate`
  - 年度录入总览改为返回全年有效员工与当前结果覆盖状态
  - 结果确认状态新增 `coverage`
  - 月份确认新增“当前结果必须覆盖全部有效员工”的后端门禁
  - 当前年度结果快照新增数据签名校验，录入变更后旧结果不再被视为可确认结果
- 月度数据录入页：
  - 取消月份选择按钮
  - 新增“选择员工”“预扣模式”“执行计算”入口
  - 默认纳入本年全部有效员工，并按“在职 / 本年离职”弹层分组选择
  - 员工编辑列表与计算结果汇总列表均支持折叠
  - 结果汇总表列示“年度累计应预扣额、最后一个月适用税率、采用方案、另一方案应扣税额”
- 公共组件：
  - 抽离年度计算结果展示组件，统一承载方案、税额卡片与逐月预扣轨迹表
  - 新增年度计算结果明细弹层
- 结果确认页：
  - 改读当前待确认结果快照，不再只看已确认结果
  - 新增“当前结果未覆盖全部有效员工”阻断提示
  - 明细弹层展示方式与快速计算模块一致

## 影响范围

- `packages/core`
- `apps/api`
- `apps/desktop`
- `docs`

## 任务进度

- 当前主任务进度：90%
- 已完成：
  - 年度录入批量计算接口与结果覆盖校验
  - 月度录入页年度化交互改造
  - 快速计算结果展示组件抽离复用
  - 结果确认页改读当前待确认结果
  - 规格、任务与上下文文档同步
- 未完成：
  - Windows / Electron 手工烟测年度录入计算主流程

## 验证结果

- `npm run test --workspace @dude-tax/api`
- `npm run test --workspace @dude-tax/desktop`
- `npm run typecheck --workspace @dude-tax/api`
- `npm run typecheck --workspace @dude-tax/desktop`
- `npm test`
- `npm run typecheck`
- `npm run build --workspace @dude-tax/desktop`
- `npm run build --workspace @dude-tax/api`

## 风险备注

- 当前未完成 Windows / Electron 桌面壳人工烟测。
- `vite build` 仍有 bundle 过大 warning，但构建成功，不影响本轮交付。
- 已尝试通过 Playwright 对本地预览做浏览器烟测，但当前环境因 `C:\Windows\System32\.playwright-mcp` 权限限制无法启动浏览器会话。
- 为兼容旧单月接口与旧导入模板，仓储响应仍保留少量 legacy 别名字段；新工作台与新接口已不再使用。

## Lessons Learned

- “是否有当前结果”不能只看税率签名，必须同时校验最新数据签名，否则录入后旧快照会误导确认门禁。
- 结果展示型回归测试如果直接绑定页面源码，抽组件时要么同步迁移测试，要么在页面保留稳定的语义锚点。
- 年度录入与结果确认共享同一套当前结果快照时，最小代价方案是复用 `annual_tax_results`，而不是新开并行结果池。
