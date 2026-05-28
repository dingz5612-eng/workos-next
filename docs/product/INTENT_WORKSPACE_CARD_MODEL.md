# Intent Workspace Card Model

WON-11 moves the product model away from page-per-step flows.

The user sees one business intent workspace. The workspace contains dynamic task cards. Each card is a business action surface with fields, evidence, checks, confirmation, and analytics support.

## Core Principle

User view:

```text
I want to handle one business intent.
```

Frontend view:

```text
IntentWorkspace + Cards
```

Backend view:

```text
Actions + State Machine + Audit Evidence + Projections
```

## Workspace Set

Accommodation:

- `W-STAY-CHECKIN`: arrange check-in.
- `W-STAY-CHECKOUT`: handle checkout.
- `W-STAY-DEPOSIT-EXCEPTION`: resolve deposit exception.
- `W-STAY-RESOURCE`: create accommodation resources.

Repair:

- `W-REPAIR-REQUEST`: handle repair request.
- `W-REPAIR-DISPATCH`: arrange repair.
- `W-REPAIR-CLOSE`: inspect and close repair.
- `W-REPAIR-MASTER-DATA`: create repair master data.

## Card Contract

Each card has:

- `cardId`
- `status`: `notStarted`, `ready`, `inProgress`, `blocked`, `done`
- `businessFields`
- `systemFields`
- `analyticsFields`
- `evidence`
- `systemChecks`
- `confirmationPolicy`
- `operation`: current action, editable inputs, evidence submission, human confirmation, and next state.

This supports user operation, backend DTO design, projection design, audit evidence, and later analytics.

## Check-in Example

`W-STAY-CHECKIN` is one workspace with five cards:

- Application card.
- Stay order card.
- Deposit card.
- Finance card.
- Check-in confirmation card.

Selecting room and bed is not a separate page. It is part of the stay order card because it only makes business sense when creating a stay order.

## Frontend Routing Decision

The old task and object pages are removed from active routing. Existing task links now resolve to their corresponding workspace.

This keeps the prototype clean and avoids teaching other modules to copy page-per-step flows.

The workspace opens on the current actionable card by default. Cards are switched as tags in the current-card area. The operation area shows all business fields for the selected card, while using dropdowns and searchable selectors where possible. The workspace must not render a second detached card list or duplicate operation areas.

## Single Source Of Truth

The same `IntentWorkspace + Card` data drives:

- Home scenario focus.
- Search result indexing and fallback routing.
- Workbench task entry mapping.
- Scenario coach card explanations.

Search and learning must not keep separate stage dictionaries. If a card field, blocker, evidence requirement, or next action changes, every entry point must reflect that change from the same model.

## Backend Direction

Recommended projections:

- `IntentWorkspaceProjection`
- `WorkspaceCardProjection`
- `WorkspaceBlockerProjection`
- `WorkspaceNextActionProjection`

Recommended APIs:

- `GET /workspaces`
- `GET /workspaces/{workspaceId}`
- `POST /workspaces/{workspaceId}/cards/{cardId}/prepare`
- `POST /workspaces/{workspaceId}/cards/{cardId}/confirm`

Actions remain granular, but the mobile user experience stays focused on one business intent.
