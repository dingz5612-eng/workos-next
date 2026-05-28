# Knowledge Command Center

WON-11 replaces the detached knowledge result model with workspace-card learning.

The goal is not to create a separate manual. The goal is to let users solve current business questions by searching the same `IntentWorkspace + Card` model that drives home, search, workbench, and the operation page.

## User Jobs

The knowledge command center supports four jobs:

- Search a business question, field, process, exception, or action.
- Filter knowledge by business domain: accommodation, repair, finance, or all.
- Filter knowledge by perspective: handling method, fields, exception, confirmation, next step, and AI boundary.
- Jump from the card guide back to the related workspace.

## Knowledge Index Sources

The current frontend builds the knowledge index from:

- `intentWorkspaces[*].title`
- `intentWorkspaces[*].summary`
- `intentWorkspaces[*].next`
- `intentWorkspaces[*].cards[*].title`
- `intentWorkspaces[*].cards[*].fields.business`
- `intentWorkspaces[*].cards[*].evidence`
- `intentWorkspaces[*].cards[*].checks`

This avoids duplicate help content. When a workspace card changes, search, learning, workbench, operation, and backend contract language stay aligned.

## Result Groups

V1.0 learning is grouped by workspace and card:

- Workspace: one user intent, such as arranging check-in or dispatching repair.
- Card: one current action, such as stay order, deposit, dispatch, diagnosis, or close.
- Field: user-facing fields that later become backend DTO fields.
- Check: business checks and blocker reasons.
- Confirmation: human confirmation boundary.
- Evidence: audit and material requirements.

## Backend Direction

The backend should later expose a `WorkspaceCardHelpIndex` projection generated from workspace card definitions and action registry data.

Recommended read model fields:

- `helpId`
- `workspaceId`
- `cardId`
- `domain`
- `perspective`
- `title`
- `body`
- `keywords`
- `relatedWorkspaceId`
- `relatedObjectTypes`
- `language`
- `version`

AI help and personalized learning should read this projection first, then fall back to model reasoning only when the indexed knowledge cannot answer the question.
