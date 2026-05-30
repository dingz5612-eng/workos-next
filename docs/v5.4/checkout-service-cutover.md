# Checkout / Service / Blocker Cutover Path

This document establishes the V5.4 shadow/pilot/active path for
CheckoutSettlement, ServiceTask, and BlockerEngine.

## Feature Flags

The authoritative first-batch config is
`docs/v5.4/checkout-service-cutover.config.json`.

Required flags:

- `checkout.start.enabled`
- `checkout.room_inspection.enabled`
- `checkout.damage_assessment.enabled`
- `service_task.enabled`
- `service_task.verify.enabled`
- `blocker_engine.enabled`
- `case_closure_policy.enabled`
- `claim_sla_lite.enabled`

All flags use tenant, role, actor, device trust, selected room/stay, and
percentage-compatible scope rules. Initial status is `shadow`.

## Slice Cutover States

Required slice ids:

- `CheckoutSettlement`
- `ServiceTask`
- `BlockerEngine`

Dependencies before pilot/active:

- `ResourceInventory` active
- `StayLifecycle` active
- `PaymentLedger` active or pilot stable
- `DepositLedger` active or pilot stable
- `StayBalanceProjection` active
- Evidence Secure Substrate active
- Claim skeleton active

Pilot scope is limited to `test-tenant`, roles `manager`, `operator`,
`cleaner`, and `finance`, with configurable actor, room, and stay lists.

## Routing

- Shadow: legacy path remains official; new checkout/service/blocker paths write
  shadow evidence and process intents only.
- Pilot: selected tenant/role/actor/room/stay routes to Operations Confirm.
- Active: Operations Confirm writes official events; ResourceInventory remains
  the only owner of room/bed release facts.
- Rollback: route back to legacy by runtime mode and feature flags; facts already
  written remain append-only.

## Shadow Compare

Config: `docs/v5.4/checkout-service-shadow-compare.config.json`.

Green:

- expected WorkItems created
- no direct DepositEntry write
- no direct BedStatus write
- closure blockers match expected

Yellow:

- timeline display mismatch
- non-critical dueAt mismatch

Red:

- Case closed with open blocker
- duplicate blockers
- service directly changed BedStatus
- checkout directly wrote DepositEntry
- bed released before cleaning/service verified
- shadow consumed by official projector

## Invariants

The invariant definitions live in `docs/v5.4/invariant-definitions.json`:

- `case.closed_has_no_open_blocker`
- `case.close_requires_closure_policy`
- `blocker.no_duplicate_open_resolution`
- `service.cannot_directly_change_bed_status`
- `checkout.cannot_directly_write_deposit_entry`
- `checkout.cleaning_required_before_release`
