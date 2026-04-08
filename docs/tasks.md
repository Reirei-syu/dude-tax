# 项目任务列表

## 当前阶段

- Execution

## 任务列表

### [x] P0：修复 Electron + API 生产运行链路

- 完成时间：2026-03-28 02:00
- 修改文件：
  - `apps/api/package.json`
  - `apps/api/build.mjs`
  - `apps/api/tsconfig.build.json`
  - `apps/desktop/electron/main.cjs`
  - `package.json`
  - `scripts/package-win.mjs`
- 影响范围：
  - `apps/api` 已产出纯 JS 运行入口 `dist/server.mjs`
  - Electron 生产包改为启动编译后的 API 产物
  - 打包链可生成并通过本机 smoke 验证

### [x] P0：移除生产环境对 tsx + TypeScript 源码的依赖

- 完成时间：2026-03-28 02:00
- 修改文件：
  - `apps/api/build.mjs`
  - `apps/api/tsconfig.build.json`
  - `apps/desktop/electron/main.cjs`
  - `scripts/package-win.mjs`
- 影响范围：
  - 生产运行不再依赖 `tsx`
  - 生产运行不再直接执行 `apps/api/src/server.ts`
  - 打包时不再依赖 `apps/api/src`、`packages/core/src`、`packages/config/src`

### [x] P0：修复 better-sqlite3 与 Electron ABI 不匹配

- 完成时间：2026-03-28 02:00
- 修改文件：
  - `scripts/package-win.mjs`
  - `package.json`
  - `package-lock.json`
- 影响范围：
  - 打包前显式下载 Electron 目标 ABI 的 `better-sqlite3` 预编译二进制
  - 打包后自动恢复本地开发环境的 Node ABI 版本
  - Windows 包启动后本地 API 可正常监听，SQLite 可成功初始化

### [x] P1：全量修复中文乱码

- 完成时间：2026-04-02 00:00
- 修改文件：
  - `apps/api/src/db/database.ts`
  - `.editorconfig`
  - `.prettierrc.json`
  - `.prettierignore`
  - `package.json`
  - `package-lock.json`
  - `AGENTS.md`
  - `PROJECT_SPEC.md`
  - `prd.md`
  - `PROGRESS.md`
- 影响范围：
  - 修复数据库默认值中的真实损坏中文
  - 新增 UTF-8（无 BOM）编码与 Prettier 基础防线
  - 清理现存 BOM 文件，避免后续再次出现编码漂移

### [x] P1：恢复被压扁的一行源码文件

- 完成时间：2026-04-02 01:00
- 修改文件：
  - `apps/api/src/services/import-service.ts`
  - `apps/api/src/repositories/annual-tax-result-repository.ts`
  - `apps/api/src/repositories/month-record-repository.ts`
  - `apps/desktop/src/pages/MonthRecordEntryPage.tsx`
  - `apps/desktop/src/components/AppLayout.tsx`
  - `package.json`
  - `package-lock.json`
- 影响范围：
  - 首批高优先级单行源码已恢复为可读结构
  - 新增 `lint-staged`，提交前可自动跑 Prettier

### [x] P2：结果失效判定改为 policy_signature + data_signature

- 完成时间：2026-04-02 14:02
- 修改文件：
  - `packages/core/src/index.ts`
  - `packages/core/src/month-record-data-signature.ts`
  - `apps/api/src/domain/annual-tax-calculation-context.ts`
  - `apps/api/src/services/annual-tax-service.ts`
  - `apps/api/src/repositories/annual-tax-result-repository.ts`
  - `apps/api/src/repositories/calculation-run-repository.ts`
  - `apps/api/src/db/database.ts`
  - `apps/api/src/annual-results.test.ts`
- 影响范围：
  - 为年度结果、历史版本和重算状态引入 `data_signature`
  - 失效判定从仅看 `policy_signature` 扩展为同时判断数据签名
  - 新增“空签名按需重算”兼容语义，旧库升级后不会误判为当前有效

### [x] P2：将历史结果重算对比迁移到 API

- 完成时间：2026-04-02 16:05
- 修改文件：
  - `packages/core/src/index.ts`
  - `apps/api/src/domain/history-result-recalculation.ts`
  - `apps/api/src/services/annual-tax-service.ts`
  - `apps/api/src/routes/calculations.ts`
  - `apps/desktop/src/api/client.ts`
  - `apps/desktop/src/pages/HistoryQueryPage.tsx`
  - `apps/api/src/annual-results.test.ts`
- 影响范围：
  - 新增 `POST /api/history-results/recalculate`
  - 历史结果重算与差异解释已收口到 API 服务层
  - `HistoryQueryPage` 不再直接调用核心计算函数

### [x] P2：SQLite 增加 CHECK 约束

- 完成时间：2026-04-02 16:32
- 修改文件：
  - `apps/api/src/db/database.ts`
  - `apps/api/src/db-constraints.test.ts`
- 影响范围：
  - 为月度记录、重算状态、年度结果和结果版本增加数据库级 `CHECK` 约束
  - 旧库升级改为“预检查 + 影子表重建迁移”，非法旧数据会阻止自动迁移
  - 新增数据库约束回归测试，覆盖旧表迁移与非法写入拒绝

### [x] P3：修复导入服务事务与性能问题

- 完成时间：2026-04-02 16:50
- 修改文件：
  - `apps/api/src/services/import-service.ts`
  - `apps/api/src/repositories/import-summary-repository.ts`
  - `apps/api/src/repositories/month-record-repository.ts`
  - `apps/api/src/import.test.ts`
- 影响范围：
  - `commit` 改为单事务执行，采用“全成功才提交”策略
  - 预览与提交改为一次预加载员工/月度记录上下文，移除循环内 N+1 查询
  - 成功导入后会清理导入摘要，避免首页继续显示过期冲突

### [x] P3：拆分超大页面组件

- 完成时间：2026-04-08 12:35
- 修改文件：
  - `apps/desktop/src/pages/AnnualResultsPage.tsx`
  - `apps/desktop/src/pages/HistoryQueryPage.tsx`
  - `apps/desktop/src/pages/annual-results/constants.ts`
  - `apps/desktop/src/pages/annual-results/hooks/useAnnualResultsPage.ts`
  - `apps/desktop/src/pages/annual-results/components/*`
  - `apps/desktop/src/pages/history-query/constants.ts`
  - `apps/desktop/src/pages/history-query/hooks/useHistoryQueryPage.ts`
  - `apps/desktop/src/pages/history-query/components/*`
- 影响范围：
  - `AnnualResultsPage.tsx` 主文件已降到约 55 行
  - `HistoryQueryPage.tsx` 主文件已降到约 57 行
  - 页面状态、副作用与展示 section 已按 `hooks / components / constants` 拆分收口

### [x] P3：统一文案映射与结果解释逻辑

- 完成时间：2026-04-08 14:28
- 修改文件：
  - `packages/core/src/display-mappings.ts`
  - `packages/core/src/index.ts`
  - `apps/desktop/src/pages/annual-results/constants.ts`
  - `apps/desktop/src/pages/history-query/constants.ts`
  - `apps/desktop/src/pages/annual-tax-withholding-summary.ts`
  - `apps/desktop/src/pages/annual-tax-explanation.ts`
  - `apps/desktop/src/pages/history-query-diff.ts`
  - `apps/desktop/src/pages/annual-result-version-diff.ts`
  - `apps/desktop/src/pages/history-query-export.ts`
  - `apps/api/src/domain/history-result-recalculation.ts`
  - `apps/api/src/services/annual-tax-service.ts`
- 影响范围：
  - 方案标签、结算方向标签和预扣模式标签已统一提升到 `packages/core`
  - 前端与 API 不再各自维护核心展示映射常量
  - explanation helper 保留原语义，只切换到共享标签来源

## 状态

- [ ] 未完成
- [x] 已完成
- [-] 已废弃
