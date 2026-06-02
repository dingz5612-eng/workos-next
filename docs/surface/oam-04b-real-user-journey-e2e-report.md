# OAM-04B-07 真实用户路径 E2E 报告

生成时间：2026-06-02T22:01:27.1268729+08:00

## 范围

- Dormitory：L1 Internal Pilot Observation
- Dormitory L2 Production：false
- Business Production：blocked
- Repair / Parts / HR：L0 Contract Preview
- Day-2：未进入

## Playwright

- 命令：`npm --prefix apps/mobile run test:e2e`
- 结果：通过，5 条浏览器级 smoke
- JSON report：`artifacts/test-results/mobile/playwright-report.json`
- HTML report：`artifacts/test-results/mobile/playwright-report/index.html`
- 失败 trace：retain-on-failure
- 失败 screenshot：only-on-failure

## 覆盖路径

- mobile operator 登录后进入移动工作面。
- finance mobile session 和刷新保持在 home，不进入 financeControl。
- mobile 直达 financeControl 显示中文权限/设备诊断。
- 工作台点击真实 persisted WorkItem 进入 OperationPanel。
- 没有 persisted WorkItem 时不显示假办理 CTA。
- Search 搜索“创建房间”显示“处理”并进入 OperationPanel。
- Search 搜索“21”不倾倒无关 WorkItem，不出现 `[object Object]`。
- Workspace 普通用户不显示 Debug / compatibility，且只有一个主 CTA。
- OperationPanel 默认不显示 raw 技术 key，技术详情可展开。
- 403 / 409 / 422 恢复说明可见。
- trusted PC manager / releaseOwner 可进入 PC 工作面，且 PC 页面不显示 mobile bottom nav。

## 验收

- `npm --prefix apps/mobile run test`：通过，51 个测试文件 / 172 条测试
- `npm --prefix apps/mobile run build`：通过
- `npm --prefix apps/mobile run test:e2e`：通过，5 条 Playwright 测试
- `node scripts/project/check-screenshot-baseline.mjs`：通过
- `node scripts/surface/check-oam-04b-surface-productization-final.mjs`：通过
- `pwsh -NoProfile -File scripts/guard-architecture.ps1`：通过

完成标识：OAM_04B_REAL_USER_JOURNEY_E2E_PASSED
