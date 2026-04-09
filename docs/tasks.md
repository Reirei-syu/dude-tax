# 项目任务列表

## 当前阶段

- Execution

## 任务列表

### [ ] 全路由人工冒烟检查剩余乱码与样式一致性

- 类型：Fix / Docs
- 模块：`apps/desktop`
- 描述：补做结果中心、历史查询、快速计算等页面的人工逐页检查，确认运行时文案、状态说明和导出相关提示无乱码、无遮挡、无明显布局回退。
- 依赖：本轮系统维护、年份体系、月度录入和当前政策改造已完成
- 风险：中
- 优先级：4

### [x] 建立单位级年份体系并接入上下文

- 完成时间：2026-04-08
- 修改文件：
  - `apps/api/src/db/database.ts`
  - `apps/api/src/repositories/unit-repository.ts`
  - `apps/api/src/repositories/context-repository.ts`
  - `apps/api/src/routes/units.ts`
  - `apps/api/src/routes/context.ts`
  - `apps/desktop/src/components/AppLayout.tsx`
  - `apps/desktop/src/pages/UnitManagementPage.tsx`
- 影响范围：
  - 新增 `unit_years` 表
  - 新建单位支持起始年份
  - 顶部年份选择器只显示当前单位已有年份
  - 支持新增 / 删除无数据年份

### [x] 新增员工状态语义并联动月度录入

- 完成时间：2026-04-08
- 修改文件：
  - `packages/core/src/employee-status.ts`
  - `packages/core/src/index.ts`
  - `apps/desktop/src/pages/EmployeeManagementPage.tsx`
  - `apps/desktop/src/pages/month-record-employee-filter.ts`
  - `apps/desktop/src/pages/MonthRecordEntryPage.tsx`
- 影响范围：
  - 员工管理页显示“在职 / 离职”
  - 月度录入页按所选月份隐藏已离职员工
  - 离职当月仍可录入

### [x] 重构月度录入页布局与样式

- 完成时间：2026-04-08
- 修改文件：
  - `apps/desktop/src/pages/MonthRecordEntryPage.tsx`
  - `apps/desktop/src/styles.css`
- 影响范围：
  - 月份按钮顶置
  - 取消季度容器
  - 新增当前月摘要
  - 页面专属尺寸缩小约 20%

### [x] 改造批量导入模板下载与中文模板解析

- 完成时间：2026-04-08
- 修改文件：
  - `apps/api/src/services/import-service.ts`
  - `apps/api/src/routes/import.ts`
  - `apps/desktop/src/pages/ImportPage.tsx`
  - `apps/desktop/src/pages/import-preview-details.ts`
- 影响范围：
  - 模板改为真实文件下载
  - 模板表头为简体中文
  - 继续兼容旧英文模板

### [x] 新增当前政策模块并升级系统维护说明结构

- 完成时间：2026-04-08
- 修改文件：
  - `apps/api/src/repositories/tax-policy-repository.ts`
  - `apps/api/src/routes/tax-policy.ts`
  - `apps/desktop/src/pages/MaintenancePage.tsx`
  - `apps/desktop/src/pages/CurrentPolicyPage.tsx`
  - `apps/desktop/src/main.tsx`
  - `packages/config/src/index.ts`
- 影响范围：
  - 当前政策新增独立页面
  - 系统维护支持标题 / 正文 / 插图
  - 导航顺序调整为“历史查询 -> 当前政策 -> 系统维护”
