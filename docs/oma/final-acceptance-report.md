# WorkOSNext 当前 OMA 最终验收报告

## 最终当前架构说明

WorkOSNext 已收敛为唯一当前 OMA 架构：主执行链是 Operations Runtime，主业务写路径是 `POST /api/operations/work-items/{workItemId}/confirm`。Projection、Lens、Search、Language 只作为读侧和体验侧内核；Control Plane 和 Management Cockpit 只能通过当前控制命令与只读治理面参与，不直接写业务事实。

当前一等目录边界：
- `services`: 只保留 `core-api`。
- `modules`: 只保留 `accommodation`、`finance-gate`、`identity`、`maintenance`。
- `packages`: 只保留 `surface-view-models`。
- `infra`: 只保留当前 Postgres、本地 compose、当前迁移链职责。
- `.github`: 只保留当前 OMA CI 和 PR 检查口径。

## 全项目文件职责和边界表

| 范围 | 当前职责 | 边界 |
| --- | --- | --- |
| `services/core-api` | API、Confirm Runtime、Unit of Work、权限、证据、审计、投影处理、迁移执行 | 不承载页面私有写入，不恢复旧写入口 |
| `modules/accommodation` | 住宿资源、线索预订、入住、退住、服务任务能力声明 | 只声明能力、规则、API、DB、测试和规则绑定 |
| `modules/finance-gate` | 收款、押金、支出、对账、纠错能力声明 | 钱和账只走 Finance/Money Kernel，不让业务页直接写账 |
| `modules/identity` | Account、User、Actor、Device、Session 和治理分配 | 登录页只收用户名密码，权限由治理面分配 |
| `modules/maintenance` | 清洁维修任务对象、分派、完成、验收、恢复可售 | 任务对象一次确定，后续只读承接 |
| `packages/surface-view-models` | 跨端只读视图模型 | 不写业务事实，不调用副作用 API |
| `docs/oma` | 唯一架构权威和验收报告 | 不保存历史归档语义 |
| `docs/contracts` | 当前合同事实来源 | 合同与脚本、测试、API 保持一致 |
| `scripts` | 当前 OMA 守卫、合同、业务规则、纯净度检查 | 不保留历史阶段脚本 |
| `infra/db/migrations` | 当前顺序迁移链 | 无重复迁移序号，无旧迁移命名 |

## 删除清单

已删除旧规则、旧工程说明、旧阶段文档、旧兼容合同、旧 Schema、旧脚本、旧工作流、旧测试产物、旧截图证据和旧报告产物。旧 `Workspace/Card` prepare/confirm 写入口保持删除，不恢复兼容层。

## 重写清单

重写了当前 OMA 架构文档、机器 manifest、系统地图、OMA 合同、体验合同、Surface 合同、CI、PR 模板、docker-compose、纯净度检查、规则权威检查、API 边界检查、Admission/Account/Search/Language 守卫、业务规则输出路径和控制面 runner 默认配置。

## 保留清单

保留并归入当前 OMA 的核心资产：`core-api`、Operations Runtime、Unit of Work、WorkItem Definition、Account Actor Kernel、Admission Kernel、Language Kernel、Search Kernel、Finance/Reconciliation/Correction、PC Governance、Mobile Surface、runtime/database/unit/e2e/policy tests。

## API 边界清单

业务写入只允许走当前分类 API：
- 主业务确认：`POST /api/operations/work-items/{workItemId}/confirm`
- 当前工作启动：`POST /api/operations/workspaces/start`
- 身份和设备：`/api/auth/*`、`/api/device-sessions*`
- 治理账号：`/api/pc-governance/account-*`
- 读侧：`/api/workspaces`、`/api/work-queue`、`/api/search`、`/api/lenses/*`
- 证据：`/api/evidence*`
- 财务对账和纠错：`/api/reconciliation/*`、`/api/correction-center/*`
- 控制面只读和治理：`/api/control-plane/*`
- 投影处理：`/api/projections/process-outbox`

## 数据库父子关系说明

`operations_cases` 是父级，`operations_work_items` 是子级；状态历史、分派、升级、提交、审计、证据、outbox、projection 关系围绕 `operation_case_id` 和 `work_item_id` 串接。迁移链已清理重复编号，并保留当前控制面、运行时、财务、投影和安全职责。

## 后端复用方法清单

当前复用核心包括：`CanonicalOperationsApiService`、`OperationsUnitOfWork`、`OperationsCaseStore`、`OperationsWorkItemStore`、`WorkItemDefinitionRegistryService`、`RuntimeActorAuthentication`、`AdmissionKernelService`、`SearchKernelService`、Evidence policy/evaluator、Finance policy/evaluator、ControlPlane read/write stores。

## 前端控件清单

当前前端统一使用：`fieldControls`、`optionSetContract`、`resourceScopeControls`、`bedLabelControls`、`OperationCardShell`、`BusinessSummaryHeader`、`BusinessTaskOverview`、`OperationStepRail`、`FieldSourceRenderer`、Action/Evidence/Device/Permission 状态组件、统一 i18n 字典和 Surface view model。

## 语言体系覆盖说明

语言内核覆盖 `zh-CN`、`ru-RU`、`ky-KG`，字段标签、错误、权限说明、搜索同义词和表面文案由合同和前端字典共同约束。`check-language-kernel` 已通过。

## 搜索体系覆盖说明

搜索内核合同化了 result type、字段、ranking、权限过滤和空状态。搜索只读，不写业务事实。`check-search-kernel` 已通过。

## 规则覆盖率报告

规则守卫已覆盖 OMA 纯净度、规则权威、API 边界、运行时写路径、Admission、Account Actor、Language、Search、Policy as Code、Experience Contract、Surface Contract、财务真相、领域包、共享治理、真相归属和宿舍 golden domain。`guard-architecture` 与 `clean-baseline` 均通过。

## 测试覆盖率报告

前端覆盖率：Statements 75.75%，Branches 62.15%，Functions 81.07%，Lines 79.75%。

后端覆盖率文件已生成：
- Unit tests: line 33.28%，branch 45.52%。
- Runtime integration tests: line 20.09%，branch 33.03%。
- Database security tests: line 0.58%，branch 0.49%。
- Policy tests: line 0.95%，branch 0.78%。
- Release control tests: line 0.00%，branch 0.00%。

测试结果：移动端 306 个单测通过，浏览器 5 个 e2e 通过；后端 Unit 224 个、Policy 4 个、Release 3 个、Database 9 个、Runtime Integration 55 个全部通过；Runtime Contract 通过。

## 远端分支处置建议

可吸收类：近期业务边界、输入交互、床位承接、线索预订和财务关联修复分支，只能按当前 OMA 重新实现或选择性吸收。

需要关闭类：历史阶段、证据堆叠、完成报告、旧控制面、旧体验分裂和旧基线类分支。

需要删除类：只包含历史产物、截图噪音、旧阶段报告或已被当前 OMA 合同覆盖的分支。

不得整分支合并；所有有效内容必须落入当前 OMA manifest 和合同边界。

## 为什么过去改来改去改不好

过去的问题不是单点 bug，而是事实来源过多：页面写路径、阶段规则、证据目录、旧合同、测试产物和临时报告互相牵制，导致每次修一个入口又被另一个旧入口带偏。

## 为什么现在这个方案不会继续偏

当前方案把目录、模块、服务、包、API、DB、规则、CI、语言、搜索、权限、证据和 Surface 都收敛到唯一 OMA manifest 与合同；纯净度检查会阻止旧阶段词、旧目录、旧工作流和旧产物重新进入项目。

## 最终验收结论

当前分支满足“纯净当前架构重建”的本地验收：当前 OMA 架构唯一，旧兼容和旧阶段噪音已删除或重写，服务/模块/包/infra/.github 已一等归类，关键守卫、构建、前端测试、浏览器测试、后端测试、数据库安全测试和运行时合同均通过。
