# Release Go / No-Go Acceptance

## Required Release Evidence

A release can move beyond planning only when evidence exists for:

- Operations Confirm remains the primary business write path.
- Any Workspace/Card prepare or confirm use is compatibility-only.
- Mobile BFF routes do not write business facts.
- Control Plane seven objects are physically present and writable.
- Shadow Namespace exists and is isolated from official runtime facts.
- GateResult, InvariantCheck, and ShadowCompareReport are machine-generated or
  produced by approved runner code paths.
- RollbackInstruction records either `rollback` or `compensating`.
- No-Go evidence is classified as `P0`, `P1`, or `P2`.
- InvariantMonitor records `blocking` or `observing`.

## Acceptance Checklist

- `docs/v5.4/operations-api-allowlist.json` contains the Operations, business
  write, compatibility, and forbidden route patterns.
- `scripts/check-api-boundaries.mjs --self-test` detects a simulated forbidden
  route.
- `scripts/check-api-boundaries.mjs` passes against repository route files.
- Migration tests verify Control Plane tables, Shadow Namespace, constraints,
  and write paths.
- CI runs the API boundary check before architecture guard.

## No-Go Evidence Mapping

P0/P1/P2 items must be mapped to durable evidence:

| Evidence | Source |
| --- | --- |
| Gate result | `control_plane.gate_results` |
| Invariant result | `control_plane.runtime_invariant_checks` |
| Shadow compare result | `control_plane.shadow_compare_reports` |
| Rollback / compensating instruction | `control_plane.rollback_instructions` |
| CI execution | `ci_run_id` on gate/check/report rows |
| Business signoff | `business_signoff_refs` on gate results |

P0 items block merge or release. P1 items require owner signoff. P2 items require
tracked follow-up.
