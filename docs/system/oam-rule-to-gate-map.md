# 当前 OAM 规则到门禁映射

本文件把 P0 规则绑定到可执行门禁。`scripts/oam/check-p0-rule-ledger.mjs` 是 P0 发布内核门禁；未列入本表的页面、脚本或摘要不得自行解释准入结果。

| 规则编号 | 规则中文名 | 主门禁 | 辅助门禁 | 证据产物 |
| --- | --- | --- | --- | --- |
| P0-01 | Business Production 不得被间接打开 | `scripts/check-admission-kernel.mjs` | `scripts/check-business-line-admission.mjs` | `artifacts/oam/evidence/master-design-proof.json` |
| P0-02 | Dormitory L2 不得被间接打开 | `scripts/check-business-line-admission.mjs` | `scripts/check-dormitory-golden-domain.mjs` | `artifacts/oam/evidence/master-outline-proof.json` |
| P0-03 | production_confirm 默认 false | `scripts/check-admission-kernel.mjs` | `scripts/check-rule-authority.mjs` | `artifacts/oam/evidence/master-design-proof.json` |
| P0-04 | 业务写入只能通过 OAM Confirm Runtime / Unit of Work | `scripts/check-runtime-write-paths.mjs` | `scripts/check-api-boundaries.mjs` | `artifacts/oam/evidence/runtime-proof.json` |
| P0-05 | 读取面不得写业务事实 | `scripts/check-api-boundaries.mjs` | `scripts/check-search-kernel.mjs` | `artifacts/oam/evidence/search-readonly-proof.json` |
| P0-06 | 管理驾驶舱不得直接写事实 | `scripts/check-management-cockpit-boundary.mjs` | `scripts/check-runtime-write-paths.mjs` | `artifacts/oam/evidence/runtime-proof.json` |
| P0-07 | 共享治理回执不得替代 AdmissionDecision | `scripts/check-shared-governance-boundary.mjs` | `scripts/check-admission-kernel.mjs` | `artifacts/oam/evidence/master-outline-proof.json` |
| P0-08 | 金额依据不得作为正式财务事实 | `scripts/finance/check-finance-semantic-truth.mjs` | `scripts/check-finance-truth.mjs` | `artifacts/oam/evidence/truth-ownership-proof.json` |
| P0-09 | 非财务域不得产生 LedgerEntry | `scripts/check-ledger-semantic-rules.mjs` | `scripts/check-finance-truth.mjs` | `artifacts/oam/evidence/truth-ownership-proof.json` |
| P0-10 | 未解析 WorkItem Definition 不得 confirm | `scripts/check-admission-kernel.mjs` | `scripts/check-runtime-write-paths.mjs` | `artifacts/oam/evidence/runtime-proof.json` |
| P0-11 | SearchResult 必须只读且可追溯 | `scripts/check-search-kernel.mjs` | `scripts/check-api-boundaries.mjs` | `artifacts/oam/evidence/search-readonly-proof.json` |
| P0-12 | 普通用户文案不得暴露内部运行术语 | `scripts/oam/check-surface-language-v2.mjs` | `scripts/check-language-kernel.mjs`、`scripts/check-surface-contract.mjs` | `artifacts/oam/evidence/surface-language-proof.json` |
| P0-13 | 高风险动作必须绑定可信设备、原因、证据和准入裁决 | `scripts/check-admission-kernel.mjs` | `scripts/trust/check-trust-boundary-kernel.mjs` | `artifacts/oam/evidence/high-risk-trust-proof.json` |
| P0-14 | Current OAM evidence root 必须绑定提交、CI 和摘要 | `scripts/oam/check-current-evidence-root.mjs` | CI artifact upload | `artifacts/oam/evidence/evidence-graph.json` |

## 统一入口

本地总入口是 `scripts/oam/run-control-plane-checks.ps1`。CI 的核心门禁不得弱于本地总入口；如 CI 新增关键规则，本地总入口必须同步补齐。
