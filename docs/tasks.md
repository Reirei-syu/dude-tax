# 项目任务列表

## 当前阶段
- Execution

## 任务列表

### [x] 完整预扣预缴情形：快速计算接入预扣规则上下文
- 完成时间：2026-03-27 14:25
- 修改文件：
  - `packages/core/src/index.ts`
  - `apps/api/src/routes/calculations.ts`
  - `apps/api/src/quick-calculate.test.ts`
  - `apps/desktop/src/pages/QuickCalculatePage.tsx`
- 影响范围：
  - 快速计算可显式选择预扣模式
  - 预扣规则上下文正式进入 API 与核心算法使用链路
  - 快速计算结果摘要展示预扣模式

### [x] 完整预扣预缴情形：计算中心接入预扣规则模式
- 完成时间：2026-03-27 14:25
- 修改文件：
  - `apps/api/src/services/annual-tax-service.ts`
  - `apps/api/src/routes/calculations.ts`
  - `apps/api/src/annual-results.test.ts`
  - `apps/desktop/src/api/client.ts`
  - `apps/desktop/src/pages/CalculationCenterPage.tsx`
- 影响范围：
  - 计算中心可显式选择预扣模式后发起正式年度重算
  - 重算结果快照写入预扣模式
  - 正式业务链路开始接入预扣规则上下文

### [x] 完整预扣预缴情形：结果中心与历史查询补充预扣规则解释
- 完成时间：2026-03-27 14:25
- 修改文件：
  - `apps/desktop/src/pages/annual-tax-withholding-summary.ts`
  - `apps/desktop/src/pages/annual-tax-withholding-summary.test.ts`
  - `apps/desktop/src/pages/AnnualResultsPage.tsx`
  - `apps/desktop/src/pages/HistoryQueryPage.tsx`
  - `apps/desktop/src/pages/history-query-diff.ts`
  - `apps/desktop/src/pages/history-query-diff.test.ts`
- 影响范围：
  - 结果中心新增预扣规则说明卡片
  - 历史查询详情新增预扣规则说明卡片
  - 历史差异对比新增预扣模式差异项

### [x] 快速计算：补发补扣输入区块与模板化输入
- 完成时间：2026-03-27 14:25
- 修改文件：
  - `apps/desktop/src/pages/QuickCalculatePage.tsx`
  - `apps/desktop/src/pages/quick-calculate-template.ts`
  - `apps/desktop/src/pages/quick-calculate-template.test.ts`
- 影响范围：
  - 快速计算补发补扣输入
  - 快速计算模板化批量输入
  - 快速计算页与月度录入页功能一致性

### [x] 剩余功能收口：月度录入补发补扣字段持久化与 API 打通
- 完成时间：2026-03-27 14:25
- 修改文件：
  - `apps/api/src/db/database.ts`
  - `apps/api/src/repositories/month-record-repository.ts`
  - `apps/api/src/routes/month-records.ts`
  - `apps/api/src/routes/calculations.ts`
  - `apps/api/src/month-records.test.ts`
- 影响范围：
  - 月度记录补发补扣字段持久化
  - 月度录入接口与快速计算接口输入结构
  - 月度记录 API 回归测试

### [x] 剩余功能收口：月度录入补发补扣导入模板与导入链路补齐
- 完成时间：2026-03-27 14:25
- 修改文件：
  - `apps/api/src/services/import-service.ts`
  - `apps/api/src/import.test.ts`
  - `apps/desktop/src/pages/import-preview-details.ts`
  - `apps/desktop/src/pages/import-preview-details.test.ts`
- 影响范围：
  - 月度导入模板字段
  - 导入预览与执行导入口径
  - 前端预览字段展示

### [x] 剩余功能收口：月度录入补发补扣 UI 区块与校验
- 完成时间：2026-03-27 14:25
- 修改文件：
  - `apps/desktop/src/pages/MonthRecordEntryPage.tsx`
  - `apps/desktop/src/pages/month-record-copy.ts`
  - `apps/desktop/src/pages/month-record-copy.test.ts`
  - `apps/desktop/src/pages/month-record-diff.ts`
- 影响范围：
  - 月度录入表单新增补发补扣区块
  - 复制上月与差异提示同步识别补发补扣字段
  - 用户可见输入闭环

### [ ] 剩余功能收口：完整预扣预缴规则落地
- 类型：功能收口
- 模块：core
- 描述：按既有方案落地完整预扣预缴规则，覆盖标准累计、6 万元优化和首次取得工资等场景
- 依赖：剩余功能收口：月度录入补发补扣 UI 区块与校验
- 风险：高

### [ ] 剩余功能收口：跨单位 / 跨年衔接规则
- 类型：功能收口
- 模块：core / service
- 描述：补齐跨单位和跨年度的衔接口径，避免年度汇算在历史数据迁移场景下失真
- 依赖：剩余功能收口：完整预扣预缴规则落地
- 风险：高

### [x] 跨单位 / 跨年衔接：补仓储查询与上下文构建
- 完成时间：2026-03-27 14:25
- 修改文件：
  - `apps/api/src/repositories/employee-repository.ts`
  - `apps/api/src/repositories/month-record-repository.ts`
  - `apps/api/src/services/annual-tax-service.ts`
  - `apps/api/src/withholding-bridge.test.ts`
- 影响范围：
  - 同身份证跨单位员工查询
  - 同身份证跨单位月度记录聚合
  - 上一年收入 / 首次发薪月推导上下文

### [x] 跨单位 / 跨年衔接：核心算法接入衔接上下文
- 完成时间：2026-03-27 14:25
- 修改文件：
  - `packages/core/src/index.ts`
  - `packages/core/src/annual-tax-calculator.ts`
  - `packages/core/src/annual-tax-calculator.test.ts`
  - `apps/api/src/services/annual-tax-service.ts`
  - `apps/api/src/annual-results.test.ts`
- 影响范围：
  - 前序单位已完成月份可参与当前单位累计预扣
  - 当前单位结果摘要不直接并入外部已预扣金额
  - 跨单位累计预扣口径正式生效

### [ ] 跨单位 / 跨年衔接：结果页补规则衔接说明
- 类型：功能收口
- 模块：ui
- 描述：在结果中心和历史查询中提示当前结果是否引用了其他单位或上一年度规则上下文
- 依赖：跨单位 / 跨年衔接：核心算法接入衔接上下文
- 风险：中

### [ ] 剩余功能收口：批量导出多员工 / 多年度能力
- 类型：功能增强
- 模块：service / ui
- 描述：在现有导出基础上增加多员工和多年度批量导出能力
- 依赖：剩余功能收口：跨单位 / 跨年衔接规则
- 风险：中

### [ ] 系统维护：税率变更审计日志
- 类型：功能增强
- 模块：service / ui
- 描述：为税率编辑、版本激活和作用域绑定补齐操作日志与时间线，支持回看谁在何时做了什么变更
- 依赖：全项目审查：依赖与架构收口
- 风险：中

### [ ] 系统维护：作用域绑定解除与恢复继承
- 类型：功能增强
- 模块：service / ui
- 描述：允许取消单位 / 年度专属绑定，恢复继承全局活动税率，避免绑定后只能覆盖不能撤销
- 依赖：系统维护：税率变更审计日志
- 风险：中

### [ ] 系统维护：税率版本差异与影响预览
- 类型：功能增强
- 模块：service / ui
- 描述：支持比较两个税率版本的关键差异，并在保存或激活前预览对当前作用域结果的影响
- 依赖：系统维护：作用域绑定解除与恢复继承
- 风险：中

### [x] 全项目审查：本地 API 与桌面壳安全加固
- 完成时间：2026-03-27 14:25
- 修改文件：
  - `apps/api/src/server.ts`
  - `apps/api/src/cors.test.ts`
  - `apps/desktop/electron/main.cjs`
- 影响范围：
  - 本地 API 来源校验与外部来源拒绝
  - Electron 渲染窗口权限边界
  - 外链打开与窗口导航防护

### [x] 全项目审查：导入链路解析稳健性增强
- 完成时间：2026-03-27 14:25
- 修改文件：
  - `apps/api/src/services/import-service.ts`
  - `apps/api/src/import.test.ts`
- 影响范围：
  - CSV 解析对引号、逗号与换行的兼容性
  - 员工/月份导入稳定性
  - 导入回归测试覆盖

### [ ] 全项目审查：依赖与架构收口
- 类型：审查跟进
- 模块：service / core / ui
- 描述：处理 `exceljs -> archiver` 运行时审计漏洞残留，评估跨包深相对路径导入与补发补扣字段链路未闭环问题
- 依赖：全项目审查：本地 API 与桌面壳安全加固；全项目审查：导入链路解析稳健性增强
- 风险：中

### [x] 历史查询：重算版本历史查询
- 完成时间：2026-03-27 12:02
- 修改文件：
  - `apps/api/src/db/database.ts`
  - `apps/api/src/repositories/annual-tax-result-repository.ts`
  - `apps/api/src/services/annual-tax-service.ts`
  - `apps/api/src/routes/calculations.ts`
  - `apps/api/src/annual-results.test.ts`
  - `apps/desktop/src/api/client.ts`
  - `apps/desktop/src/pages/HistoryQueryPage.tsx`
  - `packages/core/src/index.ts`
- 影响范围：
  - 年度结果重算链路
  - 历史查询版本时间线展示
  - 结果版本快照存储与查询 API

### [x] 结果中心：历史版本查看
- 完成时间：2026-03-27 12:12
- 修改文件：
  - `apps/desktop/src/pages/AnnualResultsPage.tsx`
- 影响范围：
  - 结果中心明细页
  - 当前员工年度结果的版本时间线查看

### [x] 结果中心：结果版本差异对比
- 完成时间：2026-03-27 12:20
- 修改文件：
  - `apps/desktop/src/pages/AnnualResultsPage.tsx`
  - `apps/desktop/src/pages/annual-result-version-diff.ts`
  - `apps/desktop/src/pages/annual-result-version-diff.test.ts`
- 影响范围：
  - 结果中心版本差异对比区块
  - 双版本选择与关键字段差异展示

### [x] 批量导入：Excel 解析支持
- 完成时间：2026-03-27 12:31
- 修改文件：
  - `apps/desktop/src/pages/ImportPage.tsx`
  - `apps/desktop/src/pages/import-file-parser.ts`
  - `apps/desktop/src/pages/import-file-parser.test.ts`
- 影响范围：
  - 批量导入文件选择入口
  - Excel 到 CSV 的前端解析复用链路

### [x] 批量导入：更细粒度的预览字段展示
- 完成时间：2026-03-27 12:40
- 修改文件：
  - `apps/desktop/src/pages/ImportPage.tsx`
  - `apps/desktop/src/pages/import-preview-details.ts`
  - `apps/desktop/src/pages/import-preview-details.test.ts`
  - `apps/desktop/src/styles.css`
- 影响范围：
  - 批量导入预览表格
  - 字段映射、冲突字段和值的细粒度展示

### [x] 系统维护：富文本说明维护
- 完成时间：2026-03-27 12:50
- 修改文件：
  - `apps/desktop/src/pages/MaintenancePage.tsx`
  - `apps/desktop/src/pages/maintenance-rich-text.tsx`
  - `apps/desktop/src/pages/maintenance-rich-text.test.ts`
  - `apps/desktop/src/styles.css`
- 影响范围：
  - 系统维护说明编辑区
  - 富文本预览与格式工具栏

### [x] 结果中心：导出结果模板管理
- 完成时间：2026-03-27 13:00
- 修改文件：
  - `apps/desktop/src/pages/AnnualResultsPage.tsx`
  - `apps/desktop/src/pages/annual-tax-export.ts`
  - `apps/desktop/src/pages/annual-tax-export-template-manager.ts`
  - `apps/desktop/src/pages/annual-tax-export-template-manager.test.ts`
  - `apps/desktop/src/styles.css`
- 影响范围：
  - 结果中心导出模板管理区
  - 模板摘要、字段分组统计和导出反馈

### [x] 个税计算核心：完整预扣预缴规则方案
- 完成时间：2026-03-27 13:10
- 修改文件：
  - `docs/plans/2026-03-27_withholding-prepayment-complete-plan.md`
  - `docs/tasks.md`
  - `PROGRESS.md`
  - `docs/context/latest_context.md`
- 影响范围：
  - 复杂预扣预缴规则方案沉淀
  - 后续实施任务拆解

### [x] 个税计算核心：预扣预缴共享类型与月度轨迹纯函数
- 完成时间：2026-03-27 13:20
- 修改文件：
  - `packages/core/src/index.ts`
  - `packages/core/src/annual-tax-calculator.ts`
  - `packages/core/src/annual-tax-calculator.test.ts`
- 影响范围：
  - 预扣预缴共享类型
  - 月度预扣轨迹纯函数
  - 核心层测试覆盖

### [x] 个税计算核心：年度计算器接入预扣轨迹摘要
- 完成时间：2026-03-27 13:28
- 修改文件：
  - `packages/core/src/index.ts`
  - `packages/core/src/annual-tax-calculator.ts`
  - `packages/core/src/annual-tax-calculator.test.ts`
  - `apps/desktop/src/pages/annual-result-version-diff.test.ts`
  - `apps/desktop/src/pages/annual-tax-explanation.test.ts`
  - `apps/desktop/src/pages/history-query-diff.test.ts`
  - `apps/desktop/src/pages/history-query-export.test.ts`
  - `apps/desktop/src/pages/history-query-year-summary.test.ts`
- 影响范围：
  - 年度计算结果结构
  - 预扣轨迹摘要接入
  - 相关前端测试数据结构

### [x] 结果中心：预扣轨迹摘要展示
- 完成时间：2026-03-27 13:35
- 修改文件：
  - `apps/desktop/src/pages/AnnualResultsPage.tsx`
  - `apps/desktop/src/pages/annual-tax-withholding-summary.ts`
  - `apps/desktop/src/pages/annual-tax-withholding-summary.test.ts`
  - `PENDING_GOALS.md`
  - `PROGRESS.md`
  - `docs/context/latest_context.md`
- 影响范围：
  - 结果中心明细页
  - 预扣模式、规则应预扣、实际已预扣和差异额展示

### [x] 个税计算核心：补发补扣场景方案
- 完成时间：2026-03-27 13:45
- 修改文件：
  - `docs/plans/2026-03-27_supplementary-payment-withholding-plan.md`
  - `docs/tasks.md`
  - `PROGRESS.md`
  - `docs/context/latest_context.md`
- 影响范围：
  - 补发补扣口径方案沉淀
  - 后续实施任务拆解

### [x] 个税计算核心：补发补扣字段与共享类型
- 完成时间：2026-03-27 13:55
- 修改文件：
  - `packages/core/src/index.ts`
  - `packages/core/src/annual-tax-calculator.ts`
  - `packages/core/src/annual-tax-calculator.test.ts`
- 影响范围：
  - 补发补扣共享类型
  - 补发补扣金额 helper
  - 核心层测试覆盖

### [x] 个税计算核心：补发补扣并入预扣轨迹
- 完成时间：2026-03-27 14:05
- 修改文件：
  - `packages/core/src/annual-tax-calculator.ts`
  - `packages/core/src/annual-tax-calculator.test.ts`
  - `PROGRESS.md`
- 影响范围：
  - 预扣轨迹算法
  - 年度汇算收入与已预扣口径
  - 核心层测试覆盖

### [x] 月度录入：补发补扣区块与校验
- 完成时间：2026-03-27 14:25
- 修改文件：
  - `apps/desktop/src/pages/MonthRecordEntryPage.tsx`
  - `apps/desktop/src/pages/month-record-copy.ts`
  - `apps/desktop/src/pages/month-record-diff.ts`
- 影响范围：
  - 月度录入补发补扣区块
  - 复制上月与差异提示
  - 支付当月补发提示文案

## 状态
- [ ] 未完成
- [x] 已完成
- [-] 已废弃
