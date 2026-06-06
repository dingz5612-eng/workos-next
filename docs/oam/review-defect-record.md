# OAM 审查缺陷闭环记录

生成时间：2026-06-06

## 当前状态

- 当前分支：`main`。
- 当前硬收口目标：只保留当前 OAM 原生架构、当前合同、当前 surface、当前 control-plane 和当前证据路径。
- 工作区进入审查时干净，本轮仅修改 OAM 纯净架构、规则门禁、surface、control-plane、DB 迁移命名、测试证据和验收报告相关文件。

## 已闭环缺陷

| 编号 | 缺陷 | 当前处置 |
| --- | --- | --- |
| C0-01 | PC 测试未作为独立验收项 | `test:pc` 保持独立入口，CI 和本地验收单独运行 |
| C0-02 | 合同内本地路径断链 | `check-local-path-references` 纳入本地总门禁 |
| C0-03 | 非 OAM artifact 路径 | 财务语义报告统一到 `artifacts/oam/checks` |
| C0-04 | Surface 写阻断字段旧命名 | 统一改为 `currentForbiddenWriteAdapter`、`nonPersistedWorkItemKey` |
| C0-05 | WorkItem 定义和步骤依赖旧命名 | 统一改为 `sourceCardId`、`suppressedFields` |
| C0-06 | Ledger/control-plane 迁移口径旧命名 | 统一改为 `migrationReadonlySources`、`sourceLock`、`readonlySourceVerification`、`projectionConsistencyCompare` |
| C0-07 | WorkItem 状态记录表命名不纯 | 统一为 `operations_work_item_state_event_log`，并新增当前迁移 `041_current_oam_work_item_state_event_log.sql` |
| C0-08 | 纯净度检查未覆盖旧运行体系词 | `scripts/oam/check-current-oam.mjs` 已将旧阶段词、旧运行体系词和旧 artifact 引用纳入硬阻断 |

## 当前通过项

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| OAM 总门禁 | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/oam/run-control-plane-checks.ps1` | PASS |
| Mobile 单元测试 | `npm --prefix apps/mobile run test` | 59 files / 313 tests PASS |
| PC 单元测试 | `npm --prefix apps/mobile run test:pc` | 4 files / 4 tests PASS |
| Mobile 覆盖率 | `npm --prefix apps/mobile run test:coverage` | Statements 78.54%, Branches 63.38%, Functions 85.00%, Lines 82.69% |
| Browser smoke | `npm --prefix apps/mobile run test:e2e` | 5 tests PASS |
| 后端构建 | `dotnet build WorkOSNext.sln -c Release` | PASS |
| 后端 Unit | `dotnet test tests/WorkOS.UnitTests/WorkOS.UnitTests.csproj -c Release --no-build --collect:"XPlat Code Coverage"` | 224 tests PASS |
| RuntimeIntegration | `dotnet test tests/WorkOS.RuntimeIntegrationTests/WorkOS.RuntimeIntegrationTests.csproj -c Release --no-build --collect:"XPlat Code Coverage"` | 55 tests PASS |
| DatabaseSecurity | `dotnet test tests/WorkOS.DatabaseSecurityTests/WorkOS.DatabaseSecurityTests.csproj -c Release --no-build --collect:"XPlat Code Coverage"` | 9 tests PASS |
| Policy | `dotnet test tests/WorkOS.PolicyAsCodeTests/WorkOS.PolicyAsCodeTests.csproj -c Release --no-build --collect:"XPlat Code Coverage"` | 4 tests PASS |
| ReleaseEvidence | `dotnet test tests/WorkOS.ReleaseEvidenceTests/WorkOS.ReleaseEvidenceTests.csproj -c Release --no-build --collect:"XPlat Code Coverage"` | 5 tests PASS |
| RuntimeContract | `dotnet run --project tests/WorkOS.RuntimeContractTests/WorkOS.RuntimeContractTests.csproj -c Release` | PASS |

## 结论

当前 OAM 纯净架构已由规则、合同、CI、本地总门禁和发布证据共同闭合。剩余 warning 仅为既有 .NET analyzer/nullable warning 与 Vite chunk size warning，不构成本次硬收口阻断项。
