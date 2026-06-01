# 发布与内测状态权威

`artifacts/release-state/current-state.json` 是 OAM-01 之后的发布与内测状态唯一裁决源。

它聚合以下输入：

- DORM-INT final go/no-go artifact。
- RT-FINAL completion assurance artifact。
- Evidence Graph。
- Completion Dashboard。
- Business Line Registry。
- Final System Gate 状态。
- BStageGate 状态。
- L1 observation window 状态。

## 当前裁决

- Dormitory 只允许处于 `L1_INTERNAL_PILOT_OBSERVATION`。
- Business Production 保持 `BLOCKED`。
- Dormitory L2 保持 `BLOCKED`。
- Repair / Parts / HR 保持 `L0 Contract Preview`。

## 阻断规则

- DORM-INT GO 不得映射为 L2。
- Final System Gate blocked 时不得给出业务生产放行。
- Repair / Parts / HR 不得因为 Dormitory L1 通过而获得生产权限。
- Evidence Graph、Completion Dashboard、DORM-INT artifact 出现状态冲突时，`check-current-state-authority.mjs` 必须失败。

## 人工处理

如果 `current-state.json` 与任一来源 artifact 冲突，处理人必须先修复来源 artifact 或回到对应 OAM 阶段，不得手写放行状态。
