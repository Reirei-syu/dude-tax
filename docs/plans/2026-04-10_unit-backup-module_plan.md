# 单位备份模块实施方案

## 1. 背景

- 当前产品缺少按单位导出数据的能力，只能依赖整库文件处理，不利于单位级归档与后续恢复设计。
- 该需求涉及 `packages/core`、`apps/api`、`apps/desktop` 和 Electron 桥接，属于高风险多模块改动。

## 2. 目标

- 在“系统维护”下新增单位备份入口。
- 备份范围固定为当前单位下全部年份业务数据，而非整库。
- 备份生成 ZIP 文件，记住最近一次成功备份目录。
- 本期只交付备份，不交付恢复。

## 3. 设计方案

- `packages/core` 新增单位备份协议类型，统一前后端接口。
- `apps/api` 新增单位备份服务与单位路由：
  - `GET /api/units/:unitId/backup-draft`
  - `POST /api/units/:unitId/backup`
- 备份内部文件固定为 `backup.json`，包含：
  - 单位业务数据
  - 作用域绑定
  - 关联税率版本
  - 当前单位审计日志
  - 元数据与摘要计数
- ZIP 由 API 服务调用 Windows PowerShell `Compress-Archive` 生成，避免新增压缩依赖。
- Electron 新增仅负责“选择保存路径”的桥接 `pickSavePath`，真正写备份文件由 API 完成。
- 系统维护页新增默认折叠的“单位备份”卡片，展示草稿信息、最近目录和备份结果。

## 4. 涉及模块

- `packages/core`
- `apps/api`
- `apps/desktop`
- `apps/desktop/electron`
- `docs`

## 5. 数据结构变更

- 无新增业务表。
- 复用 `app_preferences`，新增键 `backup_last_directory` 记录最近一次成功备份目录。
- `backup.json` 元数据固定包含：
  - `schemaVersion`
  - `exportedAt`
  - `appVersion`
  - `unitId`
  - `unitName`
  - `includedTaxYears`
  - `scopeDescription`
  - `summaryCounts`

## 6. 接口变更

- 新增 `UnitBackupDraftResponse`
- 新增 `CreateUnitBackupPayload`
- 新增 `CreateUnitBackupResponse`
- 新增 `UnitBackupManifest`
- 新增 `UnitBackupSummaryCounts`
- Electron 新增 `window.salaryTaxDesktop.pickSavePath(...)`

## 7. 风险评估

- ZIP 生成依赖 Windows PowerShell，后续跨平台时需替换。
- 若备份未携带关联税率版本，恢复时会丢失结果语义，因此必须追溯 `tax_policy_versions`。
- 备份路径必须做绝对路径、目录存在和 `.zip` 扩展名校验，避免误写。

## 8. 回退方案

- 回退新增的单位备份 API 路由、服务和桌面卡片。
- 删除 `backup_last_directory` 偏好键读取逻辑，保持旧系统维护页行为不变。
- 不触碰既有税率维护、导出和上下文逻辑。

## 9. 任务拆解

- 新增 core 类型定义。
- 新增 API 单位备份服务和失败测试。
- 在单位路由中接入草稿与执行接口。
- 新增 Electron `pickSavePath` IPC 与预加载桥接。
- 新增桌面客户端接口与系统维护页卡片。
- 同步更新规格、进度、任务与上下文文档。

## 10. 测试方案

- API：
  - 草稿接口返回建议文件名、年份范围与最近目录
  - ZIP 备份只包含目标单位及关联税率版本
  - 压缩失败返回结构化错误
- Desktop：
  - 客户端调用新接口
  - 系统维护页存在“单位备份”卡片并使用 `pickSavePath`
- 构建：
  - `npm run build --workspace @dude-tax/api`
  - `npm run build --workspace @dude-tax/desktop`
  - `npm run package:win`
