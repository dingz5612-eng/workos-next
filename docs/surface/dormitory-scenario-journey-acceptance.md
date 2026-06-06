# OMA Dormitory Journey Dormitory Scenario Journey Acceptance

中文目标：按系统场景走完宿舍 L1 内测的 10 条旅程，形成可复核的体验截图索引和验收结果。

范围：
- `dorm-live-001` 新线索 -> 预订 -> 入住 -> 分床 -> 应收
- `dorm-live-002` 押金评估 -> 收取 -> 财务确认 -> 押金负债更新
- `dorm-live-003` 普通收款 -> 财务确认 -> 分配 -> 欠款更新
- `dorm-live-004` 服务任务阻断床位 -> 完成 -> 验收 -> 释放
- `dorm-live-005` 退住 -> 查房 -> 押金扣除/退款 -> 清洁 -> 可售
- `dorm-live-006` 银行流水导入 -> 匹配 -> 异常 -> 纠错
- `dorm-live-007` 周期复盘 -> 行动计划 -> 周期关闭
- `dorm-live-008` 权限不足 -> 阻断 -> 升级 -> 审计
- `dorm-live-009` 重复提交 -> 幂等返回 -> 无重复副作用
- `dorm-live-010` 证据缺失 -> 阻断确认 -> 补证据 -> 再确认

每条旅程必须包含：
- WorkItem 体验入口。
- Operation Panel 用户状态。
- Evidence / Rejection / Ledger / Trace / Lens 的业务语义声明。
- Operating Control visibility。
- SVG snapshot 和 HTML snapshot。

边界：
- DORM-INT 仍只代表 L1 Internal Pilot Observation。
- 不进入 Day-2。
- 不声明 L2 Production。
- 不放开 Repair / Parts / HR。

## 2026-06-03 Browser-Driven Dormitory Flow Proof

本次补充验收覆盖 10 个宿舍业务办理流程，全部从移动端搜索页的主动命令发起真实 workspace，逐步输入、截图、提交，并以完成记录作为结束证据。

证据根目录：`artifacts/local-demo/ten-dormitory-browser-demo/`

汇总文件：`artifacts/local-demo/ten-dormitory-browser-demo/ten-flow-evidence-summary.json`

覆盖流程：

| 序号 | 目录 | 业务流程 | 完成证据 |
| --- | --- | --- | --- |
| 1 | `01-resource` | 创建住宿资源 | `06-roomRelease-completed.png` / `.txt` |
| 2 | `02-lead` | 线索预订 | `04-reservationConvert-completed.png` / `.txt` |
| 3 | `03-checkin` | 入住收款 | `10-operatingDashboard-completed.png` / `.txt` |
| 4 | `04-lifecycle` | 在住生命周期 | `05-stayExtension-completed.png` / `.txt` |
| 5 | `05-deposit` | 押金账本 | `07-depositClose-completed.png` / `.txt` |
| 6 | `06-payment` | 普通收款账本 | `05-debtFollowUp-completed.png` / `.txt` |
| 7 | `07-service` | 清洁维修任务 | `05-roomReleaseAfterService-completed.png` / `.txt` |
| 8 | `08-checkout` | 退房 | `05-checkoutClose-completed.png` / `.txt` |
| 9 | `09-settlement` | 退住结算 | `06-postCheckoutCleaning-completed.png` / `.txt` |
| 10 | `10-period` | 周期经营复盘 | `07-periodClose-completed.png` / `.txt` |

配套浏览器脚本：`artifacts/local-demo/ten-dormitory-browser-demo/run-ten-dormitory-browser-demo.mjs`

脚本约束：
- 入口必须来自搜索主动命令，不能直接后台造数。
- 每张卡必须保存 `open` / `input` / `submitted` 截图和文本快照。
- 完成流程必须保存 `completed` 截图和文本快照。
- 涉及财务确认的卡按确认策略切换 `finance`，其他宿舍经办卡使用 `operator`。
- `WORKOS_DEMO_ONLY_FLOW` 仅用于补跑单个流程，不改变验收范围。

语言证据：
- `artifacts/local-demo/language-smoke/language-smoke.json`
- `ru-RU` 与 `ky-KG` 的搜索页和周期完成记录抽检均无中文业务文案残留。

本次修复保持边界不变：
- Dormitory 仍为 L1 Internal Pilot Observation。
- Dormitory L2 Production 仍不放开。
- Business Production 仍 blocked。
- Repair / Parts / HR 未扩展出 L0 Contract Preview。
- 不进入 Day-2。

