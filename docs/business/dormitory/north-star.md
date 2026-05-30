# Dormitory Golden Domain North Star

## 中文目标

宿舍业务第一版 Golden Domain 的目标不是扩页面，而是证明 Operations Runtime 可以围绕 WorkItem、证据、财务事实、风险阻断、认证和 Cutover State 完成可审计经营。

## North Star Metric

`trusted_available_bed_nights` measures bed-night availability that is confirmed by resource facts, not by front-end fields.

## Operating Principles

- 所有确认动作必须通过 Operations Runtime。
- `CommandSubmission` 是唯一提交审计入口。
- `DomainEvent` 是业务事实。
- `LedgerTransaction` / `LedgerEntry` 是财务事实。
- `Projection` / `Lens` 只读事实，不拥有事实。
- `WorkItemBundle` 只属于 ExperienceEnvelope，不是事实源。
- 押金是 liability，不是 revenue。
- 宿舍在 B1 阶段不得 production-ready。

## Metric Tree

- resource availability: available beds, readiness pass rate, blocked bed aging.
- lead-to-stay conversion: lead response SLA, reservation confirmation, check-in completion.
- in-stay revenue: charge generation, payment allocation, balance accuracy.
- deposit liability: assessed deposit, received deposit, refundable deposit liability.
- checkout turnover: inspection SLA, settlement accuracy, clean-to-available cycle.

## Go/No-Go Summary

GO requires complete value streams, WorkItem catalog, evidence policy, finance control rules, risk rules, certification scenarios, and reusable Business Domain Kit templates. NO-GO if any high-risk action can confirm without evidence, any money path treats deposit as revenue, or any Dormitory page-specific write API appears.
