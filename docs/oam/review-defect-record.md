# OAM 审查缺陷基线

生成时间：2026-06-06

## 基线状态

- 当前分支：`codex/oam-pure-current-architecture`。
- 当前最新提交：`6653315d Rebuild repository around current OAM architecture`。
- 工作区状态：初始审查开始时干净。

## 已复现缺陷

| 编号 | 缺陷 | 复现结果 | 定位 |
| --- | --- | --- | --- |
| D0-01 | PC 测试失败 | `npm --prefix apps/mobile exec vitest run apps/pc/src/__tests__` 失败；`PcReleaseFlightDeckContract` 读取不存在迁移 `029_oam_gate_result_hardening.sql`。 | `apps/pc/src/__tests__/PcReleaseFlightDeckContract.test.js:7` |
| D0-02 | CI 未独立验收 PC 测试 | CI 只有 `Test mobile`，没有 `apps/pc/src/__tests__` 独立测试步骤，PC 失败不会阻断 CI。 | `.github/workflows/ci.yml:100` |
| D0-03 | 合同引用旧迁移 | 合同仍指向已改名的 `034_operations_command_submission_context.sql`。 | `docs/contracts/operations-command-submission-context.json:28` |
| D0-04 | 文档引用已删除 artifact | 宿舍旅程验收文档仍引用已删除的本地 demo 证据目录、旧汇总文件和旧浏览器脚本。 | `docs/surface/dormitory-scenario-journey-acceptance.md:34`, `docs/surface/dormitory-scenario-journey-acceptance.md:36`, `docs/surface/dormitory-scenario-journey-acceptance.md:53`, `docs/surface/dormitory-scenario-journey-acceptance.md:63` |
| D0-05 | Control Plane runner 指向不存在脚本 | Runtime certification runner 引用不存在的 `scripts/oam/certify-runtime.mjs`。 | `tools/control-plane/WorkOS.ControlPlaneRunners/RuntimeCertificationRunner.cs:656` |
| D0-06 | Control Plane cutover runner 指向不存在脚本 | Cutover runner 引用不存在的 `scripts/oam/cutover-state-runner.mjs`。 | `tools/control-plane/WorkOS.ControlPlaneRunners/CutoverStateRunner.cs:41` |
| D0-07 | 纯净度检查漏旧语义 | 当前 OAM purity check 通过，但仓库仍存在 `retired`、`retired`、`history` 当前语义和旧迁移/回填体系。 | `scripts/oam/check-current-oam.mjs:43`, `scripts/check-ledger-data-consistency.mjs:3`, `docs/contracts/ledger-data-consistency-registry.json:4`, `tools/control-plane/WorkOS.ControlPlaneRunners/MigrationVerificationJob.cs:21` |

## 当前仍通过项

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| OAM purity | `node scripts/oam/check-current-oam.mjs` | PASS |
| 合同格式校验 | `node scripts/validate-contracts.mjs` | PASS |
| 架构守卫 | `pwsh scripts/guard-architecture.ps1` | PASS |
| Mobile 单元测试 | `npm --prefix apps/mobile run test` | 57 files / 306 tests PASS |
| 后端 Unit | `dotnet test tests/WorkOS.UnitTests/WorkOS.UnitTests.csproj -c Release` | 224 tests PASS |
| RuntimeIntegration | `dotnet test tests/WorkOS.RuntimeIntegrationTests/WorkOS.RuntimeIntegrationTests.csproj -c Release` | 55 tests PASS |
| DatabaseSecurity | `dotnet test tests/WorkOS.DatabaseSecurityTests/WorkOS.DatabaseSecurityTests.csproj -c Release` | 9 tests PASS |
| Policy | `dotnet test tests/WorkOS.PolicyAsCodeTests/WorkOS.PolicyAsCodeTests.csproj -c Release` | 4 tests PASS |
| ReleaseEvidence | `dotnet test tests/WorkOS.ReleaseEvidenceTests/WorkOS.ReleaseEvidenceTests.csproj -c Release` | 3 tests PASS |

## 初始审查结论

审查发现均已复现。当前通过项说明主线重构方向可继续，但 PC 测试入口、合同路径完整性、旧语义纯净度、artifact 引用和 Control Plane 证据链存在明确验收洞，必须在后续阶段逐项修复。
