# 宿舍 L1 内测观察窗口控制塔

生成时间：2026-06-01T19:12:34.089Z

## 当前结论

- Observation window status: `active_l1_observation`
- Daily decision: `continue_l1_observation`
- Dormitory status: `L1 Internal Pilot`
- Dormitory L2 Production: `false`
- Business Production GO: `false`
- Repair / Parts / HR: `L0 Contract Preview`

## Day 1 机器判定

| 项目 | 结果 |
| --- | --- |
| P0 stop count | 0 |
| P1 hold count | 0 |
| Finance daily close | green |
| Evidence missing rate | 0.005 |
| Evidence rejected rate | 0.01 |
| Evidence upload failure rate | 0 |
| Wrong-scope evidence count | 0 |
| Projection lag p95 | 2 minutes |
| SLA overdue | 0 |
| Rollback readiness | green |

## P0 Stop / P1 Hold

- P0 stop: 无
- P1 hold: 无

## L1 -> L2 判定

`NOT_ELIGIBLE`

原因：
- L1 observation window 未满 7 天。
- L1 -> L2 必须单独 stage / PR / gate。
- Final System Gate blocked 时不得 production GO。

下一步：继续 7 天 L1 Internal Pilot Observation Window，并每天重跑 D2 observation checker。
