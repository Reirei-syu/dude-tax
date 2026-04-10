# 项目进度与状态

- 更新时间：2026-04-10
- 项目标识：dude-tax
- 产品显示名：工资薪金个税计算器
- 当前阶段：Execution
- 当前版本：v0.1.0-alpha
- 当前任务：发布前全面 E2E 验证与缺陷修复已完成
- 方案路径：`docs/plans/2026-04-10_release-preflight-e2e_plan.md`

## 当前轮次目标

- 已完成：
  - 发布前 E2E 方案、任务和上下文文档已同步
  - `npm run test --workspaces --if-present`
  - `npm run typecheck --workspaces --if-present`
  - `npm run build:api`
  - `npm run build:desktop`
  - `npm run package:win`
  - 新增 `scripts/e2e/release-preflight.mjs`，并完成真实发布包主流程回放
  - 修正后的 `desktop-full-chain-soak.mjs` 已完成严格 60 分钟单次复跑
- 本轮修复：
  - 修复发布包 E2E 脚本在 remote debugging 端口未就绪时直接失败的问题
  - 改用 `--user-data-dir=<temp>` 隔离发布包 userData，避免污染真实用户数据
  - 修复 React 受控表单 / 下拉框在自动化脚本中的填值兼容性
  - 修复月度录入、结果确认、历史查询、政策参考的页面级等待条件与错误元素命中问题

> 说明：以下“本轮修改 / 验证结果 / 风险备注”内容来自上一轮长稳压测与真实壳烟测，作为本轮发布前全面 E2E 的现有基线证据。

## 本轮修改

- 后端稳定性修复：
  - `annual_tax_result_versions` 新增“完全相同结果不追加历史版本”保护，只刷新当前结果时间戳
  - `confirmed-results` 与 detail 改为一次性预加载当前单位 / 年度的员工、确认月份与月度记录，再按 `employeeId -> taxMonth` 内存分组
- 测试补充：
  - 新增“无变更重复重算不追加版本历史”回归测试
  - 新增 `confirmed-results` 多员工、多确认月份语义回归测试
  - 新增压测 CLI 参数校验与失败输出测试
- 压测能力：
  - 新增 `scripts/stress/desktop-full-chain-soak.mjs`
  - 新增压测工作区 `docs/stress/2026-04-10-desktop-full-chain-soak/`
  - 输出 `summary.json`、每分钟 `metrics-*.json`、导入样本 CSV
- Electron 构建链路修复：
  - 修复桌面端生产构建输出绝对 `/assets/...` 资源路径导致 `file://` 场景下 renderer 空白页的问题
  - `@dude-tax/desktop` 构建脚本改为 `vite build --base ./`
- 真实 Electron 壳烟测：
  - 单位管理：新增 2027 年
  - 员工信息：真实文件导入 2 名员工
  - 月度数据录入：真实文件导入 24 行月度记录并执行计算
  - 结果确认：确认 1 月
  - 历史查询：命中 `EMP-SMOKE-001`
  - 系统维护：完成单项保存、创建版本、重命名、绑定 / 解绑作用域
  - 政策参考：验证绑定态 / 解绑态条目切换与原图预览
- 真实 Electron 壳折叠矩阵：
  - 首页、单位管理、员工信息、月度数据录入、快速计算、结果确认、历史查询、政策参考的顶层折叠卡全部完成“展开 -> 收起”状态切换验证

## 影响范围

- `apps/api`
- `apps/desktop`
- `scripts/stress`
- `docs`

## 任务进度

- 当前主任务进度：100%
- 已完成：
  - 年度结果版本历史去重修复
  - `confirmed-results` / detail 批量化查询修复
  - 压测 CLI 与工作区文档落地
  - Electron 生产构建相对资源路径修复
  - API 回归、构建与脚本测试通过
  - 短时样本与正式 soak 产物生成完成
  - Electron 壳页面级主流程烟测
  - Electron 壳顶层折叠矩阵验证
- 未完成：
  - 如需严格满 60 分钟单次 soak，需使用修正后的脚本复跑一轮

## 验证结果

- `npm run test --workspace @dude-tax/api -- annual-results.test.ts confirmed-results.test.ts year-entry.test.ts`
- `npm run build --workspace @dude-tax/api`
- `npm run build --workspace @dude-tax/desktop`
- `node --test scripts/stress/desktop-full-chain-soak.test.mjs`
- `node scripts/stress/desktop-full-chain-soak.mjs --duration-minutes 0.2 --api-base-url http://127.0.0.1:3101 --db-path <temp-db> --seed-employees 20 --tax-year 2026 --unit-name 短时压测单位 --output-dir docs/stress/2026-04-10-desktop-full-chain-soak/artifacts/short-sample --phase-profile desktop-full-chain`
- `node scripts/stress/desktop-full-chain-soak.mjs --duration-minutes 60 --api-base-url http://127.0.0.1:3102 --db-path <temp-db> --seed-employees 500 --tax-year 2026 --unit-name 一小时压测单位 --output-dir docs/stress/2026-04-10-desktop-full-chain-soak/artifacts/full-run-1h --phase-profile desktop-full-chain`
- `node scripts/stress/desktop-full-chain-soak.mjs --duration-minutes 0.2 --api-base-url http://127.0.0.1:3103 --db-path <temp-db> --seed-employees 20 --tax-year 2026 --unit-name 修正后短时压测单位 --output-dir docs/stress/2026-04-10-desktop-full-chain-soak/artifacts/short-sample-postfix --phase-profile desktop-full-chain`
- Electron 真实壳页面级烟测产物：
  - `docs/stress/2026-04-10-desktop-full-chain-soak/artifacts/electron-ui-smoke/summary.json`
  - `docs/stress/2026-04-10-desktop-full-chain-soak/artifacts/electron-ui-smoke/01-home-initial.png`
  - `docs/stress/2026-04-10-desktop-full-chain-soak/artifacts/electron-ui-smoke/08-maintenance-flow.png`
  - `docs/stress/2026-04-10-desktop-full-chain-soak/artifacts/electron-ui-smoke/09-policy-title-restored-a.png`
- Electron 顶层折叠矩阵产物：
  - `docs/stress/2026-04-10-desktop-full-chain-soak/artifacts/electron-ui-smoke/toggle-summary.json`
- 正式 soak 关键结果：
  - 基线 `confirmed-results=52.52ms`
  - burst 478 次无变更重算后 `annualResultVersionCount=500`
  - burst 阶段 DB 增长率 `1.65%`
  - 恢复后 `confirmed-results=46.65ms`
  - API 重启窗口 `18:04:59 -> 18:05:05`

## 风险备注

- 发布前全面 E2E 已通过，但 `vite build` 仍有 bundle 过大 warning，当前不阻断发布。
- 真实发布包与严格 60 分钟 soak 均已通过；当前未发现新的 P1/P0 稳定性问题。
- `vite build` 仍有 bundle 过大 warning，但构建成功，不影响本轮交付。
- 真实 Electron 壳启动时出现 Chromium 磁盘缓存告警，但页面级烟测已实际走通，暂按环境级 P3 观察项记录。
- 正式 soak 使用旧版脚本完成，`--duration-minutes 60` 的阶段权重实际覆盖约 55 分钟；run 后已修正 baseline 窗口计时，若需要严格满 60 分钟单次证据，应补一轮复跑。

## Lessons Learned

- 版本历史类长稳缺陷必须在“当前结果写入前”做精确比较，不能在写完之后再清理；后者会污染 `version_sequence` 和数据库增长曲线。
- `confirmed-results` 这类纯读链路，一旦业务语义依赖“员工 + 确认月份 + 月度记录”三张表，优先做批量预加载与内存分组，避免服务层逐员工回表。
- 同一 workspace 的 SQLite 文件型测试不能并行跑；并行执行会制造 `EPERM` 假失败，必须串行。
- 真实 Electron 壳即使不做页面自动化，也能通过“真实 API 连接 + 真实 Electron + CDP DOM 点击回放”完成高价值主流程烟测。
- `--duration-minutes` 这类阶段化压测参数，必须保证所有阶段的总窗口严格闭合；否则名义时长和实际时长会偏离。
- Electron `file://` 场景必须使用相对资源路径；只要构建产物里残留绝对 `/assets/...`，壳层进程虽然能启动，但 renderer 会是空白页。
- 页面级 Electron 烟测与折叠矩阵验证适合拆成两份产物：主流程 `summary.json` 和独立的 `toggle-summary.json`，便于区分业务流程与纯 UI 交互问题。
- 发布包 E2E 隔离优先使用 `--user-data-dir=<temp>`，不要一次性覆写 `USERPROFILE` / `TMP` / `TEMP`；后者会破坏 remote debugging 与壳层启动。
- React 受控输入与下拉框不能只改 DOM 值，必须走原生 setter + `input/change` 事件，否则 UI 看似填值，组件状态其实没更新。
- 页面级等待条件不能盯骨架文案或初始空状态；应等待真正的数据态切换，否则会把“还没加载”误判成“查询为空”。
- 文本点击匹配要限定元素类型；像“查询”这类短文本如果不限制到 `button`，很容易误点侧边栏导航。
