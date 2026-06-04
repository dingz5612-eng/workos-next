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

Workspace/Card prepare and confirm write endpoints are retired and must stay
deleted. Workspace/Card may only appear as projection/display compatibility
input. ProjectionRuntime may remain a projection/Lens compatibility facade, but
it is not the command boundary, the top-level architecture, or a business write
extension point.

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

## Issue Repair Protocol

When a user or test exposes an error, duplicate, redundant, compatibility,
invalid, confusing, slow, or broken behavior, the repair order is mandatory:

1. Observe the real behavior and name the affected user/business scenario.
2. Classify the impact across business flow, architecture layer, data/fact
   ownership, validation, surface experience, copy, performance, and evidence.
3. Locate the broken layer in the Operations Runtime axis before changing UI.
4. Align the target flow against the active contract, rule authority, Definition
   Registry, Admission Kernel, Language/Search Kernel, Control Plane, and
   Evidence Graph.
5. Update contract/model/rule first when the behavior is a global rule.
6. Implement the smallest root-cause architecture change that removes the broken
   path; delete retired compatibility, duplicate, or invalid code found in the
   impact scope.
7. Verify with unit/contract/integration checks and real browser operation when
   the behavior is user-facing.

Page-level hard-adds, old compatibility fallbacks, repeated copy patches, and
direct edits of completed business facts are forbidden repair strategies.
