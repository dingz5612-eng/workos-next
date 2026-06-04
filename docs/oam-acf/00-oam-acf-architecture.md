# OAM-ACF v8 Architecture

OAM-ACF v8 is the target top-level architecture for WorkOSNext. It organizes
business operation, authority, control, and feedback around one execution axis:
Operations Runtime.

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

The architecture separates:

- Rule authority: `docs/engineering` and `docs/rules/v5.5`.
- State authority: `artifacts/release-state/current-state.json`.
- Business write authority: Operations Confirm and owning slice command
  handlers.
- Read model authority: Projection / Lens output derived from persisted facts.
- Surface authority: Mobile and PC surfaces that consume runtime projections and
  lenses without writing business facts.

`ProjectionRuntime` remains the current implementation facade for projection and
Lens materialization. Workspace/Card may only be projection/display
compatibility input. The older Workspace/Card prepare/confirm write entry
points are retired and must stay deleted. Neither ProjectionRuntime nor
Workspace/Card is the top-level architecture.

Dormitory remains L1 internal pilot observation. Dormitory L2 and Business
Production remain blocked. Repair, Parts, and HR remain L0 contract preview.
