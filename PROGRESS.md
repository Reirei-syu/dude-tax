# 项目进度与状态

- 更新时间：2026-04-09
- 项目标识：dude-tax
- 产品显示名：工资薪金个税计算器
- 当前阶段：Execution
- 当前版本：v0.1.0-alpha
- 当前任务：Windows / Electron 手工烟测导入合并后的主流程
- 方案路径：`/docs/plans/2026-04-09_import-merge-plan.md`

## 本轮修改

- 导航与首页：
  - 取消独立“批量导入”导航项与 `/import` 路由
  - 首页不再依赖导入摘要生成提醒和工作建议
- 员工信息页：
  - 内嵌“员工批量导入”区块
  - 保留模板下载、导入预览、冲突策略和执行导入
- 月度数据录入页：
  - 内嵌“月度数据批量导入”区块
  - 新增“月度批量导入工作区”容器，统一承载模板下载、导入预览与导入回执，并默认折叠
  - 修复工作区折叠态下内容仍显示的问题，为内容容器补充 `[hidden]` 显式隐藏样式
  - 月度模板改为“当前单位本年度有效员工 x 12 月”全矩阵，并预填当前已有数据
  - 缺失员工/月份行按显式 0 数据导入
  - 主卡片旧“导出 Excel”按钮移除
  - “计算结果汇总”卡片新增“导出当前结果”按钮
- Import Service：
  - 月度导入预览/提交改为补齐缺失员工-月份组合为零值记录
  - 自动补零记录进入预览统计与回执
  - 自动补零若命中已确认月份，会在预览和提交阶段阻断

## 影响范围

- `packages/config`
- `packages/core`
- `apps/api`
- `apps/desktop`
- `docs`

## 任务进度

- 当前主任务进度：97%
- 已完成：
  - 导航与首页去独立导入入口
  - 员工信息页与月度数据录入页接入页内导入
  - 月度批量导入工作区默认折叠并集中管理三张导入卡片
  - 修复折叠工作区被 `display:flex` 覆盖导致的视觉未收起问题
  - 月度模板全员 12 行矩阵与缺失行自动补零
  - 月度录入导出迁移到计算结果汇总卡片
  - 规格、任务与上下文文档同步
- 未完成：
  - Windows / Electron 手工烟测导入合并后的主流程

## 验证结果

- `npm run test --workspace @dude-tax/api`
- `npm run test --workspace @dude-tax/desktop`
- `npm run typecheck --workspace @dude-tax/api`
- `npm run typecheck --workspace @dude-tax/desktop`
- `npm run build --workspace @dude-tax/api`
- `npm run build --workspace @dude-tax/desktop`
- `npm test`
- `npm run typecheck`
- `node --import tsx --test src/pages/month-record-entry-page.test.ts`（`apps/desktop`）
- `node --import tsx --test src/components/import-workflow-section.test.ts`（`apps/desktop`）

## 风险备注

- 当前未完成 Windows / Electron 桌面壳人工烟测。
- `vite build` 仍有 bundle 过大 warning，但构建成功，不影响本轮交付。
- 已尝试通过 Playwright 对本地预览做浏览器烟测，但当前环境因 `C:\Windows\System32\.playwright-mcp` 权限限制无法启动浏览器会话。
- 为兼容旧模板，月度导入解析仍接受 legacy 表头；新模板已切换到当前字段。
- 批量导入工作区默认折叠的真实交互仍需在 Windows / Electron 桌面壳内补一轮手工确认。

## Lessons Learned

- 如果模板本身代表“当前状态”，月度模板必须预填现有数据，否则重新上传时很容易误清空记录。
- 缺失行补零这类隐式导入行为必须进入预览和回执统计，否则锁定冲突只会在提交后暴露。
- 取消独立模块时，导航、首页提醒、首页建议和路由需要同时清理，否则会留下失效入口。
- 对于页内导入这类长流程能力，折叠只应隐藏展示层，不能卸载内容区，否则用户已粘贴文本和预览状态会丢失。
- 使用原生 `hidden` 时，如果同一元素还被业务样式显式设置了 `display:flex/grid`，必须补充 `[hidden] { display: none; }` 覆盖规则，否则会出现“状态已折叠但视觉仍展开”。
