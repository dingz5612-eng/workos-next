# Projection Rebuild Tool

`scripts/projection/rebuild` is the Final Ops entry point for projection rebuild
dry-runs, checkpoints, and audit records.

Examples:

```powershell
node scripts/projection/rebuild --tenant T1 --lens StayBalanceLens --requested-by ops-user --reason "projection verification" --actor-role operator --capabilities projection.rebuild --device-id pc-1 --device-trust trusted
node scripts/projection/rebuild --tenant T1 --from-event EVT-1 --to-event EVT-100 --dry-run --requested-by ops-user --reason "event range verification" --actor-role operator --capabilities projection.rebuild --device-id pc-1 --device-trust trusted
```

Supported lenses:

- WorkQueueLens
- CaseTimelineLens
- BedInventoryLens
- RoomReadinessLens
- StayBalanceLens
- PaymentRiskLens
- DepositBalanceLens
- DepositLiabilityLens
- CheckoutQueueLens
- ServiceTaskQueueLens
- RiskCommandLens
- PeriodPerformanceLens

Rules:

- Rebuild reads source facts and existing projection rows only.
- Rebuild does not write `audit_events`, `domain_events`, or business fact
  tables.
- Rebuild is a high-risk operation and requires `projection.rebuild`
  capability, a trusted PC/device, and a non-empty reason.
- Non-dry-run writes `projection_checkpoints`.
- Every run writes `projection_rebuild_audits`, including authorization context
  in the audit details.
- Event range rebuild filters rows by source event references and records the
  requested range.
