# 当前 OAM P0 规则账本

本账本只记录当前 OAM 的 P0 规则。状态取值仅允许 `passed`、`failed`、`blocked`、`missing`。

| 规则编号 | 规则中文名 | 权威文件 | 结构化合同 | 运行时执行点 | 负向测试或 gate | 证据产物 | 当前状态 | 风险等级 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P0-01 | Business Production 不得由 CI green、Surface 可见性、Search 命中、Control Plane 可见性打开 | `docs/oam/current-admission-state.json` | `docs/contracts/admission/production-admission-contract.json` | `AdmissionKernelService` | `scripts/check-admission-kernel.mjs` | `artifacts/oam/checks/admission-kernel-result.json` | passed | P0 |
| P0-02 | Dormitory L2 不得由设计稿、页面展示、搜索命中、驾驶舱摘要打开 | `docs/business/business-line-registry.json` | `docs/contracts/admission/business-line-admission-matrix.json` | `BusinessLineAdmission` | `scripts/check-business-line-admission.mjs` | `artifacts/oam/checks/business-line-admission-result.json` | passed | P0 |
| P0-03 | production_confirm 默认 false，必须由单独生产准入 gate 打开 | `docs/oam/current-admission-state.json` | `docs/contracts/admission/admission-matrix.json` | `AdmissionKernelService` | `scripts/check-admission-kernel.mjs` | `artifacts/oam/checks/admission-kernel-result.json` | passed | P0 |
| P0-04 | 业务写入只能通过 OAM Confirm Runtime / Unit of Work | `docs/contracts/oam.current.json` | `docs/contracts/definition/workitem-definition-registry.json` | `OperationsUnitOfWork` | `scripts/check-runtime-write-paths.mjs` | `artifacts/oam/checks/runtime-write-paths-result.json` | passed | P0 |
| P0-05 | Projection / Lens / Search / BI / Dashboard / 画像 / 摘要 / 回执不得写业务事实 | `docs/contracts/oam.current.json` | `docs/contracts/runtime-surface-policy.json` | API boundary guards | `scripts/check-api-boundaries.mjs` | `artifacts/oam/checks/api-boundaries-result.json` | passed | P0 |
| P0-06 | 管理驾驶舱不得直接写业务事实、财务事实、异常处理事实 | `docs/contracts/oam.current.json` | `docs/contracts/runtime-surface-policy.json` | ManagementCockpit boundary | `scripts/check-management-cockpit-boundary.mjs` | `artifacts/oam/checks/management-cockpit-boundary-result.json` | passed | P0 |
| P0-07 | 共享治理回执不得替代 AdmissionDecision | `docs/business/shared-governance/subject-vehicle-truth.yml` | `docs/contracts/admission/admission-decision-contract.json` | Shared governance boundary | `scripts/check-shared-governance-boundary.mjs` | `artifacts/oam/checks/shared-governance-boundary-result.json` | passed | P0 |
| P0-08 | 金额依据不得作为正式财务事实 | `docs/business/finance/finance-truth-pipeline.yml` | `docs/finance/finance-semantic-truth-kernel.yml` | Finance Truth Kernel | `scripts/finance/check-finance-semantic-truth.mjs` | `artifacts/oam/checks/finance-semantic-truth-result.json` | passed | P0 |
| P0-09 | 非财务域不得产生 LedgerEntry | `docs/business/truth-owner-registry.yml` | `docs/business/finance/ledger-semantic-rules.yml` | `OperationsUnitOfWork` | `scripts/check-ledger-semantic-rules.mjs` | `artifacts/oam/checks/ledger-semantic-rules-result.json` | passed | P0 |
| P0-10 | 未解析 WorkItem Definition 不得 confirm | `docs/contracts/definition/workitem-definition-registry.json` | `docs/contracts/admission/admission-decision-contract.json` | `WorkItemDefinitionRegistryService` | runtime contract tests | `artifacts/oam/test-results/runtime-contract.json` | passed | P0 |
| P0-11 | SearchResult 必须有 permission、lineage、freshness，并且不得包含业务写 action | `docs/contracts/search/search-contract.json` | `docs/contracts/search/search-result-schema.json` | `SearchKernelService` | `scripts/check-search-kernel.mjs` | `artifacts/oam/checks/search-kernel-result.json` | passed | P0 |
| P0-12 | 普通用户文案不得暴露内部运行术语 | `docs/surface/surface-contract.yml` | `docs/contracts/language/surface-copy-catalog.json` | Language Kernel | `scripts/check-language-kernel.mjs` | `artifacts/oam/checks/language-kernel-result.json` | passed | P0 |
| P0-13 | 高风险动作必须有 verified device trust、reason、evidenceRefs、admissionDecisionRef | `docs/contracts/admission/admission-matrix.json` | `docs/contracts/admission/actor-device-admission-contract.json` | `RuntimeActorAuthentication` | policy tests | `artifacts/oam/checks/admission-kernel-result.json` | passed | P0 |
| P0-14 | Current OAM evidence root 必须生成、校验、上传并绑定 commit / CI run / artifact digest | `docs/oam/current-architecture.manifest.json` | `artifacts/oam/evidence/evidence-graph.json` | evidence root scripts | `scripts/oam/check-current-evidence-root.mjs` | `artifacts/oam/evidence/evidence-graph.json` | passed | P0 |

## 当前裁决

当前 OAM P0 已全部绑定权威、结构化合同、运行时执行点、负向测试或 gate 与证据产物；最终 GO 仍必须以全量验证和证据根校验通过为准。
