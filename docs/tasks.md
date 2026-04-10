# 项目任务列表

## 当前阶段

- Execution

## 任务列表

### [x] 首页精简并新增政策口径卡片

- 类型：Fix
- 模块：`apps/desktop`
- 描述：移除首页中的“工作提醒”和“工作建议”卡片，新增“政策口径”卡片并提供跳转到政策参考模块的入口。
- 依赖：初始税率版本内置 7 条默认扣除项说明已完成
- 风险：低
- 优先级：4
- 完成时间：2026-04-10
- 修改文件：
  - `apps/desktop/src/pages/HomePage.tsx`
  - `apps/desktop/src/pages/home-page.test.ts`
  - `docs/tasks.md`
  - `PROGRESS.md`
  - `docs/context/latest_context.md`
- 影响范围：
  - 首页删除“工作提醒”和“工作建议”两张卡片
  - 首页新增“政策口径”卡片，并提供“前往政策参考”入口
  - 首页税率加载改为跟随当前单位 / 年度作用域

### [x] 初始税率版本内置 7 条默认扣除项说明

- 类型：Feature
- 模块：`apps/api`
- 描述：将当前 Electron 用户库中的 7 条扣除项说明及配图固化为初始税率版本默认内容，保证新安装用户首次使用即可直接看到。
- 依赖：系统维护说明子卡片补保存入口并调整头部按钮顺序已完成
- 风险：中
- 优先级：2
- 完成时间：2026-04-10
- 修改文件：
  - `apps/api/src/default-policy-content.json`
  - `apps/api/src/default-policy-content.ts`
  - `apps/api/src/default-policy-content.test.ts`
  - `apps/api/src/db/database.ts`
  - `apps/api/src/repositories/tax-policy-repository.ts`
  - `apps/api/build.mjs`
  - `docs/tasks.md`
  - `PROGRESS.md`
  - `docs/context/latest_context.md`
- 影响范围：
  - 新库初始化时“初始税率版本”自动带出 7 条默认扣除项说明
  - API 默认内容和数据库初始化来源统一，不再依赖当前机器用户库
  - API 构建产物会复制默认政策内容 JSON，打包后仍可读取

### [x] 系统维护说明子卡片补保存入口并调整头部按钮顺序

- 类型：Fix
- 模块：`apps/desktop`
- 描述：在系统维护页“扣除项说明”的每个子卡片头部补充单项保存按钮，并将按钮顺序固定为“保存、删除、折叠”。
- 依赖：政策参考原图预览支持缩放与抓手平移已完成
- 风险：中
- 优先级：4
- 完成时间：2026-04-10
- 修改文件：
  - `apps/desktop/src/pages/MaintenancePage.tsx`
  - `apps/desktop/src/pages/maintenance-page.test.ts`
  - `docs/tasks.md`
  - `PROGRESS.md`
  - `docs/context/latest_context.md`
- 影响范围：
  - 子卡片头部按钮顺序固定为“保存、删除、折叠”
  - 子卡片里的“保存”仅保存当前条目，不提交其它说明项或税率草稿
  - 当前条目的成功 / 失败反馈在本卡片内可见

### [x] 政策参考原图预览支持缩放与抓手平移

- 类型：Fix
- 模块：`apps/desktop`
- 描述：在政策参考模块的原图预览层中，补充缩放、重置和鼠标左键拖拽平移能力。
- 依赖：政策参考扣除项说明支持点击图片查看原图已完成
- 风险：低
- 优先级：4
- 完成时间：2026-04-10
- 修改文件：
  - `apps/desktop/src/pages/CurrentPolicyPage.tsx`
  - `apps/desktop/src/pages/current-policy-page.test.ts`
  - `apps/desktop/src/styles.css`
  - `docs/tasks.md`
  - `PROGRESS.md`
  - `docs/context/latest_context.md`
- 影响范围：
  - 原图预览层支持滚轮缩放、按钮缩放和重置
  - 当图片放大后，按住鼠标左键可拖拽平移，光标表现为抓手 / 抓取中
  - 不改变政策参考页缩略图入口和关闭行为

### [x] 政策参考扣除项说明支持点击图片查看原图

- 类型：Fix
- 模块：`apps/desktop`
- 描述：在政策参考模块的“扣除项说明”中，为插图提供点击查看原图的页内预览能力。
- 依赖：系统维护扣除项说明补底部新增按钮并修复插图保存回退已完成
- 风险：低
- 优先级：4
- 完成时间：2026-04-10
- 修改文件：
  - `apps/desktop/src/pages/CurrentPolicyPage.tsx`
  - `apps/desktop/src/pages/current-policy-page.test.ts`
  - `apps/desktop/src/styles.css`
  - `docs/tasks.md`
  - `PROGRESS.md`
  - `docs/context/latest_context.md`
- 影响范围：
  - 扣除项说明中的图片缩略图支持点击打开原图预览
  - 原图预览支持点击关闭按钮、点击遮罩和 `Esc` 键关闭
  - 不改变政策参考页正文和条目展示逻辑

### [x] 系统维护扣除项说明补底部新增按钮并修复插图保存回退

- 类型：Fix
- 模块：`apps/desktop` / `apps/api`
- 描述：在系统维护页“保存扣除项说明”按钮旁补充“新增说明条目”按钮，并修复上传插图后保存看似成功但切换模块后恢复旧状态的问题。
- 依赖：系统维护扣除项说明子项支持折叠已完成
- 风险：中
- 优先级：3
- 完成时间：2026-04-10
- 修改文件：
  - `apps/desktop/src/pages/MaintenancePage.tsx`
  - `apps/desktop/src/pages/maintenance-page.test.ts`
  - `apps/desktop/src/api/client.ts`
  - `apps/api/src/routes/tax-policy.ts`
  - `apps/api/src/policy-content.test.ts`
  - `docs/tasks.md`
  - `PROGRESS.md`
  - `docs/context/latest_context.md`
- 影响范围：
  - 扣除项说明卡片底部保存区新增快捷“新增说明条目”按钮
  - 税率保存路由允许更大的插图 `data URL` 请求体与字段长度
  - 上传内容过大时前端错误提示改为中文，且当前卡片内可见
  - 大图插图保存后重新进入模块可正确回读

### [x] 系统维护扣除项说明子项支持折叠

- 类型：Fix
- 模块：`apps/desktop`
- 描述：为系统维护页“扣除项说明”中的每个子说明条目补充独立折叠能力，支持单条展开 / 收起。
- 依赖：系统维护扣除项说明支持删除条目已完成
- 风险：低
- 优先级：4
- 完成时间：2026-04-10
- 修改文件：
  - `apps/desktop/src/pages/MaintenancePage.tsx`
  - `apps/desktop/src/pages/maintenance-page.test.ts`
  - `docs/tasks.md`
  - `PROGRESS.md`
  - `docs/context/latest_context.md`
- 影响范围：
  - 每个说明条目头部新增“折叠说明条目 / 展开说明条目”按钮
  - 子项默认展开，折叠后仅保留条目头部
  - 不改变现有保存链路和条目删除能力

### [x] 系统维护扣除项说明支持删除条目

- 类型：Fix
- 模块：`apps/desktop`
- 描述：在系统维护页“扣除项说明”功能中补充说明条目删除能力，允许用户删除单条说明后再统一保存。
- 依赖：系统维护与政策参考多条说明条目改造已完成
- 风险：低
- 优先级：4
- 完成时间：2026-04-10
- 修改文件：
  - `apps/desktop/src/pages/MaintenancePage.tsx`
  - `apps/desktop/src/pages/maintenance-page.test.ts`
  - `docs/tasks.md`
  - `PROGRESS.md`
  - `docs/context/latest_context.md`
- 影响范围：
  - 系统维护页说明条目卡片新增“删除说明条目”按钮
  - 删除只影响当前草稿，仍需点击“保存扣除项说明”后才会真正生效
  - 条目删除后会自动重排 `sortOrder`

### [x] 工作区卡片统一折叠支持

- 类型：Feature
- 模块：`apps/desktop`
- 描述：新增共享折叠卡片组件，为当前活路由页面的顶层工作区卡片补统一折叠能力，并保持已有折叠实现不变。
- 依赖：现有导入工作区折叠与系统维护页折叠优化已完成
- 风险：中
- 优先级：4
- 完成时间：2026-04-10
- 修改文件：
  - `apps/desktop/src/components/CollapsibleSectionCard.tsx`
  - `apps/desktop/src/components/collapsible-section-card.test.ts`
  - `apps/desktop/src/pages/HomePage.tsx`
  - `apps/desktop/src/pages/home-page.test.ts`
  - `apps/desktop/src/pages/UnitManagementPage.tsx`
  - `apps/desktop/src/pages/unit-management-page.test.ts`
  - `apps/desktop/src/pages/EmployeeManagementPage.tsx`
  - `apps/desktop/src/pages/employee-management-page.test.ts`
  - `apps/desktop/src/pages/MonthRecordEntryPage.tsx`
  - `apps/desktop/src/pages/month-record-entry-page.test.ts`
  - `apps/desktop/src/pages/QuickCalculatePage.tsx`
  - `apps/desktop/src/pages/quick-calculate-page.test.ts`
  - `apps/desktop/src/pages/ResultConfirmationPage.tsx`
  - `apps/desktop/src/pages/result-confirmation-page.test.ts`
  - `apps/desktop/src/pages/CalculationCenterPage.tsx`
  - `apps/desktop/src/pages/calculation-center-page.test.ts`
  - `apps/desktop/src/pages/CurrentPolicyPage.tsx`
  - `apps/desktop/src/pages/current-policy-page.test.ts`
  - `apps/desktop/src/pages/HistoryQueryPage.tsx`
  - `apps/desktop/src/pages/history-query-page.test.ts`
  - `apps/desktop/src/styles.css`
  - `docs/plans/2026-04-10_workspace-card-collapse_plan.md`
- 影响范围：
  - 当前活路由页面的顶层工作区卡片统一获得展开 / 折叠入口
  - 首页税率表、政策参考税率表、计算中心员工状态卡片等按约定默认收起
  - 系统维护页、月度数据录入页既有折叠逻辑和导入工作区默认折叠保持不变

### [x] 扣除项说明卡片补保存入口

- 类型：Fix
- 模块：`apps/desktop`
- 描述：在系统维护页“扣除项说明”卡片内补充显式保存按钮，避免用户新增或编辑说明条目后需要切换到其他折叠卡片中寻找保存入口。
- 依赖：系统维护模块折叠、作用域保存与版本命名优化已完成
- 风险：低
- 优先级：4
- 完成时间：2026-04-10
- 修改文件：
  - `apps/desktop/src/pages/MaintenancePage.tsx`
  - `apps/desktop/src/pages/maintenance-page.test.ts`
- 影响范围：
  - 扣除项说明卡片内可直接保存当前说明改动
  - 用户新增第 2 条说明后无需切换卡片即可完成保存

### [x] 系统维护模块折叠、作用域保存与版本命名优化

- 类型：Feature
- 模块：`packages/core` / `apps/api` / `apps/desktop`
- 描述：修复系统维护页在当前作用域下保存政策说明的落库行为，为系统维护全部卡片增加默认折叠，优化税率表自适应宽度，并支持税率版本行内改名。
- 依赖：系统维护与政策参考多条说明条目改造已完成
- 风险：高
- 优先级：3
- 完成时间：2026-04-10
- 修改文件：
  - `packages/core/src/index.ts`
  - `apps/api/src/routes/tax-policy.ts`
  - `apps/api/src/repositories/tax-policy-repository.ts`
  - `apps/api/src/policy-content.test.ts`
  - `apps/api/src/tax-policy.test.ts`
  - `apps/desktop/src/api/client.ts`
  - `apps/desktop/src/pages/MaintenancePage.tsx`
  - `apps/desktop/src/pages/maintenance-page.test.ts`
  - `apps/desktop/src/styles.css`
  - `docs/plans/2026-04-10_maintenance-scope-save-collapse-rename_plan.md`
- 影响范围：
  - 当前作用域已绑定版本时，政策说明保存会更新绑定版本而非全局活动版本
  - 系统维护页所有卡片支持默认折叠
  - 扣除项说明与基本减除费用改为上下结构
  - 税率表输入区域在非全屏下自适应卡片宽度
  - 税率版本支持行内编辑名称并使用本地时间展示

### [x] 系统维护模块折叠与版本名优化

- 类型：Feature
- 模块：`apps/api` / `apps/desktop`
- 描述：为系统维护模块所有卡片增加默认折叠能力，修正非全屏下税率表输入容器溢出，并支持保存税率时使用自定义版本名称。
- 依赖：系统维护与政策参考多条说明条目改造已完成
- 风险：中
- 优先级：3
- 完成时间：2026-04-10
- 修改文件：
  - `packages/core/src/index.ts`
  - `apps/api/src/routes/tax-policy.ts`
  - `apps/api/src/repositories/tax-policy-repository.ts`
  - `apps/api/src/tax-policy.test.ts`
  - `apps/desktop/src/pages/MaintenancePage.tsx`
  - `apps/desktop/src/pages/maintenance-page.test.ts`
  - `apps/desktop/src/styles.css`
- 影响范围：
  - 系统维护页所有卡片支持默认折叠和展开
  - 税率表输入区域改为卡片内自适应宽度
  - 保存税率时可指定自定义版本名称并写入版本列表

### [x] 系统维护与政策参考多条说明条目改造

- 类型：Feature
- 模块：`packages/core` / `apps/api` / `apps/desktop`
- 描述：将系统维护模块中的单条“扣除项说明”升级为可新增、可编辑的多条说明条目，并同步到政策参考模块展示。
- 依赖：系统维护模块最小闭环已完成
- 风险：高
- 优先级：3
- 完成时间：2026-04-10
- 修改文件：
  - `packages/core/src/index.ts`
  - `apps/api/src/routes/tax-policy.ts`
  - `apps/api/src/repositories/tax-policy-repository.ts`
  - `apps/api/src/policy-content.test.ts`
  - `apps/api/src/services/year-entry-service.ts`
  - `apps/desktop/src/pages/MaintenancePage.tsx`
  - `apps/desktop/src/pages/CurrentPolicyPage.tsx`
  - `apps/desktop/src/pages/tax-policy-validation.ts`
  - `apps/desktop/src/pages/tax-policy-validation.test.ts`
  - `apps/desktop/src/pages/maintenance-page.test.ts`
  - `apps/desktop/src/pages/current-policy-page.test.ts`
  - `apps/desktop/src/styles.css`
  - `docs/plans/2026-04-10_policy-reference-multi-items_plan.md`
- 影响范围：
  - 系统维护模块支持新增并维护多条政策说明条目
  - 政策参考模块改为按条目列表展示说明
  - 旧单条说明结构与纯文本说明可兼容读取

### [x] 员工批量导入工作区默认折叠优化

- 类型：Fix
- 模块：`apps/desktop`
- 描述：将员工信息页中的“员工批量导入 / 导入预览 / 导入回执”归入专门的批量导入工作区，并在首次进入页面时默认折叠。
- 依赖：批量导入并入员工信息与月度数据录入已完成
- 风险：低
- 优先级：4
- 完成时间：2026-04-10
- 修改文件：
  - `apps/desktop/src/pages/EmployeeManagementPage.tsx`
  - `apps/desktop/src/pages/employee-management-page.test.ts`
- 影响范围：
  - 员工信息页批量导入能力统一归入专门工作区
  - 工作区默认折叠，展开后保留原有模板下载、导入预览与导入回执流程

### [x] 快速计算编辑按钮强化

- 类型：Fix
- 模块：`apps/desktop`
- 描述：提高快速计算页“编辑”按钮的视觉权重，让入口更大、更显眼。
- 依赖：月度数据录入模块年度化计算改造已完成
- 风险：低
- 优先级：4
- 完成时间：2026-04-10
- 修改文件：
  - `apps/desktop/src/pages/QuickCalculatePage.tsx`
  - `apps/desktop/src/pages/quick-calculate-page.test.ts`
  - `apps/desktop/src/styles.css`
- 影响范围：
  - 快速计算页案例列表中的“编辑”按钮升级为更醒目的主按钮样式
  - 保持其他模块编辑按钮样式不受影响

### [x] 系统维护审计日志动作中文化

- 类型：Fix
- 模块：`apps/desktop`
- 描述：将系统维护页审计日志中的机器动作枚举映射为中文标签，避免用户看到脏文本。
- 依赖：系统维护模块最小闭环已完成
- 风险：低
- 优先级：4
- 完成时间：2026-04-10
- 修改文件：
  - `apps/desktop/src/pages/MaintenancePage.tsx`
  - `apps/desktop/src/pages/maintenance-page.test.ts`
- 影响范围：
  - 审计日志“操作”列改为中文标签展示
  - 保留未知动作码兜底回退到原始值

### [x] 修复月度批量导入工作区折叠样式失效

- 类型：Fix
- 模块：`apps/desktop`
- 描述：修复月度批量导入工作区在默认折叠状态下仍然显示内容的问题，确保折叠视觉与状态一致。
- 依赖：月度批量导入工作区默认折叠优化已完成
- 风险：低
- 优先级：4
- 完成时间：2026-04-09
- 修改文件：
  - `apps/desktop/src/styles.css`
  - `apps/desktop/src/components/import-workflow-section.test.ts`
- 影响范围：
  - 补齐折叠内容区的显式隐藏样式
  - 新增回归测试覆盖 `hidden` 与样式联动

### [x] 月度批量导入工作区默认折叠优化

- 类型：Fix
- 模块：`apps/desktop`
- 描述：将月度数据页中的“月度数据批量导入 / 导入预览 / 导入回执”归入专门的批量导入工作区，并在首次进入页面时默认折叠。
- 依赖：批量导入并入员工信息与月度数据录入已完成
- 风险：低
- 优先级：4
- 完成时间：2026-04-09
- 修改文件：
  - `apps/desktop/src/components/ImportWorkflowSection.tsx`
  - `apps/desktop/src/pages/MonthRecordEntryPage.tsx`
  - `apps/desktop/src/pages/month-record-entry-page.test.ts`
  - `apps/desktop/src/styles.css`
- 影响范围：
  - 月度数据页批量导入能力统一归入专门工作区
  - 工作区默认折叠，展开后保留原有模板下载、导入预览与导入回执流程
  - 员工信息页导入区块不受影响

### [x] 系统维护模块结构调整与版本改名刷新修复

- 类型：Fix
- 模块：`apps/desktop` / `apps/api`
- 描述：移除系统维护页内部“系统维护”总览卡，新增默认折叠的“税率维护”父卡，并修复税率版本改名后界面未立即同步的问题。
- 依赖：系统维护模块折叠、作用域保存与版本命名优化已完成
- 风险：中
- 优先级：3
- 完成时间：2026-04-10
- 修改文件：
  - `apps/desktop/src/pages/MaintenancePage.tsx`
  - `apps/desktop/src/pages/maintenance-page.test.ts`
  - `apps/desktop/src/styles.css`
  - `apps/api/src/tax-policy.test.ts`
  - `docs/tasks.md`
  - `PROGRESS.md`
  - `docs/context/latest_context.md`
- 影响范围：
  - 系统维护页标题、当前房间、编辑状态与全局反馈改为独立页头，不再放在可折叠卡片内
  - “扣除项说明 / 基本减除费用 / 综合所得税率表 / 年终奖单独计税税率表”收纳到默认折叠的“税率维护”父卡内
  - 四张子卡继续保留各自折叠行为；说明卡与基本减除费用维持全宽，两张税率表维持双列
  - 税率版本改名后会重新拉取当前作用域配置，确保版本列表、当前版本、作用域绑定与审计日志同步刷新
  - 新增桌面页结构断言与带作用域参数的税率版本改名回归测试

### [ ] Windows / Electron 手工烟测导入与系统维护主流程

- 类型：Test
- 模块：`apps/desktop`
- 描述：手工检查员工信息页和月度数据录入页的页内导入链路，以及系统维护页的默认折叠、作用域保存、多条政策说明、自定义版本名称、版本改名和税率表宽度表现。
- 依赖：批量导入并入员工信息与月度数据录入已完成
- 风险：中
- 优先级：4

### [ ] Windows / Electron 手工烟测工作区卡片折叠交互

- 类型：Test
- 模块：`apps/desktop`
- 描述：手工检查首页、单位管理、员工信息、月度数据录入、快速计算、结果确认、计算中心、历史查询、政策参考的顶层工作区卡片折叠交互，确认新增折叠壳和已有折叠壳在 Electron 桌面壳内表现正常。
- 依赖：工作区卡片统一折叠支持已完成
- 风险：中
- 优先级：4

### [x] 批量导入并入员工信息与月度数据录入

- 完成时间：2026-04-09
- 修改文件：
  - `packages/config/src/index.ts`
  - `packages/core/src/index.ts`
  - `apps/api/src/services/import-service.ts`
  - `apps/api/src/import-template.test.ts`
  - `apps/api/src/import.test.ts`
  - `apps/desktop/src/main.tsx`
  - `apps/desktop/src/components/ImportWorkflowSection.tsx`
  - `apps/desktop/src/pages/EmployeeManagementPage.tsx`
  - `apps/desktop/src/pages/MonthRecordEntryPage.tsx`
  - `apps/desktop/src/pages/HomePage.tsx`
  - `apps/desktop/src/pages/home-suggestions.ts`
  - `apps/desktop/src/pages/import-file-parser.ts`
  - `apps/desktop/src/pages/import-template.ts`
- 影响范围：
  - 取消独立批量导入导航与路由
  - 员工导入并入员工信息页
  - 月度导入并入月度数据录入页
  - 月度导入支持缺失行自动补零
  - 月度录入导出迁移到计算结果汇总卡片

### [x] 月度数据录入模块年度化计算改造

- 完成时间：2026-04-09
- 修改文件：
  - `packages/core/src/index.ts`
  - `apps/api/src/repositories/annual-tax-result-repository.ts`
  - `apps/api/src/routes/year-entry.ts`
  - `apps/api/src/services/year-entry-service.ts`
  - `apps/api/src/year-entry.test.ts`
  - `apps/desktop/src/api/client.ts`
  - `apps/desktop/src/components/AnnualTaxCalculationResultPanel.tsx`
  - `apps/desktop/src/components/AnnualTaxResultDialog.tsx`
  - `apps/desktop/src/components/YearEntryEmployeeSelectionDialog.tsx`
  - `apps/desktop/src/pages/MonthRecordEntryPage.tsx`
  - `apps/desktop/src/pages/QuickCalculatePage.tsx`
  - `apps/desktop/src/pages/ResultConfirmationPage.tsx`
  - `apps/desktop/src/styles.css`
- 影响范围：
  - 月度录入改为全年员工名单 + 结果汇总双区块
  - 新增年度录入批量计算接口与结果覆盖校验
  - 结果确认页改读当前待确认结果

### [x] 录入模型精简优化

- 完成时间：2026-04-09
- 修改文件：
  - `packages/core/src/index.ts`
  - `packages/core/src/annual-tax-calculator.ts`
  - `packages/core/src/month-record-data-signature.ts`
  - `apps/api/src/repositories/month-record-repository.ts`
  - `apps/api/src/services/annual-tax-service.ts`
  - `apps/api/src/services/year-entry-service.ts`
  - `apps/api/src/routes/month-records.ts`
  - `apps/api/src/routes/year-entry.ts`
  - `apps/api/src/routes/calculations.ts`
  - `apps/api/src/services/import-service.ts`
  - `apps/desktop/src/components/YearRecordWorkspaceDialog.tsx`
  - `apps/desktop/src/pages/year-record-workspace.ts`
  - `apps/desktop/src/pages/year-record-export.ts`
  - `apps/desktop/src/pages/MonthRecordEntryPage.tsx`
  - `apps/desktop/src/pages/QuickCalculatePage.tsx`
  - `apps/desktop/src/pages/ResultConfirmationPage.tsx`
  - `apps/desktop/src/pages/HistoryQueryPage.tsx`
- 影响范围：
  - 其他收入替代补发收入
  - 记录状态退出主流程
  - 减除费用改为工作台只读预填
  - 已确认空白月按零值月参与计算
