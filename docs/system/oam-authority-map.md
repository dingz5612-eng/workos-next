# 当前 OAM 权威闭环图

本文件定义当前 OAM 的唯一权威来源。任何页面可见性、搜索命中、驾驶舱摘要、治理回执、财务依据或测试通过状态，都不得替代这里列出的准入、写入和证据权威。

| 闭环对象 | 唯一权威 | 结构化合同 | 执行点 | 门禁 |
| --- | --- | --- | --- | --- |
| 当前架构身份 | `docs/oam/current-architecture.md` | `docs/contracts/oam.current.json` | `scripts/oam/check-current-oam.mjs` | OAM purity |
| 生产准入 | `docs/oam/current-admission-state.json` | `docs/contracts/admission/production-admission-contract.json` | `AdmissionKernelService` | `scripts/check-admission-kernel.mjs` |
| 业务线准入 | `docs/business/business-line-registry.json` | `docs/contracts/admission/business-line-admission-matrix.json` | `BusinessLineAdmission` | `scripts/check-business-line-admission.mjs` |
| 业务事实写入 | `docs/contracts/oam.current.json` | `docs/contracts/definition/workitem-definition-registry.json` | `OperationsUnitOfWork` | `scripts/check-runtime-write-paths.mjs` |
| 真值归属 | `docs/business/truth-owner-registry.yml` | `docs/contracts/definition/workitem-definition-registry.json` | `OperationsUnitOfWork` | `scripts/check-truth-owners.mjs` |
| 财务真值 | `docs/business/finance/finance-truth-pipeline.yml` | `docs/business/finance/ledger-semantic-rules.yml` | Finance Truth Kernel | `scripts/check-finance-truth.mjs` |
| Search 只读 | `docs/contracts/search/search-contract.json` | `docs/contracts/search/search-result-schema.json` | `SearchKernelService` | `scripts/check-search-kernel.mjs` |
| Surface 用户语义 | `docs/surface/surface-contract.yml` | `docs/contracts/language/surface-copy-catalog.json` | `surfaceGuard` / Language Kernel | `scripts/check-language-kernel.mjs` |
| 高风险动作信任 | `docs/contracts/admission/admission-matrix.json` | `docs/contracts/admission/actor-device-admission-contract.json` | `RuntimeActorAuthentication` | `scripts/check-admission-kernel.mjs` |
| 证据根 | `docs/oam/current-architecture.manifest.json` | `artifacts/oam/evidence/evidence-graph.json` | `scripts/oam/generate-current-evidence-root.mjs` | `scripts/oam/check-current-evidence-root.mjs` |

## 不可替代规则

- CI 通过不等于 Business Production 可办理。
- Surface 可见不等于 confirmAllowed。
- Search 命中不等于可确认、可办理或可生产。
- Dashboard 摘要不等于业务事实。
- 共享治理回执不等于 AdmissionDecision。
- 金额依据不等于正式财务事实。
