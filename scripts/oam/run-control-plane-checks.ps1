$ErrorActionPreference = "Stop"

node scripts/oam/check-current-oam.mjs
node scripts/validate-contracts.mjs
node scripts/check-rule-authority.mjs
node scripts/check-local-path-references.mjs
node scripts/check-api-boundaries.mjs --self-test
node scripts/check-api-boundaries.mjs
node scripts/check-runtime-write-paths.mjs --self-test
node scripts/check-runtime-write-paths.mjs
node scripts/check-admission-kernel.mjs --self-test
node scripts/check-admission-kernel.mjs
node scripts/check-business-line-admission.mjs
node scripts/check-account-actor-kernel.mjs --self-test
node scripts/check-account-actor-kernel.mjs
node scripts/check-language-kernel.mjs
node scripts/check-search-kernel.mjs --self-test
node scripts/check-search-kernel.mjs
node scripts/check-policy-as-code.mjs --self-test
node scripts/check-policy-as-code.mjs
node scripts/check-domain-packs.mjs --self-test
node scripts/check-domain-packs.mjs
node scripts/check-truth-owners.mjs --self-test
node scripts/check-truth-owners.mjs
node scripts/check-finance-truth.mjs --self-test
node scripts/check-finance-truth.mjs
node scripts/check-ledger-semantic-rules.mjs
node scripts/finance/check-finance-semantic-truth.mjs
node scripts/check-management-cockpit-boundary.mjs --self-test
node scripts/check-management-cockpit-boundary.mjs
node scripts/check-shared-governance-boundary.mjs --self-test
node scripts/check-shared-governance-boundary.mjs
node scripts/check-dormitory-golden-domain.mjs --self-test
node scripts/check-dormitory-golden-domain.mjs
node scripts/business/check-scenario-field-contract.mjs
node scripts/business/check-canonical-scenario-map.mjs
node scripts/business/check-evidence-coverage-contract.mjs
node scripts/business/check-ledger-posting-contract.mjs
