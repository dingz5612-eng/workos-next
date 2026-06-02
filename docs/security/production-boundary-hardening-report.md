# 生产边界加固报告

## 中文摘要

本轮把运行时认证、后端授权、生产配置、数据库就绪、API 边界、前端信任边界和证据级测试串成一个闭环。核心变化是：业务写入不再信任前端伪造字段，普通移动端不能越权进入 PC 治理平面，生产环境不能依赖开发默认口令、本地数据库或宽松 CORS，测试和门禁可以在固定 clean PostgreSQL 测试库中重放。

宿舍仍只保持 `L1_INTERNAL_PILOT_OBSERVATION`。`Dormitory L2 = false`。`Business Production = blocked`。`Repair / Parts / HR = L0 Contract Preview`。

## 分支与绑定

- branch: `codex/production-boundary-hardening`
- base head: `c9ef041d228e91ecb12f31382786d8eb9cd7d825`
- 证据绑定：`artifacts/release-state/current-state.json`、`artifacts/release-state/post-merge-attestation.json`、`artifacts/baseline/release-evidence-baseline.json`
- Day-2 状态：只更新 entry gate 证据；未启动 Day-2。

## 生产风险关闭

- 后端新增 `WorkOSRuntimeActor` 认证，写操作、confirm、高风险动作、控制平面、导出接口均由后端 session / role / device / tenant / capability 裁决。
- 登录在非开发环境使用 HttpOnly cookie 和 CSRF cookie；生产响应不向前端暴露 actor token。
- `RuntimeStartupValidator` 阻断开发默认口令、旧式 SHA-256 口令、localhost 数据库、空 CORS、通配 `AllowedHosts`。
- PostgreSQL migration 使用 advisory lock，避免多实例启动时并发迁移。
- readiness 检查要求核心运行时表存在，不再只检查 API 进程是否活着。
- `guard-architecture.ps1` 的 runtime API 验证固定使用 clean test DB 默认连接，避免依赖调用者本地环境变量。

## 认证与授权边界

- `RuntimeActorAuthentication.cs` 负责解析 cookie / bearer token / actor session。
- `Program.cs` 统一挂接认证、授权和 CSRF 中间件。
- `OperationsRuntimeEndpoints.cs` confirm 路径只使用可信 actor context，不接受前端伪造 `role`、`deviceId`、`tenantId`。
- `ProjectionRuntime.Operations.cs` 支持 session token 与 device session 查询。
- `RuntimeActorAuthenticationContractTests.cs` 覆盖未认证 confirm、错误设备、高风险动作和 session actor 解析。

## API 与 DB 边界

- OpenAPI 增补 `/live` 与 `/ready`，并同步生成 mobile runtime path DTO。
- `docs/rules/v5.5/api-boundary.yml` 增补 auth policy 元数据。
- `scripts/check-api-boundaries.mjs` 校验 runtime write API 的认证策略。
- `RuntimeDatabaseReadinessContractTests.cs` 覆盖生产数据库 readiness 和迁移启动规则。
- `PostgresProjectionStore` / `ProjectionRuntime` 增加是否执行 DB setup 的显式开关，生产默认不自动建库。

## 前端信任边界

- `apiClient.js` 写请求默认携带 cookie 与 CSRF，生产环境忽略不安全 API override。
- 前端不再在生产持久化 actor token；401 / 403 会清理本地 actor session。
- 启动时未登录只做健康检查，不预取受保护业务数据。
- HTML escape 测试覆盖 WorkItem、ActionResult、PermissionDiagnostic、Evidence 文案等可见区域。
- `workspaceSelectors.js` 对空值输出空字符串，避免出现 `undefined` / `null` / `[object Object]`。

## 禁止回退路径

- 普通 DORM-INT confirm path 不能走 workspace/card/task fallback。
- Mobile BFF 不能写业务事实。
- PC Governance / Finance / Release 不能绕过 Operations Runtime 写业务事实。
- SurfaceGuard 不能替代后端授权。
- `.tmp` 不能作为 final go-live evidence refs。
- Dormitory L1 不会自然升级为 L2。

## 验收命令结果

- `npm --prefix apps/mobile ci`: passed
- `npm --prefix apps/mobile run build`: passed
- `npm --prefix apps/mobile run test`: passed
- `npm --prefix apps/mobile run test:e2e`: passed
- `npm --prefix apps/mobile run test:report`: passed
- `npm --prefix apps/mobile run test:coverage`: passed
- `dotnet build WorkOSNext.sln -c Release`: passed
- `dotnet test tests/WorkOS.UnitTests/WorkOS.UnitTests.csproj -c Release`: passed
- `dotnet test tests/WorkOS.RuntimeIntegrationTests/WorkOS.RuntimeIntegrationTests.csproj -c Release`: passed
- `dotnet test tests/WorkOS.DatabaseSecurityTests/WorkOS.DatabaseSecurityTests.csproj -c Release`: passed
- `dotnet test tests/WorkOS.ReleaseEvidenceTests/WorkOS.ReleaseEvidenceTests.csproj -c Release`: passed
- `dotnet test tests/WorkOS.PolicyAsCodeTests/WorkOS.PolicyAsCodeTests.csproj -c Release`: passed
- `dotnet run --project tests/WorkOS.RuntimeContractTests/WorkOS.RuntimeContractTests.csproj -c Release`: passed
- `pwsh -NoProfile -File scripts/v5_4/run-control-plane-checks.ps1`: passed
- `pwsh -NoProfile -File scripts/guard-architecture.ps1`: passed
- `pwsh -NoProfile -File scripts/clean-baseline.ps1`: passed
- `git diff --check`: passed

## 剩余风险

- P0：无开放项。
- P1：GitHub merge commit 级 CI 仍需在 PR 合并后重新签注，不能用本地结果替代远端 main 结果。
- P2：MSTest analyzer 建议较多，当前不阻断业务边界，但后续可单独清理测试断言风格。

## 最终状态

`PRODUCTION_BOUNDARY_HARDENING_LOCAL_PASSED`

Dormitory remains L1 Internal Pilot Observation only.
Dormitory L2 = false.
Business Production = blocked.
Repair / Parts / HR = L0 Contract Preview.
