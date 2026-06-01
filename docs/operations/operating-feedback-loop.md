# Operating Feedback Loop

## 中文目标

RT-F 的目标是把经营控制从一次性看板升级为持续闭环：指标异常必须变成可追踪的 `RiskSignal`，再生成有 owner、SLA、升级路径和证据要求的 `WorkItem`，解决后写入 `ResolutionEvent`，刷新 Lens，进入 `PeriodReview`，并把重复异常反馈到训练和策略更新。

## 闭环主轴

`MetricDeviation -> RiskSignal -> WorkItem -> Owner / SLA -> ResolutionEvent -> Lens update -> PeriodReview -> Training / Policy update`

## 机器证据

- `docs/operations/metric-deviation-policy.yml`
- `docs/operations/risk-signal-policy.yml`
- `scripts/check-operating-feedback-loop.mjs`
- `tests/WorkOS.UnitTests/OperatingFeedbackLoopContractTests.cs`

## 边界

- 经营反馈闭环只允许推动 `WorkItem`、`ResolutionEvent`、Lens 刷新、复盘和训练策略更新。
- Management Cockpit 只能发现、定位、派发和跟踪，不能直接写业务事实。
- Repair / Parts / HR 仍保持 `L0 Contract Preview`，不能因为宿舍反馈闭环而进入 production。
- 当前阶段只能标记 `LOCAL_PASSED / STACKED_READY / LOCKED_UNTIL_CENTRAL_MERGE`，不能声明 production-ready。
