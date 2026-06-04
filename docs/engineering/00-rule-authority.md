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

## Unified Surface Architecture Rule

All user-visible pages must use the active OAM-ACF v8 / Operations Runtime
surface architecture, shared shell, shared route guards, and shared named
experience components. A page may specialize data, permissions, readonly state,
or business actions, but it must not keep a page-private legacy shell when a
current shared component exists.

Non-current architecture is a P0 defect. When a surface is found using an old
page-specific style, deprecated component, compatibility flow, or retired write
model, the affected path must be root-cause rewritten onto the current
architecture and the obsolete implementation must be deleted in the same impact
scope. It is forbidden to hide deprecated UI behind a new page, copy old layout
logic into a new component, or preserve retired compatibility code for visual
convenience.

Frontend Experience System is the mandatory execution system for user-visible
frontend work. It has five required layers: shared components, Surface contract,
multilingual dictionary, state/action contract, and real browser screenshot
evidence. Pages may specialize business content, but not architecture. New or
discovered old-architecture pages must be rewritten onto the current Frontend
Experience System and the obsolete implementation must be deleted rather than
wrapped, hidden, or kept as fallback.

Step-page experience parity is mandatory. New active step, readonly completed
step, and append-only correction step pages must share the same step rail,
direct `OperationCardShell`, state/check panel, action hierarchy, feedback
entry, and Admission/Runtime decision markers. They must not keep a
page-private outer `intent-card` wrapper, and readonly completed records must
not keep a `workspace-control` visual wrapper. When one mode improves, sibling
modes must be checked and aligned in the same Frontend Experience System pass;
users must not have to enumerate every page one by one.

Post-submit navigation is part of the Operations Runtime surface contract. When
an active Operations WorkItem confirm succeeds, the frontend must auto-advance
to the next actionable persisted WorkItem in the same workspace when one exists.
Completed readonly records are explicit review surfaces or terminal fallback
surfaces, not the normal continuation path after every submit. A
`returnCurrentWorkItem` button must not be required for ordinary post-submit
continuation.

Step status color is semantic language, not decoration. `OperationStepRail` must
distinguish completed, ready, in-progress, not-started, and blocked states with
stable visual tokens and machine-readable state markers, and the current step
must have a stronger focus ring across new, readonly, and correction pages.
Append-only correction WorkItems must use an explicit correction visual state
and marker; they must not display as ordinary ready blue. Terminal completed
records remain completed as the primary state even when a correction marker
exists; only the active append-only correction WorkItem displays correction as
the primary state.

Resource setup bed cardinality is a Definition and Truth Boundary rule. When a
room is configured with capacity or bedCount greater than one, `bedSetup` must
confirm the room's bed list in one Operations WorkItem using `roomId`,
`bedCount`, and `bedLabels`; it must not regress to one manual bed-only input.
The ResourceSetup slice must expand that confirmation into one Bed fact per
label, and room-beds block/release scope must apply to all beds in the room.

Service task resource availability scope is mandatory. `roomSetup` and
`bedSetup` define initial resource truth only; maintenance, cleaning, or service
work that blocks saleability must enter `serviceTaskCreate` with `resourceScope`
(`room`, `bed`, or `room_beds`) and `blocksAvailability=true`, then release
through `roomReleaseAfterService` with `taskId`, the matching `resourceScope`,
and a backend-approved `ServiceTaskVerified` event for the same task. A
client-provided `serviceTaskVerified` field is not proof and must not bypass the
event-state boundary. ServiceTask may request availability changes, but
ResourceSetup remains the only BedStatus/RoomStatus fact owner. A room-scoped
service task must not require or mutate a single bed; a bed-scoped service task
must not mutate the whole room; `room_beds` applies to every bed in that room.

Account / User / Actor Kernel is mandatory for internal operations identity.
Username, nickname, department, business line, role, capability, account status,
password credential, tenant, session, and device trust are backend truth
objects. The login page may only accept username and password. It must not let a
user self-select department, business line, role, capability, tenant, or device
trust. User and permission management belongs in the PC Governance plane and
requires backend session capabilities such as `account.user.manage` or
`pc.governance.admin`; all account mutations must append account audit evidence.

Admission Kernel must authorize Operations Confirm, Search, PC pages, finance
actions, release actions, session revoke, and device trust from backend session
capabilities, not frontend state, URL parameters, local storage, or request-body
authority fields. Development demo accounts are allowed only in local
Development when explicitly enabled; production and pilot runtimes must use the
real account table with versioned slow password hashes and must not seed or
accept development-only accounts.

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
