# Architecture Term Policy

Use these terms consistently:

- OAM-ACF v8: target top-level architecture.
- V5.5 Rule Authority: highest engineering rules authority.
- Operations Runtime axis: execution main axis.
- `ProjectionRuntime`: current implementation facade for projection and Lens
  materialization.
- Workspace/Card: compatibility wrapper for older prepare/confirm endpoints.
- `current-state`: release posture decision authority.

Do not describe `ProjectionRuntime`, Workspace/Card, page models, search models,
learning models, or AI models as the top-level architecture or as new business
extension points.

Do not write language that opens production scope. The allowed posture is:

- Dormitory: L1 internal pilot observation.
- Dormitory L2: blocked.
- Business Production: blocked.
- Repair / Parts / HR: L0 contract preview.
