# WorkOS Contract Rules

Contracts are the source of truth for runtime shape, UI shape, and API shape.
Runtime and frontend code must consume contracts rather than localized text or
demo defaults.

## Canonical Field Id

`field.id` is the canonical business fact key. Request payloads, policies,
storage, projector rules, and tests must use canonical field ids or canonical
payload keys.

Localized labels are display only:

```text
label.zh-CN
label.ru-RU
```

Localized labels must not be used as fact keys in runtime policy or storage.

## Option Values

`option.value` is a stable enum code. Labels localize display only.

Examples:

```text
cash
mbank
bank_transfer
confirmed
rejected
needs_review
available
reserved
occupied
```

Do not use Chinese or Russian text as `option.value`.

## Multi-Event Cards

Cards that declare multiple events must declare dispatch semantics:

- possible events only
- conditional event selection
- all events emitted on confirm

Runtime must use `EventSelectionPolicy` to interpret these semantics.

## Policy Decision Codes

Every runtime policy rejection reason must use a stable decision code registered
in `docs/contracts/policy-contract.json`. Free-form messages may be appended for
human display, but the leading code must be machine-readable.

Required baseline codes include:

```text
allowed
ai_confirmation_forbidden
role_confirmation_forbidden
slice_runtime_forbidden
deposit_evidence_required
payment_evidence_required
deposit_refund_exceeds_held_amount
payment_allocation_exceeds_confirmed_amount
business_rule_violation
idempotency_duplicate
idempotency_conflict
invalid_actor_token
```

## OpenAPI Source of Truth

`docs/contracts/workos-runtime.openapi.json` is the HTTP source of truth. The
generated frontend runtime API paths must come from OpenAPI and include every
runtime path.

## No Fake Defaults

Production-slice user input fields must not contain fake demo defaults such as:

```text
张三
A301
PAY-2026-009
DEP-2026-009
+996 555 010101
```

Demo seed data must be separated from production contracts.

## Contract Version and Hash Alignment

When OpenAPI, projection schema, policy contract, or slice manifest changes,
generated DTOs and runtime API paths must be regenerated. CI must fail if
generated files drift from contract sources.
