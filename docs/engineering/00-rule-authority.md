# V5.5 Engineering Rules Authority

This file is the highest repository-level engineering rules authority for
WorkOSNext / FunRide OMR runtime work after WON-18.

## Rule Precedence

When rules conflict, use this order:

1. `docs/engineering/*` rules.
2. `docs/acceptance/*` release and Go/No-Go acceptance rules.
3. Machine-readable contracts, allowlists, schemas, and registries under
   `docs/contracts/*`, `docs/v5.4/*`, and future `docs/v5.5/*`.
4. Guard scripts, invariant runners, shadow compare runners, and tests.
5. `docs/architecture/*` compatibility references.
6. Product, UX, review, and historical planning notes.

`docs/architecture/*` may explain background, but it must not override
Operations Runtime, Control Plane, API boundary, fact ownership, MR contract, or
GateResult rules defined under `docs/engineering` and `docs/acceptance`.

## Target Runtime Axis

New work must design around this axis:

```text
Definition
  -> OperationCase
  -> WorkItem
  -> CommandSubmission
  -> SliceCommandHandler
  -> DomainEvent / LedgerEntry
  -> ProcessManager
  -> Projection / Lens
  -> Mobile / PC Surface
```

The old Workspace/Card prepare and confirm endpoints remain compatibility
wrappers only. They must not be the primary extension point for new business
behavior.

## Batch Gate Rule

P0 WON-18 gate evidence must be green before any business batch starts. If CI or
V5.4 Control Plane Guards is red, pending, missing, or not linked to the current
work branch, Mobile / Resource / Stay / Money / Deposit / Checkout business work
is blocked.

## Hard No-Go Rules

- No page-specific business write API.
- No Mobile BFF business fact writes.
- No PC Governance, Reconciliation, or Correction endpoint may directly write
  business facts unless it is explicitly an Operations Confirm wrapper or a
  governance provisional write with invariant evidence.
- No Shadow Runtime consumption by the official projector.
- No weakened architecture guard, `continue-on-error` gate, or hand-authored
  passed GateResult.
- No production demo fallback.
- No mechanical file splitting merely to satisfy line budgets; split only by
  responsibility and owner.

## Codex Execution Contract

Codex and other automated agents must read this authority before starting a new
engineering batch. If the task asks for a later batch while an earlier dependency
is incomplete, the agent must stop at the dependency and produce evidence rather
than implementing downstream business behavior.
