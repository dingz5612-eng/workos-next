# 宿舍 L1 内测观察 Day-1 报告

## 结论

- 当前阶段：DORM-L1-OBS-DAY1
- 当前分支：codex/dorm-l1-observation-day-01
- 当前 head sha：afb34d69cc572fbecb3129f09da9ffd66e2d088a
- 判定：continue_l1_observation
- continuePilot：true
- holdPilot：false
- pausePilot：false
- rollbackRequired：false
- unresolvedP0：false
- unresolvedP1：false
- l2UpgradeEligible：false

Day-1 读取真实 live API / DB replay、财务日清、证据、账本、投影 / Lens、设备可信、支持 / 事件和训练签收证据。当前无 P0 stop、无 P1 hold，允许继续 Day-2。宿舍仍仅为 L1 Internal Pilot Observation，不允许 L2 Production，不允许 Business Production，Repair / Parts / HR 仍保持 L0 Contract Preview。

## 实际运行数据

- WorkItem：11，OperationCase：11
- CommandSubmission：12，RejectedCommandSubmission：2，RejectionTrace：2
- EvidenceObject：15，Evidence API call：45
- LedgerTransaction：7，LedgerEntry：14
- Lens read：22，Trace read：36，Projection lag p95：2 minutes
- Finance Daily Close：passed
- 403 / 409 / 422：1 / 1 / 1
- Device trust bypass：0
- Support tickets：2
- Training blocking issues：0

## P0 Stop

- 无未解决 P0。

## P1 Hold

- 无未解决 P1。

## Day-2 准入

- allowDay2：true
- 如果后续出现 P0，必须立即 stop / pause / rollback，不得进入 Day-2。
- 如果后续出现 P1，必须进入 hold，修复后才允许继续 Day-2。
- L1 -> L2 默认不 eligible，必须另走独立 stage / PR / gate。

## 证据引用

- artifacts/proof/runtime-proof-result.json
- artifacts/go-live/dormitory/live-api-db-replay-result.json
- artifacts/go-live/dormitory/finance-daily-close-result.json
- artifacts/go-live/dormitory/daily-observation-day-01.json
- artifacts/go-live/dormitory/rollback-drill-result.json
- artifacts/go-live/dormitory/training-signoff-result.json
- artifacts/trust/trust-boundary-result.json
- artifacts/release-state/current-state.json
- artifacts/portfolio/business-line-maturity-result.json
