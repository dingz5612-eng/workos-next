# WorkOSNext 项目审查手册

## 用途

本手册用于 WorkOSNext 建设过程中的产品与架构对齐。

它不是终端用户指南。终端用户通过“我的 -> 学习中心”学习系统。

## 当前产品定位

WorkOSNext 是移动优先的业务操作系统。

它不是传统后台管理看板，也不应变成模块页面集合。

当前 OAM 状态：

- UI/UX 参考必须服从当前 OAM。
- 场景流定义必须能映射到 WorkItem 和 Confirm Runtime。
- 前端业务合同必须能支撑后端 DTO、读模型和测试。

## 固定导航原则

底部导航是四种工作模式：

- 今天：先处理今天最重要的事项。
- 搜索：主动意图和直接业务入口。
- 工作台：系统分派的被动任务队列。
- 我的：画像、统计、笔记、提醒、学习中心、反馈和偏好。

不得把 `Help` 恢复为主导航。

## 固定场景原则

系统由场景流构成，不由大模块循环构成。

每条场景流属于一类：

- 对象创建。
- 业务处理。
- 异常处理。

每条场景流必须定义：

- 业务域。
- 步骤。
- 字段。
- 证据。
- 人工确认策略。
- 异常分支。
- 结束条件。

## 当前覆盖场景

住宿：

- 创建房间。
- 创建床位。
- 入住。
- 退住。
- 押金异常。

维修：

- 创建车辆画像。
- 派工和诊断。
- 验收和关闭。

财务：

- 押金收款确认。

## 必须保持的体验规则

- 今天不得变成列表页。
- 今天的本地卡片必须是场景流，不是模块循环。
- 搜索必须把缺失对象路由到创建流程。
- 工作台必须先展示任务，再展示深层筛选。
- 所有关键动作必须要求人工确认。
- 反馈必须可用，且不得阻断主任务。
- 中文、俄语和吉尔吉斯语必须共同考虑。

## 后端就绪清单

实现写 API 前必须定义：

- Scenario semantic model。
- ScenarioFlow。
- ScenarioStep。
- ScenarioField。
- ScenarioException。
- ScenarioEvidence。
- ScenarioPolicy。
- BusinessObject。
- Task。
- Action preparation。
- Action confirmation。
- Audit event。
- Note。
- Reminder。
- Feedback。

## 禁止方向

- 不重建旧 FunRide 页面集合。
- 不把模块菜单作为主产品结构。
- 不把已替换 UI 藏在新屏幕后面。
- 不让 AI 执行确认、付款、退款、核销或最终关闭。
- 不硬编码后续无法成为 DTO 或种子数据的字段。
- 不新增页面私有业务写 API。
- 不让 Search、BI、Dashboard、Projection、Lens、Profile、Summary、Receipt 成为业务事实写入路径。
- 不让业务域直接写正式财务事实或 LedgerEntry。
- 不把证据输出到 `artifacts/oam` 之外。

## 当前 OAM 硬收口审查项

- Surface 阻断字段必须使用 `currentForbiddenWriteAdapter`。
- 非持久化 WorkItem 标识必须使用 `nonPersistedWorkItemKey`。
- WorkItem 定义入口必须使用 `sourceCardId`。
- 步骤依赖隐藏字段必须使用 `suppressedFields`。
- Ledger/control-plane 迁移验证必须使用 `migrationReadonlySources`、`sourceLock`、`readonlySourceVerification`、`projectionConsistencyCompare`。
- WorkItem 状态记录必须使用 `operations_work_item_state_event_log`。
- 本地提交前必须通过 `scripts/oam/run-control-plane-checks.ps1`。

## 单次变更审查清单

- 是否遵守四种工作模式。
- 是否基于场景流。
- 是否清楚支持对象创建、业务处理或异常处理。
- 是否保持人工确认边界。
- 是否保持多语言就绪。
- 是否删除已替换 UI，而不是保留重复路径。
- 是否可推导后端 DTO、读模型和测试。
- 对象、字段、状态、任务、动作、证据、策略、分析和异常是否对齐。

最终审查结论：

```text
PROJECT_REVIEW_MANUAL_READY
```
