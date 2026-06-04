# WorkOSNext

Mobile-first, bilingual Business Work OS platform.

V1.0 is not a hotel-only product. It is a platform shell for multiple business domains, starting with accommodation and maintenance as reference domains.

## Engineering Rules

All future tasks must follow:

```text
docs/engineering/00-rule-authority.md
docs/rules/v5.5/rule-authority.yml
docs/acceptance/13-v5.5-rules-os-go-no-go.md
```

These files are the highest engineering rule authority. `docs/architecture/*`
is now compatibility and historical architecture reference only; it cannot
override V5.5 Rule Authority, current-state, Operations Runtime ownership,
API-boundary classification, fact ownership, MR contracts, or release gates.

The target top-level architecture is OAM-ACF v8. The execution axis is
Operations Runtime:

```text
Definition -> OperationCase -> WorkItem -> CommandSubmission
-> SliceCommandHandler -> DomainEvent / LedgerEntry
-> ProcessManager -> Projection / Lens -> Mobile / PC Surface
```

Current compatibility/runtime reference material lives in:

```text
docs/architecture/CURRENT_RUNTIME_ARCHITECTURE.md
docs/architecture/WORKOS_ENGINEERING_RULES.md
docs/architecture/WORKOS_BACKEND_RUNTIME_RULES.md
docs/architecture/WORKOS_FRONTEND_BOUNDARY_RULES.md
docs/architecture/WORKOS_CONTRACT_RULES.md
docs/architecture/WORKOS_ACCOMMODATION_RUNTIME_RULES.md
docs/architecture/WORKOS_TESTING_RULES.md
```

V5.4 API governance lives in:

```text
docs/engineering/03-api-boundary-rules.md
docs/engineering/13-release-control-plane-rules.md
docs/engineering/15-no-go-rules.md
docs/acceptance/12-release-go-no-go.md
docs/rules/v5.5/api-boundary.yml
```

Operations API is the legal primary business write path. The old
Workspace/Card prepare/confirm write routes are retired and must stay absent,
and Mobile BFF routes must not write business facts.

`ProjectionRuntime` is the current implementation facade for projection and
Lens materialization. It is not the top-level architecture. Workspace/Card is
projection/display compatibility input only, not a business extension point.
Release posture is decided by `artifacts/release-state/current-state.json`.

`tests/WorkOS.RuntimeContractTests` is the current Runtime Smoke /
Integration transition suite. Keep focused behavior in unit, runtime
integration, API contract, and frontend Vitest layers instead of indefinitely
growing the smoke suite.

## Architecture

Primary business writes must use:

```text
POST /api/operations/work-items/{workItemId}/confirm
```

Retired Workspace/Card write routes must stay absent:

```text
POST /api/workspaces/{workspaceId}/cards/{cardId}/prepare
POST /api/workspaces/{workspaceId}/cards/{cardId}/confirm
```

New page-specific business write APIs are P0 No-Go.

## 当前阶段边界

当前项目已超过 Phase 0-1 placeholder。当前主线是 Operations Runtime / Governance / Evidence / Reconciliation / Correction / Control Plane hardening baseline。

当前允许的业务主写路径仍然只有：

```text
POST /api/operations/work-items/{workItemId}/confirm
```

移动端是 Work Execution Plane，只能通过 Operations Runtime 办理 WorkItem。PC 端是 Governance Control Plane，Correction / Reconciliation / Release / Governance 动作不得绕过 Operations Runtime、CommandSubmission、append-only correction 和审计链路。

Dormitory 当前只能保持 L1 Internal Pilot Observation。Dormitory L2 Production = false。Business Production = blocked。Repair / Parts / HR = L0 Contract Preview。

## 安全与配置边界

Development 本地登录可使用 `operator/dev`、`finance/dev`、`manager/dev`、`admin/dev`、`releaseOwner/dev` 等本地账号。Production 禁止使用 development password，也禁止使用 legacy SHA-256 password hash；必须配置 `pbkdf2-sha256:<iterations>:<salt>:<hash>` 格式的 versioned slow hash。

Production 必须显式配置：

```text
ConnectionStrings:WorkOSRuntime
Auth:PasswordSha256ByUsername
Cors:AllowedOrigins
AllowedHosts
Migrations:RunOnStartup
```

Production 下 `ConnectionStrings:WorkOSRuntime` 不得为空，不得指向 `localhost` / `127.0.0.1` / `workosnext_dev`。`Cors:AllowedOrigins` 不得为空，`AllowedHosts` 不得为空或使用 `*`。`Migrations:RunOnStartup` 在 Production 默认关闭，除非发布负责人明确允许。

移动端 Development 可用 `?api=` 临时切换本地 API。Production 不允许把 URL query `?api=` 持久化为 `workosnext.apiBaseUrl`，只允许 `VITE_WORKOS_API_BASE_URL`、同源 API 或 `VITE_WORKOS_ALLOWED_API_BASE_URLS` 明确 allowlist。Production 登录不得把 actor token 写入 `localStorage`；受保护 API 默认使用 HttpOnly cookie、`credentials: "include"` 和 `X-CSRF-Token`。

## Run

API:

```powershell
dotnet run --project services/core-api/WorkOS.Api/WorkOS.Api.csproj --urls http://127.0.0.1:5191
```

Mobile UI prototype:

```powershell
cd apps/mobile
npm install
npm run dev -- --host 127.0.0.1 --port 5175
```

Open:

```text
http://127.0.0.1:5175?workspace=W-STAY-CHECKIN&view=workspace
```

## Toolchain Note

The backend scaffold targets `.NET 10 LTS`. Use the .NET CLI or VS Code if the installed Visual Studio version does not support `net10.0` yet.

Flutter is still the target mobile runtime, while this Phase 0-1 UI remains a mobile-first PWA prototype until Flutter SDK is available locally.
