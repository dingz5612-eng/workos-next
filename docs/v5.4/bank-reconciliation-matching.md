# Bank Reconciliation Matching

MR-09 matching is an evidence reconciliation workflow, not a payment
confirmation workflow.

## Candidate Generation

`POST /api/reconciliation/match-candidates/generate` creates proposed
`payment_match_candidates` only when:

- amount matches an existing payment, deposit, or refund fact;
- currency matches;
- bank transaction time is within the configured window;
- optional description/reference hints can improve score.

The first version never auto-matches. It only proposes candidates.

## Manual Decisions

Finance can:

- accept candidate;
- reject candidate;
- mark transaction mismatch;
- ignore transaction.

Accepting a candidate writes a reconciliation audit event such as
`Reconciliation.PaymentMatched`, `Reconciliation.DepositMatched`, or
`Reconciliation.RefundMatched`, then writes `payment_matches`.

## Non-Mutation Rules

Manual matching must not:

- create `PaymentConfirmed`;
- update payment confirmed amount;
- update deposit held amount;
- update `stay_balances`;
- create `payment_allocations`.

`payment_matches` only records that a bank transaction and an existing business
fact mutually corroborate each other.
