# OAM-04B Device / Surface Context Report

## 中文结论

阶段 1 已统一设备上下文、角色默认落点与 SurfaceGuard。移动端登录、已保存 session 恢复、onboarding 和 URL 直达 PC-only view 均经过同一套 resolver；只有 active device 明确为 trusted PC / release surface 时才允许进入 PC-only surface。

## 代码范围

- `apps/mobile/src/surfaceResolver.js`
- `apps/mobile/src/appState.js`
- `apps/mobile/src/authController.js`
- `apps/mobile/src/navigationController.js`
- `apps/mobile/src/surfaceGuard.js`
- `scripts/check-experience-contract.mjs`
- `apps/mobile/src/__tests__/MobileDefaultHomeByDevice.test.js`
- `apps/mobile/src/__tests__/SurfaceShellBoundaryContract.test.js`
- `apps/mobile/src/__tests__/authRoleHome.test.js`

## 行为结果

- finance / manager / admin / releaseOwner 在 mobile device 登录后落到 `home`。
- 已保存 finance / manager / admin / releaseOwner session 在 mobile device 恢复后不会打开 PC-only surface。
- onboarding 在 mobile device 完成后不会打开 PC-only surface。
- mobile URL 直达 `financeControl`、`governanceCenter`、`managerControlTower`、`releaseFlightDeck` 时显示中文权限/设备诊断。
- trusted PC device 可进入 `financeControl`、`managerControlTower`、`governanceCenter`、`releaseFlightDeck`。
- `surfaceGuard` 不再优先读取 `pcGovernance.currentDevice` 放行 mobile 当前运行态。
- unknown / untrusted device 访问高风险 PC surface 会被阻断。

## 验证结果

- `npm --prefix apps/mobile run test`: passed
- `npm --prefix apps/mobile run build`: passed
- `node scripts/surface/check-mobile-pc-surface-boundary.mjs`: passed
- `node scripts/surface/check-pc-desktop-shell.mjs`: passed
- `node scripts/check-experience-contract.mjs`: passed
- `pwsh -NoProfile -File scripts/guard-architecture.ps1`: passed

## 状态边界

- Dormitory remains L1 Internal Pilot Observation only.
- Dormitory L2 Production = false.
- Business Production = blocked.
- Repair / Parts / HR = L0 Contract Preview.
- Day-2 still requires separate Day-2 Entry Gate.

## 下一步

允许进入阶段 2：WorkItem 身份、路由 resolver 与 persisted WorkItem 闭环。
