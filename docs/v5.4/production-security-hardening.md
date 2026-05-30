# V5.4 Production Security Hardening

This hardening pass makes high-risk runtime paths fail closed before business
facts are committed.

## Runtime Confirm

- Runtime sessions can be revoked through `runtime_sessions.revoked_at_utc`.
- Confirm resolves actor sessions only when the session is unexpired and not
  revoked.
- AI actors cannot confirm terminal actions, even if a card-specific policy is
  misconfigured.
- Role authorization and trusted-device checks run before idempotency lookup,
  event append, outbox write, projection, or aggregate mutation.
- High-risk confirm actions require a trusted device:
  - `payment.confirm` for high amount confirmations
  - `deposit.refund.pay`
  - `deposit.deduct`
  - `case.close`
  - `period.close`

## Device Trust

`device_sessions` records tenant, actor, device id, trust state, user agent
hash, last seen time, and revocation time.

Allowed trust states:

- `unknown`
- `trusted`
- `untrusted`
- `revoked`

Revoked devices cannot perform high-risk actions or receive evidence signed
URLs.

## Evidence Files

Evidence attachment metadata is accepted only when:

- `content_sha256` is present.
- content type is in the runtime allowlist.
- size is greater than zero and not above the runtime maximum.

Signed URLs are capped at 15 minutes and every signed URL request writes a
`file_access_audits` row with actor, device, evidence, attachment, expiry,
status, and reason.

## Governance Export

Ledger and evidence/period exports require:

- export capability,
- non-empty reason,
- persisted audit row,
- expiring download URL,
- trusted PC device for high-risk exports.

Rejected export attempts also create an audit row.

## Ops Actions

The high-risk operations catalog also covers non-Confirm production operations:

- `ledger.export`
- `correction.approve`
- `release.cutover`
- `projection.rebuild`
- `deadletter.replay`

Projection rebuild and dead-letter replay require a specific capability,
trusted PC/device context, a non-empty reason, and an audit record before any
state-changing action runs.

## CORS

The API keeps explicit origin allowlisting through `RuntimeCorsOptions`.
Production must configure the `Cors:AllowedOrigins` list and must not rely on
wildcard origins.

## No Side Effects

403 role/device/AI failures return before:

- `CommandSubmission` / audit event creation,
- `DomainEvent` append,
- outbox write,
- lens update.

The unit tests cover revoked session, revoked device evidence access, trusted
device enforcement, audited ledger export, AI terminal action denial, file URL
expiry, and role-forbidden no-side-effects behavior.
