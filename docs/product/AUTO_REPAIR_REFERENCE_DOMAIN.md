# Automotive Repair Reference Domain

Automotive repair is the second reference business domain for WorkOSNext V1.0. It prevents the platform from becoming accommodation-specific.

## Core Objects

- Vehicle.
- Driver.
- Repair request.
- Repair order.
- Diagnosis.
- Technician assignment.
- Parts requirement.
- Inspection.
- Fee material.
- Closure record.

## Reference Flow

```text
Report issue
  -> Vehicle arrival
  -> Diagnosis assignment
  -> Diagnosis result
  -> Repair work
  -> Parts usage
  -> Inspection
  -> Fee material
  -> Close repair order
```

## V1.0 UI Reference Object

```text
Repair order: AR-20260528-004
Vehicle: Toyota Camry · 01KG123ABC
Driver: Иван Петров
Issue: engine noise
Priority: today
Current state: waiting for diagnosis
Next task: assign technician
Owner: maintenance supervisor
```

## Boundaries

V1.0 does not perform automatic fee settlement, inventory deduction, or financial write-off. Those actions must remain behind policy, confirmation, and audit.

