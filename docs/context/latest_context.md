# 当前上下文摘要

## 当前阶段

- Execution

## 当前任务

- 在 Windows / Electron 环境下补导入合并后的主流程手工烟测

## 已完成

- 独立“批量导入”导航与 `/import` 路由已移除
- 员工信息页内嵌员工批量导入区块
- 月度数据录入页内嵌月度数据批量导入区块
- 月度数据页新增“月度批量导入工作区”容器，并默认折叠
- 已修复折叠态下内容仍显示的问题，当前通过 `[hidden]` 样式覆盖保证视觉真实收起
- 月度模板按“有效员工 x 12 月”生成，并预填当前已有数据
- 月度导入缺失员工/月份行会自动补零并进入预览/回执
- 月度录入旧导出按钮已移除，导出入口迁移到计算结果汇总卡片
- 自动化验证通过：
  - `node --import tsx --test src/pages/month-record-entry-page.test.ts`（`apps/desktop`）
  - `node --import tsx --test src/components/import-workflow-section.test.ts`（`apps/desktop`）
  - `npm run test --workspace @dude-tax/api`
  - `npm run test --workspace @dude-tax/desktop`
  - `npm run typecheck --workspace @dude-tax/api`
  - `npm run typecheck --workspace @dude-tax/desktop`
  - `npm run build --workspace @dude-tax/api`
  - `npm run build --workspace @dude-tax/desktop`
  - `npm test`
  - `npm run typecheck`

## 剩余任务

- 在 Windows / Electron 环境下补导入合并后的主流程手工烟测

## 关键决策

- 独立批量导入模块取消，导入流程拆入员工信息页与月度录入页
- 月度导入相关三张卡片统一归入“月度批量导入工作区”，并在首次进入页面时默认折叠
- 折叠内容区继续保留组件状态，但必须用显式 `[hidden]` 样式保证视觉隐藏
- 月度模板固定覆盖当前单位本年度有效员工的 12 个月矩阵
- 月度导入缺失行按显式 0 数据写入，而不是忽略
- 导出入口从月度录入主卡片迁移到计算结果汇总卡片

## 当前问题

- Legacy 月度导入表头仍保留兼容解析，后续如继续清理，需要单独做删除计划
- 仍未完成桌面壳人工烟测；此前尝试用 Playwright 做本地预览烟测，但被当前环境的浏览器 profile 权限限制阻断
- 新增的默认折叠工作区只经过源码断言、桌面端测试、类型检查和构建验证，尚未在 Electron 壳内点按确认

## 下一步计划

1. 在桌面壳中手工检查月度数据页“月度批量导入工作区”默认折叠、展开/折叠切换和状态保留
2. 顺带检查员工信息页与月度数据录入页的页内导入、模板下载、预览、执行导入和结果导出链路
3. 根据烟测结果决定是否继续清理 legacy 导入表头与未使用的导入摘要接口
