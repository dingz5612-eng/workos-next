# 当前 OAM 架构

本文件是 WorkOSNext 当前唯一架构权威。历史阶段命名、旧兼容入口、旧证据阶段口径和旧规则文件不能作为当前事实来源；有当前价值的内容必须重写进 OAM，无法映射的内容必须删除。

## 1. OAM 定义

OAM 是当前项目的唯一运行架构身份，机器名为 `oam.current`。OAM 不作为其他英文全称的缩写使用；它只承认一条业务执行链：

```text
Product Capability
  -> Domain Module
  -> WorkItem Definition
  -> OperationCase
  -> WorkItem
  -> Confirm Runtime
  -> Unit of Work
  -> Domain Event / Ledger Entry
  -> Outbox
  -> Projection / Lens
  -> Mobile Surface / PC Governance Surface
```

任何页面、脚本、API、测试、文档、Schema、数据库结构都必须映射到这条链路。无法映射的内容删除；有价值但命名或边界不符合 OAM 的内容重写进 OAM。

## 2. 硬规则

1. 业务写入只能通过当前 OAM 定义的 Confirm Runtime 和 Unit of Work。
2. 旧 Workspace/Card 写入口、页面私有写 API、历史兼容 fallback 不允许保留。
3. Projection / Lens 只读，不能成为业务写事实来源。
4. Control Plane、PC Governance、Correction、Reconciliation 不得直接写普通业务事实；只能发治理命令、追加修正、生成审计或触发 OAM 允许的 WorkItem。
5. 用户可见字段必须来自合同、语言内核、字段来源内核、状态动作合同；不允许页面硬编码旧字段或旧状态。
6. 证据必须作为 Evidence Object 进入 Evidence / Trace / Audit 链，图片识别只能作为建议带入，不能静默覆盖业务事实。
7. 账号、角色、能力、会话、设备信任由后端 Account / Actor / Device / Session 内核控制，登录页只允许用户名和密码。
8. `.github`、`infra`、`services`、`modules`、`packages` 都必须在 OAM manifest 中归类。
9. 覆盖率口径以 `docs/oam/coverage-policy.json` 为准；普通 KPI 不纳入生成代码和测试代码，规则、finance、ledger、权限和写路径按分层目标验收。

## 2.1 当前定稿操作系统

当前 OAM 不靠人工口头约定保持一致；以下机器合同负责定位、归属、验收和证据：

| 问题 | 当前权威 | 验收脚本 |
| --- | --- | --- |
| 文件是否能作为当前权威 | `docs/oam/current-authority-index.json` | `scripts/oam/check-current-authority-index.mjs` |
| 每类文件负责什么、禁止什么 | `docs/contracts/oam-responsibility-boundary-matrix.json` | `scripts/oam/check-oam-responsibility-boundary-matrix.mjs` |
| 业务对象、字段、owner、语言键 | `docs/contracts/business/oam-business-object-field-registry.json` | `scripts/oam/check-business-object-field-registry.mjs` |
| WorkItem 状态、动作、证据和修正路径 | `docs/contracts/business/oam-workflow-state-registry.json` | `scripts/oam/check-workflow-state-registry.mjs` |
| 宿舍 Source 级业务场景和派生视图 | Source 只允许 `docs/business/domains/dormitory/dormitory-operating-kernel.json`、`docs/business/domains/dormitory/scenarios/dormitory-resource-saleability.golden-chain.yml` 和 `docs/business/domains/dormitory/scenarios/dormitory-scenario-package-matrix.yml`；`docs/business/dormitory/current-business-journey.md`、`docs/scenarios/dormitory/golden-pilot.yml`、`docs/business/dormitory/canonical-scenario-map.json`、`docs/business/domains/dormitory/dormitory-pilot-scenario-pack.yml` 只能是 generated / derived / human-readable view | `scripts/business/check-dormitory-operating-kernel.mjs`、`scripts/business/check-dormitory-resource-saleability-golden-chain.mjs`、`scripts/business/check-dormitory-scenario-package-matrix.mjs`、`scripts/check-dormitory-golden-domain.mjs` |
| 每张数据库表 owner 和唯一写入口 | `docs/contracts/database/oam-db-ownership-map.json` | `scripts/oam/check-db-ownership-map.mjs` |
| 证据根引用是否真实存在 | `docs/contracts/evidence/evidence-graph-refs-contract.json` | `scripts/oam/check-evidence-contract-refs.mjs` |
| 高风险准入、可信设备、修正和 UOW | `docs/contracts/admission/admission-matrix.json` | `scripts/oam/check-runtime-governance-v2.mjs` |
| Search 只读自证 | `docs/contracts/search/search-contract.json` | `scripts/check-search-kernel.mjs` |
| 普通用户语言、PC 治理隔离和结构化准入 | `docs/surface/surface-contract.yml` | `scripts/oam/check-surface-language-v2.mjs` |

人工手册只能解释这些权威如何使用，不重复定义机器合同。修改业务场景、字段、流程、数据库或可见文案时，先改对应合同，再改实现、测试和证据。

历史设计输入桶、弃用文件桶和静态审查快照都不是当前架构身份。可复用内容必须吸收进上表当前权威；吸收后删除原来源。

`golden-pilot`、`current-business-journey`、`canonical-scenario-map`、`pilot-scenario-pack` 不得定义当前业务 Source，不得参与 confirm、admission、runtime 写入、UOW、Ledger 或 Outbox；它们只能作为由 Source 编译出的 generated / derived / human-readable view 被只读消费。

`artifacts/oam/evidence` 和 `artifacts/oam/final-report.json` 是本地/CI 运行产物，不作为源码真值提交。放行结论必须来自当前运行的 `scripts/oam/run-control-plane-checks.ps1`、证据生成器和证据检查器。

## 2.2 当前操作模型

当前 OAM 的操作模型固定为：四图是视角，三层是分区，六环是执行顺序。

四图只表示观察视角，不是 artifact 分类：

| 视角 | 中文名 | 说明 |
| --- | --- | --- |
| `authorityGraph` | 权威图 | 观察 Source 权威、职责、边界、谁能写和谁不能写。 |
| `kernelCompileGraph` | 内核编译图 | 观察 Source 如何编译成 Generated 合同、模型、图和测试输入。 |
| `runtimeEffectGraph` | 运行效果图 | 观察 Runtime 如何消费合同并产生 WorkItem、事件、账务、Outbox 和投影效果。 |
| `readEvidenceGraph` | 读侧与证据图 | 观察 Search、Surface、Lens、Proof DAG、Release Evidence 和 Final Report 如何证明执行结果。 |

三层只表示文件和职责分区，不是执行顺序：

| 分区 | 允许内容 | 禁止内容 |
| --- | --- | --- |
| `Source Layer` | 人工维护的权威输入、规则、边界、事实归属、成熟度、写入权限。 | 派生合同、运行时代码、CI 证据重新解释业务事实。 |
| `Generated Layer` | 从 Source 编译出的合同、模型、图、Surface、Search、Lens、测试合同。 | 手改、声明业务事实权威、绕过上游 Source。 |
| `Runtime / Evidence Layer` | 运行时代码、数据库资产、CI、checker、proof DAG、release evidence、final report。 | 重新发明 Source 规则、把 CI green 或证据存在解释为 GO。 |

六环只表示整改和发布执行顺序：

1. `Authority Closure`
2. `Source Kernel Closure`
3. `Compiler Closure`
4. `Runtime WorkItem Effect Closure`
5. `Read / Surface Consumption Closure`
6. `Release Evidence Closure`

任何 checker、报告或图谱不得把四图写成 artifact 分类，不得把三层写成执行顺序，不得把六环写成散点清单。

## 3. 一等目录

### 3.1 services

只允许以下服务目录：

| 服务 | 当前状态 | 当前职责 |
| --- | --- | --- |
| `services/core-api` | 保留 | HTTP API、Confirm Runtime、Unit of Work、Policy、Evidence、Search、Projection、Governance、DB migration runner |
| `services/ai-personalization` | 当前不创建 | 只有当 OAM 批准个性化 API、数据边界、任务边界和隐私规则后才能创建 |
| `services/workers` | 当前不创建 | 只有当 OAM 批准后台任务、队列、重试、幂等和运行边界后才能创建 |

空服务壳不允许保留。

### 3.2 modules

`modules` 是领域责任归类目录，不直接替代 `services/core-api` 里的运行代码。每个模块必须有 manifest，绑定 Product Capability、Domain Invariant、API、DB、测试和规则。

| 模块 | 当前职责 |
| --- | --- |
| `modules/accommodation` | 宿舍资源、线索预订、入住、在住、退住、押金、普通收款、支出、服务任务、周期复盘 |
| `modules/finance-gate` | 普通收款确认、押金负债、支出审批、对账、修正、财务治理 |
| `modules/identity` | Account、User、Actor、Role、Capability、Session、Device Trust |
| `modules/maintenance` | 清洁维修任务、阻断可售、验收、返工、恢复可售、证据贯穿 |

### 3.3 packages

只允许以下包：

| 包 | 当前状态 | 当前职责 |
| --- | --- | --- |
| `packages/surface-view-models` | 保留 | 跨端只读 view model，不得包含业务写入逻辑 |
| `packages/contracts` | 当前不创建 | 只有当合同需要跨 app/service 发布版本时创建 |
| `packages/design-system` | 当前不创建 | 只有当共享视觉 token 和组件 API 从 app 中抽离时创建 |

空包和未来占位包不允许保留。

### 3.4 infra

`infra` 只保留当前本地运行和数据库职责：

| 目录或文件 | 当前职责 |
| --- | --- |
| `infra/docker-compose.yml` | 本地 Postgres 运行环境 |
| `infra/db/migrations` | 当前 OAM 数据库起点或迁移链 |
| `infra/postgres` | 当前不创建；如创建，必须只放 Postgres 配置、初始化和运行说明 |

旧迁移、重复迁移、旧安全例外和历史阶段迁移必须在数据库重建阶段删除或压缩。

### 3.5 .github

`.github` 只保留当前 OAM 口径：

- 构建
- 前端测试和覆盖率
- 后端测试和覆盖率
- API 边界
- DB 迁移
- Schema 校验
- 规则覆盖
- 纯净度扫描

PR 模板只允许当前 OAM 检查项，不允许历史阶段语义、旧治理缩写、旧门禁名或旧证据阶段口径。

## 4. Product Capability

当前产品能力只保留：

| 能力 | 归属模块 | 说明 |
| --- | --- | --- |
| `accommodation.resource` | accommodation | 房间、床位、价格、基础准备度 |
| `accommodation.lead-reservation` | accommodation | 线索、跟进、预订、取消、入住交接 |
| `accommodation.checkin` | accommodation | 入住交接到正式入住、费用和收款编排 |
| `accommodation.lifecycle` | accommodation | 正式入住后的资料、换床、续住、追加应收 |
| `accommodation.checkout` | accommodation | 退住、查房、押金处理、最终结算、床位释放 |
| `accommodation.service-task` | maintenance | 清洁维修任务、验收、返工、恢复可售 |
| `finance.deposit` | finance-gate | 押金负债全生命周期 |
| `finance.payment` | finance-gate | 普通收款、确认、分配、差异、欠款跟进 |
| `finance.expense` | finance-gate | 支出登记、审批、成本关联 |
| `finance.reconciliation` | finance-gate | 对账、匹配、差异、忽略和审计 |
| `identity.account-actor` | identity | 用户、角色、能力、会话、设备信任 |
| `governance.release-control` | identity | 账号治理、权限治理、发布治理和审计 |

## 5. Domain Invariant

1. 宿舍资源初始事实只由住宿资源能力创建。
2. 线索预订不能创建正式 `stayId`，只能创建 `reservationId` 和 `checkinHandoffId`。
3. 安排入住只能从 `CheckinHandoff` 或直接入住交接启动，不重复录入线索事实。
4. 房间、床位、入住单、预订单、押金单、收款记录、任务编号不得让用户手填。
5. 服务任务对象只能在创建任务时确定，后续步骤只读承接。
6. 普通收款不得混入押金；押金退款不得进入经营支出。
7. 财务确认、退款、支出审批必须由 finance capability 决定。
8. 主管验收和周期关闭必须由 manager capability 决定。
9. Evidence Object、Trace、Audit 必须可追溯到 WorkItem 和 Domain Event。
10. 任何已确认事实只能追加修正，不得原地编辑。

## 6. API Boundary

| API 面 | 写入性质 | OAM 规则 |
| --- | --- | --- |
| `/api/operations/work-items/{workItemId}/confirm` | 主业务写路径 | 必须经过权限、幂等、证据、UOW、事件、投影 |
| `/api/operations/work-items/{workItemId}/prepare` | 准备/校验 | 不写业务事实，只能准备和解释 |
| `/api/operations/workspaces/start` | 启动 WorkItem | 只能创建 OAM WorkItem，不写业务事实 |
| `/api/evidence/*` | 证据写入 | 只能写 Evidence Object，不确认业务事实 |
| `/api/reconciliation/*` | 财务治理 | 只写对账治理事实或生成修正/确认动作 |
| `/api/correction-center/*` | 追加修正 | 不能编辑原事实，只能追加修正 |
| `/api/pc-governance/*` | 治理 | 账号、导出、权限、审计；不直接写普通业务事实 |
| `/api/control-plane/*` | 发布治理 | ControlPlaneCommand、Release、Gate、Rollback、审计 |
| `/api/search`、`/api/lenses/*` | 只读 | 必须权限过滤，不写事实 |
| `/api/mobile/*` | 客户端辅助 | 草稿、反馈、最近对象，不写业务事实 |

## 7. Data Model

当前 OAM 数据模型父子关系：

```text
operations_cases
  -> operations_work_items
      -> command_submissions
      -> operation_work_item_transitions
      -> evidence_refs
      -> trace_refs
      -> audit_events
      -> outbox_messages
          -> projections
          -> lenses
```

领域表必须引用 OAM 事实来源：

- accommodation resource / stay / checkout / service task 表引用 WorkItem、event 或 stable domain id。
- finance ledger / payment / deposit / expense / reconciliation 表必须追加写入。
- identity account / session / device 表必须绑定 tenant、actor、capability 和 audit。

## 8. Language Kernel 和 Search Kernel

语言体系必须覆盖 `zh-CN`、`ru-RU`、`ky-KG`。字段标签、错误、状态、动作、权限解释只允许来自语言合同。

搜索体系必须统一 result type、required fields、ranking、permission filter、empty state、error state。Search 只负责发现和进入，不持有业务事实。

## 9. Surfaces

Mobile 只保留：

- 今天
- 工作项
- 搜索
- 我的
- Operation Panel
- Evidence Library
- Draft / Queue / Result

PC 只保留：

- Finance Control
- Manager Control Tower
- Governance Center
- Release Control

页面可以有业务差异，但不能有架构差异。共享控件、字段来源、状态动作、语言、权限解释必须共用。

## 10. 验收标准

一个文件、目录或分支的处置只有三种：

| 处置 | 标准 |
| --- | --- |
| 保留 | 符合当前 OAM，并在 manifest 中有职责 |
| 重写 | 有当前价值，但命名、边界、依赖或语义不符合 OAM |
| 删除 | 不符合当前 OAM，且没有当前价值 |

禁止“历史保留”“临时兼容”“以后再清”“仅供参考”。
