# AI Task Template

Use this template for future AI/Codex implementation requests.

## Must Follow

- `docs/architecture/WORKOS_ENGINEERING_RULES.md`
- `docs/architecture/WORKOS_BACKEND_RUNTIME_RULES.md`
- `docs/architecture/WORKOS_FRONTEND_BOUNDARY_RULES.md`
- `docs/architecture/WORKOS_CONTRACT_RULES.md`
- `docs/architecture/WON_13_PRODUCTION_RUNTIME_ARCHITECTURE.md`
- `docs/contracts/projection-contract.schema.json`
- `docs/contracts/workos-runtime.openapi.json`

## Do Not

- Do not create page-specific write APIs.
- Do not create duplicate page, search, AI, learning, task, or object models.
- Do not add business rules to render functions.
- Do not bypass prepare/confirm.
- Do not add direct fetch calls or API paths to `main.js`.
- Do not add schema changes outside `infra/db/migrations/*.sql`.

## Required Validation

```powershell
npm.cmd run build
npm.cmd audit --audit-level=low
dotnet build WorkOSNext.sln -c Release
dotnet run --project tests\WorkOS.RuntimeContractTests\WorkOS.RuntimeContractTests.csproj -c Release
pwsh ./scripts/guard-architecture.ps1
node scripts/validate-contracts.mjs
git diff --check
```
