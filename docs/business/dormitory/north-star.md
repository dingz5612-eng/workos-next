# 宿舍金标域北极星

## 中文目标

宿舍业务当前目标不是扩页面，而是证明 Operations Runtime 可以围绕 WorkItem、证据、财务事实、风险阻断、认证和切换状态完成可审计经营。

## 北极星指标

`trusted_available_bed_nights` 衡量由资源事实确认的可信可售床夜，不使用前端字段作为事实来源。

## 运行原则

- 所有确认动作必须通过 Operations Runtime。
- `CommandSubmission` 是唯一提交审计入口。
- `DomainEvent` 是业务事实。
- `LedgerTransaction` 与 `LedgerEntry` 是财务事实。
- `Projection` 与 `Lens` 只读事实，不拥有事实。
- `WorkItemBundle` 只属于 ExperienceEnvelope，不是事实源。
- 押金是负债，不是收入。
- 宿舍在当前 OAM 范围内不得打开生产。

## 指标树

- 资源可售可信度：可售床位、房态验收通过率、阻断床位时长。
- 线索入住转化：线索响应 SLA、预订确认、入住完成。
- 在住收入：费用生成、收款分配、余额准确性。
- 押金负债：押金评估、押金收取、可退押金负债。
- 退住周转：验房 SLA、结算准确性、清洁后恢复可售周期。

## 准入摘要

通过条件是价值流、WorkItem 目录、证据策略、财务控制规则、风险规则和认证场景全部完整。任一高风险动作可在无证据时确认、任一金额路径把押金当作收入、或任一宿舍页面私有写 API 出现，都必须阻断。
