# 批量导入模块最小闭环方案

## 1. 背景
- 当前产品的大部分核心模块已经具备最小闭环，快速计算模块也已接通。
- 现在最明显的模块缺口是“批量导入”：前端仍是占位入口，后端没有导入路由，数据库没有导入暂存结构。
- 你已经把整体优先级调整为“先把模块搭起来、完成前后台数据勾连和模块联动，再做优化和边界收口”，因此批量导入需要进入当前主线。

## 2. 目标
- 为批量导入模块提供一个可运行、可验证、可回退的最小闭环。
- 首版支持两类导入：
  - 员工基础信息批量导入
  - 月度数据批量导入
- 首版必须具备：
  - 模板下载
  - 粘贴 / 上传 CSV
  - 字段校验
  - 预览
  - 冲突识别
  - 冲突处理
  - 导入回执

## 3. 设计方案
### 3.1 首版范围控制
- 首版只支持 `CSV`，不直接做 Excel 解析，避免把文件解析复杂度拉高。
- 首版支持两种导入模式：
  - `employee`
  - `month_record`
- 前端页面提供：
  - 下载模板按钮
  - 文本粘贴区 / 选择文件入口
  - 解析预览表
  - 冲突处理策略选择
  - 执行导入按钮

### 3.2 数据流
- `下载模板`
  - 后端返回 CSV 模板文本
- `上传或粘贴 CSV`
  - 前端读取文本，调用预览接口
- `预览`
  - 后端解析 CSV、校验字段、识别冲突，返回结构化预览
- `确认导入`
  - 前端带上冲突处理策略调用执行导入接口
  - 后端按策略逐条落库并返回结果回执

### 3.3 API 设计
- 新增：
  - `GET /api/import/templates/:importType`
  - `POST /api/import/preview`
  - `POST /api/import/commit`
- 其中：
  - `importType` 首版取值：
    - `employee`
    - `month_record`
- `POST /api/import/preview` 请求体：
  - `importType`
  - `csvText`
- `POST /api/import/commit` 请求体：
  - `importType`
  - `csvText`
  - `conflictStrategy`

### 3.4 冲突规则
- 员工基础信息导入：
  - 同单位下 `employeeCode` 冲突
  - 同单位下 `idNumber` 冲突
- 月度数据导入：
  - 同单位 / 同员工 / 同年度 / 同月份记录已存在
- 首版冲突处理策略：
  - `skip`
  - `overwrite`
  - `abort`

### 3.5 字段模板
- `employee` 模板列：
  - `employeeCode`
  - `employeeName`
  - `idNumber`
  - `hireDate`
  - `leaveDate`
  - `remark`
- `month_record` 模板列：
  - `employeeCode`
  - `taxYear`
  - `taxMonth`
  - `status`
  - `salaryIncome`
  - `annualBonus`
  - `pensionInsurance`
  - `medicalInsurance`
  - `occupationalAnnuity`
  - `housingFund`
  - `supplementaryHousingFund`
  - `unemploymentInsurance`
  - `workInjuryInsurance`
  - `withheldTax`
  - `infantCareDeduction`
  - `childEducationDeduction`
  - `continuingEducationDeduction`
  - `housingLoanInterestDeduction`
  - `housingRentDeduction`
  - `elderCareDeduction`
  - `otherDeduction`
  - `taxReductionExemption`
  - `remark`

### 3.6 数据库存储
- 首版不新增“导入任务表”或“导入暂存表”。
- 预览完全以内存结构处理。
- 执行导入时直接调用现有仓储：
  - 员工走 `employeeRepository`
  - 月度数据走 `monthRecordRepository`
- 这样可以先快速搭起模块，后续再决定是否补任务持久化和导入历史。

### 3.7 前端页面
- 新增真实页面 `ImportPage`
- 页面结构：
  - 导入类型切换
  - 模板下载区
  - CSV 粘贴 / 文件读取区
  - 预览结果区
  - 冲突策略选择
  - 导入结果回执区
- 首页和工作提醒中的“导入冲突待处理”后续可基于该模块联动，但首版不强绑首页统计。

## 4. 涉及模块
- `apps/api/src/routes/import.ts`
- `apps/api/src/services/import-service.ts`
- `apps/api/src/repositories/employee-repository.ts`
- `apps/api/src/repositories/month-record-repository.ts`
- `apps/api/src/server.ts`
- `apps/desktop/src/pages/ImportPage.tsx`
- `apps/desktop/src/api/client.ts`
- `apps/desktop/src/main.tsx`
- `packages/core/src/index.ts`

## 5. 数据结构变更
- 首版不新增数据库表。
- 若后续需要导入历史、回滚或异步导入，再新增：
  - `import_jobs`
  - `import_job_items`

## 6. 接口变更
- 新增：
  - `GET /api/import/templates/:importType`
  - `POST /api/import/preview`
  - `POST /api/import/commit`

## 7. 风险评估
- 风险 1：CSV 首版虽然实现快，但用户可能更期待 Excel 上传。
  - 首版可先用模板下载 + CSV 导入，后续再补 Excel 解析。
- 风险 2：预览不落库、也不存导入任务，刷新页面后预览状态会丢失。
  - 这是首版最小闭环接受的代价。
- 风险 3：如果直接复用现有仓储，错误粒度可能偏粗，需要补更细的导入回执结构。
- 风险 4：批量导入会明显扩大数据写入路径，若单位隔离或冲突判断不严，会直接伤到数据围栏。

## 8. 回退方案
- 若实现后风险过高，可回退到当前 `master`，恢复占位入口。
- 若仅执行导入风险过高，可保留模板下载和预览能力，暂时下线 `commit` 接口。
- 若 CSV 方案用户体验过差，可在后续改为“前端统一转 CSV 文本，后端仍只处理结构化文本”的折中模式。
