# 项目任务列表

## 当前阶段

- Execution

## 任务列表

### [x] 开发态与安装版数据库隔离

- 类型：Fix
- 模块：`apps/api` / `apps/desktop` / `scripts` / `docs`
- 描述：将 `npm run dev` 固定到仓库内 dev 数据库，并让安装版优先使用安装目录数据库，同时支持旧 `userData` 库迁移与目录不可写回退
- 依赖：Windows 安装版发布链路已可用
- 风险：中
- 优先级：2
- 完成时间：2026-04-17
- 修改文件：
  - `apps/api/package.json`
  - `apps/api/src/db/database.ts`
  - `apps/api/src/db/database-path.test.ts`
  - `apps/desktop/package.json`
  - `apps/desktop/electron/database-path.cjs`
  - `apps/desktop/electron/main.cjs`
  - `apps/desktop/src/electron-database-path.test.ts`
  - `apps/desktop/src/electron-runtime-config.test.ts`
  - `scripts/e2e/release-preflight.mjs`
  - `PROJECT_SPEC.md`
  - `prd.md`
  - `PROGRESS.md`
  - `docs/context/latest_context.md`
  - `docs/context_memory/memory.md`
  - `docs/tasks.md`
- 影响范围：
  - 开发环境不再写入用户安装版数据库
  - 安装版默认数据库切换到安装目录
  - 升级时支持旧库自动迁移
- 验证结果：
  - `npm run test --workspace @dude-tax/desktop -- src/electron-database-path.test.ts src/electron-runtime-config.test.ts`
  - `npm run test --workspace @dude-tax/api -- src/db/database-path.test.ts`

### [ ] 真实安装包升级迁移冒烟验证

- 类型：Test
- 模块：`apps/desktop` / `scripts`
- 描述：使用真实安装包验证“旧 userData 库 -> 安装目录库”的升级迁移体验，确认数据可读且用户无感
- 依赖：开发态与安装版数据库隔离
- 风险：中
- 优先级：2
- 测试要求：
  - smoke: 必须
  - unit: 否
  - integration: 是
  - e2e: 是
  - regression: 是
  - performance: 否
  - stress: 否
  - uat: 是

### [ ] 清理已追踪的 Agent 内部协作文档

- 类型：Docs
- 模块：`docs` / `git`
- 描述：将已加入 `.gitignore` 但仍被 Git 跟踪的 Agent 内部文档移出版本控制
- 依赖：无
- 风险：中
- 优先级：4
- 测试要求：
  - smoke: 必须
  - unit: 否
  - integration: 否
  - e2e: 否
  - regression: 否
  - performance: 否
  - stress: 否
  - uat: 否

### [ ] 评估并优化桌面包体与 Vite bundle warning

- 类型：Refactor
- 模块：`apps/desktop` / `scripts`
- 描述：分析当前构建 warning 与包体来源，给出最小代价优化方案并落地
- 依赖：真实安装包升级迁移冒烟验证
- 风险：低
- 优先级：4
- 测试要求：
  - smoke: 必须
  - unit: 视改动而定
  - integration: 否
  - e2e: 否
  - regression: 是
  - performance: 是
  - stress: 否
  - uat: 否
