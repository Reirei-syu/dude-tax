# 当前上下文摘要

## 当前阶段

- Execution

## 当前任务

- 系统维护模块结构调整与版本改名刷新修复已完成，当前待补桌面壳手工烟测

## 已完成

- 首页已移除“工作提醒”和“工作建议”卡片
- 首页已新增“政策口径”卡片，并提供“前往政策参考”入口
- 首页税率读取已跟随当前单位 / 年度作用域
- 已将 7 条默认扣除项说明及配图固化为 `apps/api/src/default-policy-content.json`
- 新数据库初始化时，“初始税率版本”会自动写入这 7 条默认内容
- API 构建产物会复制默认政策内容 JSON，打包后运行时仍可读取
- 系统维护页扣除项说明每个子卡片头部已新增“保存”按钮
- 子卡片头部按钮顺序已固定为“保存、删除、折叠”
- 子卡片里的“保存”只提交当前条目，其它说明项和税率草稿继续保留为本地未保存状态
- 当前子卡片内可直接看到该条目的保存成功 / 失败反馈
- 政策参考页扣除项说明中的缩略图支持点击查看原图
- 原图预览支持点击关闭按钮、点击遮罩和 `Esc` 键关闭
- 原图预览支持滚轮缩放、按钮缩放和重置
- 当图片放大后，按住鼠标左键可拖拽平移，光标表现为抓手 / 抓取中
- “保存扣除项说明”按钮右侧已补“新增说明条目”按钮
- 税率保存路由已放宽请求体与插图 `data URL` 长度限制，插图保存后可重新读取
- 扣除项说明卡片内已补可见的错误 / 成功提示，不再依赖折叠总览卡显示保存反馈
- 系统维护页“扣除项说明”中每个子说明条目已支持独立展开 / 折叠
- 子项默认展开，折叠后仅保留标题区与操作按钮
- 系统维护页“扣除项说明”新增删除条目按钮，删除前会弹出确认提示
- 删除说明条目只影响当前草稿，仍需点击“保存扣除项说明”后才会真正生效
- 删除后会自动重排 `sortOrder`，保持政策参考页顺序稳定
- 系统维护页已移除模块内“系统维护”总览卡，改为独立页头展示标题、当前房间、当前版本摘要、编辑状态与全局反馈
- 系统维护页已新增默认折叠的“税率维护”父卡，收纳“扣除项说明 / 基本减除费用 / 综合所得税率表 / 年终奖单独计税税率表”四张子卡
- 税率维护父卡展开后，四张子卡继续保留各自折叠行为；说明卡 / 基本减除费用维持全宽，两张税率表维持双列
- 税率版本改名成功后会显式重新拉取当前作用域配置，版本列表、当前版本名、作用域绑定名称与审计日志会一起刷新
- 本地 API 已补充 `PATCH` 的 CORS 放行，系统维护页版本改名不再因预检失败报 `Failed to fetch`
- 新增 `CollapsibleSectionCard` 共享组件，统一支持标题、描述、头部扩展区和折叠按钮
- 首页、单位管理、员工信息、月度数据录入、快速计算、结果确认、计算中心、历史查询、政策参考的顶层工作区卡片已按约定接入折叠能力
- 首页“当前税率表”、政策参考两张税率表、计算中心“员工计算准备状态”默认折叠
- 员工信息页与月度数据录入页的 `ImportWorkflowSection defaultCollapsed={true}` 保持不变
- 月度数据录入页 `isEmployeeListCollapsed` / `isResultListCollapsed` 保持原实现
- 系统维护页 `defaultCollapsedSections` 保持原实现
- 自动化验证通过：
  - `npm run test --workspace @dude-tax/api -- tax-policy.test.ts`
  - `node --import tsx --test src/cors.test.ts`（`apps/api`）
  - `npm run test --workspace @dude-tax/desktop -- maintenance-page.test.ts`
  - `npm run build --workspace @dude-tax/desktop`
  - `node --import tsx --test src/pages/home-page.test.ts`（`apps/desktop`）
  - `node --import tsx --test src/default-policy-content.test.ts`（`apps/api`）
  - `node --import tsx --test src/pages/current-policy-page.test.ts`（`apps/desktop`）
  - `node --import tsx --test src/policy-content.test.ts`（`apps/api`）
  - `node --import tsx --test src/pages/maintenance-page.test.ts`（`apps/desktop`）
  - `node --import tsx --test src/components/collapsible-section-card.test.ts src/pages/current-policy-page.test.ts src/pages/employee-management-page.test.ts src/pages/month-record-entry-page.test.ts src/pages/quick-calculate-page.test.ts src/pages/result-confirmation-page.test.ts src/pages/calculation-center-page.test.ts src/pages/unit-management-page.test.ts src/pages/home-page.test.ts src/pages/history-query-page.test.ts`（`apps/desktop`）
  - `npm run test --workspace @dude-tax/desktop`
  - `npm run test --workspace @dude-tax/api`
  - `npm run typecheck --workspace @dude-tax/api`
  - `npm run typecheck --workspace @dude-tax/desktop`
  - `npm run build --workspace @dude-tax/api`
  - `npm run build --workspace @dude-tax/desktop`

## 剩余任务

- 在 Windows / Electron 环境下补导入与系统维护主流程手工烟测
- 在 Windows / Electron 环境下逐页补工作区卡片折叠交互手工烟测

## 关键决策

- 首页不再承担提醒/建议分发职责，改为保留概览 + 政策入口 + 当前税率展示
- 新装用户默认看到的 7 条说明不再依赖当前 Electron 用户库，而是改为仓库内置种子
- 默认政策内容读取与数据库初始化共用同一份 JSON 资源
- 子卡片保存继续复用现有 `updateTaxPolicy`，但请求 payload 只合并当前条目，不提交其它未保存草稿
- 原图缩放和平移都在当前页面内的同一预览视口完成，不引入新窗口和新路由
- 政策参考页原图预览保持在当前页面内完成，不新开窗口、不跳出应用
- 插图保存回退的根因确认为税率保存路由的 `bodyLimit` 与 `illustrationDataUrl` 长度限制过小，不是前端草稿状态丢失
- 上传内容过大时前端统一转成中文错误提示，避免只显示 Fastify 原始英文报错
- 子说明项折叠只保存在前端页面内存中，不做持久化，不改 API
- 说明条目删除不新增单独 API，继续复用现有 `policyItems` 整体保存链路
- 删除动作先落在前端草稿，配合确认弹窗防止误删
- 工作区卡片统一折叠仅覆盖当前主界面顶层 `glass-card page-section` 卡片，不含模态框、卡片内部子卡和导入工作区内部三张子卡
- 统一折叠交互通过共享组件实现，避免在每个页面散落新的折叠状态
- 主操作类卡片默认展开；首页税率表、政策参考税率表、计算中心员工状态卡片按既定矩阵默认折叠
- 折叠内容区继续保留组件状态，但必须用显式 `[hidden]` 样式保证视觉隐藏
- 已有折叠实现保持原样，不改维护页、月度录入局部卡片和导入工作区的既有默认值与状态字段

## 当前问题

- 需要在桌面壳里确认首页精简后信息密度和政策口径入口是否符合预期
- 需要在真实安装包环境再补一次烟测，确认首次安装启动后“政策参考”和“系统维护”都能直接看到 7 条默认说明
- 新增统一折叠壳尚未在 Electron 桌面壳内逐页点按验证
- 系统维护子卡片单项保存尚未在 Electron 桌面壳内手工验证“只保存当前条目、不覆盖其它草稿”的行为
- 系统维护页新的“独立页头 + 税率维护父卡”组合尚未在 Electron 桌面壳内手工验证首屏密度、折叠状态与层级间距
- 税率版本改名修复尚未在 Electron 桌面壳内手工验证点击“保存名称”后多区域同步刷新
- 政策参考页原图预览尚未在 Electron 桌面壳内手工验证点击图片、缩放、拖拽、关闭按钮、遮罩关闭和 `Esc` 关闭
- 扣除项说明子项折叠尚未在 Electron 桌面壳内手工验证展开 / 收起按钮和折叠后布局
- 扣除项说明删除能力与插图保存修复尚未在 Electron 桌面壳内手工验证确认弹窗、保存反馈与模块切换后回读结果
- `vite build` 仍有 bundle 过大 warning，但本轮构建成功
- 当前工作树存在未提交的 API / 文档相关历史改动，本轮未介入这些逻辑

## 下一步计划

1. 在 Electron 桌面壳中逐页检查新接入的工作区卡片展开 / 折叠按钮、首屏默认状态和内容显示是否符合矩阵
2. 补做首页、员工信息、月度数据录入、系统维护、政策参考相关既有交互的桌面壳烟测，确认本轮页面层改造、初始 7 条默认说明、系统维护独立页头、税率维护父卡、子卡片单项保存、说明条目删除、子项折叠、版本改名刷新修复、插图保存修复以及原图预览缩放 / 拖拽都未误伤旧流程
3. 如桌面壳烟测通过，再决定是否继续做历史查询 / 结果中心组件级抽象统一
