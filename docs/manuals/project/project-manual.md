# 项目手册

## 当前远端 main 状态

当前基线来自 PR #76 合并后的 main，并已完成阶段 0 / 阶段 1 / 阶段 2 的本地原子提交验证。main 的权威绑定必须通过 post-merge attestation、current-state、release evidence baseline、artifact git binding 与 OAM clean baseline 共同确认。

## OAM-04B / OAM-04C 完成情况

- OAM-04B accepted：端面体验产品化已通过。
- OAM-04C accepted：Dormitory 10 场景旅程 HTML / SVG snapshots 已作为 accepted journey evidence。
- 纯净基线报告：`docs/manuals/project/post-oam-04b-04c-pure-baseline-report.md`。

## 当前禁止进入 Day-2

Day-2 not started。Day-2 仍需要单独 Day-2 Entry Gate、单独 PR 和单独验收，不得由本手册或当前阶段自动放行。

## 当前 Production 边界

- Dormitory remains L1 Internal Pilot Observation only。
- Dormitory L2 Production = false。
- Business Production = blocked。
- Repair / Parts / HR = L0 Contract Preview。

## 当前 remaining P0 / P1 / P2

P0：不得隐藏、跳过或降级任何失败 checker。若阶段 checker 失败，先修复本阶段。

P1：继续补齐文档、多语言、runtime boundary、frontend trust boundary 与 evidence-grade test。

P2：继续整理 historical artifact、diagnostic-only screenshot 和 removable candidate。

## PR 规则

每阶段必须原子 commit。若拆分 PR，上一 PR 合并后必须重新执行 post-merge attestation / current-state rebind / release-state artifact binding，确认 main 绑定最新 merge commit。

## 阶段门禁

阶段必须按 0 -> 10 顺序推进。上一阶段未完成 checker、build、test、script、guard 和 commit 前，不得进入下一阶段。

## 可以做

- 修复阶段内 checker 暴露的问题。
- 更新当前阶段要求的 docs、artifact、tests 和 guards。
- 保持 Dormitory L1 内测观察状态下的真实体验闭环。

## 不能做

- 不进入 Day-2。
- 不声明 Dormitory L2 Production 或 Business Production。
- 不扩业务线。
- 不新增 page-specific business write API。
- 不用 TODO、空壳或静态假数据替代闭环。

## 下一个允许动作

在阶段 3 完成并提交后，才允许进入阶段 4 Localization Authority and Copy Coverage。
