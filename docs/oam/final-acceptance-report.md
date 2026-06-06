# WorkOSNext 当前 OAM 最终验收报告

> 职责边界：本文是人工可读的验收快照，不是当前 GO/NO_GO 的机器权威。当前裁决以 `artifacts/oam/final-report.json`、`artifacts/oam/evidence/evidence-graph.json` 和 `scripts/oam/check-current-evidence-root.mjs` 为准；若本文与机器证据根冲突，机器证据根优先。

## 最终当前架构说明

WorkOSNext 已收敛为唯一当前 OAM 架构：主执行链是 Operations Runtime，主业务写路径是 `POST /api/operations/work-items/{workItemId}/confirm`。Projection、Lens、Search、Language 只作为读侧和体验侧内核；Control Plane 和 Management Cockpit 只能通过当前控制命令与只读治理面参与，不直接写业务事实。

当前一等目录边界：
- `services`: 只保留 `core-api`。
- `modules`: 只保留 `accommodation`、`finance-gate`、`identity`、`maintenance`。
- `packages`: 只保留 `surface-view-models`。
- `infra`: 只保留当前 Postgres、本地 compose、当前迁移链职责。
- `.github`: 只保留当前 OAM CI 和 PR 检查口径。

## 本次审查修复覆盖

本次硬收口覆盖并复验了以下合并阻断点：PC 测试已纳入独立 CI 入口，合同本地路径引用已由当前引用完整性检查保护，旧入口、旧阶段词和旧运行体系字段由 OAM 纯净度检查阻断，已删除 artifact 引用已改为当前证据目录或当前生成命令，Control Plane runner 的 `script`、`checkRef`、`evidenceRef` 均指向真实存在或当前运行时生成的路径。

## 当前 OAM v2 定稿补充

本轮 v2 硬闭环新增机器权威和检查入口：

- 权威索引：`docs/oam/current-authority-index.json`，由 `scripts/oam/check-current-authority-index.mjs` 验收。
- 职责边界矩阵：`docs/contracts/oam-responsibility-boundary-matrix.json`，由 `scripts/oam/check-oam-responsibility-boundary-matrix.mjs` 验收。
- 业务对象字段总表：`docs/contracts/business/oam-business-object-field-registry.json`，由 `scripts/oam/check-business-object-field-registry.mjs` 验收。
- WorkItem 流程状态总表：`docs/contracts/business/oam-workflow-state-registry.json`，由 `scripts/oam/check-workflow-state-registry.mjs` 验收。
- 数据库归属图：`docs/contracts/database/oam-db-ownership-map.json`，由 `scripts/oam/check-db-ownership-map.mjs` 验收。
- 证据引用合同：`docs/contracts/evidence/evidence-graph-refs-contract.json`，由 `scripts/oam/check-evidence-contract-refs.mjs` 验收。
- 运行时治理 v2：`scripts/oam/check-runtime-governance-v2.mjs`，覆盖 Admission、可信设备、修正中心、UOW 和事实 owner。
- Surface 语言 v2：`scripts/oam/check-surface-language-v2.mjs`，覆盖普通移动端可见文案、PC 治理面隔离、结构化准入字段和 Search 读侧门禁。

这些检查已接入 `.github/workflows/ci.yml` 和 `scripts/oam/run-control-plane-checks.ps1`。阶段 10 会刷新全量测试、覆盖率、构建、浏览器 smoke、运行时合同和证据根结果；最终提交前以阶段 10 的结果为准。

本轮已完成的当前 OAM 原生改写：
- Surface 写阻断统一为 `currentForbiddenWriteAdapter`，非持久化任务标识统一为 `nonPersistedWorkItemKey`。
- WorkItem 定义入口统一为 `sourceCardId`，步骤依赖隐藏字段统一为 `suppressedFields`。
- Ledger/control-plane 迁移口径统一为 `migrationReadonlySources`、`sourceLock`、`readonlySourceVerification`、`projectionConsistencyCompare`。
- DB 状态记录统一为 `operations_work_item_state_event_log`，新增 `041_current_oam_work_item_state_event_log.sql` 处理已应用库的当前命名升级。
- 全项目大小写扫描确认无旧架构缩写、旧阶段词、非 `artifacts/oam` 财务产物路径和旧运行体系英文残留。

完整最终验收在当前源码上重新构建运行完成：移动端单测、PC 单测、移动端覆盖率、Playwright smoke、`WorkOSNext.sln` Release 构建、后端 Unit、Runtime Integration、Database Security、Policy as Code、Release Evidence 和 Runtime Contract 全部通过。

## 全项目文件职责和边界表

| 范围 | 当前职责 | 边界 |
| --- | --- | --- |
| `services/core-api` | API、Confirm Runtime、Unit of Work、权限、证据、审计、投影处理、迁移执行 | 不承载页面私有写入，不恢复旧写入口 |
| `modules/accommodation` | 住宿资源、线索预订、入住、退住、服务任务能力声明 | 只声明能力、规则、API、DB、测试和规则绑定 |
| `modules/finance-gate` | 收款、押金、支出、对账、纠错能力声明 | 钱和账只走 Finance/Money Kernel，不让业务页直接写账 |
| `modules/identity` | Account、User、Actor、Device、Session 和治理分配 | 登录页只收用户名密码，权限由治理面分配 |
| `modules/maintenance` | 清洁维修任务对象、分派、完成、验收、恢复可售 | 任务对象一次确定，后续只读承接 |
| `packages/surface-view-models` | 跨端只读视图模型 | 不写业务事实，不调用副作用 API |
| `docs/oam` | 唯一架构权威和验收报告 | 不保存历史归档语义 |
| `docs/contracts` | 当前合同事实来源 | 合同与脚本、测试、API 保持一致 |
| `scripts` | 当前 OAM 守卫、合同、业务规则、纯净度检查 | 不保留历史阶段脚本 |
| `infra/db/migrations` | 当前顺序迁移链 | 无重复迁移序号；状态记录、控制面和财务语义均使用当前命名 |

## 删除清单

已删除旧规则、旧工程说明、旧阶段文档、旧兼容合同、旧 Schema、旧脚本、旧工作流、旧测试产物、旧截图证据和旧报告产物。旧 `Workspace/Card` prepare/confirm 写入口保持删除，不恢复兼容层。

## 重写清单

重写了当前 OAM 架构文档、机器 manifest、系统地图、OAM 合同、体验合同、Surface 合同、CI、PR 模板、docker-compose、纯净度检查、规则权威检查、API 边界检查、Admission/Account/Search/Language 守卫、业务规则输出路径和控制面 runner 默认配置。

## 保留清单

保留并归入当前 OAM 的核心资产：`core-api`、Operations Runtime、Unit of Work、WorkItem Definition、Account Actor Kernel、Admission Kernel、Language Kernel、Search Kernel、Finance/Reconciliation/Correction、PC Governance、Mobile Surface、runtime/database/unit/e2e/policy tests。

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

`operations_cases` 是父级，`operations_work_items` 是子级；状态事件日志、分派、升级、提交、审计、证据、outbox、projection 关系围绕 `operation_case_id` 和 `work_item_id` 串接。迁移链已清理重复编号，并保留当前控制面、运行时、财务、投影和安全职责。

## 后端复用方法清单

当前复用核心包括：`CanonicalOperationsApiService`、`OperationsUnitOfWork`、`OperationsCaseStore`、`OperationsWorkItemStore`、`WorkItemDefinitionRegistryService`、`RuntimeActorAuthentication`、`AdmissionKernelService`、`SearchKernelService`、Evidence policy/evaluator、Finance policy/evaluator、ControlPlane read/write stores。

## 前端控件清单

当前前端统一使用：`fieldControls`、`optionSetContract`、`resourceScopeControls`、`bedLabelControls`、`OperationCardShell`、`BusinessSummaryHeader`、`BusinessTaskOverview`、`OperationStepRail`、`FieldSourceRenderer`、Action/Evidence/Device/Permission 状态组件、统一 i18n 字典和 Surface view model。

## 语言体系覆盖说明

语言内核覆盖 `zh-CN`、`ru-RU`、`ky-KG`，字段标签、错误、权限说明、搜索同义词和表面文案由合同和前端字典共同约束。`check-language-kernel` 已通过。

## 搜索体系覆盖说明

搜索内核合同化了 result type、字段、ranking、权限过滤和空状态。搜索只读，不写业务事实。`check-search-kernel` 已通过。

## 规则覆盖率报告

规则守卫已覆盖 OAM 纯净度、合同校验、规则权威、本地路径引用、API 边界、运行时写路径、Admission、Business Line Admission、Account Actor、Language、Search、Policy as Code、Domain Packs、Truth Owners、Finance Truth、Ledger Semantic、Finance Semantic Truth、Management Cockpit、Shared Governance、Dormitory Golden Domain、场景字段合同、Canonical Scenario Map、Evidence Coverage 和 Ledger Posting。`scripts/oam/run-control-plane-checks.ps1` 已通过。

## 测试覆盖率报告

前端覆盖率：Statements 78.74%，Branches 63.58%，Functions 85.05%，Lines 82.91%。

后端覆盖率文件已生成：
- Unit tests: line 33.28%，branch 45.53%。
- Runtime integration tests: line 20.09%，branch 33.03%。
- Database security tests: line 0.63%，branch 0.50%。
- Policy tests: line 0.95%，branch 0.78%。
- Release control tests: line 0.00%，branch 0.00%。

完整最终验收重新构建测试结果：
- 移动端单测：59 个测试文件、315 个用例通过。
- PC 单测：4 个测试文件、4 个用例通过，作为独立验收入口。
- Playwright smoke：5 个真实浏览器用例通过。
- 后端构建：`WorkOSNext.sln` Release 构建通过，0 warning，0 error。
- 后端测试：Unit 228 个、Runtime Integration 55 个、Database Security 9 个、Policy as Code 4 个、Release Evidence 5 个全部通过。
- Runtime Contract：运行型合同检查通过。

剩余 warning：
- Vite build 保留既有单 chunk 体积提示。
- .NET build 本轮为 0 warning，0 error。

## 远端分支处置建议

可吸收类：近期业务边界、输入交互、床位承接、线索预订和财务关联修复分支，只能按当前 OAM 重新实现或选择性吸收。

需要关闭类：历史阶段、证据堆叠、完成报告、旧控制面、旧体验分裂和旧基线类分支。

需要删除类：只包含历史产物、截图噪音、旧阶段报告或已被当前 OAM 合同覆盖的分支。

不得整分支合并；所有有效内容必须落入当前 OAM manifest 和合同边界。

## 为什么过去改来改去改不好

过去的问题不是单点 bug，而是事实来源过多：页面写路径、阶段规则、证据目录、旧合同、测试产物和临时报告互相牵制，导致每次修一个入口又被另一个旧入口带偏。

## 为什么现在这个方案不会继续偏

当前方案把目录、模块、服务、包、API、DB、规则、CI、语言、搜索、权限、证据和 Surface 都收敛到唯一 OAM manifest 与合同；纯净度检查会阻止旧阶段词、旧目录、旧工作流和旧产物重新进入项目。

## 最终验收结论

当前架构纯净验收通过。当前分支满足“纯净当前 OAM 架构最终硬收口”的本地验收：当前 OAM 架构唯一，旧适配和旧阶段噪音已删除或重写，服务/模块/包/infra/.github 已一等归类，关键守卫、构建、前端测试、PC 测试、浏览器测试、后端测试、数据库安全测试和运行时合同均通过。
