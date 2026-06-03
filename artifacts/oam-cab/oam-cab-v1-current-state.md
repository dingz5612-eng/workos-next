# OAM-CAB v1 当前冻结状态

生成时间：2026-06-03

## 当前 main

- repository: `dingz5612-eng/workos-next`
- branch: `main`
- headSha: `7bbf636041d79b19f2e3121f78f263e391b4931d`
- CI: `success`
- V5.4 Control Plane Guards: `success`

## 当前架构状态

- OAM 是目标顶层架构。
- Operations Runtime 是主执行轴。
- 主执行链为 `Definition -> OperationCase -> WorkItem -> CommandSubmission -> SliceCommandHandler -> DomainEvent / LedgerEntry -> ProcessManager -> Projection / Lens -> Mobile / PC Surface`。
- ProjectionRuntime 是当前 compatibility facade。
- Workspace/Card 是当前 compatibility wrapper。
- Mobile surface 只能通过 Operations Runtime 办理 WorkItem。
- PC Governance 是治理控制面，不得绕过 Operations Runtime、CommandSubmission、append-only correction 和审计链路直接写业务事实。

## 当前业务线状态

- Dormitory: `L1_INTERNAL_PILOT_OBSERVATION`
- Dormitory L2: `BLOCKED`
- Business Production: `BLOCKED`
- Repair: `L0 Contract Preview`
- Parts: `L0 Contract Preview`
- HR: `L0 Contract Preview`
- business-3..7: `L0 Contract Preview`

## 当前禁止状态

- Business Production 不允许。
- Dormitory L2 Production 不允许。
- Repair / Parts / HR Production 不允许。
- Production confirm 不允许被本批次解释为可用。
- Rules OS GO 不等于 Business Production GO。

## 阶段 0 自稳定结果

阶段 0 发现旧 evidence 绑定 `ed4b0b4643a2808883197efa55326148b3456a48`，当前 `origin/main` 为 `7bbf636041d79b19f2e3121f78f263e391b4931d`。已通过现有 release-state 与 observation gate 脚本完成重绑定。

已确认通过：

- `node scripts/release-state/check-current-release-state.mjs`
- `node scripts/release-state/check-current-state-authority.mjs`
- `node scripts/release-state/check-post-merge-attestation.mjs`
- `node scripts/release-state/check-artifact-git-binding.mjs`
- `node scripts/operations/check-day2-entry-gate.mjs`

## 阶段 0 gate 状态

已通过：

- `node scripts/check-rule-authority.mjs`
- `node scripts/check-v5-5-rules-os.mjs --mode=ci --commitSha=7bbf636041d79b19f2e3121f78f263e391b4931d --ciRunId=26866430737 --v54RunId=26866430742`
- `node scripts/check-api-boundaries.mjs`
- `node scripts/check-fact-ownership.mjs`

阶段 0 gate 已全部通过，允许进入阶段 1。

## 阶段 1 gate 状态

已通过：

- `node scripts/check-oam-clean-baseline.mjs`
- `node scripts/check-rule-authority.mjs`
- `node scripts/check-rule-drift.mjs`
- `node scripts/check-api-boundaries.mjs`
- `node scripts/check-fact-ownership.mjs`
- `npm --prefix apps/mobile run test`
- `dotnet test tests/WorkOS.UnitTests/WorkOS.UnitTests.csproj -c Release`
- `dotnet test tests/WorkOS.RuntimeIntegrationTests/WorkOS.RuntimeIntegrationTests.csproj -c Release`

阶段 1 已建立：

- active components: `docs/architecture/active-components.yml`
- compatibility components: `docs/architecture/compatibility-components.yml`
- archive candidates: `docs/architecture/archive-candidates.yml`
- remove candidates: `docs/architecture/remove-candidates.yml`
- Codex execution playbook: `docs/architecture/CODEX_EXECUTION_PLAYBOOK.md`
- OAM clean baseline guard: `scripts/check-oam-clean-baseline.mjs`

阶段 1 gate 已全部通过，允许进入阶段 2。

## 阶段 2 gate 状态

已通过：

- `node scripts/check-compatibility-quarantine.mjs`
- `node scripts/check-oam-clean-baseline.mjs`
- `node scripts/check-api-boundaries.mjs`
- `node scripts/check-runtime-write-paths.mjs`
- `node scripts/check-rule-drift.mjs`
- `npm --prefix apps/mobile run test`
- `dotnet test tests/WorkOS.UnitTests/WorkOS.UnitTests.csproj -c Release`
- `dotnet test tests/WorkOS.RuntimeIntegrationTests/WorkOS.RuntimeIntegrationTests.csproj -c Release`

阶段 2 已建立：

- compatibility quarantine rules: `docs/architecture/compatibility-quarantine-rules.md`
- compatibility quarantine guard: `scripts/check-compatibility-quarantine.mjs`
- existing compatibility routes 登记在 `docs/architecture/compatibility-components.yml`

阶段 2 gate 已全部通过，允许进入阶段 3。

## 阶段 3 gate 状态

已通过：

- `node scripts/check-admission-kernel.mjs`
- `node scripts/check-business-line-admission.mjs`
- `node scripts/check-admission-surface-alignment.mjs`
- `node scripts/check-surface-contract.mjs`
- `node scripts/check-oam-clean-baseline.mjs`
- `npm --prefix apps/mobile run test`
- `dotnet test tests/WorkOS.UnitTests/WorkOS.UnitTests.csproj -c Release`
- `dotnet test tests/WorkOS.RuntimeIntegrationTests/WorkOS.RuntimeIntegrationTests.csproj -c Release`

阶段 3 已建立：

- admission contract: `docs/contracts/admission/admission-contract.json`
- admission matrix: `docs/contracts/admission/admission-matrix.json`
- admission sources: `docs/contracts/admission/admission-sources.json`
- admission guard: `scripts/check-admission-kernel.mjs`

阶段 3 只建立 contract + guard，未接入业务 confirm 主链路，未新增 production confirm。

阶段 3 gate 已全部通过，允许进入阶段 4。

## 阶段 4 gate 状态

已通过：

- `node scripts/check-definition-registry.mjs`
- `node scripts/check-fact-ownership.mjs`
- `node scripts/check-api-boundaries.mjs`
- `node scripts/check-language-kernel.mjs`
- `node scripts/check-search-kernel.mjs`
- `node scripts/check-admission-kernel.mjs`
- `node scripts/check-oam-clean-baseline.mjs`
- `npm --prefix apps/mobile run build`
- `npm --prefix apps/mobile run test`
- `dotnet build WorkOSNext.sln -c Release`
- `dotnet test tests/WorkOS.UnitTests/WorkOS.UnitTests.csproj -c Release`
- `dotnet test tests/WorkOS.RuntimeIntegrationTests/WorkOS.RuntimeIntegrationTests.csproj -c Release`
- `pwsh ./scripts/guard-architecture.ps1`
- `git diff --check`

阶段 4 已建立：

- Definition Registry: `docs/contracts/definition/workitem-definition-registry.json`
- Field / Evidence / Risk / Ledger refs: `docs/contracts/definition/*-refs.json`
- Language Kernel catalogs: `docs/contracts/language/*.json`
- Search Kernel catalogs: `docs/contracts/search/*.json`
- Definition / Language / Search guards: `scripts/check-definition-registry.mjs`, `scripts/check-language-kernel.mjs`, `scripts/check-search-kernel.mjs`

阶段 4 只建立合同、守卫和 supportedLanguages 对齐；未新增业务页面、业务写 API、production confirm 或 Workspace/Card 业务扩展。

阶段 4 gate 已全部通过，允许进入阶段 5。

## 阶段 5 gate 状态

已通过：

- `node scripts/check-definition-registry.mjs`
- `node scripts/check-admission-kernel.mjs`
- `node scripts/check-language-kernel.mjs`
- `node scripts/check-search-kernel.mjs`
- `node scripts/check-compatibility-quarantine.mjs`
- `node scripts/check-api-boundaries.mjs`
- `node scripts/check-fact-ownership.mjs`
- `node scripts/check-runtime-write-paths.mjs`
- `node scripts/check-surface-contract.mjs`
- `node scripts/surface/check-surface-runtime-guard-contract.mjs`
- `npm --prefix apps/mobile run build`
- `npm --prefix apps/mobile run test`
- `npm --prefix apps/mobile run test:e2e`
- `dotnet build WorkOSNext.sln -c Release`
- `dotnet test tests/WorkOS.UnitTests/WorkOS.UnitTests.csproj -c Release`
- `dotnet test tests/WorkOS.RuntimeIntegrationTests/WorkOS.RuntimeIntegrationTests.csproj -c Release`
- `dotnet run --project tests/WorkOS.RuntimeContractTests/WorkOS.RuntimeContractTests.csproj -c Release`
- `git diff --check`

阶段 5 已建立或对齐：

- `WorkItemDefinitionRegistryService` 已接入 runtime confirm/search 主链路。
- `AdmissionKernelService` 已在 confirm 前裁决 visible / prepare / confirm / production。
- Search API 已统一通过 `SearchKernelService`，legacy search 仅留在 `LegacyWorkspaceSearchAdapter` 内。
- `CanonicalOperationsApiService` 写入 command payload 时带入 definition、admission、actor、device、surface 与 compatibility 上下文。
- Operation surface 不再显示 `trusted-confirm` 按钮，不再向用户暴露 `payloadHash` / `commandSubmissionId` / `traceAvailable` 这类内部字段。
- 三语言运行时证明文案和内置演示账号名已补齐，避免俄语/吉语界面混中文账号名。
- 浏览器截图检查结果已保存到 `artifacts/oam-cab/browser-checks/phase-5/check-result.json`，截图保存到同目录 `*.png`。

阶段 5 剩余 P1 风险：

- CommandSubmission context 持久化列仅完成合同、迁移草案和 runtime payload 对齐；尚未声明为 production-ready。
- `Workspace/Card` 仍是 compatibility wrapper，后续阶段必须继续迁移到 `Definition -> OperationCase -> WorkItem -> CommandSubmission -> SliceCommandHandler -> DomainEvent / LedgerEntry -> ProcessManager -> Projection / Lens -> Surface` 主轴。

阶段 5 未放开：

- 未新增 Business Production。
- 未放开 Dormitory L2 Production。
- 未新增 production confirm。
- 未把 Search / Mobile / PC Governance 变成业务事实写入点。

阶段 5 gate 已全部通过，允许进入阶段 6。

## OAM-CAB v1 最终报告 gate 状态

已通过：

- `node scripts/check-oam-cab-final-report.mjs`
- `node scripts/check-oam-clean-baseline.mjs`
- `node scripts/check-compatibility-quarantine.mjs`
- `node scripts/check-api-boundaries.mjs`
- `node scripts/check-runtime-write-paths.mjs`
- `node scripts/check-admission-kernel.mjs`
- `node scripts/check-definition-registry.mjs`
- `node scripts/check-language-kernel.mjs`
- `node scripts/check-search-kernel.mjs`
- `node scripts/check-fact-ownership.mjs`
- `node scripts/check-surface-contract.mjs`
- `node scripts/surface/check-surface-runtime-guard-contract.mjs`
- `node scripts/check-rule-authority.mjs`
- `node scripts/check-rule-drift.mjs`
- `npm --prefix apps/mobile run build`
- `npm --prefix apps/mobile run test`
- `npm --prefix apps/mobile run test:e2e`
- `dotnet build WorkOSNext.sln -c Release`
- `dotnet test tests/WorkOS.UnitTests/WorkOS.UnitTests.csproj -c Release`
- `dotnet test tests/WorkOS.RuntimeIntegrationTests/WorkOS.RuntimeIntegrationTests.csproj -c Release`
- `dotnet run --project tests/WorkOS.RuntimeContractTests/WorkOS.RuntimeContractTests.csproj -c Release`
- `git diff --check`

最终阶段已补齐：

- machine final report: `artifacts/oam-cab/oam-cab-v1-final-report.json`
- human final report: `docs/architecture/OAM_CAB_V1_FINAL_REPORT.md`
- final report gate: `scripts/check-oam-cab-final-report.mjs`
- component classification schema: `docs/architecture/active-components.yml`, `docs/architecture/compatibility-components.yml`, `docs/architecture/archive-candidates.yml`, `docs/architecture/remove-candidates.yml`
- Codex execution protocol: `docs/architecture/CODEX_EXECUTION_PLAYBOOK.md`
- compatibility quarantine hard rules: `docs/architecture/compatibility-quarantine-rules.md`

OAM-CAB v1 baseline gate 已通过。该结论只说明架构基线、证据和 No-Go 边界已可机器检查；不等于 Business Production GO。

最终保留 No-Go：

- Business Production: `blocked`
- Dormitory L2: `BLOCKED`
- production confirm: `blocked`
- Repair / Parts / HR / business-3..7: `L0 Contract Preview`

最终 P1 风险：

- CommandSubmission context 持久化列仍是合同和迁移草案，不是 production-ready。
- Workspace/Card 仍是 compatibility wrapper，后续必须继续迁移并最终清理。
- Control Plane / Evidence Graph 已纳入证据闭环，但 Business Production 仍由 current-state 阻断。

允许的下一步仅限 OAM 总控继续下发 cleanup、候选归档、migration hardening 或 production readiness evidence；不允许进入 Business Production。

## OAM-CAB v1｜Baseline Repair & Evidence Closure inventory 状态

当前阶段不是 Business Production、不是 Production Ready、不是 L1 / L0 业务升级，也不是新业务功能开发。当前阶段只补齐清单、合同、证据和门禁闭环。完整机器清单写入：`artifacts/oam-cab/oam-cab-v1-inventory.json`。

Inventory summary：

- API route inventory：68 条 route，来源为 `services/**/*.cs` 的 `Map*` route 扫描。
- non-GET route classification：34 条 non-GET `/api/*` route，均已进入 `docs/rules/v5.5/api-boundary.yml` 分类。
- business write path inventory：7 条写入相关 route；当前唯一主业务写路径仍是 `POST /api/operations/work-items/{workItemId}/confirm`，Correction Center 为 append-only correction / governance，Workspace/Card 为 compatibility shim。
- Definition Registry coverage：22 个 WorkItem definition。
- WorkItem definition coverage：22 个 definition 均记录 `sliceId`、legacy card、command type、projection owner 和 allowed facts。
- handler allowedFacts coverage：运行时源码已扫描 `AllowedFacts` / `SliceCommandHandlerDefinition` / `ValidateFactOwnership` 绑定。
- Fact Ownership matrix：来源 `docs/rules/v5.5/fact-ownership.yml`，已纳入 `artifacts/oam-cab/oam-cab-v1-inventory.json`。
- ProjectionRuntime write usage scan：扫描 `ProjectionRuntime`、`RuntimeAggregateLensStorage`、`RecordProjection`、`ProcessOutbox`、`runtime_documents` 使用；ProjectionRuntime 仍限 compatibility facade。
- Workspace/Card write usage scan：扫描 `PrepareWorkspaceCard`、`ConfirmWorkspaceCard`、`WorkspaceCardCompatibilityAdapter`；Workspace/Card 仍限 compatibility wrapper / shim。
- runtime_documents source-of-truth usage scan：扫描 `runtime_documents`、`authoritative`、`source of truth` 使用，不允许把 runtime_documents 解释为业务事实权威。
- runtime_documents snapshot-only audit：当前状态为 `snapshot-only-contract`，证据为 compatibility quarantine 和 fact ownership gate。
- Search usage inventory：15 个 Search result type，Search 只读，并经过 Admission / Permission / Language。
- Language key/status explanation inventory：覆盖 `zh-CN`、`ru-RU`、`ky-KG`，核心状态、错误和搜索文案归入 Language Kernel。
- Control Plane write capability inventory：Control Plane route 只允许 governance / evidence / export audit，不得直接写 business fact。
- Evidence Graph write/reference inventory：EvidenceGraph refs 指向 release-state、final report、execution log、browser check 和 inventory，Evidence 只能 append-only / traceable。

Legacy write path classification 只能为 `remove`、`forbidden`、`compatibility shim to Operations Confirm`、`non-business write`。当前 inventory 的 `forbidden_findings` 为 0；任何新增 unclassified non-GET route 或 forbidden legacy write path 必须阻断 final-report gate。

## OAM-CAB v1｜Baseline Repair & Evidence Closure contract 状态

已补齐或冻结以下合同引用，入口为 `docs/contracts/oam-cab/contract-index.json`：

- API Boundary Contract：`docs/contracts/oam-cab/api-boundary-contract.json`
- Definition Registry Contract：`docs/contracts/definition/workitem-definition-registry.json`
- CommandSubmission Contract：`docs/contracts/command-submission/command-submission-contract.json`
- Fact Ownership Contract：`docs/contracts/oam-cab/fact-ownership-contract.json`
- Compatibility Box Contract：`docs/contracts/compatibility/compatibility-box-contract.json`
- AdmissionDecision Contract：`docs/contracts/admission/admission-decision-contract.json`
- BusinessLineAdmission Matrix：`docs/contracts/admission/business-line-admission-matrix.json`
- ReleaseStateAdmission Matrix：`docs/contracts/admission/release-state-admission-matrix.json`
- SurfaceAdmission Matrix：`docs/contracts/admission/surface-admission-matrix.json`
- ActorDeviceAdmission Contract：`docs/contracts/admission/actor-device-admission-contract.json`
- ProductionAdmission Contract：`docs/contracts/admission/production-admission-contract.json`
- ControlPlaneCommand append-only Contract：`docs/contracts/control-plane/control-plane-command-append-only-contract.json`
- EvidenceGraph refs Contract：`docs/contracts/evidence/evidence-graph-refs-contract.json`
- BusinessSignoff Contract：`docs/contracts/governance/business-signoff-contract.json`
- Rollback and Compensation Contract：`docs/contracts/governance/rollback-compensation-contract.json`
- Search Contract：`docs/contracts/search/search-contract.json`
- BI / KPI Contract：`docs/contracts/bi-kpi/bi-kpi-contract.json`
- Language Kernel Contract：`docs/contracts/language/language-contract.json`
- PermissionExplainability Contract：`docs/contracts/language/permission-explainability-contract.json`

当前合同状态只证明 OAM-CAB baseline repair 的边界和证据闭环，不授予 Business Production GO。
