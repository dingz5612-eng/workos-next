# OAM-04B/04C 后合并纯净基线报告

生成目的：对齐 OAM-04B / OAM-04C accepted 后的文档入口、project hygiene、artifact inventory、screenshot baseline、stale refs 与 README 当前状态。

## 当前结论

- OAM-04B / OAM-04C accepted。
- Dormitory remains L1 Internal Pilot Observation only。
- Dormitory L2 Production = false。
- Business Production = blocked。
- Repair / Parts / HR = L0 Contract Preview。
- Day-2 not started。

## Artifact 分类

final evidence：

- `artifacts/release-state/current-state.json`
- `artifacts/release-state/post-merge-attestation.json`
- `artifacts/release-state/artifact-git-binding-result.json`
- `artifacts/baseline/release-evidence-baseline.json`
- `artifacts/baseline/oam-clean-baseline-result.json`
- `artifacts/baseline/surface-ux-baseline.json`
- `artifacts/surface/oam-04b-surface-productization-final-result.json`
- `artifacts/surface/dormitory-scenario-journey-result.json`
- `artifacts/go-live/dormitory/internal-pilot-go-no-go.json`

historical artifact：

- OAM / RT4 / DORM-INT 早期通过但未被 current-state 作为当前 final evidence 直接引用的旧结果。
- Day-0、Day-1、L1-to-L2 readiness、portfolio maturity 等旧阶段材料，只能解释历史链路，不改变当前状态。
- `artifacts/project/stale-artifacts.json` 中 `retainedAs=historical_artifact` 的条目。

diagnostic-only：

- 旧 PNG screenshot 目录，例如 `artifacts/screenshots/dormitory-business-scenarios`。
- 本地测试输出、临时 replay 输出和 `.tmp` 目录。
- V5.4 / guard 运行中生成的中间报告，除非被 checker 持久化到 `artifacts/` 或 `docs/` 并进入 final evidence refs。

superseded：

- PR #73 未合并的旧 post-clean baseline attestation。
- 被 PR #74 OAM-04B / OAM-04C accepted 取代的旧 surface draft 口径。
- 被 PR #76 runtime proof harness 修复与当前 post-merge attestation 取代的旧 main 绑定结果。

removable candidate：

- 未被 `current-state`、baseline、manual 或 checker 引用的本地诊断输出。
- 删除前必须先运行 `node scripts/project/check-artifact-hygiene.mjs` 与 `node scripts/project/check-stale-evidence-refs.mjs`，并确认不影响 final evidence。

## Screenshot 基线

- OAM-04C `artifacts/screenshots/dormitory-journeys/*.html` 与 `*.svg` snapshots 是 accepted journey evidence。
- 旧 PNG screenshot 目录只作为 diagnostic-only，不作为 final evidence 缺口。
- `artifacts/screenshots/oam-ux-baseline/index.json` 是当前 screenshot baseline index。

## 文档入口

- README 只表达当前 accepted / blocked / L1 / L0 / Day-2 not started 状态。
- 早期 Phase 0-1 prototype / placeholder 说明移入 `docs/history/phase-0-1-archive.md`。
- 若历史 UX / architecture 文档与当前 release-state 冲突，以 `artifacts/release-state/current-state.json` 与本报告为准。

## 当前禁止项

- 不进入 Day-2。
- 不声明 Dormitory L2 Production。
- 不声明 Business Production。
- 不放开 Repair / Parts / HR production。
- 不新增业务线。
- 不恢复 Workspace/Card compatibility path 为 ordinary confirm path。
- 不把旧 PNG screenshot 当作 final evidence。
