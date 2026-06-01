# Dormitory Internal Pilot On-call Runbook

## Scope

This runbook applies only to `dorm-int-l1-2026-06`. It allows L1 Internal Pilot support actions and does not authorize Dormitory L2 Production, Repair production, Parts production, or HR production.

## P0 Response

When a P0 alert fires, the on-call owner must:

1. Open or link the related `WorkItem` or `GateResult`.
2. Pause the Dormitory pilot if money, evidence, rollback, invariant, or bed occupancy safety is uncertain.
3. Disable money confirm for payment mismatch or finance daily close failure.
4. Disable refund approve for refund blocked or deposit liability uncertainty.
5. Freeze high-risk WorkItem types for bed double occupancy, P0 invariant failure, red shadow, or outbox dead-letter.
6. Create a corrective WorkItem with owner, due time, evidence requirement, and audit reference.
7. Record the user-facing hold message: `业务暂停/请联系经理`.

## Required Evidence

Every P0 response must keep append-only evidence:

- `GateResult` or `RuntimeInvariantCheck`
- `RejectionTrace` or `FactTrace`
- `RollbackInstruction`
- `CompensationInstruction` when money or ledger correction is involved
- corrective `WorkItem`

## Owner Matrix

- `releaseOwner`: gate hold, pilot pause, rollback approval
- `technicalOwner`: outbox, projection, runtime, device trust
- `finance`: payment mismatch, refund blocked, daily close failure
- `manager`: SLA, bed occupancy, escalation, operational pause
- `supportOwner`: user support and evidence upload recovery
