# API Boundary Rules

## Primary Business Write Path

Operations API is the legal primary path for business writes:

```text
POST /api/operations/work-items/{workItemId}/confirm
```

Operations prepare and confirm must own the canonical command boundary. Any new
business write must be expressed as an Operations work-item confirmation unless
an explicit architecture rule allows a different non-business transport.

## Operations API Allowlist

The route allowlist lives in:

```text
docs/v5.4/operations-api-allowlist.json
```

Allowed Operations API routes are:

```text
POST /api/operations/cases
GET /api/operations/cases/{caseId}
POST /api/operations/work-items
GET /api/operations/work-items
GET /api/operations/work-items/{workItemId}
POST /api/operations/work-items/{workItemId}/prepare
POST /api/operations/work-items/{workItemId}/confirm
```

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
