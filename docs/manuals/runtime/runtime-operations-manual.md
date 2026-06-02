# Runtime Operations Manual

## API 启动

Development API：

```powershell
dotnet run --project services/core-api/WorkOS.Api/WorkOS.Api.csproj -c Release --no-launch-profile
```

本地测试数据库连接通过 `ConnectionStrings__WorkOSRuntime` 与 `WORKOS_TEST_CONNECTION` 指定。

## 数据库连接

本地 PostgreSQL 示例：

```text
Host=localhost;Port=54329;Database=workosnext_test;Username=workosnext;Password=workosnext_dev
```

Production 不得使用 localhost、127.0.0.1 或 development password。

## Migration 策略

Development 可按本地测试需要运行 migration。Production 默认 `Migrations:RunOnStartup=false`，除非 releaseOwner 明确允许并通过 runtime guard。

## /health /live /ready

- `/health`：服务与 readiness 摘要。
- `/live`：进程存活。
- `/ready`：数据库、migration、schema 访问 readiness。

## Session / Actor / Device Trust

登录后由 actor session 代表当前用户。移动端默认 currentDevice；只有 PC surface 且存在可信 PC session 时，才使用 `pcGovernance.currentDevice`。

受保护 API 默认使用 cookie auth 与 `credentials: "include"`；cookie-authenticated non-GET 请求必须携带 `X-CSRF-Token`。Development 可继续使用 `X-WorkOS-Actor-Token` compatibility flow，但仍必须通过 runtime session storage 校验。Production 不得把 actor token 返回给前端或写入 `localStorage`。

Production 不允许通过 `?api=` 持久化任意 API base URL。前端只能使用同源、`VITE_WORKOS_API_BASE_URL` 或明确 allowlist；发现不安全的 `workosnext.apiBaseUrl` 必须清理并回退。

## Evidence Signed URL

Evidence signed URL 只能服务证据上传和读取，不得把占位 evidence 表示为已可信完成。证据需要经过真实附件上传和可信校验。

## Outbox / Projection Replay

Outbox 和 projection replay 用于恢复 read model。Projection pending 是同步中，不是失败。失败时先看 trace 与 outbox 状态，再重跑 replay。

## Runtime Guard

Runtime guard 负责确认 API boundary、runtime write path、policy、device trust、ledger、evidence、projection 和 no fake fallback。

前端 offline fallback 只能展示已缓存的真实只读数据；没有缓存时显示中文空态，不得提供 confirm、approve、apply、export 或 process-outbox。

## Live API DB Replay

重跑 live API DB replay：

```powershell
node scripts/proof/run-runtime-proof.mjs
node scripts/proof/check-runtime-proof-result.mjs
```

Replay runner 必须先通过 `/api/auth/login` 获取 actor token，再调用真实 API。

## 失败恢复

403：查看权限诊断，确认 actor / role / capability / device trust。  
409：检查 idempotency key 与 payload fingerprint，不重复写业务事实。  
422：补齐证据或业务字段，不绕过 blocker。  
DB unavailable：先恢复 PostgreSQL，再检查 `/ready`。
