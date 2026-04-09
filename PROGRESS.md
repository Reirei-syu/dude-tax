# 项目进度与状态

- 更新时间：2026-04-09
- 项目标识：dude-tax
- 产品显示名：工资薪金个税计算器
- 当前阶段：Execution
- 当前版本：v0.1.0-alpha
- 当前任务：录入模型精简优化
- 方案路径：`/docs/plans/2026-04-09_entry-model-simplification-plan.md`

## 本轮修改

- 月度数据公共模型收缩：
  - 补发收入统一改为“其他收入”
  - 取消“补扣税调整”
  - 取消“补发所属期间”
  - 保留“其他收入备注”
  - 取消“记录状态”作为计算前置条件
- 个税计算逻辑改造：
  - 录入内容直接作为计算来源
  - 结果确认支持空白月直接确认
  - 已确认但无录入内容的月份按零值月参与计算
- 工作台表格改造：
  - 删除“记录状态”列
  - 收入区改为“工资收入、年终奖、预扣税额、其他收入、其他收入备注”
  - 新增只读“减除费用”列，按当前政策 `basicDeductionAmount` 展示，默认 5000
- API 与仓储兼容：
  - 新请求/响应切到 `otherIncome / otherIncomeRemark`
  - 旧单月接口与导入仍可接受旧字段，但新主流程不再依赖它们
  - 遗留数据库列保留，不做删列
- 页面与导出同步：
  - 月度数据录入、快速计算、结果确认、历史查询明细工作台全部切到新字段
  - 通用 workbook builder 改为新列顺序并包含只读减除费用列

## 影响范围

- `packages/core`
- `apps/api`
- `apps/desktop`
- `docs`

## 任务进度

- 当前主任务进度：100%
- 已完成：
  - core 类型与计算逻辑精简
  - API 契约、确认逻辑和导入兼容更新
  - 前端工作台、页面与导出同步
  - 文档与上下文同步
- 未完成：
  - Windows / Electron 手工烟测

## 验证结果

- `npm test`
- `npm run typecheck`
- `npm run build --workspace @dude-tax/desktop`
- `npm run build --workspace @dude-tax/api`

## 风险备注

- 当前未完成 Windows / Electron 桌面壳人工烟测。
- 已尝试通过 Playwright 对本地预览做浏览器烟测，但当前环境因 `C:\Windows\System32\.playwright-mcp` 权限限制无法启动浏览器会话。
- 为兼容旧单月接口与旧导入模板，仓储响应仍保留少量 legacy 别名字段；新工作台与新接口已不再使用。
- Desktop build 仍有 bundle 过大 warning，但不影响本轮构建通过。

## Lessons Learned

- 一旦“记录状态”退出模型，正式结果链路与确认链路必须明确谁来提供“零值月”语义，否则月度确认会失去边界。
- 与其在每个页面重复维护列定义，不如先稳定共享工作台字段和 workbook builder，再让页面复用。
- 兼容层最好只留在 legacy 路由和导入入口，主流程越早切干净，后续维护越稳。
