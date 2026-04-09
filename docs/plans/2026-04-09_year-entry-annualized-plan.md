# 月度数据录入模块年度化计算改造方案

## 1. 背景

- 月度数据录入仍停留在“月份多选 + 员工列表 + 单员工编辑”的旧形态。
- 快速计算已经具备全年速算与结果轨迹展示，但正式录入链路缺少同口径计算与结果承接。
- 结果确认目前只依赖已确认结果，无法承接月度录入页刚计算出的待确认快照。

## 2. 目标

- 让月度数据录入页按全年视角直接编辑、计算并展示结果汇总。
- 让结果确认页承接“已计算但未确认”的当前结果快照，并保留全局月份确认模型。
- 保持 `UI -> Service -> Core` 分层，不新增数据库表。

## 3. 设计方案

- 月度录入页取消月份选择按钮，新增“选择员工”“预扣模式”“执行计算”入口。
- 默认纳入本年全部有效员工；选择员工弹层分组展示“在职员工 / 本年离职员工”。
- 抽离快速计算结果展示组件，复用于月度录入明细弹层与快速计算页。
- 新增年度录入批量计算接口，写入 `annual_tax_results` / `annual_calculation_runs`，并删除未纳入当前名单的旧快照。
- 结果确认页改读当前年度结果快照，确认前校验“当前结果已覆盖全部有效员工”。

## 4. 涉及模块

- `packages/core`
- `apps/api/src/routes/year-entry.ts`
- `apps/api/src/services/year-entry-service.ts`
- `apps/api/src/repositories/annual-tax-result-repository.ts`
- `apps/desktop/src/pages/MonthRecordEntryPage.tsx`
- `apps/desktop/src/pages/QuickCalculatePage.tsx`
- `apps/desktop/src/pages/ResultConfirmationPage.tsx`
- `apps/desktop/src/components/*`

## 5. 数据结构变更

- 不新增数据库表。
- 扩展 `YearEntryOverviewResponse`、`YearEntryResultCoverage`、`YearEntryCalculationResponse` 等前后端共享类型。
- `MonthConfirmationState` 新增结果覆盖信息，用于确认门禁提示。

## 6. 接口变更

- `GET /api/units/:unitId/years/:taxYear/year-entry-overview`
  - 移除月份查询参数，返回全年有效员工总览与当前结果覆盖状态。
- `POST /api/units/:unitId/years/:taxYear/year-entry-calculate`
  - 输入：`employeeIds[]`、`withholdingContext.mode`
  - 输出：`status + coverage + summaryRows`
- `GET /api/units/:unitId/years/:taxYear/month-confirmations`
  - 返回值新增 `coverage`

## 7. 风险评估

- 若不校验 `annual_tax_results` 的最新数据签名，录入后旧结果会被误判为“已覆盖”。
- 月度录入页和结果确认页都改读当前结果快照，若接口契约不同步会造成页面状态漂移。
- 快速计算结果展示抽离后，若页面源码断言测试未同步，会出现非业务性回归。

## 8. 回退方案

- 若新批量计算接口不可用，可回退到旧的月度录入纯编辑模式，并保留快速计算模块独立试算。
- 若结果确认新门禁导致流程不可用，可临时回退为前端只读提示，不改变后端确认逻辑。
- 若共享结果展示组件影响快速计算，可恢复快速计算页内联结果区实现。

## 9. 任务拆解

- [x] 扩展 core 共享类型，补充年度录入结果覆盖与汇总响应契约
- [x] 新增/调整 API 测试，覆盖总览、批量计算、确认覆盖门禁
- [x] 实现年度录入总览与批量计算服务逻辑
- [x] 校验年度结果快照必须匹配当前数据签名
- [x] 重构月度录入页为“全年编辑 + 计算结果汇总”双区块
- [x] 新增员工选择弹层与计算结果明细弹层
- [x] 抽离快速计算结果展示组件并复用
- [x] 改造结果确认页，读取当前待确认结果并展示覆盖门禁
- [ ] Windows / Electron 手工烟测年度录入计算主流程
