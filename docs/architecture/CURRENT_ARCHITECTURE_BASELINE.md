# 当前架构基线

本文件是当前架构基线说明，但不是最高规则权威。最高规则权威仍然是：

1. `docs/engineering/*`
2. `docs/acceptance/*`
3. `docs/rules/v5.5/*`
4. machine-readable contracts / registries / guard scripts

`docs/architecture/*` 只提供兼容和历史架构参考，不得覆盖 V5.5 Rule Authority、current-state、Operations Runtime ownership、API boundary、fact ownership、MR contract、GateResult 或 release gate。

## 顶层架构

当前目标顶层架构是 OAM-ACF v8。OAM-ACF v8 用于描述 WorkOSNext 的业务运行、治理、证据和界面之间的长期结构。

当前主执行链是 Operations Runtime。Operations Runtime 是主执行链，不是 ProjectionRuntime、Workspace/Card、Mobile surface 或 PC Governance：

```text
Definition -> OperationCase -> WorkItem -> CommandSubmission
-> SliceCommandHandler -> DomainEvent / LedgerEntry
-> ProcessManager -> Projection / Lens -> Mobile / PC Surface
```

当前主写路径是：

```text
POST /api/operations/work-items/{workItemId}/confirm
```

任何新业务写入都必须进入 Operations Runtime。任何新业务语义都必须进入 Definition Registry。任何 visible / prepare / confirm / production 判断都必须由 Admission Kernel 裁决。

Admission Kernel 是 confirmAllowed 和业务写入前置裁决核心。Definition Registry 是 WorkItem、字段、证据、风险、ledger policy、projection owner 和 surface 语义来源。Experience Kernel 负责把 runtime 状态、安全提示、阻断和下一步表达为用户可理解的界面体验，但不得决定业务事实或 confirmAllowed。

## 兼容层边界

ProjectionRuntime 是当前 compatibility facade，用于 projection 和 Lens materialization 的当前实现承接。它不是顶层架构，也不得成为新的业务写入中心。

Workspace/Card 是 compatibility wrapper，用于承接旧 prepare / confirm 入口和旧 surface 结构。它不是新业务扩展点，不得新增业务动作或绕过 Operations Runtime。

允许的 Workspace/Card compatibility write 仅限当前 API boundary 中已分类的：

```text
POST /api/workspaces/{workspaceId}/cards/{cardId}/prepare
POST /api/workspaces/{workspaceId}/cards/{cardId}/confirm
```

其中 confirm 必须通过 compatibility adapter 进入 Operations Runtime 约束链路。

## 治理与规则职责

Control Plane 负责治理、发布证据、Gate、Rollback、Shadow Compare 和审计证据链。PC Governance 是治理控制面，不得直接写业务事实。

Rules OS 负责规则权威、API boundary、fact ownership、MR contract、invariant maturity、GateResult hardening 和 rule drift。

Business Line Registry 决定业务线 L0 / L1 / L2 / Production 成熟度。Surface Policy 只决定展示和体验，不得单独授权 production action。

current-state 是状态裁决权威。当前 release-state 明确：

- Dormitory: `L1_INTERNAL_PILOT_OBSERVATION`
- Dormitory L2: `BLOCKED`
- Business Production: `BLOCKED`
- Repair: `L0 Contract Preview`
- Parts: `L0 Contract Preview`
- HR: `L0 Contract Preview`
- business-3..7: `L0 Contract Preview`

Business Production 当前 blocked。Dormitory L2 当前 blocked。Repair / Parts / HR 当前只能作为 L0 Contract Preview。

## 新改动准入

任何新业务、语言、搜索、surface 或 runtime 改动都必须先更新对应 contract，再更新实现，再更新测试和 evidence。

Admission Kernel、Definition Registry、Language Kernel、Search Kernel、Experience Kernel、Control Plane 和 Evidence Graph 是 OAM-CAB v1 active 组件。Language Kernel 是统一语言、解释和状态表达来源，必须覆盖 blocked、L0 Contract Preview、L1 Internal Pilot Observation、confirmAllowed、visibility、preview、production 等状态解释。Search Kernel 必须经过 Admission / Permission / Language，保持只读，不得退化为简单 contains 搜索。Control Plane / Evidence Graph 是发布、证据、GateResult、Invariant、ShadowCompare、RollbackInstruction 和审计闭环。

未完成合同和 guard 前，不得把局部前端 copy、搜索 fallback 或 Workspace/Card 行为当作新的业务扩展点。

## 禁止解释

不得把 Rules OS GO 解释为 Business Production GO。不得把 L1 Internal Pilot Observation 解释为 L2 或 Production。不得把 surface visible 解释为 confirmAllowed 或 productionAllowed。
