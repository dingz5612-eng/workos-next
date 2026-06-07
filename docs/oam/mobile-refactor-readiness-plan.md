# Mobile Branch Risk Kernel 减重准备计划

## 当前裁决

当前不允许进行大规模减重或控制器拆分。

移动端最新覆盖率为：

- Statements：82.35%
- Branches：66.64%
- Functions：88.96%
- Lines：86.48%

Branches 尚未达到 70%，因此 `docs/oam/mobile-branch-risk-policy.json` 继续保持第一阶段 no-regression 门禁，不提升为 Branches 70% 硬门禁。

## 允许的工作

- 继续补高风险矩阵测试。
- 继续刷新 `docs/oam/mobile-branch-risk-ledger.json`。
- 继续维护 `docs/oam/mobile-critical-branch-scenarios.json` 的业务场景绑定。
- 只做不改变业务语义的小修，且必须通过移动测试、coverage policy、critical scenarios 和 OAM 总门禁。

## 暂不允许的减重

- 暂不拆 `operationController.js`。
- 暂不拆 `navigationController.js`。
- 暂不把 `simpleView.js` 改为 view registry。
- 暂不迁移 DOM/localStorage 兜底。
- 暂不集中字段兼容、错误解释或语言兜底到新抽象。

## 下一批补测优先级

下一批补测文件由 `docs/oam/mobile-branch-risk-ledger.json` 自动生成，以 `targetAssessment.nextBatchFiles` 为准。当前优先级为：

- `apps/mobile/src/operationController.js`：补空提交、重复点击、提交中、403、409、422、纠错态、完成态和弱网矩阵。
- `apps/mobile/src/fieldSourceRenderer.js`：补字段别名、只读字段、必填字段、证据字段和异常字段来源矩阵。
- `apps/mobile/src/navigationController.js`：补深链缺 WorkItem、无权限跳转、搜索跳转、PC 路由拦截和 404 fallback 矩阵。
- `apps/mobile/src/views/searchView.js`：补 Search 命中不可直接写事实、权限不可见、projection pending/failed 和 PC scope 隔离矩阵。
- `apps/mobile/src/selectors/queueSelectors.js`：补空态、损坏存储、超限截断、只读态、错误态和权限态矩阵。
- `apps/mobile/src/operationRuntime.js`：补错误状态、重复提交、无 WorkItem、无证据和设备不可信矩阵。
- `apps/mobile/src/surfaceGuard.js`：补 mobile/PC、角色不足、设备不可信、production blocked、合同预览和 Search 命中不可办理矩阵。
- `apps/mobile/src/authController.js`：补 actor 缺失、session 过期、设备缺失和角色切换矩阵。

## 允许减重的条件

只有同时满足以下条件后，才允许进入减重：

- 全局 Branches >= 70%。
- Statements >= 82%。
- Functions >= 88%。
- Lines >= 85%。
- P0 关键场景全部有测试绑定。
- `node scripts/oam/check-mobile-coverage-policy.mjs` 通过。
- `node scripts/oam/check-mobile-critical-branch-scenarios.mjs` 通过。
- OAM 总门禁通过。

## 减重顺序

达到条件后，按以下顺序串行推进，每一步后运行相关测试和门禁：

1. 字段兼容统一进 adapter。
2. 错误解释统一进 error presenter。
3. 语言兜底统一进 language kernel。
4. DOM/localStorage 兜底统一进 safeStorage/safeDom。
5. `simpleView.js` 改成 view registry。
6. 拆分 `operationController.js` 和 `navigationController.js`。

任何减重不得删除 OAM 保护分支，不得弱化 403、409、422、设备信任、证据、Search 只读、mobile/PC 边界。
