# 系统维护税率版本管理方案

## 1. 背景
- 当前系统维护只维护单一生效税率，数据保存在 `app_preferences.tax_policy_settings` 与 `app_preferences.tax_policy_maintenance_notes`。
- 当前结果失效已经基于 `policy_signature` 实现逻辑失效，不再物理删除结果；这为“税率版本切换”提供了可复用基础。
- 但当前仍无法回答三个实际问题：
  - 某次税率调整前后分别用了什么口径
  - 能否回切到历史税率版本
  - 回切后哪些结果可直接恢复为有效

## 2. 目标
- 为系统维护增加“税率版本管理”能力，支持保留历史版本、查看版本列表、切换当前生效版本。
- 保持现有 `policy_signature` 语义不变，让结果有效性继续通过“当前生效税率签名 vs 结果生成时签名”判断。
- 控制改动范围，不一次性做复杂审计、差异对比或多分支版本流。

## 3. 设计方案
### 3.1 数据存储
- 新增表 `tax_policy_versions`，作为税率版本主存储。
- 字段建议：
  - `id`
  - `version_name`
  - `policy_signature`
  - `settings_json`
  - `maintenance_notes`
  - `is_active`
  - `created_at`
  - `activated_at`
  - `updated_at`
- `policy_signature` 唯一，用于避免重复保存同一版本。
- `settings_json + maintenance_notes` 共同构成一个完整税率版本快照。

### 3.2 当前版本指针
- 仍保留 `app_preferences`，但不再存完整税率 JSON。
- 新增键：
  - `active_tax_policy_version_id`
- 当前生效税率由该指针指向 `tax_policy_versions.id`。
- 旧键 `tax_policy_settings`、`tax_policy_maintenance_notes` 仅用于迁移兼容，迁移完成后不再作为主读源。

### 3.3 迁移策略
- 启动时检查 `tax_policy_versions` 是否存在，不存在则建表。
- 若版本表为空：
  - 若旧 `app_preferences` 中已有税率配置，则将其回填为首个活动版本。
  - 若旧配置不存在，则将默认税率回填为首个活动版本。
- 同时写入 `active_tax_policy_version_id`。
- 迁移完成后，读取逻辑优先版本表；仅在极端异常时回退默认税率。

### 3.4 仓储层调整
- `taxPolicyRepository.get()`
  - 返回当前生效版本的 `currentSettings / currentNotes`
  - 额外返回版本列表摘要：
    - `id`
    - `versionName`
    - `policySignature`
    - `isActive`
    - `createdAt`
    - `activatedAt`
- `taxPolicyRepository.save(payload)`
  - 不再覆盖当前配置
  - 而是生成新版本，写入 `tax_policy_versions`
  - 若与当前活动版本完全一致，则 no-op
  - 新版本保存后自动切为活动版本
- 新增：
  - `taxPolicyRepository.activateVersion(versionId)`
  - 用于切换当前活动版本

### 3.5 API 设计
- 保留：
  - `GET /api/tax-policy`
  - `PUT /api/tax-policy`
- 新增：
  - `POST /api/tax-policy/versions/:versionId/activate`
- `GET /api/tax-policy`
  - 返回当前税率、默认税率、说明文本、版本列表
- `PUT /api/tax-policy`
  - 表示“保存为新税率版本并激活”
- `POST /api/tax-policy/versions/:versionId/activate`
  - 表示“切换到历史税率版本”

### 3.6 与结果失效的关系
- 继续沿用现有 `policy_signature` 机制。
- 保存新版本或切换历史版本时：
  - 不删除 `annual_tax_results`
  - 不删除 `annual_calculation_runs`
  - 当前有效结果仍由签名匹配决定
- 这意味着：
  - 切到新税率时，旧签名结果自然失效
  - 回切旧税率时，签名一致的旧结果可自然恢复为有效
- 前提是员工月度数据未发生变化；若发生变化，现有月度录入链路已会删除对应结果，因此不会出现“错误恢复旧结果”的问题。

### 3.7 前端系统维护页
- 当前页先扩展为三块：
  - 当前活动税率编辑区
  - 保存校验与说明区
  - 税率版本列表区
- 版本列表首版支持：
  - 查看版本名
  - 查看创建时间 / 启用时间
  - 标识当前活动版本
  - 激活历史版本
- 首版不做：
  - 版本差异对比
  - 删除版本
  - 编辑历史版本
  - 审批流

### 3.8 版本命名策略
- 首版采用系统自动命名，格式建议：
  - `税率版本 YYYY-MM-DD HH:mm`
- 不要求用户手工输入版本名，避免增加交互负担。
- 后续若需要人工命名，可在现有字段上扩展。

## 4. 涉及模块
- `apps/api/src/db/database.ts`
  - 新增 `tax_policy_versions`
  - 增加迁移与回填逻辑
- `apps/api/src/repositories/tax-policy-repository.ts`
  - 版本化读写与激活逻辑
- `apps/api/src/routes/tax-policy.ts`
  - 新增版本激活接口
- `apps/api/src/tax-policy.test.ts`
  - 增加版本保存、版本激活、迁移兼容测试
- `apps/desktop/src/pages/MaintenancePage.tsx`
  - 增加版本列表与激活交互
- `packages/core`
  - 现有 `buildTaxPolicySignature` 继续复用，无需大改

## 5. 数据结构变更
- 新增表：
  - `tax_policy_versions`
- 新增偏好键：
  - `active_tax_policy_version_id`
- 旧偏好键：
  - `tax_policy_settings`
  - `tax_policy_maintenance_notes`
- 旧键后续作为迁移来源，不再作为主存储。

## 6. 接口变更
- 变更：
  - `GET /api/tax-policy` 返回体增加版本列表摘要和当前版本元信息
- 保持：
  - `PUT /api/tax-policy`
- 新增：
  - `POST /api/tax-policy/versions/:versionId/activate`

## 7. 风险评估
- 风险 1：数据库迁移复杂度提升。
  - 原因：要从 `app_preferences` 单值模式迁移到版本表 + 活动指针模式。
- 风险 2：切换历史版本后，结果中心和历史查询会立即切换“当前有效结果”集合。
  - 原因：`policy_signature` 是全局有效性判据。
- 风险 3：若版本命名、版本列表信息不足，用户可能无法判断该激活哪个历史版本。
  - 首版先用时间命名，后续再考虑手工命名和版本差异展示。
- 风险 4：若后续要做“按单位 / 年度范围失效”，当前全局版本切换模型还需要继续细化。

## 8. 回退方案
- 若版本化实现不稳定，可回退到当前 `master`，恢复“单一生效税率 + 当前签名判断”的模式。
- 若迁移失败，可临时保留版本表但继续读取 `app_preferences` 作为主读源，待数据修复后再切换。
- 若前端版本列表交互风险过高，可先只在后端落版本化存储，前端继续保留当前编辑页，延后开放版本激活。
