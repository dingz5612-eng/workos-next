# Workspace Card Backend Contract Draft

This draft is the backend implementation target for the current mobile prototype.

Frontend, backend, search, workbench, scenario coach, and AI must use the same center model:

```text
IntentWorkspaceProjection + WorkspaceCardProjection
```

## DTO Draft

```csharp
public sealed record IntentWorkspaceProjectionDto(
    string WorkspaceId,
    string Domain,
    LocalizedText Title,
    LocalizedText Summary,
    IReadOnlyList<WorkspaceCardProjectionDto> Cards,
    LocalizedText NextBestAction,
    IReadOnlyList<WorkspaceBlockerDto> Blockers);

public sealed record WorkspaceCardProjectionDto(
    string CardId,
    string Status,
    LocalizedText Title,
    WorkspaceFieldSetDto Fields,
    IReadOnlyList<EvidenceRequirementDto> EvidenceRequirements,
    IReadOnlyList<SystemCheckDto> SystemChecks,
    IReadOnlyList<WorkspaceBlockerDto> BlockerRules,
    IReadOnlyList<WorkspaceEventDefinitionDto> Events,
    WorkspaceTransitionDto Transitions,
    ConfirmationPolicyDto ConfirmationPolicy);

public sealed record WorkspaceFieldSetDto(
    IReadOnlyList<WorkspaceFieldDto> Business,
    IReadOnlyList<WorkspaceFieldDto> System,
    IReadOnlyList<WorkspaceFieldDto> Analytics);

public sealed record WorkspaceFieldDto(
    string FieldId,
    LocalizedText Label,
    string Layer,
    string Type,
    bool Required,
    string Source,
    bool VisibleToUser,
    string? AnalyticsKey);
```

## Field Types

- `text`
- `select`
- `searchSelect`
- `money`
- `evidenceUpload`
- `confirmation`
- `readonly`

## Event Draft

Accommodation events:

- `ApplicationApproved`
- `StayOrderPrepared`
- `BedSelected`
- `DepositEvidenceSubmitted`
- `DepositBlocked`
- `FinanceDepositConfirmed`
- `CheckInConfirmed`
- `CheckoutStarted`
- `RoomInspectionSubmitted`
- `CheckoutSettlementPrepared`
- `CheckoutFinanceConfirmed`
- `CheckoutCompleted`
- `DepositExceptionDetected`
- `DepositEvidenceResubmitted`
- `DepositEvidenceReviewed`
- `DepositExceptionReturnedToBusiness`
- `RoomCreated`
- `BedCreated`
- `BedActivated`

Repair events:

- `RepairCustomerVehicleLinked`
- `RepairRequestCreated`
- `VehicleArrived`
- `RepairDispatchPrepared`
- `RepairDispatched`
- `RepairDiagnosisSubmitted`
- `RepairExecutionUpdated`
- `RepairBlocked`
- `RepairInspectionSubmitted`
- `RepairFeeMaterialSubmitted`
- `RepairCustomerConfirmed`
- `RepairClosed`
- `RepairCustomerCreated`
- `VehicleProfileCreated`
- `RepairServiceRuleConfigured`

## Projection Targets

Every confirmed event should update:

- `IntentWorkspaceProjection`
- `WorkspaceCardProjection`
- `WorkQueueProjection`
- `SearchProjection`
- `ScenarioCoachProjection`
- `AiContextProjection`
- `AuditEvidenceProjection`

## API Draft

```http
GET /api/workspaces
GET /api/workspaces/{workspaceId}
POST /api/workspaces/{workspaceId}/cards/{cardId}/prepare
POST /api/workspaces/{workspaceId}/cards/{cardId}/confirm
```

`prepare` returns the current card with system checks, blockers, field defaults, and allowed actions.

`confirm` accepts only card payloads prepared by the runtime and must enforce human confirmation when required.

AI, search, workbench, voice, and scenario coach must never call domain write actions directly.

## Completion Criteria

A workspace card is backend-ready only when it can answer:

- Which user-facing fields are required?
- Which system fields are read-only?
- Which analytics fields are collected?
- Which evidence is required?
- Which checks can block progress?
- Which event is emitted?
- Which projections update?
- Which card becomes next?
- Who must manually confirm?
