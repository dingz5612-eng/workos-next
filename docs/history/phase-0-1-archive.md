# Phase 0-1 历史归档

本文件只保留 WorkOSNext 早期 Phase 0-1 prototype / placeholder 口径，供追溯设计来源使用。它不是当前 release-state authority，也不是当前验收入口。

## 历史范围

- 早期目标是 mobile-first PWA prototype，用于在 Flutter SDK 不可用时快速评估 UX。
- 早期文档曾将 WorkOSNext 描述为 multi-domain platform shell，并以 accommodation / maintenance 作为 reference domains。
- 早期 `apps/mobile` 是可运行 UI shell，承担原型验证与 DTO / projection / task API 讨论输入。
- 早期 placeholder 包含 voice、scan、quick create、metric、Docker Compose PostgreSQL 等待补齐项。

## 当前取代关系

- 当前 main 已完成 OAM-04B / OAM-04C accepted。
- 当前主写路径是 `POST /api/operations/work-items/{workItemId}/confirm`。
- Workspace/Card path 只保留 compatibility-only，不是 ordinary confirm 主路径。
- 当前移动端是 Work Execution Plane，PC 端是 Governance Control Plane。
- 当前 artifact / report / baseline 必须服从 release-state authority 与 project hygiene checker。

## 当前业务边界

- Dormitory remains L1 Internal Pilot Observation only。
- Dormitory L2 Production = false。
- Business Production = blocked。
- Repair / Parts / HR = L0 Contract Preview。
- Day-2 not started。

## 使用规则

历史归档可以用于解释为什么存在早期 UX / architecture / ADR 文档，但不得作为当前验收状态、production 边界、Day-2 入口或业务线扩展依据。若历史文档与 README、`artifacts/release-state/current-state.json`、`docs/project/project-cleanup-report.md` 或 `docs/manuals/project/post-oam-04b-04c-pure-baseline-report.md` 冲突，以当前 release-state authority 为准。
