# OAM-04B WorkItem Route Identity Report

## 中文结论

阶段 2 已关闭 WorkItem 身份与办理路由 P0。所有进入办理面入口必须解析到 `runtimeStore.operationWorkItems` 或 `runtimeStore.workQueue` 中真实存在的 WorkItem；`workspaceId + cardId` 只作为兼容解析输入，不直接拼成办理身份。

## 代码范围

- `apps/mobile/src/operationRouteResolver.js`
- `apps/mobile/src/navigationController.js`
- `apps/mobile/src/views/operationPanelView.js`
- `apps/mobile/src/views/experienceComponents.js`
- `apps/mobile/src/views/searchView.js`
- `apps/mobile/src/i18n/operationCopy.js`
- `apps/mobile/src/__tests__/OperationRouteIdentityContract.test.js`

## 行为结果

- Workbench 的 WorkItem 点击进入真实 persisted WorkItem Operation Panel。
- Search 的 WorkItem 结果渲染可行动按钮，并携带 persisted WorkItem id。
- Workspace/card 兼容输入通过 resolver 映射到真实 WorkItem。
- 缺少 persisted WorkItem 时不显示“进入办理面”，而显示“暂不能直接办理”和“请从工作队列打开真实任务”。
- `T-ROOM-CREATE` 不再作为办理身份；`W-STAY-RESOURCE` + `roomSetup` 只能解析到真实 WorkItem 后进入普通办理。
- fake Operation Panel id 显示中文 not-found 引导，不在可见文本暴露 raw id。

## 验证结果

- `npm --prefix apps/mobile run test`: passed
- `npm --prefix apps/mobile run build`: passed
- `node scripts/surface/check-view-model-contract.mjs`: passed
- `node scripts/surface/check-user-facing-surface-copy.mjs`: passed
- `node scripts/surface/check-no-raw-surface-labels.mjs`: passed
- `node scripts/surface/check-surface-runtime-guard-contract.mjs`: passed
- `pwsh -NoProfile -File scripts/guard-architecture.ps1`: passed

## 状态边界

- Dormitory remains L1 Internal Pilot Observation only.
- Dormitory L2 Production = false.
- Business Production = blocked.
- Repair / Parts / HR = L0 Contract Preview.
- Day-2 still requires separate Day-2 Entry Gate.

## 下一步

允许进入阶段 3：单主操作入口与提交状态机闭环。
