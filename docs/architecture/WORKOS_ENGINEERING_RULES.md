# WorkOS Architecture Compatibility Rules

This file is a compatibility and historical architecture reference. The highest
engineering rule authority lives in:

```text
docs/engineering/00-rule-authority.md
docs/rules/v5.5/rule-authority.yml
docs/acceptance/13-v5.5-rules-os-go-no-go.md
```

If this file conflicts with V5.5 Rule Authority, current-state, API-boundary
classification, fact ownership, MR contracts, or release gates, the V5.5
authority chain wins.

## OAM-ACF v8 Target

OAM-ACF v8 is the target top-level architecture. Its execution axis is
Operations Runtime:

```text
Definition
  -> OperationCase
  -> WorkItem
  -> CommandSubmission
  -> SliceCommandHandler
  -> DomainEvent / LedgerEntry
  -> ProcessManager
  -> Projection / Lens
  -> Mobile / PC Surface
```

The older Slice/Card wording in architecture references describes compatibility
shape and implementation history. It is not the primary extension model for new
business behavior.

## Projection Ownership

- Projection state is read model output, not the business write model.
- Slice-owned aggregates and ledger facts are persisted by the owning slice.
- Lens output reads persisted facts and projection state; it must not invent a
  second source of truth.
- Legacy compatibility code must be isolated, documented, and removed when the
  owning slice has a production runtime.
- `ProjectionRuntime` is the current implementation facade for projection and
  Lens materialization; it is not the top-level architecture.

## AI Cannot Confirm

AI may prepare, explain, recommend, and draft. AI must never confirm a Card.
Confirm requires a trusted backend actor session and a human role allowed by the
Card confirmation contract.

## Authenticated Actor And Policy Gate

所有 business / governance / runtime maintenance write 都必须由后端认证得到
trusted actor context，不能信任 request body、`X-WorkOS-Actor-Id` 或前端
ViewModel。非 `GET /api/*` 默认需要 `WorkOSWrite`，`POST
/api/operations/work-items/{workItemId}/confirm` 必须需要
`OperationsConfirmPolicy`。高风险 correction、governance export、session /
device revoke、projector maintenance 必须声明并通过对应 policy：
`HighRiskActionPolicy`、`GovernanceExportPolicy` 或
`RuntimeMaintenancePolicy`。

生产登录必须使用 HttpOnly cookie 承载 `workosnext_session`，cookie-authenticated
non-GET 请求必须校验 `X-CSRF-Token`。Development 可以保留
`X-WorkOS-Actor-Token` compatibility flow，但它仍必须通过 runtime session
storage 校验。

## Clean Baseline

The repository must not reintroduce old page, task, object, or scenario models.
The legal primary business write API shape is Operations Confirm:

```text
POST /api/operations/work-items/{workItemId}/confirm
```

The older Workspace/Card write endpoints are compatibility layer only:

```text
POST /api/workspaces/{workspaceId}/cards/{cardId}/prepare
POST /api/workspaces/{workspaceId}/cards/{cardId}/confirm
```

Mobile BFF routes must not write business facts. New page-specific business
write APIs are P0 No-Go items. The following page-specific write APIs are
forbidden:

```text
/api/hostel/checkin
/api/payment/confirm
/api/deposit/refund
/api/finance/confirm-deposit
/api/room/activate
```

The Operations route allowlist lives at
`docs/v5.4/operations-api-allowlist.json` and is enforced by
`scripts/check-api-boundaries.mjs`.

## Required Validation

Before claiming a change is complete, run the applicable gate:

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
node scripts/check-api-boundaries.mjs --self-test
node scripts/check-api-boundaries.mjs
node scripts/generate-contract-dtos.mjs --check
pwsh ./scripts/guard-architecture.ps1
pwsh ./scripts/clean-baseline.ps1
git diff --check
```

Run newly added unit, runtime integration, or frontend tests when those projects
exist. Do not claim GitHub Actions success without Actions evidence for the
exact commit.

## Rule Index

Highest authority:

- Rule authority: `docs/engineering/00-rule-authority.md`
- V5.5 machine authority: `docs/rules/v5.5/rule-authority.yml`
- V5.5 Go/No-Go: `docs/acceptance/13-v5.5-rules-os-go-no-go.md`
- Current-state authority: `artifacts/release-state/current-state.json`

Compatibility and historical references:

- Backend runtime: `docs/architecture/WORKOS_BACKEND_RUNTIME_RULES.md`
- Frontend boundaries: `docs/architecture/WORKOS_FRONTEND_BOUNDARY_RULES.md`
- Contract rules: `docs/architecture/WORKOS_CONTRACT_RULES.md`
- Runtime surfaces: `docs/architecture/WORKOS_SURFACE_RULES.md`
- Accommodation runtime: `docs/architecture/WORKOS_ACCOMMODATION_RUNTIME_RULES.md`
- Testing rules: `docs/architecture/WORKOS_TESTING_RULES.md`
- Current runtime facts: `docs/architecture/CURRENT_RUNTIME_ARCHITECTURE.md`
- API boundary rules: `docs/engineering/03-api-boundary-rules.md`
- Release Control Plane rules: `docs/engineering/13-release-control-plane-rules.md`
- No-Go rules: `docs/engineering/15-no-go-rules.md`
- Release Go/No-Go acceptance: `docs/acceptance/12-release-go-no-go.md`
- Machine-readable registry: `docs/architecture/rules/index.json`
- Exception registry: `docs/architecture/architecture-exceptions.json`

## Exception Policy

Rules default to no exceptions. If a temporary exception is unavoidable, it must
be registered in `docs/architecture/architecture-exceptions.json` with:

- `ruleId`
- `owner`
- `reason`
- `createdAt`
- `expiresAt`
- `removalCondition`
- `linkedTest`

Expired exceptions must fail the architecture guard. Exceptions cannot be used
to permit page-specific write APIs, AI confirmation, untrusted actor identity,
ledger fact ownership violations, or fake CI success.
