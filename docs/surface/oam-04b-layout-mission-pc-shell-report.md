# OAM-04B-06 Layout / Mission / PC Shell 报告

生成时间：2026-06-02T21:56:50.2919298+08:00

## 范围

- Dormitory：L1 Internal Pilot Observation
- Dormitory L2 Production：false
- Business Production：blocked
- Repair / Parts / HR：L0 Contract Preview
- Day-2：未进入

## 完成内容

- 移动端 fixed layer 使用统一 CSS token，并为 bottom nav、sticky CTA、safe area 留足底部空间。
- OperationPanel / Workspace 归属 Work 流，底部导航激活“工作”并带 `aria-current`。
- Home Mission Control 从 runtime queue 派生阻断、影响范围、建议动作和计数；无数据时显示中文空态。
- PC shell 使用 1200px 桌面宽度，PC surfaces 不显示移动底部导航。
- PC-only route 在 mobile 设备下显示中文诊断；releaseOwner 在可信 PC 设备可进入发布工作区。

## 验收

- `npm --prefix apps/mobile run test`：通过，51 个测试文件 / 172 条测试
- `npm --prefix apps/mobile run build`：通过
- `node scripts/surface/check-mobile-work-shell.mjs`：通过
- `node scripts/surface/check-pc-desktop-shell.mjs`：通过
- `node scripts/surface/check-mobile-pc-surface-boundary.mjs`：通过
- `node scripts/project/check-screenshot-baseline.mjs`：通过
- `pwsh -NoProfile -File scripts/guard-architecture.ps1`：通过

完成标识：OAM_04B_LAYOUT_MISSION_CONTROL_PC_SHELL_CLOSED
