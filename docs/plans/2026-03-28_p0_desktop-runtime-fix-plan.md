# P0：桌面生产运行链路修复方案

## 1. 背景
- 当前桌面生产包仍通过 `tsx` 直接执行 `apps/api/src/server.ts`。
- 生产运行依赖 TypeScript 源码、workspace 目录结构和 `tsx` loader，不满足试点交付要求。
- `better-sqlite3` 在打包后的 Electron 环境中仍存在 ABI 不匹配，导致本地 API 无法正常启动。

## 2. 目标
- 让 `apps/api` 产出纯 JS 可执行产物。
- 让 Electron 在生产包中只启动编译后的 API 入口，不再依赖 `tsx` 和 `src/*.ts`。
- 让打包链显式包含 API 编译产物，并完成 `better-sqlite3` 的 Electron ABI 重编。

## 3. 设计方案
- 在 `apps/api` 引入独立构建脚本，输出 `dist/server.mjs`。
- 构建方式采用打包式编译，将 API 运行所需的业务代码与 `@dude-tax/core` / `@dude-tax/config` 一并收口到单个产物中，仅保留 `better-sqlite3` 为运行时原生依赖。
- `apps/desktop/electron/main.cjs` 在生产环境改为直接启动 `apps/api/dist/server.mjs`。
- `scripts/package-win.mjs` 在打包前先执行 API 构建，再对 `better-sqlite3` 进行 Electron ABI 重编。
- 打包时显式保留 `apps/api/dist`，同时忽略 `apps/api/src`、`packages/core/src`、`packages/config/src` 等生产运行不再需要的源码目录。

## 4. 涉及模块
- `apps/api/package.json`
- `apps/api/build.mjs`
- `apps/desktop/electron/main.cjs`
- `package.json`
- `scripts/package-win.mjs`
- 视需要更新 `.gitignore`、`PROGRESS.md`、`docs/tasks.md`、`docs/context/latest_context.md`

## 5. 数据结构变更
- 无

## 6. 接口变更
- 无业务接口变更
- 运行入口从 `apps/api/src/server.ts` 切换为 `apps/api/dist/server.mjs`

## 7. 风险评估
- 如果 API bundling 处理不当，可能引入对 `better-sqlite3` 以外依赖的缺失。
- 如果 Electron rebuild 没有作用到实际被打包的 `better-sqlite3` 模块，ABI 问题仍会保留。
- 如果打包忽略规则过宽，可能把生产运行所需的文件错误排除。

## 8. 回退方案
- 保留现有 `dev` 链路不变，仅调整生产构建与打包脚本。
- 如新构建链失败，可回退 `apps/api/build.mjs`、`main.cjs`、`package-win.mjs`，恢复到当前开发态运行方式。

## 9. 任务拆解
- [ ] 为 `apps/api` 增加生产构建脚本并输出 `dist/server.mjs`
- [ ] 更新根脚本，打包前先构建 API 与桌面前端
- [ ] 修改 Electron 主进程，生产环境改为启动编译后 API
- [ ] 更新打包脚本，显式包含 API 编译产物并排除生产无关源码
- [ ] 修复 `better-sqlite3` 的 Electron ABI 重编链路
- [ ] 执行 Windows 打包与 smoke 验证
