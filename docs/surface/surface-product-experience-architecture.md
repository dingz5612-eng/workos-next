# OAM Surface 端面体验产品化架构

本阶段只重建用户体验层，不重写 Runtime，不进入 Day-2，不授予 Dormitory L2 Production，也不授予 Business Production。

## 主路径

```text
Runtime data -> ViewModel adapter -> User-facing surface
```

- `Runtime data` 仍来自 Operations Runtime、Projection、Lens、Trace 和 Surface Store。
- `ViewModel adapter` 只派生展示字段、中文文案、行动建议和技术诊断引用。
- `User-facing surface` 只消费 ViewModel，不把 ViewModel 当业务事实源。

## 中心模型边界

- 中心模型仍是 `IntentWorkspaceProjection` + `WorkspaceCardProjection`。
- `WorkItemBundle`、`ExperienceEnvelope`、`ViewModel` 只能作为派生体验层。
- 主提交入口仍是 Operations Confirm。
- Surface 不拥有业务事实，不写 DomainEvent，不写 LedgerTransaction。
- `sourceRefs` 必须回指 `workspaceId`、`cardId`、`workItemId`、`aggregateRef`。

## 双平面

- Mobile = Work Execution Plane，只展示一线办理、证据、自救、队列、设备可信和学习。
- PC = Governance Control Plane，只展示 Finance Workspace、Manager Control Tower、Governance Center、Release Workspace、Audit Explorer。
- PC 治理动作不得绕过 Operations Runtime。

## Raw 信息规则

普通用户页面不得直接渲染 raw `WorkItem`、raw `Evidence`、raw `CommandSubmission`、raw `Ledger`。

Raw id 只能进入：

- 技术诊断。
- 轨迹详情。
- 审计抽屉。

## 禁止输出

- 不输出 `FULLY_PASSED`。
- 不输出 `PRODUCTION_READY`。
- 不输出 `BUSINESS_PRODUCTION_GO`。
- 不输出 `DORMITORY_L2_PRODUCTION_ALLOWED`。
- 不输出 `REPAIR_PARTS_HR_PRODUCTION_ALLOWED`。
