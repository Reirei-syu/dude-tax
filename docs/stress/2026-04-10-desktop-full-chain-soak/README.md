# dude-tax 桌面端全链路长稳压测工作区

## 1. 任务标识

- 标识：`2026-04-10-desktop-full-chain-soak`
- 主题：`desktop-full-chain-soak`

## 2. 目标

- 验证桌面端真实运行环境下，导入、重算、确认、历史查询与已确认结果查询是否收敛。
- 检查无变更重算是否继续膨胀版本历史。
- 检查确认结果查询在 500 员工样本下是否仍满足桌面端可接受延迟。
- 检查 API 重启后，脚本与数据链路是否恢复正常且不出现额外版本放大。

## 3. 最小交付物

- `module-matrix.md`
- `invariants.md`
- `runbook.md`
- `findings.md`
- `soak-log.md`
- `artifacts/summary.json`
- `artifacts/metrics-*.json`

## 4. 运行原则

1. 先做真实 Electron 壳启动检查，再开始主 soak。
2. 压测脚本只负责真实 API 负载与证据落盘，不承担 Electron 自动化。
3. 每分钟至少记录一次数据库与操作计数快照。
4. 恢复阶段必须包含一次 API 重启。

## 5. 当前已知问题

- 无变更重算会导致版本历史无界增长。
- `confirmed-results` 在 500 员工样本下存在明显退化。
