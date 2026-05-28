# Semantic Action Surface

WON-11 turns the operation area into a workspace-card action surface.

The operation area is no longer a loose form or a separate task page. It is derived from the selected `IntentWorkspace` card and shows the same execution contract that search, workbench, scenario coach, and the backend must later enforce.

## Surface Layout

Every card operation surface has six required parts:

- Current action: the selected workspace card.
- Business fields: card fields that can become backend DTO fields.
- Evidence materials: the documents, photos, receipts, signatures, or review records needed for audit.
- Human confirmation summary: the policy text that makes critical actions explicit.
- Next card: what becomes available after this card is completed.
- Blockers and best next action: shown inside the operation surface, not as a detached panel.

System fields and analytics fields are part of the card contract, but they are not shown to normal users as technical labels. They are backend and product signals that should be collected later.

## Semantic Sources

The frontend currently reads the action surface from:

- `intentWorkspaces[*].cards[*].title`
- `intentWorkspaces[*].cards[*].fields.business`
- `intentWorkspaces[*].cards[*].fields.system`
- `intentWorkspaces[*].cards[*].fields.analytics`
- `intentWorkspaces[*].cards[*].evidence`
- `intentWorkspaces[*].cards[*].checks`
- `intentWorkspaces[*].cards[*].status`

This keeps UI, backend DTO design, audit evidence, and user guidance aligned.

## Accommodation Example

For the check-in workspace, the surface shows:

- Application card.
- Stay order card, including room and bed selection.
- Deposit card.
- Finance card.
- Check-in confirmation card.
- Human confirmation boundary for deposit, finance confirmation, and check-in.

## Repair Example

For repair workspaces, the surface shows:

- Repair request card, vehicle arrival card, and dispatch entry card.
- Dispatch, diagnosis, execution, and blocker cards.
- Inspection, fee material, customer confirmation, and close cards.
- Human confirmation boundary for completion, fee confirmation, customer confirmation, and close.

## Backend Contract Direction

The backend should later expose workspace card preparation endpoints that return this surface as data:

- `workspaceId`
- `cardId`
- `actionId`
- `currentAction`
- `businessFields`
- `systemFields`
- `analyticsFields`
- `evidenceRequirements`
- `systemChecks`
- `confirmationPolicy`
- `nextCard`
- `blockers`
- `analyticsEvents`

The confirm endpoint should accept only the action payload and evidence references produced by this surface. Search, workbench, AI, voice entry, and scenario coach must not bypass this preparation and confirmation flow.
