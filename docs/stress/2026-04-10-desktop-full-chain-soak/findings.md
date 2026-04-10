# Findings

## P0 / P1

### [Resolved] 无变更重算版本膨胀未再复现

- 风险等级：已关闭
- 修复后现象：500 员工场景下执行 478 次无变更重算，`annual_tax_result_versions` 始终保持 500。
- 触发条件：正式 soak 的重算 burst 阶段。
- 非收敛信号：未出现。
- 实际证据：`full-run-1h/summary.json -> phaseMetrics.burst.afterStats.annualResultVersionCount = 500`
- 验证结论：通过。

### [Resolved] `confirmed-results` 规模退化已压回可接受范围

- 风险等级：已关闭
- 修复后现象：500 员工、12 个确认月份下，`confirmed-results` 基线 52.52 ms，恢复后 46.65 ms。
- 触发条件：正式 soak 的基线、query ramp、恢复阶段。
- 非收敛信号：未出现。
- 实际证据：
  - `baseline.queryMetrics.latenciesMs.confirmedResults = 52.52`
  - `queryRamp.peakConfirmedResultsMs = 80.11`
  - `recovery.postRecoveryQueries.latenciesMs.confirmedResults = 46.65`
- 验证结论：通过。

## P2 / P3

### [P3] Electron 壳启动烟测出现 Chromium 磁盘缓存告警

- 风险等级：P3
- 现象：自动化启动 Electron 壳时，`electron-stderr.log` 出现 `Unable to create cache` / `Gpu Cache Creation failed`。
- 影响：本次前后两次壳层启动均未提前退出，主流程未受阻。
- 可能原因：自动化隐藏窗口启动环境下的 Chromium 缓存目录权限或锁竞争。
- 处理建议：后续在真实用户桌面环境补一次可视化启动验证；若仍复现，再定位 Electron userData / cache 目录权限。
