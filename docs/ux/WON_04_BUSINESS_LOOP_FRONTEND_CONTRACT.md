# WON-04 Business Loop Frontend Contract

## Goal

Prepare the mobile prototype for backend implementation by making accommodation and repair complete enough to guide DTOs, projections, and task APIs.

## Home Contract

Home has three layers:

1. Global command card.
2. Direct search entry.
3. Local business loop cards.

The global card is cross-business. It must not represent only one domain.

The local business cards currently cover:

- Accommodation closed loop.
- Repair closed loop.

## Accommodation Loop

```text
Application approval
  -> room and bed selection
  -> stay order creation
  -> deposit evidence
  -> finance confirmation
  -> check-in
```

Frontend field model:

- Stay order number.
- Resident.
- Room and bed.
- Deposit evidence.
- Receipt number.
- Finance confirmation state.

Human confirmation boundary:

- Deposit confirmation.
- Check-in confirmation.

## Repair Loop

```text
Repair request
  -> vehicle arrival
  -> diagnosis assignment
  -> repair execution
  -> inspection
  -> fee material
  -> close repair order
```

Frontend field model:

- Repair order number.
- Vehicle and plate.
- Driver.
- Technician.
- Arrival slot.
- Vehicle status.
- Diagnosis evidence.
- Inspection evidence.

Human confirmation boundary:

- Repair completion.
- Fee confirmation.
- Repair order close.

## Search Contract

Home search and search page use the same intent behavior.

Search supports:

- Resident / room / bed / stay order.
- Vehicle / plate / driver / repair order.
- Action intents such as deposit blocked, assign repair, check-in, payment confirmation.

## Gaps To Remember Before Backend

- Need stable object IDs and display IDs.
- Need role and permission model before write APIs.
- Need evidence attachment contract.
- Need reminder and note persistence model.
- Need audit event schema for every manual confirmation.
- Need bilingual labels from one source instead of duplicated UI strings.

Final UX verdict for this package:

```text
WON_04_BUSINESS_LOOP_FRONTEND_CONTRACT_READY
```
