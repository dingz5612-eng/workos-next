# Runtime Contract Lock

Status: S1 contract-only.

The production runtime cutover uses these contracts as the only accepted fact
chain. This document does not activate a new endpoint, adapter, unit of work, or
business runtime behavior.

## Fact Chain

Definition -> OperationCase -> WorkItem -> CommandSubmission ->
SliceCommandHandler -> DomainEvent / LedgerTransaction / LedgerEntry ->
ProcessManager -> Projection / Lens -> Mobile / PC Surface.

## Contract Versions

- CommandEnvelope.v1
- OperationCase.v1
- WorkItem.v1
- CommandSubmission.v1
- DomainEvent.v1
- LedgerTransaction.v1
- LedgerEntry.v1
- WorkItemTransition.v1
- ProjectionCommit.v1
- FactTrace.v1
- ShadowFactGraph.v1

## Ownership Rules

- CommandSubmission is the only command audit entry.
- DomainEvent is the business fact.
- LedgerTransaction and LedgerEntry are financial facts.
- LedgerEntry must belong to one LedgerTransaction.
- Projection and Lens outputs are derived views, not fact sources.
- Frontend field values are not financial fact sources.
- Old Workspace/Card APIs are compatibility surfaces, not the main write axis.
- WorkItemBundle is an experience envelope, not a fact source.
- EvidenceObject is evidence fact and does not replace PaymentConfirmed or
  DepositConfirmed facts.

## Required Trace Fields

- CommandEnvelope requires tenantId, commandType, schemaVersion,
  definitionVersionId, caseId, workItemId, idempotencyKey, and payloadHash.
- DomainEvent requires tenantId, caseId, workItemId, submissionId, causationId,
  and correlationId.
- LedgerEntry requires tenantId, ledgerTransactionId, entryId, debitCredit,
  amount, and currency.
- FactTrace must link case, work item, submission, domain event, ledger
  transaction, ledger entry, and projection commit references.
