# V5.4 Production Observability

The production observability surface is exposed through `GET /api/observability/runtime`
and rendered in PC Governance Full under **Production Observability**.

## Metric Groups

Runtime:
- `confirmLatencyP95Ms`
- `confirmFailureCount`
- `idempotencyConflictCount`
- `forbiddenCount403`
- `conflictCount409`
- `validationCount422`
- `handlerFailureCount`

Outbox:
- `outboxLagSeconds`
- `deadLetterCount`
- `replayCount`

Projection:
- `projectionLagSeconds`
- `rebuildCount`
- `staleLensCount`

Mobile:
- `workItemBundleP95Ms`
- `uploadFailureCount`
- `submitRetryCount`
- `draftRecoveryCount`

Money:
- `paymentConfirmWithoutEvidenceViolations`
- `allocationOverAvailableViolations`
- `stayBalanceMismatchCount`

Deposit:
- `availableRefundNegativeCount`
- `refundFailedDoubleCount`
- `heldAmountNegativeCount`

Checkout:
- `openBlockers`
- `duplicateBlockers`
- `fakeCloseAttempts`

Control Plane:
- `gateResultStatus`
- `redShadowReports`
- `blockingInvariantFailures`
- `releaseState`

## Sources

- Runtime latency and failure counters are gathered in the runtime process.
- Outbox lag and dead-letter counts read `outbox_messages`.
- Replay count reads `outbox_dead_letter_replay_audits`.
- Projection rebuild and stale checkpoint counts read `projection_rebuild_audits`
  and `projection_checkpoints`.
- Mobile experience counters read `behavior_events` instrumentation.
- Money and deposit violation counts use ledger-derived SQL checks.
- Checkout blocker metrics read ProcessManager request intents.
- Control Plane status reads `control_plane.gate_results`,
  `control_plane.shadow_compare_reports`,
  `control_plane.runtime_invariant_checks`, and
  `control_plane.release_manifests`.

## Guardrails

- The panel is read-only.
- Metrics do not create DomainEvent, LedgerEntry, WorkItem, or release objects.
- Financial violation counts are derived from ledger/projection data, not user
  hand-entered dashboard numbers.
- Control Plane health is machine evidence: GateResult, shadow report grade,
  invariant failures, and release state.
