# Scenario Semantic Model

## Purpose

The scenario semantic model upgrades field contracts into a full Work OS runtime contract.

Each scenario is not just a form. It is a semantic graph of:

- Business objects.
- Fields.
- States.
- Tasks.
- Actions.
- Evidence.
- Policies.
- Analytics.
- Exception branches.

## Template

Every scenario should define:

```text
Scenario
Business Objects
Field Contract
State Contract
Task Contract
Action Contract
Evidence Contract
Policy Contract
Analytics Contract
Exception Branches
Backend DTO Draft
```

## Check-In Semantic Model

Business Objects:

- Resident.
- Application.
- Room.
- Bed.
- StayOrder.
- DepositEvidence.

Field Contract:

- residentName.
- applicationId.
- roomId.
- bedId.
- stayOrderId.
- depositAmount.
- depositEvidence.
- receiptNo.
- depositReviewStatus.

State Contract:

- Application: Submitted -> Approved.
- Bed: Available -> Reserved -> Occupied.
- StayOrder: Draft -> ReadyForCheckIn -> InResidence.
- DepositEvidence: Submitted -> Accepted or Returned.

Task Contract:

- Select bed.
- Create stay order.
- Submit deposit evidence.
- Finance confirm deposit.
- Confirm check-in.

Action Contract:

- prepareCheckIn.
- selectBed.
- submitDepositEvidence.
- confirmDeposit.
- confirmCheckIn.

Evidence Contract:

- Deposit screenshot.
- Receipt number.
- Finance review record.
- Check-in confirmation record.

Analytics Contract:

- checkInLeadTime.
- bedAssignmentDuration.
- depositReviewDuration.
- depositReturnCount.
- manualConfirmationCount.

Exception Branches:

- No available bed.
- Bed locked.
- Deposit rejected.
- Missing evidence.
- Permission denied.

## Checkout Semantic Model

Business Objects:

- Resident.
- StayOrder.
- Room.
- Bed.
- RoomInspection.
- FeeSettlement.
- RefundEvidence.

State Contract:

- StayOrder: InResidence -> CheckoutPending -> Closed.
- Bed: Occupied -> Cleaning or Available.
- FeeSettlement: Pending -> Accepted or Returned.

Task Contract:

- Start checkout.
- Inspect room.
- Settle fees.
- Confirm refund.
- Release bed.
- Close stay order.

Analytics Contract:

- checkoutDuration.
- roomInspectionDuration.
- damageCount.
- refundDuration.

Exception Branches:

- Fee unpaid.
- Room damage.
- Refund pending.
- Finance returned.

## Deposit Exception Semantic Model

Business Objects:

- StayOrder.
- DepositEvidence.
- FinanceReview.
- AuditEvent.

State Contract:

- Evidence: Returned -> Resubmitted -> Accepted or Returned.
- StayOrder: ReadyForCheckIn remains blocked until accepted.

Task Contract:

- Fix deposit evidence.
- Finance review.
- Return to check-in.

Analytics Contract:

- exceptionResolutionDuration.
- depositReturnCount.
- amountMismatchCount.
- duplicateEvidenceCount.

Exception Branches:

- Amount mismatch.
- Payer mismatch.
- Evidence unclear.
- Duplicate evidence.

## Room And Bed Creation Semantic Model

Business Objects:

- Building.
- Room.
- Bed.
- RoomType.
- BedPrice.
- InspectionState.

State Contract:

- Room: Draft -> Active.
- Bed: Draft -> PendingInspection -> Available.

Task Contract:

- Validate room.
- Create room.
- Validate bed capacity.
- Create bed.
- Inspect bed.

Analytics Contract:

- roomCreationDuration.
- duplicateRoomCount.
- bedCreationDuration.
- capacityConflictCount.

Exception Branches:

- Duplicate room.
- Missing building.
- Invalid capacity.
- Duplicate bed.
- Capacity exceeded.

## Repair Dispatch Semantic Model

Business Objects:

- RepairCustomer.
- Vehicle.
- RepairOrder.
- Technician.
- Diagnosis.
- Inspection.

State Contract:

- Vehicle: Active -> Arrived -> UnderRepair -> Available.
- RepairOrder: Created -> WaitingDiagnosis -> InProgress -> WaitingInspection.

Task Contract:

- Create repair order.
- Confirm vehicle arrival.
- Assign technician.
- Submit diagnosis.
- Start repair.
- Submit repair evidence.

Analytics Contract:

- dispatchLeadTime.
- diagnosisDuration.
- repairDuration.
- vehicleDowntime.
- technicianUtilization.

Exception Branches:

- Vehicle missing.
- No technician.
- Technician timeout.
- Diagnosis incomplete.
- New issue discovered.

## Repair Close Semantic Model

Business Objects:

- RepairOrder.
- Inspection.
- FeeMaterial.
- Vehicle.
- AuditEvent.

State Contract:

- RepairOrder: WaitingInspection -> WaitingFee -> Closed.
- Vehicle: UnderRepair -> Available.

Task Contract:

- Inspect repair.
- Confirm fee material.
- Close repair.

Analytics Contract:

- inspectionDuration.
- reworkCount.
- closeDuration.
- feeMaterialReturnCount.

Exception Branches:

- Inspection failed.
- Rework required.
- Fee material missing.
- Close permission denied.

## Vehicle Creation Semantic Model

Business Objects:

- RepairCustomer.
- Vehicle.
- VehicleDocument.
- AuditEvent.

State Contract:

- Vehicle: Draft -> Active.

Task Contract:

- Validate customer.
- Validate plate and VIN.
- Create vehicle profile.
- Bind vehicle to customer.

Analytics Contract:

- vehicleCreationDuration.
- duplicatePlateCount.
- duplicateVinCount.

Exception Branches:

- Missing customer.
- Duplicate plate.
- Duplicate VIN.
- Missing vehicle data.

## Backend Definition Draft

Backend definitions should be seedable:

```text
ScenarioDefinition
BusinessObjectDefinition
FieldDefinition
StateTransitionDefinition
TaskDefinition
ActionDefinition
EvidenceDefinition
PolicyDefinition
MetricDefinition
ExceptionDefinition
```

Final semantic model verdict:

```text
SCENARIO_SEMANTIC_MODEL_READY_FOR_BACKEND_RUNTIME_DESIGN
```
