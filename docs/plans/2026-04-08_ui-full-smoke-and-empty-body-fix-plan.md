# UI 全量巡检与空 Body 请求缺陷修复方案

## 1. 背景

- 当前桌面端 `apps/desktop/src/api/client.ts` 的 `request()` 固定附带 `Content-Type: application/json`。
- 对无 body 的 `POST / DELETE` 请求，这会触发 Fastify 的 `FST_ERR_CTP_EMPTY_JSON_BODY`。
- 已确认受影响动作至少包括：
  - 单位管理：生成删除认证
  - 员工信息：删除员工
  - 系统维护：激活历史税率版本
- 当前桌面端测试主要覆盖纯函数和工具层，尚未覆盖 `apiClient` 的无 body 请求分支与页面主路径冒烟。

## 2. 目标

- 修复前端无 body 请求被错误附加 JSON 头的问题。
- 为受影响的无 body 路由补齐桌面端与 API 回归测试。
- 使用隔离数据库完成 `apps/desktop/src/main.tsx` 中实际 10 个桌面路由页面的最小 UI 冒烟巡检。
- 输出“可运行 / 不可运行”巡检结果，并将新发现缺陷记录到任务文档。

## 3. 设计方案

- 在 `apps/desktop/src/api/client.ts` 收口请求构造逻辑。
- 规则固定为：
  - 仅当 `RequestInit.body` 存在时自动注入 `Content-Type: application/json`
  - 无 body 的 `POST / DELETE` 不再发送该头
  - 保留调用方自定义 `headers` 的合并能力
- 不修改后端接口、请求字段、数据库结构与分层边界。
- 桌面端新增 `apiClient` 回归测试，直接校验：
  - 有 body 的请求仍发送 JSON 头
  - 无 body 的 `POST / DELETE` 不发送 JSON 头
- API 新增无 body 路由回归测试，覆盖：
  - `POST /api/units/:unitId/delete-challenge`
  - `DELETE /api/employees/:employeeId`
  - `POST /api/tax-policy/versions/:versionId/activate`
- UI 冒烟巡检使用隔离数据库与浏览器自动化，按 `apps/desktop/src/main.tsx` 中实际 10 个路由执行最小正向流程。

## 4. 涉及模块

- `apps/desktop`
  - API 请求封装
  - 单位管理页
  - 员工信息页
  - 系统维护页
  - 全量路由 UI 冒烟巡检
- `apps/api`
  - 单位路由
  - 员工路由
  - 税率版本路由
- `docs`
  - `docs/tasks.md`
  - `PROGRESS.md`
  - `docs/context/latest_context.md`

## 5. 数据结构变更

- 无

## 6. 接口变更

- 无对外接口变更
- 前端内部请求约定变更：
  - `request()` 只在存在 body 时自动设置 `Content-Type: application/json`

## 7. 风险评估

- 中风险
- 风险点：
  - 请求头修复是共性封装改动，会影响所有前端 API 调用
  - UI 巡检涉及多模块主路径，可能暴露与本次修复无关的遗留缺陷
- 风险控制：
  - 不改后端协议，只改前端请求封装
  - 先补请求层与 API 层回归测试，再执行 UI 冒烟
  - UI 巡检使用隔离数据库，避免污染现有开发数据
  - 新发现缺陷不混入本次共性修复，只记录到任务文档

## 8. 回退方案

- 若请求封装修复导致其他接口异常：
  - 回退 `apps/desktop/src/api/client.ts`
  - 回退新增测试文件
  - 保留巡检结果文档，单独拆分“请求封装兼容性修复”任务
- 若 UI 冒烟发现大量与本次无关的阻断：
  - 停止扩大修复范围
  - 将问题整理为独立任务
  - 仅提交空 body 请求缺陷修复与其回归测试

## 9. 任务拆解

- Task 1：创建方案文件并同步执行入口文档
  - 验证：`docs/plans`、`docs/tasks.md`、`PROGRESS.md`、`docs/context/latest_context.md` 已反映当前任务
- Task 2：修复 `apps/desktop/src/api/client.ts` 的无 body 请求头逻辑
  - 验证：桌面端请求层测试通过
- Task 3：补充 API 无 body 路由回归测试
  - 验证：API 测试通过
- Task 4：执行代码级验证
  - 验证：
    - `npm run test --workspace @dude-tax/desktop`
    - `npm run test --workspace @dude-tax/api`
    - `npm run typecheck`
    - `npm run build --workspace @dude-tax/desktop`
- Task 5：使用隔离数据库执行 10 个路由页面 UI 冒烟巡检
  - 验证：形成可运行 / 不可运行清单，重点动作已覆盖
- Task 6：将巡检结果和新增缺陷回写文档
  - 验证：`docs/tasks.md`、`PROGRESS.md`、`docs/context/latest_context.md` 已同步最终结果
