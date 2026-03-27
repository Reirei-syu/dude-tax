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

### [ ] P1：全量修复中文乱码
- 类型：可用性修复
- 模块：config / api / desktop
- 描述：修复 UI 文案、config 文案、数据库默认值和默认 seed 中的乱码，统一编码为 UTF-8（无 BOM）
- 依赖：P0 已全部完成
- 风险：高

### [ ] P1：恢复被压扁的一行源码文件
- 类型：可维护性修复
- 模块：api / desktop
- 描述：恢复核心文件格式，建立 Prettier / lint-staged 防线，防止再次出现单行源码
- 依赖：P1：全量修复中文乱码
- 风险：中

### [ ] P2：修复历史版本 isInvalidated 判定逻辑
- 类型：业务正确性修复
- 模块：api / core
- 描述：引入 `data_signature`，让结果有效性同时受税率变更和月度数据变更影响
- 依赖：P1：恢复被压扁的一行源码文件
- 风险：高

### [ ] P2：将历史结果重算对比迁移到 API
- 类型：架构修复
- 模块：api / desktop
- 描述：删除前端直接调用核心计算的逻辑，由 API 输出重算结果和差异说明
- 依赖：P2：修复历史版本 isInvalidated 判定逻辑
- 风险：中

### [ ] P2：SQLite 增加 CHECK 约束
- 类型：数据层修复
- 模块：api / db
- 描述：为月份、年份、金额、状态等关键字段增加数据库最后防线，并提供兼容旧数据的迁移方案
- 依赖：P2：将历史结果重算对比迁移到 API
- 风险：高

### [ ] P3：修复导入服务事务与性能问题
- 类型：稳定性优化
- 模块：api
- 描述：为导入提交增加事务边界、减少 N+1 查询，并明确全成功或部分成功策略
- 依赖：P2：SQLite 增加 CHECK 约束
- 风险：中

### [ ] P3：拆分超大页面组件
- 类型：可维护性优化
- 模块：desktop
- 描述：按 hooks / components / utils / constants 拆分 `AnnualResultsPage`、`HistoryQueryPage`
- 依赖：P3：修复导入服务事务与性能问题
- 风险：中

### [ ] P3：统一文案映射与结果解释逻辑
- 类型：架构优化
- 模块：desktop / api / core
- 描述：统一方案标签、结算方向标签、规则解释和结果说明，避免多处重复维护
- 依赖：P3：拆分超大页面组件
- 风险：中

## 状态
- [ ] 未完成
- [x] 已完成
- [-] 已废弃
