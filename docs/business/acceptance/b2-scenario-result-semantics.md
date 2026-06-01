# B2 Scenario Result Semantics

Status: OPX B-Gate P0 hardening contract  
Owner: Business Line Acceptance / OPX B-Gate  
Scope: Dormitory B2 certification, RuntimeCertificationRunner, DormitoryCertificationRunner, GateRunner, semantic shadow, invariant evidence

## Purpose

B2 certification must distinguish between a business command that commits facts, a business command that is rejected with traceable evidence, and a gate-only block that never represents a business submission.

The previous shorthand "each scenario has a DomainEvent" is not valid for blocked scenarios. The corrected rule is:

- committed scenarios must produce business DomainEvent evidence;
- rejected command scenarios must produce rejection trace evidence and must not write business facts;
- gate-only blocked scenarios must produce gate/invariant/shadow evidence and must not pretend to be a business CommandSubmission.

## Result classes

| Class | Applies to | Required evidence | Forbidden business side effects |
| --- | --- | --- | --- |
| committed | `committed_projected`, `projection_pending_committed`, `idempotency_duplicate` first commit | `CommandSubmission`, at least one `DomainEvent`, `FactTrace`, stable response, projection/lens evidence; money commands also require `LedgerTransaction` and `LedgerEntry` | none, because this is the only class allowed to write facts |
| rejected command | `permission_denied_403`, `business_blocked_422`, `idempotency_conflict_409` | `RejectedCommandSubmission` or `CommandSubmission(status=rejected)`, `RejectionTrace`, status code, policy/audit/invariant evidence, stable idempotency response where applicable | `DomainEvent`, `LedgerTransaction`, `LedgerEntry`, projection commit |
| gate-only blocked | `semantic_shadow_red_blocked`, `missing_rollback_blocked`, `missing_signoff_blocked` | `GateResult(status=blocked)`, `InvariantCheck` or `ShadowCompareReport`, rollback/signoff blocker evidence when applicable | `CommandSubmission`, `RejectedCommandSubmission`, `DomainEvent`, `LedgerTransaction`, `LedgerEntry`, projection commit |

## Dormitory scenario mapping

| Scenario | Expected outcome | Semantic class | Additional rule |
| --- | --- | --- | --- |
| `dorm-cert-001` | `committed_projected` | committed | must emit FactTrace and business event |
| `dorm-cert-002` | `committed_projected` | committed | money command; must emit balanced ledger transaction |
| `dorm-cert-003` | `committed_projected` | committed | money command; must emit balanced ledger transaction |
| `dorm-cert-004` | `committed_projected` | committed | service completion must not release blocked resource without verify evidence |
| `dorm-cert-005` | `committed_projected` | committed | money command; refund/deduction ledger must remain traceable |
| `dorm-cert-006` | `committed_projected` | committed | correction must be append-only compensation |
| `dorm-cert-007` | `projection_pending_committed` | committed | command commits while projection may remain pending |
| `dorm-cert-008` | `permission_denied_403` | rejected command | no business DomainEvent or LedgerTransaction |
| `dorm-cert-009` | `idempotency_duplicate` | committed | first submit commits; duplicate returns same stable response and no duplicate side effect |
| `dorm-cert-010` | `business_blocked_422` | rejected command | missing/rejected evidence blocks confirm with no business DomainEvent or LedgerTransaction |

## Gate-only examples

The following outcomes are certification gate outcomes, not business command outcomes:

- `semantic_shadow_red_blocked`
- `missing_rollback_blocked`
- `missing_signoff_blocked`

They must be represented as blocked `GateResult` evidence with invariant or shadow evidence. They must not be represented as committed or rejected business submissions unless a real user command was submitted to the Operations runtime.

## Acceptance rules

1. A committed result is not accepted unless it has `CommandSubmission`, `DomainEvent`, and `FactTrace`.
2. A money committed result is not accepted unless it has `LedgerTransaction` and `LedgerEntry`.
3. A rejected command result is not accepted if it writes any business `DomainEvent`, `LedgerTransaction`, or projection commit.
4. A gate-only blocked result is not accepted if it creates a business `CommandSubmission` or any business fact.
5. Idempotency duplicate is accepted only when the duplicate response is stable and creates no additional business side effect.
6. B2 FULL_PASS requires certification output to label each scenario with one of these classes and validate the required/forbidden evidence for that class.
