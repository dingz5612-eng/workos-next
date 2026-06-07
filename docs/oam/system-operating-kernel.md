# System Operating Kernel

本文件是 docs/oam/current-authority-index.json 下级系统运行源，不替代顶层权威索引。

| Kernel | Owner | 负责 | 门禁 |
| --- | --- | --- | --- |
| Authority Kernel | oam-release-owner | Authority Kernel 对当前 OAM 运行链负责。 | scripts/oam/check-current-authority-index.mjs |
| Domain Kernel | business-contract-owner | Domain Kernel 对当前 OAM 运行链负责。 | scripts/business/check-dormitory-execution-kernel.mjs<br>scripts/check-dormitory-golden-domain.mjs |
| Runtime Kernel | runtime-kernel-owner | Runtime Kernel 对当前 OAM 运行链负责。 | scripts/check-runtime-write-paths.mjs<br>scripts/oam/check-operation-identity-boundary.mjs |
| Finance Truth Kernel | finance-truth-owner | Finance Truth Kernel 对当前 OAM 运行链负责。 | scripts/check-finance-truth.mjs<br>scripts/check-ledger-semantic-rules.mjs<br>scripts/finance/check-finance-semantic-truth.mjs |
| Evidence Kernel | release-evidence-owner | Evidence Kernel 对当前 OAM 运行链负责。 | scripts/oam/generate-current-evidence-root.mjs<br>scripts/oam/check-current-evidence-root.mjs |
| Admission Kernel | admission-kernel-owner | Admission Kernel 对当前 OAM 运行链负责。 | scripts/check-admission-kernel.mjs<br>scripts/check-business-line-admission.mjs |
| Projection Search Lens Kernel | search-kernel-owner | Projection Search Lens Kernel 对当前 OAM 运行链负责。 | scripts/check-search-kernel.mjs<br>scripts/oam/check-db-ownership-map.mjs |
| Surface Kernel | surface-owner | Surface Kernel 对当前 OAM 运行链负责。 | scripts/check-surface-contract.mjs<br>scripts/oam/check-surface-language-v2.mjs<br>npm --prefix apps/mobile run test |
| Release Control Kernel | release-control-owner | Release Control Kernel 对当前 OAM 运行链负责。 | scripts/oam/check-p0-rule-ledger.mjs<br>scripts/oam/run-control-plane-checks.ps1 |
| Engineering Ledger Kernel | oam-release-owner | Engineering Ledger Kernel 对当前 OAM 运行链负责。 | scripts/oam/generate-current-engineering-ledger.mjs<br>scripts/oam/check-current-engineering-ledger.mjs |

## 不变量

- current-authority-index 是唯一顶层入口。
- system-operating-kernel 只定义运行职责，不替代顶层权威索引。
- 每个内核必须有输入、输出、禁止行为、门禁、证据和失败处理。
- 写入链必须经过 Admission、Definition、CommandSubmission 和 Unit of Work。
- Search、Projection、Lens 和 Surface 默认只读，不拥有业务事实。
