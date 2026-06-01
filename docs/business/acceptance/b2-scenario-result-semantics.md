# B2 Scenario Result Semantics

RT-B uses this contract to prevent B2 certification from treating every blocked condition as a fake committed business event.

## committed_scenario

- Must include `CommandSubmission`, `DomainEvent`, and `FactTrace`.
- Money scenarios must include a balanced `LedgerTransaction`.
- Projection pending is not submit failure; it remains committed with pending projection evidence.

## rejected_command_scenario

- Must include `RejectedCommandSubmission`, `RejectionTrace`, and audit or invariant evidence.
- Must not include business `DomainEvent`.
- Must not include `LedgerTransaction`.
- `403`, `409`, and `422` have distinct reason codes and next actions.

## gate_only_blocked_scenario

- Must include `GateResult`.
- Must include `InvariantCheck` or `ShadowCompareReport`.
- Must include rollback or compensation blocker evidence.
- Does not require business `CommandSubmission`.
- Must not write business facts.

## Current Boundary

B2 validates certification behavior only. It does not activate Dormitory production, Repair production, Parts production, HR production, or unrestricted user scope.
