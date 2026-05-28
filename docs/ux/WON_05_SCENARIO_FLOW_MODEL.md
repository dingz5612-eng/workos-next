# WON-05 Scenario Flow Model

## Goal

Replace module-level loops with scenario-level loops.

The frontend business model now has three flow categories:

- Object creation.
- Business handling.
- Exception handling.

## Accommodation Scenario Flows

- Create room.
- Create bed.
- Create resident.
- Check-in.
- Checkout.
- Deposit exception.
- Bed status exception.
- Fee exception.

## Repair Scenario Flows

- Create repair customer.
- Create vehicle profile.
- Create repair order.
- Dispatch and diagnosis.
- Repair execution.
- Inspection and close.
- Repair fee exception.
- Safety stop / urgent risk.

## UI Rule

Home must not show a large module loop called accommodation or repair. It shows today's scenario flows.

Search must route to a scenario flow:

- Search missing room -> create room.
- Search missing bed -> create bed.
- Search missing vehicle -> create vehicle profile.
- Search deposit blocked -> deposit exception.
- Search checkout -> checkout flow.
- Search repair dispatch -> dispatch and diagnosis.

Workbench remains a passive queue of scenario tasks.

## Backend Rule

Backend development should seed scenario flow definitions first:

```text
ScenarioFlow
ScenarioStep
ScenarioField
ScenarioException
ScenarioEvidence
ScenarioPolicy
```

Task, object, search, reminders, audit, and projections should reference the same scenario flow definitions.

Final UX verdict for this package:

```text
WON_05_SCENARIO_FLOW_MODEL_READY
```
