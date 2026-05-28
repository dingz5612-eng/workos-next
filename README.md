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

The target backend architecture is .NET 10 LTS. This local Phase 0-1 scaffold currently targets `net9.0` because the local machine has .NET 9 SDK installed and not .NET 10 SDK. Upgrade the target framework to `net10.0` once the SDK is installed.

