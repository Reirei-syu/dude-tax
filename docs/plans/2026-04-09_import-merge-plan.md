# 批量导入并入员工信息与月度数据录入方案

## 1. 背景

- 独立“批量导入”模块与主业务流割裂，员工导入和月度导入都需要先跳转独立页面。
- 月度模板只覆盖显式文件行，无法表达“缺失月份按 0 导入”。
- 月度录入页旧“导出 Excel”按钮与当前结果汇总职责重叠。

## 2. 目标

- 取消独立批量导入入口，将员工导入并入员工信息页，将月度导入并入月度数据录入页。
- 保留模板下载、导入预览、冲突策略和执行导入的完整流程。
- 让月度模板覆盖“有效员工 x 12 月”，并让缺失行按显式 0 数据导入。
- 将导出能力迁移到“计算结果汇总”卡片。

## 3. 设计方案

- 删除 `/import` 路由与导航项，首页提醒与工作建议不再依赖导入摘要。
- 抽离共享导入面板组件，复用到员工信息页和月度数据录入页。
- 月度模板按当前单位/年份有效员工生成 12 行矩阵，并预填当前已有月度数据。
- 月度导入分析在解析显式文件行后，自动补齐缺失员工-月份组合为零值记录。
- 自动补零记录参与预览、冲突和回执统计，避免隐藏副作用。
- 月度录入旧导出按钮移除，结果汇总卡片新增“导出当前结果”。

## 4. 涉及模块

- `packages/config`
- `packages/core`
- `apps/api/src/services/import-service.ts`
- `apps/desktop/src/components/ImportWorkflowSection.tsx`
- `apps/desktop/src/pages/EmployeeManagementPage.tsx`
- `apps/desktop/src/pages/MonthRecordEntryPage.tsx`
- `apps/desktop/src/pages/HomePage.tsx`

## 5. 数据结构变更

- `ImportPreviewRow` 新增可选 `rowLabel`
- `ImportPreviewResponse` 新增可选 `autoFillZeroRowCount`、`autoFillZeroEmployeeCount`
- `ImportCommitResponse.failures` 新增可选 `rowLabel`
- 不新增数据库表

## 6. 接口变更

- 保留 `/api/import/templates/:importType`、`/api/import/preview`、`/api/import/commit`
- 月度模板输出改为有效员工 12 行矩阵
- 月度导入分析新增自动补零语义

## 7. 风险评估

- 若月度模板不预填当前数据，用户重新上传模板时容易误清空已有月份记录。
- 若自动补零记录不进入预览与回执，会导致锁定冲突在提交阶段才暴露。
- 若导航和首页建议清理不完整，会保留失效入口。

## 8. 回退方案

- 若页内导入区块不可用，可暂时恢复 `/import` 路由入口。
- 若自动补零语义影响现有导入稳定性，可先回退为仅处理显式文件行。
- 若结果汇总导出不稳定，可临时恢复月度录入主卡片旧导出按钮。

## 9. 任务拆解

- [x] 调整导航、首页提醒与工作建议，移除独立导入入口
- [x] 抽离共享导入面板组件
- [x] 在员工信息页接入员工批量导入
- [x] 在月度数据录入页接入月度数据批量导入
- [x] 月度模板改为有效员工 12 行矩阵并预填当前数据
- [x] 月度导入分析补齐缺失员工-月份组合为零值记录
- [x] 自动补零记录接入预览、冲突与回执统计
- [x] 月度录入导出迁移到计算结果汇总卡片
- [ ] Windows / Electron 手工烟测导入合并后的主流程
