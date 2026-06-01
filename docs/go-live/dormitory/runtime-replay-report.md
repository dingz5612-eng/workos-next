# D1 Runtime-backed Dormitory API/DB Replay Report

## 中文摘要

本报告绑定 `D1: Runtime-backed Dormitory API/DB Replay`。D1 只验证宿舍 L1 Internal Pilot 的真实 API、PostgreSQL、OperationsUnitOfWork、账本、投影与 trace replay 能力，不声明宿舍 L2 Production，不放开 Repair / Parts / HR，也不把 artifact runner 或 synthetic fact 当作通过证据。

## Replay Contract

- Branch: `codex/dorm-runtime-backed-api-db-replay`
- Current main HEAD: `791c9ce1cac9a1088c1b9cc41d5fdfe058ef282c`
- SourceMode: `real_api_db`
- Final evidence refs:
  - `artifacts/go-live/dormitory/live-api-db-replay-result.json`
  - `artifacts/go-live/dormitory/source-mode-contract-result.json`

## 运行边界

- Dormitory status: `L1 Internal Pilot`
- Dormitory L2 Production: blocked
- Repair / Parts / HR: `L0 Contract Preview`
- Business Production GO: blocked
- `.tmp` evidence refs: blocked
- synthetic `DomainEvent` / `LedgerTransaction`: blocked

## 验收说明

正式结论以 `scripts/go-live/run-dormitory-live-api-db-scenarios.mjs` 生成的真实 replay artifact 和 `scripts/go-live/check-dormitory-runtime-replay-result.mjs` 的机器校验为准。PR 描述、本地口头 PASS、旧 CI run id、`.tmp` 文件不能替代本报告引用的 artifacts。
