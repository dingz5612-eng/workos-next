# Knowledge Command Center

WON-09 upgrades Learning Center into a knowledge command center.

The goal is not to create a separate manual. The goal is to let users solve current business questions by searching the same scenario semantic model that drives task pages.

## User Jobs

The knowledge command center supports four jobs:

- Search a business question, field, process, exception, or action.
- Filter knowledge by business domain: accommodation, repair, finance, or all.
- Filter knowledge by type: scenario, field, exception, confirmation, state, and evidence.
- Jump from a knowledge result back to the related task surface.

## Knowledge Index Sources

The current frontend builds the knowledge index from:

- `scenarioFlows[*].stages`
- `scenarioFlows[*].fields`
- `scenarioFlows[*].evidence`
- `scenarioFlows[*].policy`
- `scenarioFlows[*].semantic.states`
- `scenarioFlows[*].semantic.exceptions`

This avoids duplicate help content. When a scenario changes, learning, task operation, and backend contract language stay aligned.

## Result Groups

V1.0 knowledge results are grouped by type:

- Scenario: business flow and stage order.
- Field: user-facing fields that later become backend DTO fields.
- Exception: blocker and branch conditions.
- Confirmation: human confirmation boundary.
- State: expected object states.
- Evidence: audit and material requirements.

## Backend Direction

The backend should later expose a `KnowledgeIndex` projection generated from scenario definitions and action registry data.

Recommended read model fields:

- `knowledgeId`
- `domain`
- `scenarioId`
- `type`
- `title`
- `body`
- `keywords`
- `relatedTaskId`
- `relatedObjectTypes`
- `language`
- `version`

AI help and personalized learning should read this projection first, then fall back to model reasoning only when the indexed knowledge cannot answer the question.
