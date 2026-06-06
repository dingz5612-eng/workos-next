# 当前 OAM 下一阶段准入规则

本文件是当前 OAM 的下一阶段准入权威说明。它只定义“是否允许继续补强下一阶段材料”，不定义 Business Production、不定义 Dormitory L2，也不允许 production_confirm。

## 权威引用

- P0 规则账本：`docs/system/oam-p0-rule-ledger.md`
- 证据根：`artifacts/oam/evidence/evidence-graph.json`
- 最终报告：`artifacts/oam/final-report.json`
- 当前准入状态：`docs/oam/current-admission-state.json`
- 当前架构 manifest：`docs/oam/current-architecture.manifest.json`

## 准入条件

下一阶段只允许在以下条件全部满足时进入：

1. `docs/system/oam-p0-rule-ledger.md` 中不存在 unresolved P0。
2. `docs/oam/current-admission-state.json` 中 Business Production 仍为 `BLOCKED`，除非单独生产准入 gate 通过。
3. `docs/oam/current-admission-state.json` 中 Dormitory L2 仍为 `BLOCKED`，除非单独 L2 gate 通过。
4. `productionConfirmAllowed` 仍为 `false`，除非单独启用 gate 通过。
5. Search、Dashboard、Profile、Summary、Receipt、Projection、Lens 没有业务事实写入路径。
6. Runtime truth owner guard、allowedFacts guard、forbiddenFacts guard、ledgerPolicy guard 全部通过。
7. 高风险动作必须通过 verified device trust、actor capability、reason、evidenceRefs、admissionDecisionRef 和 append-only guard。
8. `artifacts/oam/evidence/evidence-graph.json` 完整，且通过 `scripts/oam/check-current-evidence-root.mjs` 校验。
9. `artifacts/oam/final-report.json` 完整，且 final go/no-go 为 `GO`。
10. 所有 `skipped` 或 `not_applicable` 项必须有中文原因说明。

## 禁止推导

以下信号不得推导为下一阶段 GO：

1. CI success 不等于 Business Production GO。
2. Coverage 达标不等于 Dormitory L2 GO。
3. Surface 可见不等于 confirmAllowed。
4. Search 命中不等于可办理。
5. Dashboard 摘要不等于业务事实。
6. Management decision 不等于业务确认。
7. Shared receipt 不等于 AdmissionDecision。
8. Amount basis 不等于正式财务事实。

## GO / NO_GO

最终裁决规则：

- 如果证据根未生成或校验失败，裁决必须为 `NO_GO`。
- 如果存在 unresolved P0，裁决必须为 `NO_GO`。
- 如果 Business Production 被打开，裁决必须为 `NO_GO`。
- 如果 Dormitory L2 被打开，裁决必须为 `NO_GO`。
- 如果 production_confirm 被打开，裁决必须为 `NO_GO`。
- 如果 SearchResult 缺少 permission、lineage、freshness，裁决必须为 `NO_GO`。
- 如果 SearchResult 有业务写 action，裁决必须为 `NO_GO`。
- 如果普通用户文案暴露内部运行术语，裁决必须为 `NO_GO`。
- 如果 unresolved WorkItem Definition 可以 confirm，裁决必须为 `NO_GO`。
- 如果非财务域可以产生 LedgerEntry，裁决必须为 `NO_GO`。
- 如果 correction apply 可以绕过 trusted device、evidenceRefs 或 admissionDecisionRef，裁决必须为 `NO_GO`。

当且仅当 P0 全部清零、证据根完整、全量验证通过时，`next_stage_allowed` 才允许进入下一阶段补强；该准入不得解释为 Business Production、Dormitory L2 或 production_confirm 放行。
