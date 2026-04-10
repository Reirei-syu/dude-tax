# 发布前全面 E2E 验证方案

## 1. 背景

- 当前仓库已完成上一轮桌面端长稳压测、真实 Electron 壳烟测与 Windows 测试包构建修复。
- 现有证据分散在 `scripts/stress/`、`docs/stress/` 与手工产物中，缺少一条面向“发布前”的统一验证闭环。
- 本轮目标不是扩功能，而是在当前未提交代码基础上完成一次可复跑、可定位、可回退的发布前全面 E2E 验证；若发现缺陷，只做最小修复。

## 2. 目标

- 完成 workspaces 级基线校验：测试、类型检查、构建、Windows 测试包打包。
- 完成发布包 / Electron 真实壳主流程 E2E：覆盖壳启动、本地 API 连通、全局上下文、关键业务页面与关键只读回显。
- 使用修正后的 `desktop-full-chain-soak` 脚本执行严格 60 分钟单次 soak，补齐当前已知缺口。
- 若验证中发现错误，先做根因定位，再实施最小修复，并完成回归验证。

## 3. 设计方案

- 基线校验：
  - 执行 `npm run test --workspaces --if-present`
  - 执行 `npm run typecheck --workspaces --if-present`
  - 执行 `npm run build:api`、`npm run build:desktop`、`npm run package:win`
- 发布包 E2E：
  - 新增或补齐 `scripts/e2e/release-preflight.mjs`
  - 通过真实发布包启动 Electron，并显式开启 remote debugging 端口用于 CDP 回放
  - 优先验证“发布包自启 managed API”链路；若发布包链路无法稳定读取运行时配置，再降级为“真实 Electron 壳 + 外部固定端口 API”作为补充证据
  - 自动化只放在接口层与壳层，不绕过 Service / HTTP 直接操作 Core
- 长稳验证：
  - 使用当前修正后的 `scripts/stress/desktop-full-chain-soak.mjs`
  - 重新执行 `--duration-minutes 60`
  - 记录 `summary.json`、`metrics-*.json`、关键日志与异常
- 失败处理：
  - 任何失败项先收集日志、命令输出、复现条件
  - 修复遵守最小改动原则，优先补测试 / 脚本护栏

## 4. 涉及模块

- `apps/api`
- `apps/desktop`
- `scripts/package-win.mjs`
- `scripts/stress/desktop-full-chain-soak.mjs`
- `scripts/e2e/*`（如需新增）
- `docs/plans/*`
- `docs/tasks.md`
- `PROGRESS.md`
- `docs/context/latest_context.md`

## 5. 数据结构变更

- 默认无数据结构变更。
- 若验证暴露数据层缺陷，仅允许在现有 schema 不变前提下做逻辑修复；如需改 schema，必须停止执行并单独确认。

## 6. 接口变更

- 默认不改现有 HTTP API。
- 如需新增发布前 E2E 脚本，CLI 约定如下：
  - `node scripts/e2e/release-preflight.mjs --app-path <path> --output-dir <path> [--api-base-url <url>]`
  - stdout 默认输出 JSON，包含 `status`、`data`、`error`

## 7. 风险评估

- 高风险：
  - 发布包模式与开发模式运行路径不同，可能暴露 `userData`、managed API、自启日志、资源路径等只在生产链路出现的问题。
  - 60 分钟 soak 执行时间长，若脚本存在时序或恢复问题，回归成本较高。
- 中风险：
  - 壳层自动化若依赖 UI 文案或 DOM 结构，页面小改动会导致脚本脆弱。
- 可控风险：
  - 本轮以验证和最小修复为主，不主动改架构、不改 schema、不引入新依赖。

## 8. 回退方案

- 若新增 E2E 脚本不稳定：
  - 回退 `scripts/e2e/*` 与文档变更，保留失败证据，不影响产品运行链路。
- 若修复引入回归：
  - 回退对应最小修改文件
  - 恢复到验证前状态
  - 将问题登记为单独修复任务

## 9. 任务拆解

- [x] 建立发布前 E2E 任务与方案文档，更新任务/进度/上下文文档。
- [x] 执行 workspaces 基线校验，记录首轮失败证据。
- [x] 补齐并执行发布包 / Electron 主流程 E2E 回放。
- [x] 执行修正后脚本的严格 60 分钟 soak，并整理产物。
- [x] 对失败项做根因修复与回归验证。
- [x] 同步 `docs/tasks.md`、`PROGRESS.md`、`docs/context/latest_context.md` 与必要静态文档。
