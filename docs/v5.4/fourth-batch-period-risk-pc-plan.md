# MR-10 Period / Risk / PC Governance Full Plan

This document is a planning artifact only. It does not introduce business code, schema, endpoints, or runtime behavior.

## Source Reports Read

- `docs/v5.4/mr-06-release-report.md`: not found in the current repository state.
- `docs/v5.4/mr-07-release-report.md`: not found in the current repository state.
- `docs/v5.4/mr-08-release-report.md`: found. CheckoutSettlement / ServiceTask / BlockerEngine are reported as passed with green shadow compare. MR-08 rollback uses runtime mode rollback and compensation is append-only business correction.
- `docs/v5.4/mr-09-release-report.md`: found. Reconciliation / CorrectionCenter are reported as passed with green shadow compare. MR-09 rollback uses runtime mode rollback and compensation is follow-up correction / case reopen.

MR-10 should treat missing MR-06 and MR-07 release reports as blocked evidence until PaymentLedger and DepositLedger release evidence is recreated or recovered.

## Located Code Map

### Payment Ledger

- `infra/db/migrations/006_hostel_operating_ledger.sql`
- `infra/db/migrations/007_accommodation_money_ledgers.sql`
- `services/core-api/WorkOS.Api/Slices/Accommodation/PaymentLedger/Persistence/PaymentLedgerStorage.cs`
- `services/core-api/WorkOS.Api/Slices/Accommodation/PaymentLedger/Policies/PaymentLedgerPolicy.cs`
- `services/core-api/WorkOS.Api/Slices/Accommodation/PaymentLedger/ProjectorRules/PaymentLedgerProjectorRules.cs`
- `services/core-api/WorkOS.Api/Runtime/RuntimeAccommodationLedgerStorage.cs`
- `services/core-api/WorkOS.Api/Runtime/AccommodationLedgerState.cs`
- `services/core-api/WorkOS.Api/Runtime/RuntimeAggregateLensStorage.cs`

Primary current sources include `hostel_payments`, `finance_reconciliations`, `payment_allocations`, `stay_balances`, and the `payment-risk` / `stay-balance` aggregate lenses.

### Deposit Ledger

- `infra/db/migrations/007_accommodation_money_ledgers.sql`
- `services/core-api/WorkOS.Api/Slices/Accommodation/DepositLedger/Persistence/DepositLedgerStorage.cs`
- `services/core-api/WorkOS.Api/Slices/Accommodation/DepositLedger/Policies/DepositLedgerPolicy.cs`
- `services/core-api/WorkOS.Api/Slices/Accommodation/DepositLedger/ProjectorRules/DepositLedgerProjectorRules.cs`
- `services/core-api/WorkOS.Api/Runtime/RuntimeAccommodationLedgerStorage.cs`
- `services/core-api/WorkOS.Api/Runtime/RuntimeAggregateLensStorage.cs`

Primary current sources include `deposit_transactions`, `deposit_liabilities`, and the `deposit-liability` aggregate lens.

### Reconciliation And Correction

- `infra/db/migrations/017_reconciliation_runtime.sql`
- `infra/db/migrations/018_reconciliation_matching_manual_decisions.sql`
- `infra/db/migrations/019_reconciliation_mismatch_cases.sql`
- `infra/db/migrations/020_correction_center_schema.sql`
- `services/core-api/WorkOS.Api/Runtime/BankStatementCsvParser.cs`
- `services/core-api/WorkOS.Api/Runtime/BankStatementImportModels.cs`
- `services/core-api/WorkOS.Api/Runtime/BankStatementImportService.cs`
- `services/core-api/WorkOS.Api/Runtime/RuntimeBankStatementImportStorage.cs`
- `services/core-api/WorkOS.Api/Runtime/ReconciliationMatchModels.cs`
- `services/core-api/WorkOS.Api/Runtime/ReconciliationMatchingService.cs`
- `services/core-api/WorkOS.Api/Runtime/RuntimeReconciliationMatchingStorage.cs`
- `services/core-api/WorkOS.Api/Runtime/ReconciliationMismatchCaseService.cs`
- `services/core-api/WorkOS.Api/Runtime/ReconciliationMismatchModels.cs`
- `services/core-api/WorkOS.Api/Runtime/ReconciliationProcessManager.cs`
- `services/core-api/WorkOS.Api/Runtime/RuntimeReconciliationMismatchCaseStorage.cs`
- `services/core-api/WorkOS.Api/Runtime/CorrectionCenterModels.cs`
- `services/core-api/WorkOS.Api/Runtime/CorrectionCenterService.cs`
- `services/core-api/WorkOS.Api/Runtime/RuntimeCorrectionCenterStorage.cs`

Coverage tests are present under `tests/WorkOS.UnitTests` and runtime contract tests under `tests/WorkOS.RuntimeContractTests` / `tests/WorkOS.RuntimeIntegrationTests`.

### Resource / Stay / Checkout / Service / Lens

- Resource schema and runtime:
  - `infra/db/migrations/011_accommodation_resource_setup_runtime.sql`
  - `services/core-api/WorkOS.Api/Slices/Accommodation/ResourceSetup/ResourceSetupSlice.cs`
  - `services/core-api/WorkOS.Api/Slices/Accommodation/ResourceSetup/Persistence/ResourceSetupStorage.cs`
  - `services/core-api/WorkOS.Api/Slices/Accommodation/ResourceSetup/Policies/ResourceSetupPolicy.cs`
  - `services/core-api/WorkOS.Api/Slices/Accommodation/ResourceSetup/ProjectorRules/ResourceSetupProjectorRules.cs`
- Stay lifecycle:
  - `infra/db/migrations/010_accommodation_lead_stay_lifecycle.sql`
  - `services/core-api/WorkOS.Api/Slices/Accommodation/StayLifecycle/Persistence/StayLifecycleStorage.cs`
  - `services/core-api/WorkOS.Api/Slices/Accommodation/StayLifecycle/ProjectorRules/StayLifecycleProjectorRules.cs`
- Checkout / service / expense:
  - `infra/db/migrations/008_accommodation_checkout_service_expense.sql`
  - `infra/db/migrations/016_checkout_service_process_manager.sql`
  - `services/core-api/WorkOS.Api/Slices/Accommodation/CheckOutSettlement/Persistence/CheckOutSettlementStorage.cs`
  - `services/core-api/WorkOS.Api/Slices/Accommodation/CheckOutSettlement/Policies/CheckOutSettlementPolicy.cs`
  - `services/core-api/WorkOS.Api/Slices/Accommodation/CheckOutSettlement/ProjectorRules/CheckoutProjectorRules.cs`
  - `services/core-api/WorkOS.Api/Slices/Accommodation/ServiceTask/Persistence/ServiceTaskStorage.cs`
  - `services/core-api/WorkOS.Api/Slices/Accommodation/ServiceTask/Policies/ServiceTaskPolicy.cs`
  - `services/core-api/WorkOS.Api/Slices/Accommodation/ServiceTask/ProjectorRules/ServiceTaskProjectorRules.cs`
  - `services/core-api/WorkOS.Api/Runtime/CheckoutServiceProcessManager.cs`
- Lenses:
  - `services/core-api/WorkOS.Api/Runtime/RuntimeAggregateLensStorage.cs`
  - `services/core-api/WorkOS.Api/Runtime/LensQueryService.cs`
  - `docs/contracts/accommodation-lens-contract.json`
  - `apps/mobile/src/runtimeLensCatalog.js`

Current aggregate lenses include `bed-inventory`, `room-readiness`, `payment-risk`, `deposit-liability`, `stay-balance`, `checkout-queue`, `service-task-queue`, `expense-analytics`, `period-performance`, and `risk-command`.

### Dashboard / Risk / Report / PC Admin

- Current PC-like governance views are implemented inside the mobile app shell:
  - `apps/mobile/src/views/financeReconciliationView.js`
  - `apps/mobile/src/views/checkoutServiceView.js`
  - `apps/mobile/src/views/releaseControlView.js`
  - `apps/mobile/src/appRouter.js`
  - `apps/mobile/src/apiClient.js`
- Styling:
  - `apps/mobile/src/styles/finance-reconciliation.css`
  - `apps/mobile/src/styles/checkout-service.css`
  - `apps/mobile/src/styles/release-control.css`

MR-10 can reuse these route and rendering patterns for PC Governance Full until a separate PC admin app is introduced.

### Role Capability / Permission Management

- `services/core-api/WorkOS.Api/Runtime/ConfirmationPolicyCatalog.cs`
- `services/core-api/WorkOS.Api/Runtime/AuthSessionService.cs`
- `services/core-api/WorkOS.Api/Runtime/RuntimeAuthOptions.cs`
- `services/core-api/WorkOS.Api/Runtime/RuntimeSessionStorage.cs`
- `services/core-api/WorkOS.Api/Runtime/SliceRuntimeCapabilityGate.cs`
- `services/core-api/WorkOS.Api/Runtime/ProjectionSeed.cs`
- `docs/contracts/policy-contract.json`
- `docs/contracts/runtime-surface-policy.json`
- `docs/contracts/slice-manifest.json`

Current confirm capability is card / role based. Finance, manager, admin, operator, cleaner, and auditor roles exist in seed and policy surfaces. MR-10 governance actions should use the existing Operations Confirm path and extend capability checks there, not add page-specific write APIs.

### Export / Audit

- Audit and event read paths:
  - `services/core-api/WorkOS.Api/Program.cs`
  - `services/core-api/WorkOS.Api/Runtime/RuntimeEventStorage.cs`
  - `services/core-api/WorkOS.Api/Runtime/RuntimeEvidenceStorage.cs`
  - `services/core-api/WorkOS.Api/Runtime/RuntimeReconciliationMatchingStorage.cs`
  - `services/core-api/WorkOS.Api/Runtime/RuntimeCorrectionCenterStorage.cs`
- Existing endpoints include audit events, workspace events, evidence upload / signed URL, reconciliation, and correction center APIs.
- No dedicated export endpoint or export audit table was found. MR-10 export is gated in PC Governance and records export audit through the existing behavior-event audit path before active use.

## Period Schema Plan

Current period schema exists in `infra/db/migrations/009_accommodation_period_analytics.sql` with:

- `period_reviews`
- `period_metric_snapshots`
- `period_finance_snapshots`
- `period_operation_diagnoses`
- `period_action_plans`
- `period_late_adjustments`

MR-10 should not add schema during this planning task. The implementation plan is to harden the existing period model before adding new tables:

- Normalize tenant / workspace handling so period close is tenant-scoped and timezone-aware.
- Ensure period boundaries are derived from tenant runtime config, not frontend date strings.
- Freeze finance snapshots and operation snapshots at close time.
- Store late changes as append-only `period_late_adjustments`, never by mutating a frozen snapshot.
- Record close checks that prove metrics review, finance review, operation diagnosis, and required action plans were run.
- Ensure period close cannot happen when P0 blockers, unresolved high-risk mismatches, or mandatory open WorkItems remain.
- Enforce Period close only after scope confirmed, metrics reviewed, finance reviewed, operations diagnosed, action plan committed or explicitly skipped, no blocking invariant violation, and business signoff completed.
- LateAdjustment rows are appended only after PeriodReviewClosed, carry reason / actor / optional correction id, and include before / after view data for governance review.

If future MR-10 implementation needs schema additions, expected candidates are `period_close_checks`, `period_risk_snapshots`, `period_governance_exports`, and explicit tenant-scoped period identity. Those are intentionally not implemented by this plan.

## Finance Snapshot Sources

MR-10 finance snapshots must be computed from backend ledger / reconciliation / correction sources only:

- Payment:
  - `hostel_payments`
  - `finance_reconciliations`
  - `payment_allocations`
  - `stay_balances`
  - `payment-risk` lens
- Deposit:
  - `deposit_transactions`
  - `deposit_liabilities`
  - `deposit-liability` lens
- Expense:
  - `expenses`
  - `expense_links`
  - `expense-analytics` lens
- Reconciliation:
  - `bank_statement_imports`
  - `bank_transactions`
  - `payment_match_candidates`
  - `payment_matches`
  - `payment_mismatches`
  - `reconciliation_cases`
- Correction:
  - `ledger_correction_requests`
  - `correction_approvals`
  - `ledger_reversal_entries`
  - `ledger_correction_entries`
  - `correction_audit`
- Evidence / audit:
  - evidence metadata and file hash from `RuntimeEvidenceStorage`
  - audit events from `RuntimeEventStorage`

Snapshot rules:

- Bank transactions are evidence for reconciliation, not business payment facts.
- Deposit received is liability, not revenue.
- Deposit refund is liability settlement, not expense.
- Deposit apply-to-balance reduces liability and outstanding balance, but is not new cash flow.
- Correction entries must be represented as late adjustments or append-only corrections.
- Frozen period snapshots must not be recalculated in place after close.

## Operation Snapshot Sources

MR-10 operation snapshots should be computed from existing resource, stay, checkout, service, blocker, work item, and lens sources:

- Resource:
  - resource setup migrations and storage under `ResourceSetup`
  - `bed-inventory`, `room-readiness`, `blocked-bed`, and `rate-plan` lenses
- Stay:
  - stay lifecycle storage under `StayLifecycle`
  - `active-stay`, `stay-balance`, and `lead-funnel` lenses
- Checkout:
  - `checkout_settlements`
  - `room_inspections`
  - `checkout-queue` lens
- Service:
  - `service_tasks`
  - `service-task-queue` lens
- Blocker / closure:
  - Checkout service process manager records
  - MR-08 blocker and closure checks from the checkout / service view and report
- Work execution:
  - WorkItem / OperationCase runtime stores
  - process manager run records
  - overdue and claim state where available
- Existing aggregate lens bridge:
  - `RuntimeAggregateLensStorage.cs`
  - `LensQueryService.cs`

Operation snapshots must prefer LensSnapshot / DomainEvent-derived state over frontend caches or manually entered dashboard values.

## Expense Ledger Status Decision

The repository has an `ExpenseLedger` slice, schema, storage, and projector:

- `infra/db/migrations/008_accommodation_checkout_service_expense.sql`
- `services/core-api/WorkOS.Api/Slices/Accommodation/ExpenseLedger/Persistence/ExpenseLedgerStorage.cs`
- `services/core-api/WorkOS.Api/Slices/Accommodation/ExpenseLedger/Policies/ExpenseLedgerPolicy.cs`

Decision for MR-10:

- Treat ExpenseLedger as an available but not fully hardened finance snapshot source.
- Track ExpenseLedger integration explicitly in `expense_ledger_status` with `tenant_id`, `status`, `source`, `updated_at_utc`, and `note`.
- Valid status values are `not_integrated`, `manual_imported`, and `ledger_verified`.
- If status is `not_integrated`, FinanceSnapshot must not display expense as `0`; profit metrics remain disabled and PC / RiskCommand must show: `支出账本未接入，利润类指标不可用或待确认`.
- Only approved / accepted expenses should feed period finance snapshots.
- Deposit refunds must never be counted as expenses.
- Deposit deductions must not be counted as expenses unless an explicit business policy creates a separate expense fact.
- `ExpenseLedgerPolicy.cs` is currently minimal and should be hardened before PC Governance Full can mark expense reporting active.
- If policy hardening is not complete, MR-10 GateResult should warn or block active period governance depending on whether expense totals are included in close decisions.

## Risk Command Lens Plan

Current `risk-command` in `RuntimeAggregateLensStorage.cs` provides aggregate counters from balances, payments, service tasks, beds, deposits, and periods. MR-10 should evolve it into a drilldown-first risk item lens.

Each risk item should include:

- `riskId`
- `riskType`
- `severity`
- `amount` or `count`
- `currency`
- `ownerRole`
- `ownerActorId`
- `relatedObject`
- `relatedCaseId`
- `relatedWorkItemIds`
- `relatedLedgerRefs`
- `relatedEvidenceRefs`
- `relatedEventIds`
- `resolveAction`
- `dueAt`
- `drilldownUrl`

Implementation status:

- `RiskCommandLens` now emits source-backed risk items instead of a single demo-style counter aggregate.
- The first supported item types are `debt_risk`, `deposit_liability`, `payment_pending_confirmation`, `refund_payment_pending`, `blocked_beds`, `service_task_backlog`, `period_not_closed`, `reconciliation_mismatch`, `high_risk_correction`, `overdue_work_items`, and `open_blockers`.
- Items without source tables or source refs are dropped by `RiskCommandLensBuilder`; demo, fixture, mock, or frontend-only sources are never shown as official risk counts.
- Each item carries `severityReason`, owner, resolve action, source refs, and a drilldown URL.

Planned risk types and sources:

- Debt risk: `stay_balances`, `stay-balance` lens, payment allocation data.
- Deposit liability: `deposit_liabilities`, `deposit-liability` lens.
- Pending payment confirmation: `hostel_payments`, `payment-risk` lens.
- Pending refund / deposit settlement: deposit ledger and refund queue sources.
- Blocked beds: resource and service lenses.
- Cleaning / repair backlog: `service_tasks`, `service-task-queue` lens.
- Period not closed: `period_reviews`, `period-performance` lens.
- Reconciliation mismatch: `payment_mismatches`, `reconciliation_cases`.
- High-risk correction: `ledger_correction_requests`, correction approvals / audit.
- Overdue WorkItems: WorkItem due / claim state.
- Open blockers: checkout / service blocker sources from MR-08.

No risk item should be shown as official without source references. Display-only or stale projections should be marked as stale and excluded from formal risk counts.

## Action Plan Work Item Plan

MR-10 action plans are WorkItem-backed governance work, not passive dashboard rows or free-text notes.

Implemented flow:

1. Period review detects P0/P1 risk or unresolved blockers.
2. Period close policy requires one or more action plan WorkItems.
3. Action plan WorkItems include owner role, optional owner actor, source risk refs, target metric, due date, severity, and resolve action.
4. WorkItem completion goes through Operations Confirm.
5. Period close re-runs closure checks and records an immutable close check.
6. Late corrections after period close create `period_late_adjustments` or correction WorkItems, not direct snapshot edits.

Implementation status:

- `Accommodation.PeriodOperationsDiagnosed` can suggest a `periodActionPlan` WorkItem intent through the process manager.
- `Accommodation.PeriodActionPlanCommitted` creates a `periodActionPlanExecution` WorkItem intent and emits `Accommodation.PeriodActionPlanWorkItemCreated`.
- `PeriodActionPlanCommitted` persists `period_action_plans.status = committed`; it never marks the action plan completed.
- `periodActionPlan` requires `ownerRole`, `dueAtUtc` or `dueAt`, and `priority`.
- `periodActionPlanComplete` requires `actionPlanWorkItemId` or `workItemId` and produces the later `Accommodation.PeriodActionPlanCompleted` event.
- `periodClose` now requires scope / metric / finance / operation reviews, action plan committed or skipped, no blocking invariant violation, and business signoff before `Accommodation.PeriodReviewClosed`.
- `PeriodReviewClosed` records close high-watermark data and freezes final metric / finance / operation snapshot source versions before the period is marked closed.
- Late changes after close append `period_late_adjustments` with reason, actor, optional correction id, and before / after views; frozen snapshot bodies are not edited.
- Period detail exposes `lateAdjustmentCount`; RiskCommandLens exposes `period_late_adjustment` as a governance risk item with drilldown.

## PC Governance Full Pages

MR-10 PC Governance Full should be implemented using existing PC-like view patterns in `apps/mobile/src/views` unless a dedicated PC admin app is introduced first.

Planned pages:

- Governance Home: period status, open risks, GateResult status, unresolved blockers, and action plan summary.
- Period Close Console: metric review, finance review, operation diagnosis, closure checks, and close decision.
- Finance Snapshot Drilldown: payment, deposit, expense, reconciliation, correction, and late adjustment sources.
- Operation Snapshot Drilldown: resource, stay, checkout, service, blocker, WorkItem, and SLA sources.
- Risk Command Center: drilldown risk item list with severity, owner, evidence, event, and action refs.
- Action Plan Board: governance WorkItems, overdue state, owner role, due date, and completion evidence.
- Reconciliation & Correction Center: reuse `financeReconciliationView.js` and extend links into period governance.
- Checkout / Service Manager: reuse `checkoutServiceView.js` for blockers, timelines, and overdue work.
- Release Control Center: reuse `releaseControlView.js` for MR gate evidence.
- Audit & Evidence Explorer: read audit events, evidence hash, signed URL audit, and correction audit.
- Export Center: optional. Must create audit records for any export before active use.

All PC actions must go through Operations Confirm. MR-10 must not add `/api/period/close`, `/api/report/export`, or similar page-specific business write APIs.

## Invariants

MR-10 should add or enforce these invariant definitions:

- `period.snapshot_frozen_append_only`
- `period.finance_snapshot_from_ledgers_only`
- `period.operation_snapshot_from_lenses_only`
- `period.deposit_not_revenue`
- `period.deposit_refund_not_expense`
- `period.close_requires_metric_finance_operations_reviews`
- `period.close_requires_action_plan_for_high_risk`
- `period.close_blocked_by_open_p0_risk`
- `period.late_adjustment_does_not_mutate_frozen_snapshot`
- `risk.every_risk_has_drilldown_refs`
- `risk.no_demo_or_projection_only_count`
- `risk.severity_explainable`
- `action_plan.required_for_open_high_risk`
- `pc.governance_actions_use_operations_confirm`
- `export.requires_audit_record`
- `bank.import_does_not_create_payment_fact`
- `reconciliation.bank_transaction_single_match_default`
- `ledger.no_edit_old_entry`
- `correction.requires_reason`
- `correction.high_risk_requires_approval`
- `balance.rebuild_after_correction`
- `case.closed_has_no_open_blocker`
- `case.close_requires_closure_policy`
- `blocker.no_duplicate_open_resolution`
- `shadow.no_shadow_event_consumed_by_official_projector`

## Shadow Strategy

Recommended slice IDs:

- `PeriodAnalytics`
- `RiskCommand`
- `PCGovernance`

Shadow compare scopes:

- `period_finance_snapshot`
- `period_operation_snapshot`
- `risk_command_items`
- `action_plan_workitems`
- `pc_governance_surface`
- `export_audit`

Green:

- Finance snapshot totals match ledger-derived totals.
- Operation snapshot totals match lens / event-derived totals.
- Risk items have source refs and drilldown URLs.
- Required action plans exist for high-risk open issues.
- PC governance reads only official sources and does not mutate facts.

Yellow:

- Display-only mismatch.
- Candidate score / explanatory field mismatch.
- Non-critical stale lens with fallback to marked stale state.
- Optional PC table field missing without affecting close decision.

Red:

- Deposit counted as revenue.
- Deposit refund counted as expense.
- Bank import creates business fact.
- Correction edits an old ledger entry.
- Period frozen snapshot mutated in place.
- Period closed with open P0 risk, open blocker, or mandatory WorkItem.
- Risk item displayed without source refs.
- PC governance action bypasses Operations Confirm.
- Shadow data is consumed by the official projector.

## Cutover Strategy

Feature flags:

- `period.review.enabled`
- `period.finance_snapshot.enabled`
- `period.operation_snapshot.enabled`
- `period.close.enabled`
- `period.late_adjustment.enabled`
- `risk_command.enabled`
- `pc_governance_full.enabled`
- `admin.role_capability.enabled`
- `export.ledger.enabled`

The implemented cutover contract is stored in `docs/v5.4/period-risk-pc-governance-cutover.config.json`.

Dependencies before active:

- PaymentLedger release evidence recovered or regenerated.
- DepositLedger release evidence recovered or regenerated.
- ResourceInventory active.
- StayLifecycle active.
- CheckoutSettlement / ServiceTask / BlockerEngine active or green pilot.
- Reconciliation / CorrectionCenter green and append-only.
- Evidence Secure Substrate active.
- Gate runner, invariant runner, and shadow compare runner active.
- RoleCapability rules for finance, manager, admin, auditor, and operator are explicit.
- ExpenseLedger policy hardening decision completed.

Pilot:

- Tenant: test tenant.
- Roles: boss, manager, finance, admin.
- Actor scope: named governance owners only.
- Period scope: limited `period_range`; first contract is 2026-05-01 through 2026-05-31.
- Exports: disabled or audited-only.
- Close action: observing first, then blocking after green reports.

Active:

- PC Governance Full is the default governance read surface.
- Period close uses backend policy and closure checks.
- RiskCommandLens is drilldown-first and source-backed.
- Action plans are WorkItem-backed.
- Exports, if enabled, are audited.

## Rollback / Compensation Strategy

Rollback:

- Set `PeriodGovernance`, `RiskCommand`, and `PCGovernance` runtime modes to legacy, paused, or disabled.
- Keep created period reviews, snapshots, risk records, action plan WorkItems, audit events, and exports.
- Do not delete frozen snapshots or correction records.
- Disable PC close / export actions through feature flags if evidence is incomplete.

Compensation:

- Incorrect period snapshot: append `period_late_adjustment` or create a superseding governance correction; do not mutate closed snapshot rows.
- Incorrect risk item: append correction / resolution event and rebuild RiskCommandLens.
- Incorrect action plan: close as superseded with reason and create a new WorkItem.
- Incorrect finance fact: route through Correction Center.
- Incorrect reconciliation decision: reopen ReconciliationCase or create follow-up correction request.
- Incorrect period close: reopen or supersede period review through an explicit governance correction path; never SQL-delete close evidence.

## Risks And Blocked Items

- MR-06 and MR-07 release reports are missing, so PaymentLedger and DepositLedger gate evidence must be recovered or regenerated.
- `ExpenseLedgerPolicy.cs` is minimal; expense snapshot use should be gated until policy hardening is complete.
- `risk-command` currently exposes aggregate counters, not full drilldown risk items.
- No dedicated PC admin app exists; current PC-like pages live under `apps/mobile/src/views`.
- No dedicated export audit implementation was found.
- Current period analytics uses existing workspace-oriented tables. MR-10 implementation must verify tenant scoping, timezone, currency, and period boundary rules before active cutover.
