# 系统手册

## 当前系统阶段

WorkOSNext 当前处于 OAM-04B / OAM-04C accepted 后的 L1 内测观察前控制平面。当前状态只能表达为：

- Dormitory remains L1 Internal Pilot Observation only。
- Dormitory L2 Production = false。
- Business Production = blocked。
- Repair / Parts / HR = L0 Contract Preview。
- Day-2 not started。

## OAM 总架构

OAM 以 release-state authority、runtime evidence、surface baseline、project hygiene 和 guard architecture 共同约束当前系统状态。README 只做入口说明；最终状态以 `artifacts/release-state/current-state.json`、baseline artifact 和 checker 输出为准。

## Release State Authority

当前 authority 文件包括：

- `artifacts/release-state/current-state.json`
- `artifacts/release-state/post-merge-attestation.json`
- `artifacts/release-state/artifact-git-binding-result.json`
- `artifacts/baseline/oam-clean-baseline-result.json`

任何手册、SOP 或 PR body 不得覆盖这些 artifact 的状态判断。

## Runtime 到 Surface

展示链路必须是：

```text
Runtime data -> ViewModel adapter -> User-facing surface
```

UI、ViewModel、Mobile BFF 不得写业务事实。Search、Learning、Home Lens 和 OperationPanel 只能派生展示。

## Operations Confirm 主写路径

唯一主业务写入路径是：

```text
POST /api/operations/work-items/{workItemId}/confirm
```

Workspace/Card compatibility path 只能作为 compatibility-only，不得恢复成 ordinary confirm path。

## Mobile / PC 平面

Mobile Work Plane 面向一线办理，包含 Today / Work / Search / Me / Workspace / OperationPanel。PC Governance Plane 面向 Finance / Manager / Governance / Release 控制面。移动设备直达 PC-only surface 必须显示中文权限或设备诊断。

## Evidence / Ledger / Projection / Lens / Trace

Evidence 区分证据需求、证据草稿、待上传真实附件、待可信校验、已通过、被拒绝和作用域不匹配。LedgerTransaction 是 money fact 的前置要求；deposit 是 liability，不是 revenue。Projection pending 不能显示为 failed。Trace 必须能追到 WorkItem、CommandSubmission、DomainEvent、Evidence 和 Ledger 相关引用。

## Auth / Actor / Device Trust / Policy

Development 可使用本地账号。Production 必须使用 versioned slow password hash、明确 CORS、AllowedHosts 和真实数据库连接。高风险 PC surface 需要可信 PC session；SurfaceGuard 只是前端体验边界，不是后端授权替代。

## 禁止项

- 不进入 Day-2。
- 不声明 Dormitory L2 Production。
- 不声明 Business Production。
- 不放开 Repair / Parts / HR production。
- 不新增业务线。
- 不新增 page-specific business write API。
- 不绕过 Operations Runtime、CommandSubmission、LedgerTransaction、Evidence 和 append-only correction。
