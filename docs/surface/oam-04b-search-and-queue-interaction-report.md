# OAM-04B-04 Search 与 Queue 交互闭环报告

生成时间：2026-06-02T21:41:59.3702117+08:00

## 范围

- Dormitory：L1 Internal Pilot Observation
- Dormitory L2 Production：false
- Business Production：blocked
- Repair / Parts / HR：L0 Contract Preview
- Day-2：未进入

## Search Intent Hub

- 搜索结果统一经过 `buildSearchResultVM()`，输出 resultType、中文标题/说明、状态、下一步、actionType、actionLabel、WorkItem/Workspace/Card/Case/Evidence/Trace/Learning 标识、目标 view、无动作原因和 sourceRefs。
- WorkItem 结果渲染“处理”按钮，并通过 `data-work-item-id` 进入真实 persisted WorkItem 的 OperationPanel。
- Evidence、Trace、Learning、对象结果分别复用 `data-evidence-id`、`data-trace-id`、`data-learning-id`、`data-workspace`/`data-card-id`。
- 没有可跳转目标的结果只显示中文原因，不渲染假按钮。
- 搜索排序避免窄查询直接倾倒全量 WorkItem，并让“创建房间”优先命中房间创建办理项。

## Queue Filter State

- 新增统一 `queueFilters`：domain、badge、status、ownerRole、evidenceState、transferable、riskLevel。
- 旧 `queueDomain` / `queueBadge` 只作为兼容适配。
- IA chip、普通筛选、高级筛选均写入同一 `queueFilters`。
- `queueTasks()` 明确消费统一筛选状态，筛选结果、数量和空态随状态变化。
- “需补证据”基于 evidenceState；“可转交”基于 transferable 或办理角色差异。
- 清除筛选恢复默认队列视图。

## 验收

- `npm --prefix apps/mobile run test`：通过，49 个测试文件 / 161 条测试
- `npm --prefix apps/mobile run build`：通过
- `node scripts/surface/check-mobile-work-shell.mjs`：通过
- `node scripts/surface/check-user-facing-surface-copy.mjs`：通过
- `node scripts/surface/check-mobile-visible-copy.mjs`：通过
- `node scripts/surface/check-no-raw-surface-labels.mjs`：通过
- `node scripts/surface/check-view-model-contract.mjs`：通过
- `pwsh -NoProfile -File scripts/guard-architecture.ps1`：通过

完成标识：OAM_04B_SEARCH_AND_QUEUE_INTERACTION_CLOSED
