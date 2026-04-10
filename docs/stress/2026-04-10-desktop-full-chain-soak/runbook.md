# 执行 Runbook

## 1. 环境信息

- 仓库版本：`dude-tax`
- 运行形态：真实 Electron 壳 + 固定端口本地 API + SQLite
- 观察对象：数据库文件、WAL、版本历史、确认结果查询耗时、API 恢复后行为

## 2. 基线

- 实际执行：
  - `npm run test --workspace @dude-tax/api -- annual-results.test.ts confirmed-results.test.ts year-entry.test.ts`
  - `npm run build --workspace @dude-tax/api`
  - `npm run build --workspace @dude-tax/desktop`
  - `node --test scripts/stress/desktop-full-chain-soak.test.mjs`
  - `node scripts/stress/desktop-full-chain-soak.mjs --duration-minutes 0.2 --api-base-url http://127.0.0.1:3101 --db-path <temp-db> --seed-employees 20 --tax-year 2026 --unit-name 短时压测单位 --output-dir docs/stress/2026-04-10-desktop-full-chain-soak/artifacts/short-sample --phase-profile desktop-full-chain`
  - `node scripts/stress/desktop-full-chain-soak.mjs --duration-minutes 60 --api-base-url http://127.0.0.1:3102 --db-path <temp-db> --seed-employees 500 --tax-year 2026 --unit-name 一小时压测单位 --output-dir docs/stress/2026-04-10-desktop-full-chain-soak/artifacts/full-run-1h --phase-profile desktop-full-chain`
- 配套动作：
  - PowerShell 编排固定端口 API 启动、真实 Electron 壳前后两次启动检查，以及恢复阶段 API 重启。
- 结果：
  - 短样本与正式 run 均成功产出 `summary.json`。
  - 正式 run 生成 56 份 `metrics-*.json`。

## 3. 重算 burst

- 观察点：
  - `annual_tax_result_versions`
  - `annual_tax_results`
  - 数据库 / WAL 大小
- 正式 run 结果：
  - 500 员工场景下执行 478 次无变更重算。
  - `annual_tax_result_versions` 始终保持 500，不再放大。
  - 数据库体积从 29,839,360 字节增长到 30,330,880 字节，增长率 1.65%。

## 4. 查询 ramp

- 观察 `confirmed-results`、`confirmed-result-detail`、`history-results` 延迟曲线。
- 正式 run 结果：
  - `confirmed-results` 基线 52.52 ms，峰值 80.11 ms，恢复后 46.65 ms。
  - `confirmed-result-detail` 基线 20.02 ms，恢复后 19.66 ms。
  - `history-results` 基线 285.92 ms，峰值 322.82 ms，恢复后 284.73 ms。

## 5. 恢复 / 重启

- 实际执行：
  - `2026-04-10 18:04:59` 开始重启 API
  - `2026-04-10 18:05:05` 健康检查恢复成功
- 结果：
  - 恢复阶段 `retrySuccessCount=226`，`retryFailureCount=0`
  - 重启前后 `annualResultCount=500`、`annualResultVersionCount=500`、`confirmedMonthCount=12` 保持一致

## 6. 收尾

- 再次启动 / 检查 Electron 壳，进程保持存活。
- 检查 `summary.json`、`metrics-*.json` 与临时目录日志。
- 已同步 `findings.md`、`PROGRESS.md` 与 `docs/context/latest_context.md`。
- 备注：
  - 正式 run 使用旧版脚本执行，`--duration-minutes 60` 的阶段权重实际覆盖约 55 分钟，run 后已补齐 baseline 窗口计时逻辑；若需严格满 60 分钟单次复跑，直接使用当前脚本重新执行即可。
