# OAM-04B Primary Action State Machine Report

## 中文结论

阶段 3 已关闭单主 CTA 与提交状态机断点。Workspace / OperationPanel 不再同时渲染卡片内主提交按钮与 sticky 主提交按钮；主 CTA 从统一状态机派生，提交后会切换到查看轨迹、刷新状态或恢复动作，不再继续显示提交入口。

## 代码范围

- `apps/mobile/src/operationActionState.js`
- `apps/mobile/src/views/workspaceView.js`
- `apps/mobile/src/views/operationPanelView.js`
- `apps/mobile/src/i18n/operationCopy.js`
- `apps/mobile/src/__tests__/OperationActionStateContract.test.js`

## 行为结果

- `ready` -> 提交处理。
- `blocked` -> 查看阻断原因。
- `missingEvidence` -> 补齐证据。
- `waitingPermission` -> 查看权限处理说明。
- `notStarted` -> 请先完成上一张卡，disabled 且有中文原因。
- `submitting` -> 正在提交…，disabled。
- `submitted` -> 查看提交轨迹。
- `projectionPending` -> 刷新状态，不显示为失败。
- `done` -> 已完成，disabled。
- `failed` -> 查看失败原因。

## 验证结果

- `npm --prefix apps/mobile run test`: passed
- `npm --prefix apps/mobile run build`: passed
- `node scripts/surface/check-user-facing-surface-copy.mjs`: passed
- `node scripts/surface/check-mobile-work-shell.mjs`: passed
- `node scripts/surface/check-no-raw-surface-labels.mjs`: passed
- `node scripts/surface/check-oam-04b-surface-productization-final.mjs`: passed
- `pwsh -NoProfile -File scripts/guard-architecture.ps1`: passed

## 状态边界

- Dormitory remains L1 Internal Pilot Observation only.
- Dormitory L2 Production = false.
- Business Production = blocked.
- Repair / Parts / HR = L0 Contract Preview.
- Day-2 still requires separate Day-2 Entry Gate.

## 下一步

允许进入阶段 4：Search Intent Hub 与 Queue Filter 真闭环。
