# WorkOSNext

Mobile-first, bilingual Business Work OS platform.

V1.0 is not a hotel-only product. It is a platform shell for multiple business domains, starting with accommodation and maintenance as reference domains.

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

The backend scaffold targets `.NET 10 LTS`. Flutter is still the target mobile runtime, while this Phase 0-1 UI remains a mobile-first PWA prototype until Flutter SDK is available locally.
