# V5.5 API Write Classification

The V5.5 API boundary is defined by
`docs/rules/v5.5/api-boundary.yml` and enforced by
`scripts/check-api-boundaries.mjs`.

## Default Rule

All non-GET `/api/*` routes are write routes and must be classified in exactly
one category. Unclassified write routes are P0.

## Categories

- `operationsBusinessWrite`: only
  `POST /api/operations/work-items/{workItemId}/confirm`.
- `compatibilityBusinessWrite`: retired; the category must stay empty.
- `mobileExperienceWrite`: mobile draft, client event, and recent-object state;
  no business facts.
- `evidenceWrite`: evidence object, file, and review writes; no payment or
  deposit confirmation facts.
- `reconciliationGovernanceWrite`: bank import, matching, mismatch, and
  decision writes; no PaymentConfirmed or DepositConfirmed facts.
- `governanceWrite`: allowed Dormitory Operations workspace-start
  coordination writes; they create a handling workspace instance but do not
  confirm business facts.
- `correctionCenterWrite`: append-only correction request, approval, rejection,
  and apply path. Apply may affect ledger projections only as an explicit
  append-only correction service with invariants.
- `pcGovernanceWrite`: governance export audit with capability and reason.
- `securitySessionWrite`: auth and device session lifecycle.
- `systemProjectionWrite`: Operations coordination records and projection
  maintenance.
- `behaviorEventWrite`: behavior telemetry only.
- `controlPlaneWrite`: Control Plane writes only, if added later.

## Current Classification

The machine file is the source of truth. This document is a readable summary for
reviewers. Run:

```powershell
node scripts/check-api-boundaries.mjs --self-test
node scripts/check-api-boundaries.mjs --out=.tmp/v5_5/api-boundary-check-v3.json
```

The output must report:

- `version = 3`
- `unclassified_write_route_count = 0`
- `multi_classified_write_route_count = 0`
- `business_write_route_count = 1`
