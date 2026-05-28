# WorkOSNext Project Review Manual

## Purpose

This manual is for product and architecture alignment while building WorkOSNext.

It is not an end-user guide. End users learn the system through `Me -> Learning Center`.

## Current Product Position

WorkOSNext is a mobile-first business operating system.

It is not a traditional admin dashboard and it should not become a collection of module pages.

Current stage:

- UI/UX reference.
- Scenario flow definition.
- Frontend business contract for backend development.

## Fixed Navigation Principle

The bottom navigation is four working modes:

- Home: what should be handled first today.
- Search: active intent and direct business entry.
- Workbench: passive task queue assigned by the system.
- Me: profile, statistics, notes, reminders, learning center, feedback, preferences.

Do not add `Help` back as a primary tab.

## Fixed Scenario Principle

The system is built from scenario flows, not large module loops.

Every flow belongs to one category:

- Object creation.
- Business handling.
- Exception handling.

Each scenario flow must define:

- Business domain.
- Steps.
- Fields.
- Evidence.
- Human confirmation policy.
- Exception branches.
- End condition.

## Current Covered Scenarios

Accommodation:

- Create room.
- Create bed.
- Check-in.
- Checkout.
- Deposit exception.

Repair:

- Create vehicle profile.
- Dispatch and diagnosis.
- Inspection and close.

Finance:

- Deposit payment confirmation.

## UX Rules That Must Hold

- Home must not become a list page.
- Home local cards must be scenario flows, not module loops.
- Search must route missing objects to creation flows.
- Workbench must show tasks before deep filters.
- Every critical action must require human confirmation.
- Feedback must be available without blocking the primary task.
- Chinese and Russian must be considered together.

## Backend Readiness Checklist

Before implementing write APIs, define:

- Scenario semantic model.
- ScenarioFlow.
- ScenarioStep.
- ScenarioField.
- ScenarioException.
- ScenarioEvidence.
- ScenarioPolicy.
- BusinessObject.
- Task.
- Action preparation.
- Action confirmation.
- Audit event.
- Note.
- Reminder.
- Feedback.

## Prohibited Directions

- Do not rebuild the old FunRide page collection.
- Do not use module menus as the main product structure.
- Do not hide deprecated UI behind new screens.
- Do not let AI execute confirmation, payment, refund, write-off, or final closing.
- Do not hard-code fields that cannot later become DTOs or seed data.

## Review Checklist Per Change

- Does it respect the four working modes?
- Is it scenario-flow based?
- Does it support object creation, business handling, or exception handling clearly?
- Does it keep the human confirmation boundary?
- Does it preserve bilingual readiness?
- Does it remove replaced UI instead of keeping duplicate paths?
- Can backend DTOs, read models, and tests be derived from it?
- Are objects, fields, states, tasks, actions, evidence, policy, analytics, and exceptions aligned?

Final review verdict for this manual:

```text
PROJECT_REVIEW_MANUAL_READY
```
