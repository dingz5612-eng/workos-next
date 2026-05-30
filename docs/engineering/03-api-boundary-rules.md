# API Boundary Rules

## Primary Business Write Path

Operations API is the legal primary path for business writes:

```text
POST /api/operations/work-items/{workItemId}/confirm
```

Operations prepare and confirm must own the canonical command boundary. Any new
business write must be expressed as an Operations work-item confirmation unless
an explicit architecture rule allows a different non-business transport.

## V2 Write Route Classification

The route classification allowlist lives in:

```text
docs/v5.4/operations-api-allowlist.json
```

Every non-GET `/api/*` route is treated as a write route by default. A write
route must appear in exactly one classified allowlist category. Unclassified
write routes are P0 failures.

Primary business writes may only use:

```text
POST /api/operations/work-items/{workItemId}/confirm
```

Other non-business writes must be classified as Operations coordination,
compatibility, mobile experience, evidence file, auth/device, control plane,
governance, behavior event, or runtime maintenance writes. Governance writes
must declare whether they write business facts, whether they use Operations
Confirm, whether they only write control/governance/provisional records, and
whether they are append-only.

## Compatibility Layer

The old Workspace/Card API is compatibility-only:

```text
POST /api/workspaces/{workspaceId}/cards/{cardId}/prepare
POST /api/workspaces/{workspaceId}/cards/{cardId}/confirm
```

Compatibility endpoints may remain to support existing clients, but new product
work must not treat them as the primary design surface. New business-write
architecture, documentation, and tests must target Operations Confirm.

## Mobile BFF Boundary

Mobile BFF routes may assemble views, fetch read models, or proxy non-business
session behavior. Mobile BFF routes must not write business facts, ledger facts,
release state, shadow facts, or confirmation results.

Forbidden examples:

```text
POST /api/mobile/*/confirm
POST /api/mobile/*/refund
POST /api/mobile/*/close
```

## Page-Specific Business Writes

Adding page-specific business write APIs is a P0 No-Go. This includes direct
write endpoints such as:

```text
POST /api/payment/confirm
POST /api/deposit/refund
POST /api/checkout/close
POST /api/bed/release
POST /api/period/close
```

Use `scripts/check-api-boundaries.mjs` to enforce the boundary in CI.
