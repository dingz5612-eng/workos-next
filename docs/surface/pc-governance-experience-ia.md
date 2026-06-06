# OMA Surface PC Governance Experience IA

中文目标：把 PC 端从移动壳里的调试页面，整理为治理控制平面。

范围：
- Finance Workspace：银行流水导入、匹配候选、异常队列、修正 WorkItem、追加补偿和审计。
- Manager Control Tower：风险、SLA、阻断、WorkItem 跟进、财务异常。
- Governance Center：证据、账务摘要、案例、审计、受控导出、治理配置。
- Release Workspace：发布准入、GateResult、Shadow、Invariant、Rollback、BusinessSignoff。
- Audit Explorer：只读检索 DomainEvent、CommandSubmission、发布审计和修正审计。

体验规则：
- PC 页面必须使用 desktop shell，不显示 mobile bottom nav。
- PC 端可以展示审计字段和技术引用，但业务写入仍必须经过 Operations Runtime。
- PC Finance / Governance / Release 不得绕过 CommandSubmission 写业务事实。
- Mobile ordinary view 不得出现 PC Governance / Release / Finance admin surface。
- Dormitory 仍保持 L1 Internal Pilot Observation；不声明 L2 Production。

