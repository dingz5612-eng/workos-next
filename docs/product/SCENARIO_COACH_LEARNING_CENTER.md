# Scenario Coach Learning Center

WON-10 changes the learning experience from a knowledge result list into a scenario coach.

The user does not need another document center. The user needs to understand the exact business stage they are stuck on and return to the correct task.

## UX Rules

- Search highlights and expands matching scenario stages.
- Filters narrow scenario loops; they do not create a separate result area.
- Each scenario loop owns its own stage guide.
- Each stage guide explains one step only.
- Business jump actions live inside the stage guide.
- Normal users must not see technical object names, enum names, analytics keys, or backend state identifiers.

## Stage Guide Template

Every stage guide uses the same user-facing template:

- What this step does.
- Which fields are needed.
- What the system checks.
- Which evidence is needed.
- Who confirms.
- What state the business reaches after this step.
- What the next step is.
- What AI can and cannot do.
- Enter related task / open related object.

## Learning Perspectives

The learning filter is a perspective, not a result type:

- All.
- How to handle.
- Required fields.
- Blocking exceptions.
- Human confirmation.
- Next step.
- AI boundary.

## Backend Direction

The backend should not create a detached help table. It should project scenario and action definitions into a `StageHelpProjection`.

Recommended projection fields:

- `scenarioId`
- `stageId`
- `domain`
- `language`
- `stageLabel`
- `purpose`
- `requiredFields`
- `systemChecks`
- `evidenceRequirements`
- `confirmationPolicy`
- `afterStateLabel`
- `nextStageLabel`
- `aiCan`
- `aiCannot`
- `relatedTaskId`
- `relatedObjectType`
- `version`

Task pages, search help, AI answers, and the scenario coach should read the same projection.
