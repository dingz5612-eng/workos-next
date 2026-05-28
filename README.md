# WorkOSNext

Mobile-first, bilingual Business Work OS platform.

V1.0 is not a hotel-only product. It is a platform shell for multiple business domains, starting with accommodation and maintenance as reference domains.

## Engineering Rules

All future tasks must follow:

```text
docs/architecture/WORKOS_ENGINEERING_RULES.md
```

The center model is `IntentWorkspaceProjection + WorkspaceCardProjection`. Do not create separate page, search, learning, or AI models for the same business behavior.

WON-13 production runtime work must also follow:

```text
docs/architecture/WON_13_PRODUCTION_RUNTIME_ARCHITECTURE.md
```

## Phase 0-1 Scope

- Project scaffold.
- Mobile-first UI/UX shell with mock projection data.
- Chinese and Russian language switching.
- Intent Hub, Work Queue, Object Workspace, Task Surface, Confirm Sheet, After Action, and Help surfaces.
- .NET Core API health endpoint and bootstrap endpoint.
- PostgreSQL Docker Compose placeholder.
- Behavior event endpoint placeholder.

## Run

API:

```powershell
dotnet run --project services/core-api/WorkOS.Api/WorkOS.Api.csproj --urls http://localhost:5180
```

Mobile UI prototype:

```powershell
cd apps/mobile
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Open:

```text
http://127.0.0.1:5173
```

## Toolchain Note

The backend scaffold targets `.NET 10 LTS`. Use the .NET CLI or VS Code if the installed Visual Studio version does not support `net10.0` yet.

Flutter is still the target mobile runtime, while this Phase 0-1 UI remains a mobile-first PWA prototype until Flutter SDK is available locally.
