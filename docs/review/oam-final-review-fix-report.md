# OAM 最终审查修复报告

## 审查缺陷清单

| 缺陷 | 影响 | 当前处置 |
| --- | --- | --- |
| PC 测试未作为独立验收项 | PC 治理面回归可能绕过 CI | 已保留 `test:pc` 独立入口，并由 CI 单独运行 |
| 合同内本地路径断链 | 合同通过但指向不存在文件 | 已由当前路径引用完整性检查覆盖 |
| 旧入口、旧阶段词和旧运行体系字段残留 | 影响当前 OAM 判断，可能恢复旧写路径或旧命名口径 | 已由当前 OAM 纯净度检查阻断 |
| 文档引用已删除 artifact | 证据链不可复现 | 已改为当前 `artifacts/oam` 证据或当前生成命令 |
| Control Plane runner 指向不存在脚本 | 控制面报告可能失真 | runner 的 `script`、`checkRef`、`evidenceRef` 已指向真实当前路径 |
| OAM 拼写残留误写 | 策略输入命名与当前架构不一致 | 已改为 `oamRuntimeInvariantResult` |

## 修复清单

- 保持唯一当前 OAM 架构，不恢复旧兼容入口。
- 完成当前 OAM 原生硬收口：`currentForbiddenWriteAdapter`、`nonPersistedWorkItemKey`、`sourceCardId`、`suppressedFields`、`migrationReadonlySources`、`sourceLock`、`operations_work_item_state_event_log` 已同步到合同、代码、DB 和测试。
- 保持一等目录边界：`services/core-api`、`modules/accommodation`、`modules/finance-gate`、`modules/identity`、`modules/maintenance`、`packages/surface-view-models`。
- 删除没有当前职责的空壳目录。
- 修正策略输入命名，避免 OAM 拼写残留。
- 更新最终验收报告和当前系统图，明确完整最终验收与当前合并验收网。

## 检查命令

- `npm --prefix apps/mobile run test`
- `npm --prefix apps/mobile run test:pc`
- `npm --prefix apps/mobile run test:coverage`
- `npm --prefix apps/mobile run test:e2e`
- `dotnet build WorkOSNext.sln -c Release`
- `dotnet test tests/WorkOS.UnitTests/WorkOS.UnitTests.csproj -c Release`
- `dotnet test tests/WorkOS.RuntimeIntegrationTests/WorkOS.RuntimeIntegrationTests.csproj -c Release`
- `dotnet test tests/WorkOS.DatabaseSecurityTests/WorkOS.DatabaseSecurityTests.csproj -c Release`
- `dotnet test tests/WorkOS.PolicyAsCodeTests/WorkOS.PolicyAsCodeTests.csproj -c Release`
- `dotnet test tests/WorkOS.ReleaseEvidenceTests/WorkOS.ReleaseEvidenceTests.csproj -c Release`
- `dotnet run --project tests/WorkOS.RuntimeContractTests/WorkOS.RuntimeContractTests.csproj -c Release`
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/oam/run-control-plane-checks.ps1`
- 大小写旧词扫描：覆盖 README、docs、schemas、scripts、.github、apps、packages、services、tools、infra、tests。

## 测试结果

- 移动端单测：59 个测试文件、313 个用例通过。
- PC 单测：4 个测试文件、4 个用例通过。
- 移动端覆盖率：Statements 78.54%，Branches 63.38%，Functions 85.00%，Lines 82.69%。
- Playwright smoke：5 个真实浏览器用例通过。
- 后端 Release 构建：通过，仅保留既有 analyzer warning。
- 后端测试：Unit 224 个、Runtime Integration 55 个、Database Security 9 个、Policy as Code 4 个、Release Evidence 5 个全部通过。
- Runtime Contract：通过。
- 后端覆盖率：Unit line 33.28% / branch 45.52%；Runtime Integration line 20.09% / branch 33.03%；Database Security line 0.63% / branch 0.50%；Policy line 0.95% / branch 0.78%；Release Evidence line 0.00% / branch 0.00%。
- 旧语义扫描：大小写扫描无命中。

## 剩余风险

当前没有合并阻断项。后端构建仍有既有 nullable/analyzer warning，Vite build 仍有既有 chunk size warning，未影响本次 OAM 纯净验收；后续可作为单独质量治理任务处理。

## 结论

当前架构纯净验收通过。PC 测试、合同引用、路径引用、旧入口语义、旧运行体系字段、artifact 证据链、Control Plane 证据链和全量测试均已纳入当前 OAM 验收网。
