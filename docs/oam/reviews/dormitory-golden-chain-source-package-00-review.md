# 宿舍第一金链 Source 场景包 00 复审报告

日期：2026-06-13

本报告只用于 00 对 Source 场景包是否定稿、是否允许进入编译准备做裁决。当前不新增宿舍业务功能，不扩展第一金链，不执行正式 generated contracts 编译，不改写业务放行状态。

## 现场

- 当前分支：`codex/oam-s2h-s2k-authority-closure`
- 本地 HEAD：`4e156607fb82817fd26562c9113f7e43a87c1032`
- 远端基线 `origin/main`：`903f4c1d841e46aacae05263eee62b43f5c2dff7`
- ahead / behind：ahead 7 / behind 0
- 工作区状态：存在未提交整改差异；本轮未提交、未推送、未合并。

## 文件生命周期

Source authority 本轮可改：

- `docs/business/domains/dormitory/scenarios/dormitory-resource-saleability.golden-chain.yml`
- `docs/business/domains/dormitory/scenarios/dormitory-scenario-package-matrix.yml`
- `docs/business/domains/dormitory/dormitory-operating-kernel.json`
- `docs/contracts/language/surface-copy-catalog.json`

Generator / checker 本轮可改：

- `scripts/oam/check-dormitory-golden-chain-source-package.mjs`
- `scripts/business/check-dormitory-resource-saleability-golden-chain.mjs`
- `scripts/business/generate-dormitory-derived-contracts.mjs`
- `scripts/check-admission-kernel.mjs`
- `scripts/oam/check-operation-identity-boundary.mjs`
- `scripts/oam/generate-current-evidence-root.mjs`
- `scripts/oam/run-control-plane-checks.ps1`
- `scripts/validate-runtime-api.mjs`

Generated / derived 本轮未手改：

- `docs/business/dormitory/canonical-scenario-map.json`
- `docs/business/dormitory/scenario-field-contract.yml`
- `docs/contracts/generated/**`
- `apps/mobile/src/generated/**`
- `artifacts/oam/evidence/**`
- `artifacts/oam/final-report.json`

## P0 修复

- 第一金链 Source 明确只包含 `Dorm.RoomSetupConfirm`、`Dorm.BedSetupConfirm`、`Dorm.ResourceReadinessConfirm`。
- `policyRef` 已从业务身份 allowed 拆分为 `admissionPolicyRef`、`evidencePolicyRef`、`ledgerPolicyRef`、`surfacePolicyRef`；旧泛称只保留为只读 deprecated alias。
- `migrationFences` 已补 `affectsBusinessIdentity=false`。
- Finance / Ledger 红线已固定：`ledger.none.v1`、禁止 LedgerEntry / LedgerTransaction / AmountBasis / MoneyBasis / FinancialFact / FinanceReceipt 等进入第一金链。
- 三个 WorkItem 均声明不产生 MoneyBasis、AmountBasis、LedgerTransaction、LedgerEntry。
- `room.basicProfile` 限定为房间建档基础信息；readiness / saleability 字段只作为禁止子字段出现。
- `roomId` / `bedId` 固定为 `selectedStableRef`，禁止 raw ID 手填、route param、cardId、sourceCardId、workspaceCardId、search label。
- ResourceReadinessConfirm 不再直接 handoff 到 CheckinConfirm。
- 用户可见 copyKey 已绑定三语言；Source 不再依赖中文显示名作为 Surface 文案权威。
- Search / Dashboard / Metric / read-side envelope 已补 permission / lineage / freshness 降级规则。
- 本地旧身份删除链已登记第一金链相关项，均只读、不可执行、不影响 admission / runtime confirm / business identity / ledger。
- 公开 CreateWorkItemRequest / ConfirmWorkItemRequest 不再接受客户端提交 admission、admissionDecisionRef、confirmAllowed、productionAllowed、trustedDevice、deviceTrustStatus、surface。
- Confirm 可信设备状态改为服务端根据 actor + device session 计算。

## Checker 与 Evidence 准备

新增统一入口：

- `node scripts/oam/check-dormitory-golden-chain-source-package.mjs`

统一 checker 输出：

- `gateId=OAM-DORMITORY-GOLDEN-CHAIN-SOURCE-PACKAGE`
- `status=PASS`
- `p0Failures=[]`
- `mutation10AStatus=PASS`
- `evidenceNodeReady=true`
- `finalGoNoGo=NO_GO`

Control Plane 已纳管：

- `scripts/oam/run-control-plane-checks.ps1` 已加入统一 Source Package gate。

Evidence generator 已准备：

- `scripts/oam/generate-current-evidence-root.mjs` 已加入 checker result required file。
- Evidence Graph 可由 generator 生成 `OAM-DORMITORY-GOLDEN-CHAIN-SOURCE-PACKAGE` 节点。
- Final Report 可展示 `sourcePackageStatus` 和 `sourcePackageReview` 区块。
- 本轮未手写 Evidence Graph / Release Evidence / Final Report artifact。

## Gate 结果

已通过：

- `node scripts/oam/check-dormitory-golden-chain-source-package.mjs`
- `node scripts/business/check-dormitory-resource-saleability-golden-chain.mjs`
- `node scripts/business/check-dormitory-scenario-package-matrix.mjs`
- `node scripts/check-admission-kernel.mjs --self-test`
- `node scripts/check-admission-kernel.mjs`
- `node scripts/oam/check-operation-identity-boundary.mjs`
- `node scripts/business/check-dormitory-operating-kernel.mjs`
- `node scripts/oam/check-db-no-side-effects-proof.mjs`
- `node scripts/validate-runtime-api.mjs`
- `node scripts/oam/check-current-oam.mjs`
- `node scripts/check-language-kernel.mjs`
- `node scripts/oam/check-surface-language-v2.mjs`
- `node scripts/check-search-kernel.mjs --self-test`
- `node scripts/check-search-kernel.mjs`
- `node scripts/check-surface-contract.mjs`
- `node scripts/check-experience-contract.mjs`
- `node scripts/surface/check-surface-experience-contract.mjs`
- `node scripts/oam/check-read-intelligence-kernel.mjs`
- `node scripts/oam/check-dashboard-readonly.mjs`
- `node scripts/oam/check-bi-kpi-metric-operating-model.mjs`
- `node scripts/check-finance-truth.mjs --self-test`
- `node scripts/check-finance-truth.mjs`
- `node scripts/check-ledger-semantic-rules.mjs`
- `node scripts/finance/check-finance-semantic-truth.mjs`
- `node scripts/check-runtime-write-paths.mjs --self-test`
- `node scripts/check-runtime-write-paths.mjs`
- `node scripts/check-api-boundaries.mjs --self-test`
- `node scripts/check-api-boundaries.mjs`
- `node scripts/trust/check-trust-boundary-kernel.mjs`
- `dotnet test tests/WorkOS.UnitTests/WorkOS.UnitTests.csproj --filter FullyQualifiedName~CanonicalOperationsApiServiceTests --no-restore`
- `dotnet test tests/WorkOS.UnitTests/WorkOS.UnitTests.csproj --filter FullyQualifiedName~OperationsRuntimeServiceTests --no-restore`

按本轮边界保持 pending：

- `node scripts/oam/check-generated-files-not-manually-edited.mjs` 失败，原因是正式 generated 输出未重编；本轮禁止正式 generated contracts 编译，因此不通过重编来修绿，登记为 `PENDING_GENERATED_CONTRACT`。

## Residual Risks

P1：

- `docs/business/dormitory/canonical-scenario-map.json` 当前 derived 文件仍有后续场景指向第一金链 Source 的旧输出。Generator 已准备修复方向，但本轮不正式重生 generated / derived 编译输出。
- `docs/business/dormitory/scenario-field-contract.yml` 当前 derived 文件仍指向 `docs/scenarios/dormitory/golden-pilot.yml`。Generator 已准备改为 pending Source review / 00 decision。

P2：

- 全仓旧身份清理不在本轮范围；本轮只登记第一金链局部删除链。

## 角色复审摘要

- 01 产品业务：第一金链范围固定为房间、床位、资源准备；线索、预订、入住、收款、押金、退住、纠错均未打开。
- 02 架构运行时：Admission / Trust 由服务端计算；公开请求不能提交准入或 trust 状态。
- 03 体验语言：Source 文案改为 copyKey + 三语言目录解析；用户可见语义不把 visible / summary / receipt 解释为 confirm 或 production。
- 04 搜索数据：Search / Dashboard / Metric 均只读，缺 permission / lineage / freshness / admission envelope 时降级或阻断。
- 05 安全发布：Control Plane 和 Evidence generator 已纳管 gate；当前不生成正式发布证据。
- 06 质量证据：统一 checker、10A mutation、source-level no-side-effects 已通过。
- Finance / Ledger：第一金链全程 `ledger.none.v1`，业务域不能写 FinancialFact / LedgerTransaction / LedgerEntry。

## 结论

sourceScenarioPackageReviewStatus=READY_FOR_00_FINAL_REVIEW

compilePreparationDecision=PENDING_00_DECISION

compilePreparationAllowed=false_until_00_approval

businessFeatureDevelopmentAllowed=false

businessProductionGoNoGo=NO_GO

dormitoryL2GoNoGo=NO_GO

productionConfirmAllowed=false

finalGoNoGo=NO_GO
