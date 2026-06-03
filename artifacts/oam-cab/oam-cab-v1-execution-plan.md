# OAM-CAB v1 执行计划

生成时间：2026-06-03

本文件记录 WorkOSNext / FunRide 的 OAM Clean Architecture Baseline 执行边界。所有阶段必须串行进入；允许并行的子任务也必须在汇合 gate 全部通过后才能继续。

## 权威文件

阶段 0 已读取并确认以下权威输入：

- `README.md`
- `docs/engineering/00-rule-authority.md`
- `docs/rules/v5.5/rule-authority.yml`
- `docs/acceptance/13-v5.5-rules-os-go-no-go.md`
- `docs/engineering/16-v5.5-engineering-rules-os.md`
- `artifacts/release-state/current-state.json`
- `docs/business/business-line-registry.json`
- `docs/contracts/slice-manifest.json`
- `docs/contracts/runtime-surface-policy.json`
- `docs/rules/v5.5/api-boundary.yml`
- `docs/rules/v5.5/fact-ownership.yml`
- `docs/rules/v5.5/fact-write-map.yml`

## 本批次冻结规则

- 不新增业务功能。
- 不新增业务页面。
- 不新增业务写 API。
- 不新增 page-specific business write API。
- 不新增业务线生产能力。
- 不新增 production confirm。
- 不新增 Workspace/Card 业务扩展。
- 不把 ProjectionRuntime 扩展为新的业务中心。
- 不把 Mobile BFF 变成业务事实写入点。
- 不让 PC Governance 直接写业务事实。
- 不把 Rules OS GO 解释为 Business Production GO。
- 不把 L1 Internal Pilot Observation 解释为 L2 或 Production。
- 不隐藏、不降级、不改名绕过 P0/P1 风险。

## 架构执行边界

- 顶层架构：OAM-ACF v8。
- 主执行轴：Operations Runtime。
- 主写路径：`POST /api/operations/work-items/{workItemId}/confirm`。
- ProjectionRuntime：compatibility facade，不是顶层架构。
- Workspace/Card：compatibility wrapper，不是新业务扩展点。
- 新业务语义必须进入 Definition Registry。
- Runtime 是否 visible / prepare / confirm / production 必须由 Admission Kernel 裁决。
- Language 和 Search 必须作为一等架构模块治理。

## 阶段推进

1. 阶段 0：冻结与现状确认。
2. 阶段 1：OAM 当前架构基线。
3. 阶段 2：组件分类与兼容层隔离。
4. 阶段 3：Admission Kernel 合同。
5. 阶段 4：Definition / Language / Search 合同并行建设。
6. 阶段 5：Runtime / Surface / Search 实现对齐。
7. 阶段 6：Control Plane / Evidence / Production Readiness 对齐。
8. 阶段 7：纯净基线清理与删除候选处理。
9. 阶段 8：最终全量验收。

阶段 0、1、2、3 必须严格串行。任何阶段 gate 失败，必须修复当前阶段并重新执行该阶段 gate，不得进入下一阶段。

## 阶段 0 完成条件

阶段 0 只在以下命令全部通过后才允许进入阶段 1：

- `node scripts/check-rule-authority.mjs`
- `node scripts/check-v5-5-rules-os.mjs --mode=ci`
- `node scripts/check-api-boundaries.mjs`
- `node scripts/check-fact-ownership.mjs`

## 自稳定修复记录

阶段 0 开始时发现 `artifacts/release-state/current-state.json` 和底层 release evidence 仍绑定旧 main head。已按现有脚本执行 self-stabilizing rebind：

- `node scripts/release-state/rebind-dorm-int-latest-main.mjs`
- `node scripts/release-state/build-current-release-state.mjs`
- `node scripts/release-state/build-post-merge-attestation.mjs`
- `node scripts/operations/check-observation-sequence-gate.mjs --day=2`
- `node scripts/release-state/check-artifact-git-binding.mjs`

该修复只重绑定证据和 guard 产物，不新增业务功能，不放开 production / L2 / Repair / Parts / HR。

## 最终报告与证据闭环

OAM-CAB v1 最终阶段必须生成并验证：

- `artifacts/oam-cab/oam-cab-v1-final-report.json`
- `docs/architecture/OAM_CAB_V1_FINAL_REPORT.md`
- `scripts/check-oam-cab-final-report.mjs`

最终报告必须覆盖 Architecture Authority、Admission Kernel、Operations Runtime、Compatibility Box、Experience Kernel、Language Kernel、Search Kernel、Control Plane、Evidence Graph、Definition Registry。

最终报告不得声明 Business Production GO，不得声明 Dormitory L2 ready，不得声明 production confirm 可用。默认生产结论保持 No-Go，除非 current-state 和 release gates 后续明确改变。
