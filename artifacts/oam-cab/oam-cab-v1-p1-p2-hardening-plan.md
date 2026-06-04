# OAM-CAB v1 P1/P2 Hardening Plan

生成时间：2026-06-03T14:09:21.6575738Z

## Scope

本计划只拆分 OAM-CAB v1 final report 中已经记录的 P1/P2 风险。它不授权 Business Production、不授权 Dormitory L2、不授权删除或归档移动。

## P1 Tasks

### P1-AUTH-COOKIE-CSRF

- title: Cookie / CSRF production browser auth baseline not production-ready
- source: `artifacts/oam-cab/oam-cab-v1-final-report.json`
- owner domain: security / trust
- current blocker: 当前 cookie / CSRF 只满足 baseline repair 证据，不满足 production browser auth。
- required work: 定义生产浏览器 session、cookie flags、CSRF token lifecycle、same-site policy、logout/revoke、tenant/device binding、negative tests。
- acceptance: production auth contract 与 runtime tests 通过；manual browser auth positive/negative flows 有截图；Business Production gate 仍由 current-state 单独裁决。

### P1-COMMAND-SUBMISSION-CONTEXT

- title: CommandSubmission context persisted columns still contract / migration draft
- source: `docs/contracts/command-submission/command-submission-contract.json`
- owner domain: operations-runtime
- current blocker: context 已进入 contract / payload，但 persisted columns 和 migration 仍未 production-ready。
- required work: 完成 migration、backfill/nullability strategy、idempotency and context uniqueness checks、ledger/evidence trace linking、rollback plan。
- acceptance: migration dry run + integration tests + artifact binding 通过；CommandSubmission context 可以被 trace / Lens / EvidenceGraph 稳定读取。

### P1-WORKSPACE-CARD-MIGRATION

- title: Workspace/Card compatibility wrapper migration still pending
- source: `docs/architecture/compatibility-components.yml`
- owner domain: operations-runtime / surface
- current blocker: Workspace/Card prepare-confirm 仍作为 compatibility wrapper 注册。
- required work: 逐页迁移到 `Definition -> OperationCase -> WorkItem -> CommandSubmission -> SliceCommandHandler -> DomainEvent / LedgerEntry -> ProcessManager -> Projection / Lens -> Surface`，收集旧 route traffic 为零的证据。
- acceptance: Operation Panel、Work、Search、Today 只使用 Operations WorkItem APIs；compatibility route shrink gate 通过；删除仍需单独授权。

### P1-CONTROL-PLANE-EVIDENCE-GO

- title: Control Plane / Evidence Graph still not Business Production GO
- source: `artifacts/release-state/current-state.json`
- owner domain: governance / evidence
- current blocker: Control Plane / Evidence Graph 有 evidence closure，但 current-state 仍阻断 Business Production。
- required work: 展示 GateResult、Invariant、ShadowCompare、RollbackInstruction chain 的真实来源、滞后、降级原因和 rollback instruction。
- acceptance: PC governance 页面、EvidenceGraph refs、Control Plane append-only guard 和 Business Production readiness gate 共同通过；current-state 才可裁决下一步。

## P2 Tasks

### P2-DOTNET-WARNINGS

- title: dotnet analyzer / nullability warnings
- source: latest `pwsh ./scripts/guard-architecture.ps1` output
- owner domain: runtime code quality
- current blocker: `ActionRuntimeService.cs` 仍有 nullable warnings。
- required work: 修复 nullable annotations 或 defensive defaults，避免 `CorrelationId`、`RequestId`、`IdempotencyKey` 可能为 null。
- acceptance: `dotnet build WorkOSNext.sln -c Release` 不再输出该组 warnings，runtime tests 通过。

### P2-LINT-TYPECHECK-REGRESSION

- title: lint/typecheck/dedicated regression commands not_available
- source: `artifacts/oam-cab/oam-cab-v1-final-report.json`
- owner domain: developer experience / CI
- current blocker: root 和 mobile package 没有 lint/typecheck/dedicated regression script。
- required work: 定义可重复命令，接入 CI，并避免把 `not_available` 伪造成 passed。
- acceptance: final report tests 字段可以记录真实 passed 命令；CI 上同名命令可复现。

### P2-CANDIDATE-CLEANUP

- title: archive/remove candidate cleanup not executed
- source: `docs/architecture/archive-candidates.yml`, `docs/architecture/remove-candidates.yml`
- owner domain: architecture hygiene
- current blocker: cleanup 只完成分类，没有执行归档或删除。
- required work: 为每个候选项补 owner decision、replacement、proofNotUsed、archive/remove gate，再单独 PR 执行。
- acceptance: cleanup PR 有 before/after inventory、guard 通过、无引用断裂、无 Business Production 误读。

## Parallel Branch

### DORM-SCENARIO-BROWSER-AUDIT

- title: Dormitory business scenarios real browser positive/negative audit
- status: queued
- scope: 宿舍业务各场景正反例逐页真实点击测试。
- pages: login, home, today, workbench, search, operationPanel, recentSubmissions, learning, me, feedback when applicable。
- evidence: 每页完整截图；一屏不够则连续截图；记录点击路径、输入、期望、实际、阻断/提示、语言和布局问题。
- forbidden: 不接受模拟、不接受后台直接写数据、不接受测试模式替代真实浏览器。
- output: 独立截图目录和审计报告；不得解释为 Business Production GO。
