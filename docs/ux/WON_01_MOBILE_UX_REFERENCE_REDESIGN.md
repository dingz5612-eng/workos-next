# WON-01 Mobile UX Reference Redesign

## Goal

Replace the first runnable shell with a cleaner mobile UX reference instead of layering fixes onto the rough card prototype.

## Kept

- WorkOSNext project structure.
- Bilingual switching.
- Intent Hub, Work Queue, Object Workspace, Task Surface, Confirm, Result, Help concepts.
- PWA delivery for Phase 0-1 evaluation.
- .NET API scaffold.

## Removed From Active UI

- Technical demo identifiers such as `stay-1001`.
- English internal labels such as `Finance Gate`.
- Generic action copy such as "open object" as the main user action.
- Flat equal-weight search result groups.
- Workbench without prioritization.
- Stacked visual hierarchy where every block competed for attention.

## Added

- Realistic accommodation object:
  - `SO-20260528-001`
  - Resident Zhang San.
  - Room A301.
  - Bed A301-02 lower bed.
  - Deposit 3000 KGS, finance not approved.
- Automotive repair object:
  - `AR-20260528-004`
  - Toyota Camry `01KG123ABC`.
  - Driver Ivan Petrov.
  - Engine noise.
  - Waiting for technician diagnosis.
- Priority workbench lanes:
  - First.
  - Due today.
  - Waiting confirmation.
  - Newly assigned.
  - Recent.
- Decision-style search with a best match.
- Object page with real business facts.
- Task page with checklist, form fields, guidance, and sticky primary action.

## UX Standard

The user should understand:

1. What is most important now.
2. Which business object is affected.
3. Why it is blocked or ready.
4. What exact task should be done.
5. What must be checked before confirmation.
6. What the action will and will not do.

Final UX verdict for this package:

```text
WON_01_MOBILE_UX_REFERENCE_READY_FOR_USER_REVIEW
```

