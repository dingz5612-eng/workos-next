# WON-04 Business Loop Frontend Contract

## Goal

Prepare the mobile prototype for backend implementation by making accommodation and repair complete enough to guide DTOs, projections, and task APIs.

## Home Contract

Home has three layers:

1. Global command card.
2. Direct search entry.
3. Local business loop cards.

The global card is cross-business. It must not represent only one domain.

The local cards must be scenario flows, not module flows. They currently cover:

- Accommodation check-in.
- Accommodation checkout.
- Room creation.
- Bed creation.
- Deposit exception.
- Repair dispatch and diagnosis.
- Repair inspection and close.
- Vehicle creation.

## Accommodation Scenario Flows

### Check-In Flow

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

### Checkout Flow

```text
Start checkout
  -> room inspection
  -> fee settlement
  -> finance confirmation
  -> release bed
  -> close stay order
```

Frontend field model:

- Stay order number.
- Resident.
- Room inspection result.
- Fee settlement state.
- Deposit refund state.

### Room Creation Flow

```text
Building / zone
  -> room number
  -> room type and capacity
  -> duplicate check
  -> create room
  -> create beds
```

### Bed Creation Flow

```text
Select room
  -> bed number
  -> bed type
  -> price / inspection state
  -> capacity check
  -> create bed
```

### Deposit Exception Flow

```text
Find exception
  -> locate stay order
  -> submit corrected evidence
  -> finance review
  -> return to check-in
```

## Repair Scenario Flows

### Dispatch And Diagnosis Flow

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

### Inspection And Close Flow

```text
Submit inspection
  -> responsible user checks
  -> inspection passed
  -> fee material
  -> close repair order
```

### Vehicle Creation Flow

```text
Select customer
  -> plate number
  -> brand and model
  -> VIN / engine number
  -> duplicate check
  -> create vehicle profile
```

### Repair Customer Creation Flow

```text
Customer name
  -> contact person and phone
  -> customer type
  -> duplicate check
  -> create customer
  -> bind vehicle
```

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
- Need scenario flow definitions as backend seed data, not hard-coded page logic.
- Need create-object flows before business flows, otherwise search-not-found cannot route cleanly.

Final UX verdict for this package:

```text
WON_04_BUSINESS_LOOP_FRONTEND_CONTRACT_READY
```
