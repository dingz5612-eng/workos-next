# AI Task Template

Use this template when asking an AI coding agent to work on WorkOSNext.

## Mandatory Context

Read these first:

```text
docs/architecture/WORKOS_ENGINEERING_RULES.md
docs/architecture/WORKOS_BACKEND_RUNTIME_RULES.md
docs/architecture/WORKOS_FRONTEND_BOUNDARY_RULES.md
docs/architecture/WORKOS_CONTRACT_RULES.md
docs/architecture/WORKOS_ACCOMMODATION_RUNTIME_RULES.md
docs/architecture/WORKOS_TESTING_RULES.md
docs/architecture/CURRENT_RUNTIME_ARCHITECTURE.md
docs/architecture/rules/index.json
docs/architecture/architecture-exceptions.json
docs/contracts/projection-contract.schema.json
docs/contracts/workos-runtime.openapi.json
docs/contracts/slice-manifest.json
docs/contracts/policy-contract.json
```

Historical context may be useful, but it is not the current source of truth:

```text
docs/architecture/WON_13_PRODUCTION_RUNTIME_ARCHITECTURE.md
docs/architecture/WON_14_HOSTEL_FOLIO_LEDGER_OPERATING_ANALYTICS_RUNTIME.md
```

## Non-Negotiable Boundaries

- Do not add page-specific write APIs.
- Do not bypass Action Runtime, AuditEvent, Outbox, Lens, or PostgreSQL.
- Do not let AI confirm.
- Do not trust actor identity from request body.
- Do not use localized labels as runtime fact keys.
- Do not let non-owner slices write ledger, cost, BedStatus, or frozen snapshot
  facts.
- Do not weaken tests or guards to make a failure disappear.

## Task Format

Describe:

```text
Goal
Relevant slice(s)
Relevant card(s)
Expected event(s)
Expected aggregate / ledger effects
Expected Lens effects
Expected frontend behavior
Required tests / guards
Known migration constraints
```

## Required Validation

Run the applicable gate and report pass/fail honestly:

```bash
npm --prefix apps/mobile ci
npm --prefix apps/mobile run build
npm --prefix apps/mobile audit --audit-level=low
dotnet build WorkOSNext.sln -c Release
dotnet run --project tests/WorkOS.RuntimeContractTests/WorkOS.RuntimeContractTests.csproj -c Release
node scripts/validate-contracts.mjs
node scripts/validate-runtime-api.mjs
node scripts/generate-contract-dtos.mjs --check
pwsh ./scripts/guard-architecture.ps1
pwsh ./scripts/clean-baseline.ps1
git diff --check
```

Run unit, runtime integration, and frontend tests when they exist. Do not claim
CI success without evidence for the exact commit.
