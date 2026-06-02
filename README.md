# WorkOSNext

WorkOSNext 当前不是正式生产系统，也不是 Day-2 项目入口。当前 main 已完成 OAM-04B / OAM-04C accepted 后的远端基线确认，主线状态是 Operations Runtime / Governance / Evidence / Reconciliation / Correction / Control Plane hardening baseline。

## 当前状态

- OAM-04B / OAM-04C accepted。
- Dormitory remains L1 Internal Pilot Observation only。
- Dormitory L2 Production = false。
- Business Production = blocked。
- Repair / Parts / HR = L0 Contract Preview。
- Day-2 not started。

早期 Phase 0-1 prototype / placeholder 说明已归档到：

```text
docs/history/phase-0-1-archive.md
```

## 工程规则

所有后续任务必须遵守：

```text
docs/architecture/WORKOS_ENGINEERING_RULES.md
```

中心模型仍是：

```text
IntentWorkspaceProjection + WorkspaceCardProjection
```

不得为同一业务行为新增独立的 page、search、learning 或 AI 事实模型。

当前 runtime facts 与 WON-16 governance rules 位于：

```text
docs/architecture/CURRENT_RUNTIME_ARCHITECTURE.md
docs/architecture/WORKOS_BACKEND_RUNTIME_RULES.md
docs/architecture/WORKOS_FRONTEND_BOUNDARY_RULES.md
docs/architecture/WORKOS_CONTRACT_RULES.md
docs/architecture/WORKOS_ACCOMMODATION_RUNTIME_RULES.md
docs/architecture/WORKOS_TESTING_RULES.md
```

V5.4 API governance 位于：

```text
docs/engineering/03-api-boundary-rules.md
docs/engineering/13-release-control-plane-rules.md
docs/engineering/15-no-go-rules.md
docs/acceptance/12-release-go-no-go.md
docs/v5.4/operations-api-allowlist.json
```

## 写入边界

Operations API 是唯一合法主业务写入路径：

```text
POST /api/operations/work-items/{workItemId}/confirm
```

Workspace/Card API 只保留 compatibility-only：

```text
POST /api/workspaces/{workspaceId}/cards/{cardId}/prepare
POST /api/workspaces/{workspaceId}/cards/{cardId}/confirm
```

Mobile BFF、ViewModel、UI 不得写业务事实。新增 page-specific business write API 是 P0 No-Go。

移动端是 Work Execution Plane，只能通过 Operations Runtime 办理 WorkItem。PC 端是 Governance Control Plane，Correction / Reconciliation / Release / Governance 动作不得绕过 Operations Runtime、CommandSubmission、append-only correction 和审计链路。

## Artifact 分类

- final evidence：当前 release-state / baseline / surface / runtime guard 直接引用的权威证据，必须绑定当前 verified main 或由 checker 明确允许 historical retained。
- historical artifact：旧阶段已通过但不再作为当前 final evidence 的历史材料。
- diagnostic-only：旧 PNG screenshot、local run 输出、`.tmp` 运行中间物，只能用于诊断，不得作为 final evidence。
- superseded：被 PR #74 / PR #76 或后续 post-merge attestation 取代的旧签注、旧报告或旧 PR 证据。
- removable candidate：未被 current-state、baseline、manual 或 checker 引用的本地诊断输出；删除前必须由 project hygiene checker 证明不会影响 final evidence。

OAM-04C `artifacts/screenshots/dormitory-journeys/*.html` 与 `*.svg` 是 accepted journey evidence。早期 PNG screenshot 目录只作为 diagnostic-only。

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

Production 下 `ConnectionStrings:WorkOSRuntime` 不得为空，不得指向 `localhost` / `127.0.0.1` / `workosnext_dev`。`Cors:AllowedOrigins` 不得为空，`AllowedHosts` 不得为空或使用 `*`。`Migrations:RunOnStartup` 在 Production 默认关闭，除非 releaseOwner 明确允许。

移动端 Development 可用 `?api=` 临时切换本地 API。Production 不允许把 URL query `?api=` 持久化为 `workosnext.apiBaseUrl`，只允许 `VITE_WORKOS_API_BASE_URL`、同源 API 或 `VITE_WORKOS_ALLOWED_API_BASE_URLS` 明确 allowlist。Production 登录不得把 actor token 写入 `localStorage`；受保护 API 默认使用 HttpOnly cookie、`credentials: "include"` 和 `X-CSRF-Token`。

## 本地运行

API:

```powershell
dotnet run --project services/core-api/WorkOS.Api/WorkOS.Api.csproj --urls http://127.0.0.1:5191
```

Mobile UI:

```powershell
cd apps/mobile
npm install
npm run dev -- --host 127.0.0.1 --port 5175
```

Open:

```text
http://127.0.0.1:5175?workspace=W-STAY-CHECKIN&view=workspace
```

## 工具链

后端目标是 `.NET 10 LTS`。如本机 Visual Studio 尚不支持 `net10.0`，请使用 .NET CLI 或 VS Code。
