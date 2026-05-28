# WorkOSNext V1.0 Architecture

## Positioning

WorkOSNext is a mobile-first, bilingual Business Work OS platform. It is not a hotel-only product. Accommodation and maintenance are the first two reference domains used to prove that the platform can support multiple business areas with one operating model.

## Core Product Model

```text
Intent Hub
  Search / voice placeholder / scan placeholder / quick create

Work Queue
  Today work / blocked work / waiting confirmation / recommendations

Object Workspace
  Object summary / state / blocker / related objects / timeline / tasks

Task Surface
  Context Bar / Journey Strip / Action Panel / Guidance Dock

Confirm Sheet
  Human confirmation before high-impact actions

After Action
  Completion result / audit evidence / next step
```

## Target Stack

```text
Mobile:
Flutter

Backend:
.NET 10 LTS modular monolith

Data:
PostgreSQL

Workers:
.NET Worker + Outbox Projection

AI:
Python FastAPI service placeholder, GPT or embedding models behind it

Deployment:
Docker Compose locally, low-cost VPS later
```

## Local Phase 0-1 Stack

The current machine does not have Flutter SDK installed. Phase 0-1 therefore ships a mobile-first PWA UI shell so the UX can be evaluated immediately. The backend already targets .NET 10 LTS.

This is not a change in target architecture. It is a bootstrapping choice:

- Keep the product model independent from UI technology.
- Validate UX before building business code.
- Move the approved UI model into Flutter once the SDK is available.
- Keep the .NET API on the LTS runtime line.

## Runtime Boundaries

AI can:

- Parse intent candidates.
- Explain blockers.
- Summarize objects.
- Draft help text.
- Rank recommendations.

AI cannot:

- Confirm check-in.
- Complete checkout.
- Charge or refund.
- Reconcile finance.
- Change terminal state.
- Bypass policy, state machine, or human confirmation.

## V1.0 Data Principles

- Store business state as codes, not display text.
- Resolve all display copy through i18n.
- Read UI from projections.
- Record behavior events from the first version.
- Keep audit evidence for high-impact actions.
