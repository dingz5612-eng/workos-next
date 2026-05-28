# WorkOSNext Phase Plan

## WON-00: Project Scaffold

- Repository structure.
- API health endpoint.
- Mobile UI shell.
- Docker Compose PostgreSQL placeholder.
- Bilingual standard.

## WON-01: UI/UX Trial Prototype

- Home Intent Hub.
- Intent Search.
- Work Queue.
- Object Workspace.
- Task Surface.
- Confirm Sheet.
- After Action.
- Help and AI boundary.
- Accommodation and automotive repair reference objects.
- Clean active UI only; no retained obsolete prototype components.

## WON-02: Product Model Schema

- Bottom navigation becomes Home / Search / Workbench / Me.
- Help becomes contextual guidance and searchable content, not a primary tab.
- Workbench becomes a task command center with domain, context, status, sorting, and advanced filters.
- Accommodation and automotive repair must remain first-class reference domains.
- Deprecated active UI paths must be deleted rather than hidden behind new screens.
- Object schema.
- Task schema.
- Action schema.
- State machine schema.
- Policy schema.
- Confirmation schema.
- Projection schema.
- Behavior event schema.

## WON-03: Backend Minimal Loop

- Before backend binding, freeze the V1 mode architecture:
  - Home is the daily command card, not a list page.
  - Search is active intent and scenario entry, not default object browsing.
  - Workbench is a passive task queue with compact filters and count badges.
  - Me owns notes, reminders, feedback, tutorial, profile, and preferences.
  - Deprecated active UI sections must be removed when replaced.
- Auth.
- Workbench projection API.
- Object projection API.
- Task projection API.
- Action prepare / confirm.
- Audit and behavior event persistence.

## WON-04: Projection Worker

- Backend work starts from the frontend closed-loop model:
  - Accommodation must cover application, room/bed, stay order, deposit evidence, finance confirmation, and check-in.
  - Repair must cover repair request, vehicle arrival, technician assignment, diagnosis, repair execution, inspection, fee material, and close.
  - Home requires global command projection plus per-business local focus projection.
  - Search must reuse the same intent function from home and search pages.
  - Task pages must expose field models that can become backend DTOs.
- Outbox.
- Work item projection.
- Search index projection.
- Timeline projection.
- Guidance projection.

## WON-05: Search And Workbench Enhancement

- Frontend business model is scenario-flow based:
  - Object creation flows are first-class.
  - Business handling flows are first-class.
  - Exception handling flows are first-class.
  - Home local cards show scenario flows, not large module loops.
  - Search-not-found should route into creation flows.
- Chinese/Russian search dictionaries.
- Blocker search.
- Help search.
- Rule-based recommendation.

## WON-06: AI Adapter

- Learning Center and Review Manual are separate but share scenario language:
  - End users read `Me -> Learning Center`.
  - Builders use `docs/review/PROJECT_REVIEW_MANUAL.md`.
  - `docs/product/SCENARIO_FLOW_CATALOG.md` is the temporary single knowledge source before backend seed data.
- Intent parse adapter.
- Help answer adapter.
- Object summary adapter.
- AI call logging.
- Sensitive data filtering.

## WON-07: Personalization

- Scenario Semantic Model is the backend runtime target:
  - Objects, fields, states, tasks, actions, evidence, policy, analytics, and exceptions must be defined together.
  - `docs/product/SCENARIO_SEMANTIC_MODEL.md` is the current architecture source before seed data.
- Semantic Action Surface is the task execution target:
  - Task operation UI must be derived from the semantic model rather than a loose page form.
  - Each task shows current action, system judgement, business fields, evidence, human confirmation, after state, and analytics hints.
  - `docs/product/SEMANTIC_ACTION_SURFACE.md` defines the current frontend-to-backend action contract.
- Knowledge Command Center is the learning and help target:
  - Learning content is generated from the same scenario semantic model instead of a separate manual.
  - Users can search and filter by business domain and knowledge type.
  - `docs/product/KNOWLEDGE_COMMAND_CENTER.md` defines the current knowledge-index projection direction.
- Scenario Coach is the refined learning target:
  - Search and filters highlight scenario stages rather than producing detached knowledge result lists.
  - Stage guides explain one business step with fields, checks, evidence, confirmation, next step, AI boundary, and related task entry.
  - `docs/product/SCENARIO_COACH_LEARNING_CENTER.md` defines the StageHelpProjection direction.
- Intent Workspace Card Model is the mobile operation target:
  - Accommodation and repair business are organized by intent workspaces, not page-per-step routes.
  - Each workspace contains dynamic cards with business fields, system fields, analytics fields, evidence, checks, operation inputs, and confirmation boundaries.
  - Legacy task/object pages are removed from active routing; task links resolve to workspaces.
  - Workspaces open on the current actionable card; card switching happens through tags inside the current-card area, without a second detached card list.
  - `docs/product/INTENT_WORKSPACE_CARD_MODEL.md` defines the WorkspaceProjection and CardProjection direction.
- User habit profile.
- Personalized ranking.
- Model versioning.
- Default-rule fallback.

## Standing Engineering Rules

- All future work must follow `docs/architecture/WORKOS_ENGINEERING_RULES.md`.
- Backend contract drafts must follow `docs/architecture/WORKSPACE_CARD_BACKEND_CONTRACT.md`.
- WON-13 backend runtime work must follow `docs/architecture/WON_13_PRODUCTION_RUNTIME_ARCHITECTURE.md`.
- `IntentWorkspaceProjection + WorkspaceCardProjection` is the single center model for frontend, backend, search, workbench, scenario coach, and AI.
- Do not create separate page models, search models, learning models, or AI models for the same business behavior.
