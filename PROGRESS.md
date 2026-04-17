# 项目进度与状态

- 更新时间：2026-04-17
- 项目标识：dude-tax
- 产品显示名：工资薪金个税计算器
- 当前阶段：Execution
- 当前版本：v0.1.0-alpha
- 当前任务：开发态与安装版数据库隔离

## 本轮修改

- 新增 `apps/desktop/electron/database-path.cjs`，负责安装版数据库路径解析、写权限探测和旧库迁移
- `apps/desktop/electron/main.cjs` 改为通过 helper 决定安装版 managed API 的数据库路径
- `apps/api/src/db/database.ts` 暴露 `databaseFilePath`，便于验证 API 实际打开的数据库文件
- `apps/api/package.json` 的 `dev` 脚本显式注入 `DUDE_TAX_DB_PATH=../../data/dev/dude-tax.dev.db`
- `apps/desktop/package.json` 的 `dev` 脚本为 Electron 开发壳显式注入同一条 dev 库路径
- `scripts/e2e/release-preflight.mjs` 新增安装目录数据库路径检查
- 新增 desktop/api 数据库路径回归测试

## 影响范围

- `apps/api`
- `apps/desktop`
- `scripts/e2e`
- 项目运行时文档

## 当前进度

- 当前主任务进度：100%

已完成：

- 开发态默认数据库切换为仓库内独立 dev 库
- 安装版默认数据库切换为安装目录 `data/dude-tax.db`
- 安装目录不可写时自动回退到 `userData`
- 旧 `userData` 库首次升级自动复制迁移
- 发布前脚本可检查安装版是否优先落库到安装目录
- desktop/api 路径回归测试已转绿

未完成：

- 真实安装包升级场景的人工冒烟验证
- `.gitignore` 已忽略但仍被追踪的 Agent 文档清理
- Vite bundle warning 优化

## 验证结果

- `npm run test --workspace @dude-tax/desktop -- src/electron-database-path.test.ts src/electron-runtime-config.test.ts`
- `npm run test --workspace @dude-tax/api -- src/db/database-path.test.ts`

## 风险备注

- 安装目录权限在真实用户环境中仍可能触发回退路径，需要人工验证体验
- 若绕过 workspace `dev` 脚本单独启动 API 且不传 `DUDE_TAX_DB_PATH`，仍会回落到旧默认路径
- 发布前脚本当前依赖测试包目录可写这一前提

## Lessons Learned

- 这类“串库”问题不能只改 API 默认值，必须同时收紧 Electron 主进程、workspace dev 脚本和发布前检查
- 安装版数据库迁移优先用“复制不删除”，可以显著降低升级风险
- Electron 路径策略最好抽成纯 Node helper，避免把文件系统逻辑散落在主进程里

## 下一步建议

1. 用真实安装包验证旧 `userData` 库升级迁移到安装目录的体验
2. 清理已加入 `.gitignore` 但仍被 Git 跟踪的 Agent 内部文档
3. 继续处理 Vite bundle warning 与桌面包体优化
