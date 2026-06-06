# Dormitory Golden Pilot Go/No-Go

> 职责边界：本文是宿舍 Golden Pilot 的人工说明，不是当前 OAM 下一阶段准入权威，也不代表 Business Production、Dormitory L2 或 `production_confirm` 放行。当前准入以 `docs/system/oam-next-stage-admission.md`、`docs/system/oam-p0-rule-ledger.json` 和证据根为准。

## 中文结论

B2 只验证宿舍 Golden Pilot runtime scenarios 可以被 Operations Runtime、Balanced Money Kernel、Semantic Shadow、GateRunner 和 Cutover State 控制，不声明宿舍 production-ready。

## GO 条件

- 10 个 `dorm-cert-*` 场景可重放。
- committed 场景必须有 `CommandSubmission`、`DomainEvent` 和 `FactTrace`。
- money 场景必须有 balanced `LedgerTransaction`。
- evidence 场景必须按 Evidence Policy 阻断缺失或 rejected evidence。
- duplicate submit 返回 stable response。
- idempotency conflict 返回 `409` 且无业务副作用。
- permission denied 返回 `403` 且无业务副作用。
- Red `ShadowCompareReport`、P0 invariant、missing rollback 均阻断 GateRunner。
- `SliceCutoverState` / `FeatureFlag` 控制 pilot 写入路径。

## NO-GO 条件

- 新增 Dormitory page-specific write API。
- 绕过 `CommandSubmission` 写 `DomainEvent`。
- money command 没有 balanced `LedgerTransaction`。
- deposit 被当成 revenue。
- `WorkItemBundle` 成为事实源。
- Repair / Parts 或其它业务线 production activation。
