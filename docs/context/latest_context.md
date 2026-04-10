# 当前上下文摘要

## 当前阶段

- Execution

## 当前任务

- 发布前全面 E2E 验证与缺陷修复已完成

## 已完成

- 已修复无变更重算导致的版本历史膨胀
- 已修复 `confirmed-results` / detail 的 N+1 查询退化
- 已新增 `scripts/stress/desktop-full-chain-soak.mjs` 与结构化 JSON 输出
- 已修复 Electron 生产构建绝对资源路径导致的白屏问题
- 已完成短样本验证：
  - 20 员工 / 240 月度记录
  - `short-sample/summary.json` 生成成功
- 已完成修正后短样本验证：
  - baseline 已补齐 `windowMs` / `idlePaddingMs`
  - `short-sample-postfix/summary.json` 生成成功
- 已完成正式 soak：
  - 500 员工 / 6000 月度记录
  - burst 478 次无变更重算后 `annualResultVersionCount=500`
  - `confirmed-results` 基线 52.52 ms，恢复后 46.65 ms
  - API 于 `18:04:59 -> 18:05:05` 重启并恢复健康
  - `full-run-1h/summary.json` 与 56 份 `metrics-*.json` 已生成
- 已完成真实 Electron 壳页面级烟测：
  - 单位管理新增 2027 年
  - 员工导入 2 名员工
  - 月度导入 24 行并执行计算
  - 结果确认确认 1 月
  - 历史查询命中 `EMP-SMOKE-001`
  - 系统维护完成单项保存、创建版本、重命名、绑定/解绑作用域
  - 政策参考验证绑定态 / 解绑态条目切换与原图预览
- 已完成真实 Electron 壳顶层折叠矩阵验证：
  - `toggle-summary.json` 中所有目标卡片 `toggled=true`

## 剩余任务

- 当前轮次无阻塞任务
- 可选后续事项：
  - 如准备真正发布，可基于当前通过的测试包结果整理发布说明
  - 如要继续降风险，可单独优化桌面端大 bundle warning

## 关键决策

- 无变更重复重算的“去重点”固定放在 `annual_tax_results` 写入前，对比签名、方案、税额与快照 JSON
- `confirmed-results` 与 detail 共用批量预加载的员工 / 确认月份 / 月度记录索引，不再逐员工回表
- 压测 CLI 只通过 Service 暴露的真实 API 施压，不在脚本内绕过 HTTP 直接碰 Core
- Electron 壳验证采用“真实 API 连接 + 真实 Electron + CDP DOM 点击回放”策略，不新增仓库依赖
- 顶层折叠交互单独拆到 `toggle-summary.json` 验证，避免和业务主流程混在一起
- 本轮发布前验证优先复用已有 build/package/stress 能力；仅在缺少可复跑入口时补最小脚本
- 发布包 E2E 的 userData 隔离采用 `--user-data-dir=<temp>`，继续保留 managed API 自启动验证

## 当前问题

- 自动化壳层启动日志里有 Chromium 缓存告警，但未导致进程退出
- `vite build` 仍存在 bundle 过大 warning，但当前不阻断发布
- Chromium 缓存相关 stderr 仍会出现，但不影响发布包主流程回放与 soak 结果

## 下一步计划

1. 如需要对外发布，整理当前 `docs/e2e/.../summary.json` 与 `docs/stress/.../full-run-1h-postfix/summary.json` 作为发布证据
2. 如继续开发，下一个可独立推进的低风险项是桌面端 bundle 体积优化
