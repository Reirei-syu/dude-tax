# 模块与数据链路矩阵

| 模块 | 入口动作 | 主要读取 | 主要写入 | 下游触发 | 循环点 | 收敛条件 | 放大量级 | 观测信号 | 证据位置 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Electron 桌面壳 | 启动应用并连接固定端口 API | `dist/index.html`、preload runtimeConfig | 用户态日志、窗口状态 | 页面初始化请求本地 API | API 异常重连、启动失败 | 启动后首页可稳定打开，不出现 managed API 崩溃 | 启动前 / 启动后 | 进程存活、managed API 日志、启动错误 | `artifacts/electron-*.log` |
| 员工导入 | `/api/import/preview` + `/api/import/commit` | CSV、员工表、单位表 | `employees`、`import_preview_summaries` | 员工列表刷新、后续月度导入 | 重复导入 overwrite | 停止导入后员工总数稳定，无重复员工 | 50 / 200 / 500 员工 | 员工总数、导入成功数、冲突数 | `artifacts/summary.json` |
| 月度导入 | `/api/import/preview` + `/api/import/commit` | CSV、员工表、确认月份 | `employee_month_records`、`import_preview_summaries` | 年度结果重算、确认状态变化 | overwrite 重复导入 | 停止导入后月度记录数稳定，无额外重复行 | 600 / 2400 / 6000 行 | 月度记录数、导入成功数、错误数 | `artifacts/summary.json` |
| 年度结果重算 | `/api/units/:id/years/:year/calculation-statuses/recalculate` | 月度记录、税率设置、跨单位衔接上下文 | `annual_tax_results`、`annual_tax_result_versions`、`annual_calculation_runs` | 年度结果列表、历史查询、版本历史 | 无变更重复重算 | 停止重算后版本总数不继续增长 | 1 / 100 / 500+ 次重复重算 | 版本数、结果数、DB/WAL 大小 | `artifacts/metrics-*.json` |
| 月份确认 | `/api/units/:id/years/:year/month-confirmations/*` | 当前覆盖状态、月度记录 | `month_confirmations` | 已确认结果查询 | 顺序确认 / 取消确认 | 确认月份数与预期一致，不出现跨月漂移 | 12 个月 | 已确认月份数、确认响应时间 | `artifacts/summary.json` |
| 已确认结果查询 | `/api/units/:id/years/:year/confirmed-results*` | 员工、确认月份、月度记录、税率设置 | 无 | 列表 / 明细展示 | 高频查询 | 500 员工下基线 ≤ 1.5s，收尾 ≤ 2.0s | 50 / 200 / 500 员工 | 查询耗时、返回行数 | `artifacts/summary.json` |
| 历史查询 | `/api/history-results` | 当前结果、签名、源数据签名 | 无 | 历史页展示 | 高频查询 | 停止查询后无额外写入、无数据漂移 | 50 / 200 / 500 员工 | 查询耗时、失效行数 | `artifacts/summary.json` |

## 补充说明

- 本轮重点链路是“月度导入 -> 重算 -> 版本历史 -> 已确认结果查询”。
- 若停止输入后版本数、WAL 或数据库体积仍持续增长，按高风险处理。
