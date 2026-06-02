# 证据级测试增强报告

## 中文摘要

本轮把测试从“能跑通命令”升级为“能留下证据、能被 CI 上传、能定位失败”的测试体系。移动端新增 Vitest report / coverage / Playwright E2E，.NET 测试项目接入 coverage collector，runtime contract 产出 JSON 报告，GitHub Actions 上传测试与覆盖率 artifact。

## 测试增强范围

- Mobile unit: `vitest run src`
- Mobile report: `vitest run src --reporter=default --reporter=json`
- Mobile coverage: `vitest run src --coverage`
- Mobile E2E: Playwright chromium smoke，覆盖普通移动工作平面、PC Manager Control Tower、PC Release Flight Deck。
- .NET unit / integration / DB security / release evidence / policy as code：接入 `coverlet.collector`。
- Runtime contract：生成 `artifacts/test-results/runtime-contract-report.json`。
- CI artifact：上传 mobile report、mobile coverage、Playwright report、dotnet TRX、dotnet coverage、runtime contract report。

## 新增测试

- `apps/mobile/src/__tests__/FrontendTrustBoundary.test.js`
- `apps/mobile/e2e/surface-smoke.spec.js`
- `tests/WorkOS.RuntimeIntegrationTests/RuntimeActorAuthenticationContractTests.cs`
- `tests/WorkOS.DatabaseSecurityTests/RuntimeDatabaseReadinessContractTests.cs`

## 更新测试

- `apps/mobile/src/__tests__/authRoleHome.test.js`
- `apps/mobile/src/__tests__/confirmErrorHandling.test.js`
- `apps/mobile/src/__tests__/htmlEscaping.test.js`
- `tests/WorkOS.UnitTests/RuntimeHardeningTests.cs`
- `tests/WorkOS.UnitTests/ApiBoundaryRulesTests.cs`
- `tests/WorkOS.UnitTests/V54ControlPlaneGuardTests.cs`

## 证据位置

- Runtime contract report: `artifacts/test-results/runtime-contract-report.json`
- Mobile test report: `artifacts/test-results/mobile/vitest-report.json`
- Mobile coverage: `artifacts/test-results/mobile/coverage/`
- Playwright report: `apps/mobile/playwright-report/`
- Playwright last run: `apps/mobile/test-results/.last-run.json`
- GitHub workflow artifact wiring: `.github/workflows/ci.yml`

## 运行时守卫覆盖矩阵

- 未认证写入：401 / rejected，无业务事实。
- 角色越权：403 / rejected，无 DomainEvent / LedgerTransaction。
- 错误设备：403 或 422，并保留诊断。
- 错误 tenant / pilot scope：后端阻断，不依赖前端 guard。
- PC governance direct write：规则与 API boundary 阻断。
- workspace/card fallback：只能作为兼容诊断，不进入普通 DORM-INT confirm path。
- 生产配置：启动前阻断开发默认口令、本地数据库、空 CORS、通配 host。
- XSS：用户可见 surface 对业务文本做 escaping，不渲染 raw object。

## 失败修复记录

- 修复 `RuntimeHardeningTests` 中旧英文错误说明断言，改为匹配中文“旧式 SHA-256”。
- 修复 architecture guard 在缺少环境变量时回落到默认 `workosnext` DB 的问题，改为 `validate-runtime-api.mjs` 自带 clean test DB 默认连接。
- 修复 OpenAPI / generated DTO 因新增 `/live`、`/ready` 后的架构 allowlist 漂移。
- 修复 control-plane guard 对 `Migration` 命名的误触发，保留生产迁移开关但避免架构扫描误判。

## 命令结果

- `npm --prefix apps/mobile run test`: passed
- `npm --prefix apps/mobile run build`: passed
- `npm --prefix apps/mobile run test:e2e`: passed
- `npm --prefix apps/mobile run test:report`: passed
- `npm --prefix apps/mobile run test:coverage`: passed
- `dotnet test tests/WorkOS.UnitTests/WorkOS.UnitTests.csproj -c Release`: passed
- `dotnet test tests/WorkOS.RuntimeIntegrationTests/WorkOS.RuntimeIntegrationTests.csproj -c Release`: passed
- `dotnet test tests/WorkOS.DatabaseSecurityTests/WorkOS.DatabaseSecurityTests.csproj -c Release`: passed
- `dotnet test tests/WorkOS.ReleaseEvidenceTests/WorkOS.ReleaseEvidenceTests.csproj -c Release`: passed
- `dotnet test tests/WorkOS.PolicyAsCodeTests/WorkOS.PolicyAsCodeTests.csproj -c Release`: passed
- `dotnet run --project tests/WorkOS.RuntimeContractTests/WorkOS.RuntimeContractTests.csproj -c Release`: passed
- `pwsh -NoProfile -File scripts/v5_4/run-control-plane-checks.ps1`: passed
- `pwsh -NoProfile -File scripts/guard-architecture.ps1`: passed
- `pwsh -NoProfile -File scripts/clean-baseline.ps1`: passed

## 结论

`EVIDENCE_GRADE_TEST_CI_OBSERVABILITY_PASSED`

这些结果只能证明当前分支本地与 PR 前验证通过；合并后仍必须等待远端 main CI 与 V5.4 Guards 重新签注。
