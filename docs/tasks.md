# 项目任务列表

## 当前阶段
- Execution

## 任务列表

### [x] 桌面交付：运行时 API 注入与用户数据目录迁移
- 完成时间：2026-03-28 00:00
- 修改文件：
  - `apps/desktop/electron/main.cjs`
  - `apps/desktop/electron/preload.cjs`
  - `apps/desktop/src/global.d.ts`
  - `apps/desktop/src/api/client.ts`
  - `apps/api/src/server.ts`
  - `apps/api/src/db/database.ts`
- 影响范围：
  - 桌面端改为运行时注入 API 基地址
  - 生产包启动时尝试自启本地 API
  - 默认数据库目录迁移到用户数据目录

### [x] 系统维护：税率变更审计日志
- 完成时间：2026-03-28 00:00
- 修改文件：
  - `apps/api/src/db/database.ts`
  - `apps/api/src/repositories/tax-policy-repository.ts`
  - `apps/api/src/routes/tax-policy.ts`
  - `apps/api/src/tax-policy.test.ts`
  - `apps/desktop/src/pages/MaintenancePage.tsx`
- 影响范围：
  - 新增税率变更审计表与查询返回
  - 系统维护页新增审计日志展示

### [x] 系统维护：作用域绑定解除与恢复继承
- 完成时间：2026-03-28 00:00
- 修改文件：
  - `apps/api/src/repositories/tax-policy-repository.ts`
  - `apps/api/src/routes/tax-policy.ts`
  - `apps/api/src/tax-policy.test.ts`
  - `apps/desktop/src/api/client.ts`
  - `apps/desktop/src/pages/MaintenancePage.tsx`
- 影响范围：
  - 当前单位 / 年度可解除专属绑定
  - 解除后恢复继承全局活动税率

### [x] 系统维护：税率版本差异与影响预览
- 完成时间：2026-03-28 00:00
- 修改文件：
  - `packages/core/src/index.ts`
  - `apps/api/src/repositories/tax-policy-repository.ts`
  - `apps/api/src/routes/tax-policy.ts`
  - `apps/api/src/tax-policy.test.ts`
  - `apps/desktop/src/api/client.ts`
  - `apps/desktop/src/pages/MaintenancePage.tsx`
- 影响范围：
  - 版本差异项生成
  - 当前作用域结果 / 重算记录影响预览

### [x] 跨单位 / 跨年衔接：结果页补规则来源说明
- 完成时间：2026-03-28 00:00
- 修改文件：
  - `packages/core/src/index.ts`
  - `apps/api/src/services/annual-tax-service.ts`
  - `apps/desktop/src/pages/annual-tax-rule-source-summary.ts`
  - `apps/desktop/src/pages/AnnualResultsPage.tsx`
  - `apps/desktop/src/pages/HistoryQueryPage.tsx`
- 影响范围：
  - 结果中心展示规则来源摘要
  - 历史查询展示外部规则上下文引用说明
  - 历史查询失效快照对比改为按当前作用域税率重算

### [x] 全项目审查：跨包引用收口与运行时审计归零
- 完成时间：2026-03-28 00:00
- 修改文件：
  - `apps/api/**/*`
  - `apps/desktop/**/*`
  - `package.json`
  - `package-lock.json`
- 影响范围：
  - `apps/*` 改用 workspace 包名引用 `@dude-tax/core` / `@dude-tax/config`
  - `npm audit --omit=dev` 收敛到 0 漏洞

### [x] 桌面交付：Windows 测试包打包脚本
- 完成时间：2026-03-28 00:00
- 修改文件：
  - `package.json`
  - `scripts/package-win.mjs`
  - `.gitignore`
- 影响范围：
  - 新增 `npm run package:win`
  - 输出 `dist-electron/` Windows 测试包目录

### [ ] 桌面交付：Electron ABI 原生模块重编与 smoke 验证
- 类型：交付收口
- 模块：desktop / api
- 描述：继续处理打包后 `better-sqlite3` 与 Electron ABI 不匹配问题，直到测试包能拉起本地 API、初始化用户数据目录数据库，并通过本机 smoke 验证
- 依赖：桌面交付：Windows 测试包打包脚本
- 风险：高

### [ ] 核心税务：跨单位 / 跨年复杂口径继续收口
- 类型：功能收口
- 模块：core / service / ui
- 描述：继续补齐真实业务试点范围内的复杂税务口径，并对不支持场景提供显式拦截或警示
- 依赖：跨单位 / 跨年衔接：结果页补规则来源说明
- 风险：高

## 状态
- [ ] 未完成
- [x] 已完成
- [-] 已废弃
