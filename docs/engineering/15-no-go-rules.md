# No-Go Rules

No-Go items must be classified as `P0`, `P1`, or `P2`. A release, pilot, or
runtime cutover cannot merge ambiguous No-Go evidence.

## P0 No-Go

P0 means the release must not proceed.

- New page-specific business write API.
- Mobile BFF writes business facts.
- Business write bypasses Operations Confirm.
- GateResult is manually authored rather than machine-generated.
- Control Plane seven objects are not physically persisted.
- Shadow Namespace is not physically isolated from formal production facts.
- RollbackInstruction does not distinguish rollback from compensating action.
- Blocking invariant fails.

## P1 No-Go

P1 means the release needs explicit owner signoff before pilot or active mode.

- Observing invariant has unresolved violations.
- Shadow compare is yellow without a documented owner and expiry.
- Rollback validation steps are incomplete.
- Gate evidence is missing a traceable CI run id or input hash.

## P2 No-Go

P2 means the release can continue only when the risk is recorded and tracked.

- Documentation is incomplete but the machine gate is green.
- Non-blocking compare examples need cleanup.
- Manual business signoff reference is delayed but not required for the current
  scope.

## Evidence Mapping

Every No-Go item must map to one or more of:

- `control_plane.gate_results`
- `control_plane.runtime_invariant_checks`
- `control_plane.shadow_compare_reports`
- `control_plane.rollback_instructions`
- CI run id
- business signoff reference
