# OAM-04C Dormitory Scenario Journey Acceptance

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

