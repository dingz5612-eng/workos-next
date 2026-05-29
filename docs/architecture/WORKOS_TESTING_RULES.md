# WorkOS Testing Rules

WorkOS tests are a pyramid, not one growing smoke test. Every new runtime
capability must land in the narrowest useful layer first, then be covered by
integration or smoke tests only where the behavior crosses module boundaries.

## Test Layers

| Layer | Project or Location | Purpose |
| --- | --- | --- |
| Runtime smoke / integration transition | `tests/WorkOS.RuntimeContractTests` | Current end-to-end safety net. It verifies contracts, runtime path, persistence, projection, and Lens behavior while the suite is being split. It must not keep absorbing every new scenario indefinitely. |
| Unit tests | `tests/WorkOS.UnitTests` | Policy, event selection, contract parsing, option value, canonical field id, and HTTP mapping units. |
| Runtime integration tests | `tests/WorkOS.RuntimeIntegrationTests` | PostgreSQL transaction, idempotency, outbox claim/dead-letter, migration upgrade, aggregate persistence, and no-side-effect guarantees. |
| API contract tests | runtime API validation | Real HTTP behavior compared with OpenAPI, including auth, role, business blocker, idempotency, Lens, and behavior event contracts. |
| Frontend Vitest | `apps/mobile` | Submit protocol, evidence submission, idempotency UUID, status handling, escaping, and carried-forward scope. |
| Concurrency tests | unit or integration layer | Idempotency and outbox claim behavior under concurrent attempts. |
| Migration upgrade tests | runtime integration layer | Old `runtime_documents` and existing database state absorbing new contracts without silent data loss. |

## CI Gate

CI must run:

```bash
npm --prefix apps/mobile ci
npm --prefix apps/mobile run build
npm --prefix apps/mobile audit --audit-level=low
dotnet build WorkOSNext.sln -c Release
dotnet run --project tests/WorkOS.RuntimeContractTests/WorkOS.RuntimeContractTests.csproj -c Release
node scripts/validate-contracts.mjs
node scripts/validate-slice-admission.mjs
node scripts/architecture-drift-report.mjs
node scripts/validate-runtime-api.mjs
node scripts/generate-contract-dtos.mjs --check
pwsh ./scripts/guard-architecture.ps1
pwsh ./scripts/clean-baseline.ps1
git diff --check
```

When `tests/WorkOS.UnitTests`, `tests/WorkOS.RuntimeIntegrationTests`, or
frontend Vitest exist, CI must run them explicitly. Do not add fake CI steps for
tests that do not exist.

## Safety Rules

- Any destructive test database reset must require the database name to contain
  `_test` or `TEST_DATABASE=true`.
- Forbidden and invalid confirm paths must verify no side effects:
  no `AuditEvent`, no `OutboxMessage`, and no aggregate write.
- Contract-only slice tests must be manifest-driven and cover every
  `status = contract-only` slice automatically.
- Production-slice admission must be manifest-driven and must require happy
  path confirm, role negative, AI negative, idempotency duplicate,
  audit/outbox persistence, and aggregate value checks.
- Tests must not assert only fixed global counts when manifest-driven derivation
  is possible.
- Runtime policy and storage tests must use canonical field ids and canonical
  payload keys, not localized labels.
- Every new runtime policy rejection code must be registered in
  `docs/contracts/policy-contract.json`.
- The latest commit may only be described as CI-passing when local full gate
  evidence or GitHub Actions evidence exists for that exact commit.
