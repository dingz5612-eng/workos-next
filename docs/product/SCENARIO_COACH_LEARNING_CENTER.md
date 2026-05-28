# Scenario Coach Learning Center

WON-11 aligns the learning center with the same `IntentWorkspace + Card` model used by home, search, and workbench.

The user does not need another detached document center. The user needs to understand the exact business card they are stuck on and return to the same workspace that handles the task.

## UX Rules

- Search highlights and expands matching workspace cards.
- Filters narrow workspace cards; they do not create a separate result area.
- Each intent workspace owns its own card guide.
- Each card guide explains one actionable card only.
- Business jump actions live inside the stage guide.
- Normal users must not see technical object names, enum names, analytics keys, or backend state identifiers.
- Card guides should tell users what to select, not ask them to type IDs or repeat data the system already knows.
- The coach must not maintain its own stage dictionary. It reads the same workspace title, card title, business fields, evidence, checks, blocker, and next action as the operation page.

## Card Guide Template

Every card guide uses the same user-facing template:

- What this step does.
- Which fields are needed.
- Which fields are selected from system candidates or searchable selectors.
- What the system checks.
- Which evidence is needed.
- Who confirms.
- What state the business reaches after this step.
- What the next step is.
- What AI can and cannot do.
- Enter related workspace / open related object.

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

The backend should not create a detached help table. It should project workspace card definitions into a `WorkspaceCardHelpProjection`.

Recommended projection fields:

- `workspaceId`
- `cardId`
- `domain`
- `language`
- `workspaceLabel`
- `cardLabel`
- `purpose`
- `requiredFields`
- `systemChecks`
- `evidenceRequirements`
- `confirmationPolicy`
- `afterStateLabel`
- `nextCardLabel`
- `aiCan`
- `aiCannot`
- `relatedWorkspaceId`
- `relatedObjectType`
- `version`

Search help, AI answers, workbench items, and the scenario coach should read the same projection. Updating a workspace card must automatically update the operation page and the learning explanation.
