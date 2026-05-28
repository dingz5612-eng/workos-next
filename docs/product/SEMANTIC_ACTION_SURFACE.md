# Semantic Action Surface

WON-08 turns the task operation area into a semantic action surface.

The operation area is no longer a loose form. It is derived from the scenario semantic model and shows the same execution contract that the backend must later enforce.

## Surface Layout

Every task page operation surface has six required parts:

- Current action: the task title plus the current scenario stage.
- System judgement: blockers and exception branches that explain whether the action can continue.
- Business fields: scenario fields that can become backend DTO fields.
- Evidence materials: the documents, photos, receipts, signatures, or review records needed for audit.
- Human confirmation summary: the policy text that makes critical actions explicit.
- After state: the object states expected after the action is confirmed.

The surface can also show analytics hints. These are not user obligations; they are backend and product signals that should be collected later.

## Semantic Sources

The frontend currently reads the action surface from:

- `scenarioFlows[*].fields`
- `scenarioFlows[*].evidence`
- `scenarioFlows[*].policy`
- `scenarioFlows[*].semantic.actions`
- `scenarioFlows[*].semantic.states`
- `scenarioFlows[*].semantic.analytics`
- `scenarioFlows[*].semantic.exceptions`

This keeps UI, backend DTO design, audit evidence, and user guidance aligned.

## Accommodation Example

For the deposit task, the surface shows:

- Stay order, resident, room/bed, and deposit evidence fields.
- Deposit evidence and finance confirmation records.
- Human confirmation boundary for deposit and check-in.
- Expected states such as `Application.Approved`, `Bed.Reserved`, and `StayOrder.ReadyForCheckIn`.

## Repair Example

For repair dispatch, the surface shows:

- Repair order, vehicle, driver, and technician assignment fields.
- Diagnosis records, repair photos, acceptance signature, and fee materials.
- Human confirmation boundary for completion, fee confirmation, and repair closure.
- Expected states such as `Vehicle.Arrived`, `RepairOrder.WaitingDiagnosis`, and `RepairOrder.InProgress`.

## Backend Contract Direction

The backend should later expose an action preparation endpoint that returns this surface as data:

- `actionId`
- `taskId`
- `objectId`
- `currentAction`
- `systemJudgement`
- `fields`
- `evidenceRequirements`
- `confirmationPolicy`
- `afterStates`
- `analyticsEvents`

The confirm endpoint should accept only the action payload and evidence references produced by this surface. Search, workbench, AI, and voice entry must not bypass this preparation and confirmation flow.
