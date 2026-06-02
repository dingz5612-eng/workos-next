# OAM-04B Interaction Baseline Report

## 中文结论

阶段 0 已确认当前分支从最新 `origin/main` 开始，OAM-04B / OAM-04C 既有验收证据仍可用，release-state 与 baseline artifact 已重新绑定到当前 main head。

本阶段只做基线确认和签注重绑，不进入 Day-2，不声明 Dormitory L2，不声明 Business Production，不扩展 Repair / Parts / HR。

## 基线

- branch: `codex/oam-04b-surface-interaction-closure`
- repositoryHead: `fe50578178886b958b9f394d2b51b2749aed54cd`
- origin/main HEAD: `fe50578178886b958b9f394d2b51b2749aed54cd`
- verifiedMainHead: `fe50578178886b958b9f394d2b51b2749aed54cd`
- main CI run id: `26816339393`
- main V5.4 Guards run id: `26816339396`
- PR #74: merged
- PR #73: closed and superseded by later main attestation

## 验证结果

- `node scripts/release-state/check-post-merge-attestation.mjs`: passed
- `node scripts/release-state/check-artifact-git-binding.mjs`: passed
- `node scripts/baseline/check-release-evidence-baseline.mjs`: passed
- `node scripts/baseline/check-oam-clean-baseline.mjs`: passed
- `node scripts/baseline/check-surface-ux-baseline.mjs`: passed
- `node scripts/surface/check-oam-04b-surface-productization-final.mjs`: passed
- `node scripts/surface/check-dormitory-scenario-journey.mjs`: passed
- `node scripts/operations/check-observation-sequence-gate.mjs --day=2`: passed
- `node scripts/evidence/check-evidence-ledger-append-only.mjs`: passed
- `npm --prefix apps/mobile run test`: passed
- `npm --prefix apps/mobile run build`: passed
- `pwsh -NoProfile -File scripts/v5_4/run-control-plane-checks.ps1`: passed
- `pwsh -NoProfile -File scripts/guard-architecture.ps1`: passed

## 修复过的阶段 0 问题

- release-state artifact 初始绑定旧 head，已通过 `rebind-dorm-int-latest-main`、`build-current-release-state`、`build-post-merge-attestation` 重新绑定到当前 main。
- 本地 API 进程曾锁定 Release build 输出，已停止该进程并重建干净测试库后重跑。
- 本地 V5.4 / architecture guard 复用测试库导致重复写入风险，已使用干净 `workosnext_test` 数据库重跑并通过。

## 状态边界

- Dormitory remains L1 Internal Pilot Observation only.
- Dormitory L2 Production = false.
- Business Production = blocked.
- Repair / Parts / HR = L0 Contract Preview.
- Day-2 still requires separate Day-2 Entry Gate.

## 下一步

允许进入阶段 1：设备上下文、角色落点与 SurfaceGuard 统一。
