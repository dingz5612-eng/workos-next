# ADR-0002 Current OAM Authority

## Status

Accepted.

## Decision

WorkOSNext has one top-level architecture authority: OAM, with `docs/oam/current-architecture.md`, `docs/oam/current-architecture.manifest.json`, `docs/contracts/oam.current.json`, and `docs/system/current-system-map.md` as the current source of truth.

Any prior misspelled architecture token, retired stage term, duplicate authority file, unused placeholder package, empty service shell, or unreferenced template must be removed instead of kept as an alias.

## Consequences

- Operations Runtime remains the main execution chain.
- `POST /api/operations/work-items/{workItemId}/confirm` remains the main business write path.
- Projection, Lens, Search, BI, Dashboard, Profile, and shared receipts remain read-side or projection-side and cannot write business or finance facts.
- Management Cockpit and Control Plane can issue ControlPlaneCommand only; they cannot directly mutate business facts.
- Current module and package manifests must bind Product Capability, Domain Invariant, API, database, tests, and rules, or the shell is deleted.
- Business production and production confirm remain blocked until current OAM admission, evidence, certification, rollback, and CI gates pass.
