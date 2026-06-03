# Codex 执行手册

本文件约束后续 Codex / automated agent 在 WorkOSNext 中执行工程任务的顺序。最高规则权威仍然是 `docs/engineering/*`、`docs/acceptance/*` 和 `docs/rules/v5.5/*`。

Codex 不是架构裁决者。Codex 只能执行 00｜OAM 总控唯一指令；专业 AI、局部建议或页面反馈不能直接给 Codex 下最终架构命令。遇到规则冲突、证据缺失或无法判断的架构方向时，Codex 必须停止扩大实现范围，并在最终报告中记录为风险或阻断项。

## 每次任务必须先做

1. 读取 `docs/engineering/00-rule-authority.md`。
2. 读取 `docs/rules/v5.5/rule-authority.yml`。
3. 读取 `docs/acceptance/13-v5.5-rules-os-go-no-go.md`。
4. 读取 `artifacts/release-state/current-state.json`。
5. 读取 `docs/architecture/CURRENT_ARCHITECTURE_BASELINE.md`。
6. 判断任务层级：rule / contract / runtime / surface / evidence / cleanup。
7. 判断涉及组件是 active、compatibility、archive candidate 还是 remove candidate。
8. 判断是否影响 Admission。

## 修改顺序

1. 先改 contract。
2. 再改实现。
3. 再改测试。
4. 再生成 evidence。
5. 最后输出中文 No-Go / Risk。

如果任务只允许文档或 guard 更新，不得顺手修改业务逻辑、API、DB schema 或前端交互。

## 禁止行为

- 不得擅自扩展 compatibility。
- 不得绕过 Operations Runtime。
- 不得局部修补 language、search 或 surface 而不更新对应合同。
- 不得把 Workspace/Card 作为新业务扩展点。
- 不得把 ProjectionRuntime 作为顶层架构。
- 不得让 Mobile BFF 或 PC Governance 直接写业务事实。
- 不得把 surface visible 解释为 confirmAllowed。
- 不得把 Rules OS GO 解释为 Business Production GO。
- 不得使用 waiver、TODO、continue-on-error 或手写 passed evidence 绕过 gate。
- 不得新增业务功能来掩盖架构缺口。
- 不得把局部测试通过解释为 Business Production GO。

## 输出要求

每次批次结束必须用中文说明：

- 完成了什么。
- modified files。
- 新增文件。
- 删除文件。
- tests run。
- gates run。
- evidence。
- 哪些组件是 active / compatibility / archive / remove candidate。
- 哪些 gate 已通过。
- 哪些风险仍存在。
- next-stage recommendation。
- 是否允许进入下一阶段。

如果不允许进入下一阶段，必须明确列出 blocker 和修复项。
