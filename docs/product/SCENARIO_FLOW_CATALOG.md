# Scenario Flow Catalog

This catalog is the temporary single knowledge source for scenario flows.

Later it should become JSON seed data or database seed data used by:

- User Learning Center.
- Project Review Manual.
- Frontend scenario cards.
- Backend APIs.
- Tests.

## Flow Schema

Each flow should include:

- `flowId`
- `businessDomain`
- `category`
- `displayName`
- `steps`
- `fields`
- `evidence`
- `policy`
- `exceptions`
- `endState`

## Accommodation Flows

### Create Room

- Category: object creation.
- Steps: building / zone, room number, room type and capacity, duplicate check, create room, create beds.
- Fields: building, room number, room type, capacity, duplicate check state.
- Evidence: creator, created time, duplicate check result.
- Policy: requires accommodation admin permission.
- Exceptions: duplicate room, missing building, invalid capacity, permission denied.

### Create Bed

- Category: object creation.
- Steps: select room, bed number, bed type, price / inspection state, capacity check, create bed.
- Fields: room, bed number, bed type, reference price, inspection state.
- Evidence: capacity check, bed number check, inspection state.
- Policy: cannot create without room or beyond room capacity.
- Exceptions: room missing, duplicate bed, capacity exceeded, invalid state.

### Check-In

- Category: business handling.
- Steps: application approval, room and bed selection, stay order creation, deposit evidence, finance confirmation, check-in.
- Fields: stay order number, resident, room, bed, deposit evidence, receipt number.
- Evidence: payment screenshot, receipt number, finance confirmation.
- Policy: deposit confirmation and check-in confirmation require human confirmation.
- Exceptions: application rejected, no available bed, bed locked, deposit rejected.

### Checkout

- Category: business handling.
- Steps: start checkout, room inspection, fee settlement, finance confirmation, release bed, close stay order.
- Fields: stay order number, resident, room inspection result, fee settlement state, deposit refund state.
- Evidence: room inspection record, fee details, refund confirmation.
- Policy: checkout close and deposit refund require human confirmation.
- Exceptions: fee unpaid, room damage, refund pending, finance returned.

### Deposit Exception

- Category: exception handling.
- Steps: find exception, locate stay order, submit corrected evidence, finance review, return to check-in.
- Fields: deposit evidence, exception type, amount, reviewer.
- Evidence: original evidence, corrected evidence, return reason, review result.
- Policy: finance must manually accept or return evidence.
- Exceptions: amount mismatch, unclear evidence, duplicate submission, rejected by finance.

## Repair Flows

### Create Vehicle Profile

- Category: object creation.
- Steps: select customer, plate number, brand and model, VIN / engine number, duplicate check, create vehicle profile.
- Fields: customer, plate, brand, model, VIN, engine number, mileage.
- Evidence: customer authorization, vehicle documents, plate / VIN duplicate check.
- Policy: cannot create without customer or with duplicate plate / VIN.
- Exceptions: missing customer, duplicate plate, duplicate VIN, missing vehicle data.

### Dispatch And Diagnosis

- Category: business handling.
- Steps: repair request, vehicle arrival, diagnosis assignment, repair execution, inspection, fee material, close.
- Fields: repair order number, vehicle, driver, technician, arrival slot.
- Evidence: diagnosis record, repair photos, inspection signature, fee material.
- Policy: repair completion, fee confirmation, and close require human confirmation.
- Exceptions: vehicle not arrived, no technician, timeout, diagnosis incomplete.

### Inspection And Close

- Category: business handling.
- Steps: submit inspection, responsible user checks, inspection passed, fee material, close repair order.
- Fields: repair order number, inspector, fee material, close state.
- Evidence: inspection photo, signature, material fee record, close record.
- Policy: cannot close if inspection fails or fee material is missing.
- Exceptions: inspection failed, rework required, fee material missing, close permission denied.

## Finance Flow

### Deposit Payment Confirmation

- Category: business handling.
- Steps: receive evidence, review amount, review payer, accept or return, audit record.
- Fields: evidence number, amount, payer, reviewer, review state.
- Evidence: receipt, payment screenshot, review result.
- Policy: AI cannot automatically confirm finance evidence.
- Exceptions: amount mismatch, payer mismatch, evidence unclear, duplicate evidence.

Final catalog verdict:

```text
SCENARIO_FLOW_CATALOG_READY_FOR_BACKEND_SEED_DESIGN
```
