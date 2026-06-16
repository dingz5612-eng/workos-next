import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const indexPath = "docs/oam/current-authority-index.json";

const sourceLayerWhitelist = [
  "docs/oam/current-architecture.md",
  "docs/oam/current-architecture.manifest.json",
  "docs/oam/current-authority-index.json",
  "docs/contracts/oam.current.json",
  "docs/oam/current-oam-kernel-responsibility-map.json",
  "docs/oam/oam-kernel-graph.json",
  "docs/oam/system-operating-kernel.json",
  "docs/oam/compiler-generated-contract-kernel.json",
  "docs/oam/file-lifecycle-policy.json",
  "docs/oam/current-oam-cross-domain-conflict-rules.json",
  "docs/oam/codex-execution-channel-policy.json",
  "docs/oam/professional-ai-review-seats.json",
  "docs/oam/system-change-governance-contract.json",
  "docs/oam/system-failure-routing-contract.json",
  "docs/oam/system-handoff-contract.json",
  "docs/oam/iteration-kernel.json",
  "docs/system/oam-p0-rule-ledger.json",
  "docs/business/business-line-registry.json",
  "docs/business/admission/business-line-levels.yml",
  "docs/oam/current-admission-state.json",
  "docs/business/truth-owner-registry.yml",
  "docs/business/domains/dormitory/dormitory-operating-kernel.json",
  "docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json",
  "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json",
  "docs/business/domains/dormitory/dormitory-scenario1-benchmark-inheritance.authority.json",
  "docs/business/domains/dormitory/dormitory-scenario1-resource-basic-readiness.authority.json",
  "docs/business/domains/dormitory/dormitory-scenario2-resource-operation-status.authority.json",
  "docs/business/domains/dormitory/dormitory-scenario3-product-and-pricing.authority.json",
  "docs/business/domains/dormitory/dormitory-scenario4-inquiry-and-quote.authority.json",
  "docs/business/domains/dormitory/dormitory-scenario5-reservation-and-inventory-hold.authority.json",
  "docs/business/domains/dormitory/dormitory-scenario6-payment-deposit-and-guarantee.authority.json",
  "docs/business/domains/dormitory/dormitory-scenario7-check-in-processing.authority.json",
  "docs/business/domains/dormitory/dormitory-scenario8-in-stay-management.authority.json",
  "docs/business/domains/dormitory/dormitory-scenario9-checkout-settlement.authority.json",
  "docs/business/domains/dormitory/dormitory-scenario10-cancel-noshow-refund.authority.json",
  "docs/business/domains/dormitory/dormitory-scenario11-housekeeping-maintenance-outofservice.authority.json",
  "docs/business/domains/dormitory/dormitory-scenario12-channel-corporate-customer.authority.json",
  "docs/business/domains/dormitory/dormitory-scenario13-reporting-audit-review.authority.json",
  "docs/business/domains/dormitory/dormitory-bed-cardinality.authority.json",
  "docs/business/domains/dormitory/dormitory-command-contracts.authority.json",
  "docs/business/domains/dormitory/dormitory-failure-semantics.authority.json",
  "docs/business/domains/dormitory/dormitory-first-golden-chain.capability-decision.authority.json",
  "docs/business/domains/dormitory/dormitory-invariants.authority.json",
  "docs/business/domains/dormitory/dormitory-object-graph.authority.json",
  "docs/business/domains/finance/finance-operating-kernel.json",
  "docs/business/domains/maintenance/maintenance-operating-kernel.json",
  "docs/finance/finance-ledger-kernel.json",
  "docs/identity/identity-permission-kernel.json",
  "docs/read-intelligence/read-intelligence-kernel.json",
  "docs/surface/surface-contract.yml",
  "docs/contracts/language/language-contract.json",
  "docs/contracts/database/oam-db-ownership-map.json"
];

const requiredSourceEntries = [
  entry("docs/oam/current-authority-index.json", "current_architecture_authority", "oam-release-owner", "scripts/oam/check-current-authority-index.mjs", "artifacts/oam/evidence/evidence-graph.json", "当前权威索引 Source，声明唯一分类模型和 Source 白名单。"),
  entry("docs/business/admission/business-line-levels.yml", "current_admission_contract", "business-admission-owner", "scripts/check-business-line-admission.mjs", "artifacts/oam/evidence/high-risk-trust-proof.json", "业务线成熟度与准入等级 Source。"),
  entry("docs/oam/current-admission-state.json", "current_admission_contract", "admission-kernel-owner", "scripts/check-admission-kernel.mjs", "artifacts/oam/evidence/high-risk-trust-proof.json", "当前准入状态 Source，生产确认保持阻断。"),
  entry("docs/read-intelligence/read-intelligence-kernel.json", "read_side_allowed_file", "read-intelligence-owner", "scripts/oam/check-read-intelligence-kernel.mjs", "artifacts/oam/evidence/search-readonly-proof.json", "读侧智能内核 Source，只定义读侧边界。"),
  entry("docs/surface/surface-contract.yml", "current_business_contract", "surface-owner", "scripts/check-surface-contract.mjs", "artifacts/oam/evidence/surface-language-proof.json", "Surface 边界 Source，只定义展示和交互边界。"),
  entry("docs/business/domains/dormitory/dormitory-scenario2-resource-operation-status.authority.json", "current_domain_kernel", "domain-owner", "scripts/business/check-dormitory-scenario2-resource-operation-status-authority.mjs", "artifacts/oam/checks/dormitory-scenario2-resource-operation-status-authority-result.json", "房源运营就绪与状态维护 Source Authority，只能人工维护；定义场景包 2 的运营检查、状态维护、阻断和恢复边界。"),
  entry("docs/business/domains/dormitory/dormitory-scenario3-product-and-pricing.authority.json", "current_domain_kernel", "domain-owner", "scripts/business/check-dormitory-scenario3-product-and-pricing-authority.mjs", "artifacts/oam/checks/dormitory-scenario3-product-and-pricing-authority-result.json", "住宿商品与价格 Source Authority，只能人工维护；定义场景包 3 的商品、价格方案、价格日历、版本和证据边界。"),
  entry("docs/business/domains/dormitory/dormitory-scenario4-inquiry-and-quote.authority.json", "current_domain_kernel", "domain-owner", "scripts/business/check-dormitory-scenario4-inquiry-and-quote-authority.mjs", "artifacts/oam/checks/dormitory-scenario4-inquiry-and-quote-authority-result.json", "询价与报价 Source Authority，只能人工维护；定义场景包 4 的客户询价、入住需求、报价版本、价格快照和转预订准备边界。"),
  entry("docs/business/domains/dormitory/dormitory-scenario5-reservation-and-inventory-hold.authority.json", "current_domain_kernel", "domain-owner", "scripts/business/check-dormitory-scenario5-reservation-and-inventory-hold-authority.mjs", "artifacts/oam/checks/dormitory-scenario5-reservation-and-inventory-hold-authority-result.json", "预订与库存锁定 Source Authority，只能人工维护；定义场景包 5 的可订复核、库存锁定、预订确认、预订号和下游入住办理边界。"),
  entry("docs/business/domains/dormitory/dormitory-scenario6-payment-deposit-and-guarantee.authority.json", "current_domain_kernel", "domain-owner", "scripts/business/check-dormitory-scenario6-payment-deposit-and-guarantee-authority.mjs", "artifacts/oam/checks/dormitory-scenario6-payment-deposit-and-guarantee-authority-result.json", "收款、押金与担保 Source Authority，只能人工维护；定义场景包 6 的应收、押金、担保、凭证、finance-gate 和下游入住办理边界。"),
  entry("docs/business/domains/dormitory/dormitory-scenario7-check-in-processing.authority.json", "current_domain_kernel", "domain-owner", "scripts/business/check-dormitory-scenario7-check-in-processing-authority.mjs", "artifacts/oam/checks/dormitory-scenario7-check-in-processing-authority-result.json", "入住办理 Source Authority，只能人工维护；定义场景包 7 的预订承接、身份核验、协议确认、房间/床位交付、确认入住和入住凭证边界。"),
  entry("docs/business/domains/dormitory/dormitory-scenario8-in-stay-management.authority.json", "current_domain_kernel", "domain-owner", "scripts/business/check-dormitory-scenario8-in-stay-management-authority.mjs", "artifacts/oam/checks/dormitory-scenario8-in-stay-management-authority-result.json", "在住管理 Source Authority，只能人工维护；定义场景包 8 的在住状态、服务、异常、续住、换房换床、凭证和退房准备边界。"),
  entry("docs/business/domains/dormitory/dormitory-scenario9-checkout-settlement.authority.json", "current_domain_kernel", "domain-owner", "scripts/business/check-dormitory-scenario9-checkout-settlement-authority.mjs", "artifacts/oam/checks/dormitory-scenario9-checkout-settlement-authority-result.json", "退房结算 Source Authority，只能人工维护；定义场景包 9 的退房办理、交接、验房、费用核算、押金抵扣、财务请求和资源恢复边界。"),
  entry("docs/business/domains/dormitory/dormitory-scenario10-cancel-noshow-refund.authority.json", "current_domain_kernel", "domain-owner", "scripts/business/check-dormitory-scenario10-cancel-noshow-refund-authority.mjs", "artifacts/oam/checks/dormitory-scenario10-cancel-noshow-refund-authority-result.json", "取消、未到店与退款处理 Source Authority，只能人工维护；定义场景包 10 的取消、未到店、政策金额、库存释放、退款/扣费请求和 finance-gate 边界。"),
  entry("docs/business/domains/dormitory/dormitory-scenario11-housekeeping-maintenance-outofservice.authority.json", "current_domain_kernel", "domain-owner", "scripts/business/check-dormitory-scenario11-housekeeping-maintenance-outofservice-authority.mjs", "artifacts/oam/checks/dormitory-scenario11-housekeeping-maintenance-outofservice-authority-result.json", "房务、维修与停售协同 Source Authority，只能人工维护；定义场景包 11 的保洁、维修、检查、停售建议、恢复建议、费用意向和证据边界。"),
  entry("docs/business/domains/dormitory/dormitory-scenario12-channel-corporate-customer.authority.json", "current_domain_kernel", "domain-owner", "scripts/business/check-dormitory-scenario12-channel-corporate-customer-authority.mjs", "artifacts/oam/checks/dormitory-scenario12-channel-corporate-customer-authority-result.json", "渠道与企业客户 Source Authority，只能人工维护；定义场景包 12 的渠道、企业客户、协议、商品资格、发布规则、佣金/结算意向和证据边界。"),
  entry("docs/business/domains/dormitory/dormitory-scenario13-reporting-audit-review.authority.json", "current_domain_kernel", "domain-owner", "scripts/business/check-dormitory-scenario13-reporting-audit-review-authority.mjs", "artifacts/oam/checks/dormitory-scenario13-reporting-audit-review-authority-result.json", "经营报表、审计与复盘 Source Authority，只能人工维护；定义场景包 13 的报表、指标、审计、复盘、行动计划、只读治理和 finance-gate 读取边界。")
];
const requiredGeneratedEntries = [
  entry("docs/oam/domain-derived-contracts.json", "current_system_kernel", "oam-release-owner", "scripts/oam/check-derived-contract-consistency.mjs", "artifacts/oam/checks/derived-contract-consistency-result.json", "领域派生 manifest，只登记由领域内核生成的视图。"),
  entry("docs/oam/generated-contracts-manifest.json", "current_system_kernel", "oam-release-owner", "scripts/oam/check-derived-contract-consistency.mjs", "artifacts/oam/checks/derived-contract-consistency-result.json", "生成合同 manifest，只登记 runtime/surface/search/lens/test 合同。")
];

const sourceSet = new Set(sourceLayerWhitelist);
const index = readJson(indexPath);
const entries = new Map((index.entries ?? []).map((item) => [slash(item.path), item]));
for (const item of requiredSourceEntries) {
  if (!entries.has(item.path)) entries.set(item.path, item);
}
for (const item of requiredGeneratedEntries) {
  if (!entries.has(item.path)) entries.set(item.path, item);
}

index.classificationModel = {
  version: "oam.authority-classification.v1",
  status: "authoritative",
  architecture: "oam.current",
  decisionRuleZh: "layer、authorityRole 和显式写权字段是当前权威分类决策源；currentTruthAllowed 仅作为兼容派生字段。",
  currentTruthAllowedCompatibilityZh: "旧 checker 暂时可读取 currentTruthAllowed，但不得把它作为唯一权威判断。",
  layers: ["source", "generated", "runtime", "evidence", "manual"],
  authorityRoles: [
    "architectureRoot",
    "sourceKernel",
    "policySource",
    "generatedContract",
    "validationSchema",
    "runtimeImplementation",
    "databaseAsset",
    "evidenceProof",
    "humanManual"
  ],
  sourceLayerWhitelist
};
index.sourceLayerWhitelist = sourceLayerWhitelist.map((path) => ({
  path,
  reasonZh: sourceReason(path)
}));

index.entries = [...entries.values()]
  .map((item) => classifyEntry({ ...item, path: slash(item.path) }))
  .sort((left, right) => left.path.localeCompare(right.path));

writeJson(indexPath, index);
console.log(`Authority classification normalized: ${indexPath}`);
console.log(`entries=${index.entries.length} source=${index.entries.filter((item) => item.layer === "source").length}`);

function classifyEntry(item) {
  const classification = classifyPath(item.path, item.identity);
  const generated = classification.layer === "generated";
  const evidence = item.evidence ?? classification.evidence ?? "artifacts/oam/evidence/evidence-graph.json";
  const currentTruthAllowed = classification.layer === "source" && classification.compatibilityTruthAllowed !== false;
  const base = {
    ...item,
    identity: item.identity ?? classification.identity,
    owner: item.owner ?? classification.owner,
    checker: item.checker ?? classification.checker,
    evidence,
    currentTruthAllowed,
    layer: classification.layer,
    authorityRole: classification.authorityRole,
    businessFactAuthorityAllowed: classification.businessFactAuthorityAllowed,
    contractAuthorityAllowed: classification.contractAuthorityAllowed,
    runtimeWriteAllowed: classification.runtimeWriteAllowed,
    financeLedgerTruthAllowed: classification.financeLedgerTruthAllowed,
    readModelTruthAllowed: classification.readModelTruthAllowed,
    manualEditAllowed: classification.manualEditAllowed,
    generated,
    doNotEdit: generated,
    checkerRef: item.checker ?? classification.checker,
    evidenceRef: evidence,
    responsibilityZh: classification.responsibilityZh,
    notesZh: classification.notesZh ?? item.notesZh
  };
  delete base.generatedFrom;
  delete base.sourceRefs;
  if (generated) {
    base.generatedFrom = classification.generatedFrom;
  } else {
    base.sourceRefs = classification.sourceRefs;
  }
  return base;
}

function classifyPath(file, identity) {
  if (sourceSet.has(file)) return sourceClassification(file, identity);
  if (file === "artifacts/oam/evidence" || identity === "current_evidence_asset") {
    return {
      layer: file.startsWith("docs/contracts/evidence/") ? "generated" : "evidence",
      authorityRole: file.startsWith("docs/contracts/evidence/") ? "generatedContract" : "evidenceProof",
      businessFactAuthorityAllowed: false,
      contractAuthorityAllowed: file.startsWith("docs/contracts/evidence/"),
      runtimeWriteAllowed: false,
      financeLedgerTruthAllowed: false,
      readModelTruthAllowed: false,
      manualEditAllowed: false,
      generatedFrom: ["docs/oam/system-operating-kernel.json", "docs/oam/oam-kernel-graph.json"],
      sourceRefs: ["docs/oam/current-authority-index.json"],
      responsibilityZh: "证据或证据合同只证明执行状态，不定义业务事实。"
    };
  }
  if (isGeneratedContract(file)) {
    return {
      layer: "generated",
      authorityRole: "generatedContract",
      businessFactAuthorityAllowed: false,
      contractAuthorityAllowed: true,
      runtimeWriteAllowed: false,
      financeLedgerTruthAllowed: false,
      readModelTruthAllowed: false,
      manualEditAllowed: false,
      generatedFrom: generatedFromFor(file),
      sourceRefs: undefined,
      responsibilityZh: "机器派生合同只能被消费和校验，不得作为人工业务事实 Source。"
    };
  }
  if (file.startsWith("infra/db/migrations")) {
    return runtime("databaseAsset", "数据库 migration 是运行时数据库资产，不定义 Source 业务事实。");
  }
  if (file.startsWith("services/")) {
    return runtime("runtimeImplementation", "Runtime 实现只能消费 Source 边界或 generated contract，不重新解释业务权威。");
  }
  if (file.startsWith("apps/") || file.startsWith("packages/")) {
    return runtime("runtimeImplementation", "Surface 实现只展示、解释和触发已准入动作，不写业务事实权威。");
  }
  if (file.startsWith("schemas/") || file.includes("/schema")) {
    return runtime("validationSchema", "Schema 只验证结构，不拥有业务事实权威。");
  }
  if (file.startsWith("scripts/") || file.startsWith(".github/") || file.startsWith("tests/")) {
    return runtime("validationSchema", "门禁、CI 和测试只验证边界，不承载业务事实权威。");
  }
  if (identity === "current_manual" || file.endsWith(".md")) {
    return {
      layer: "manual",
      authorityRole: "humanManual",
      businessFactAuthorityAllowed: false,
      contractAuthorityAllowed: false,
      runtimeWriteAllowed: false,
      financeLedgerTruthAllowed: false,
      readModelTruthAllowed: false,
      manualEditAllowed: true,
      sourceRefs: ["docs/oam/current-authority-index.json"],
      responsibilityZh: "人读说明只能解释当前权威，不定义业务事实。"
    };
  }
  return runtime("validationSchema", "保留文件默认只作为工程支撑，不定义业务事实权威。");
}

function sourceClassification(file, identity) {
  const role = sourceRole(file);
  return {
    layer: "source",
    authorityRole: role,
    businessFactAuthorityAllowed: businessFactSource(file),
    contractAuthorityAllowed: role !== "humanManual",
    runtimeWriteAllowed: false,
    financeLedgerTruthAllowed: file === "docs/finance/finance-ledger-kernel.json",
    readModelTruthAllowed: file === "docs/read-intelligence/read-intelligence-kernel.json",
    manualEditAllowed: true,
    generatedFrom: undefined,
    sourceRefs: sourceRefsFor(file),
    responsibilityZh: sourceReason(file),
    identity
  };
}

function runtime(authorityRole, responsibilityZh) {
  return {
    layer: authorityRole === "databaseAsset" ? "runtime" : "runtime",
    authorityRole,
    businessFactAuthorityAllowed: false,
    contractAuthorityAllowed: false,
    runtimeWriteAllowed: authorityRole === "runtimeImplementation" || authorityRole === "databaseAsset",
    financeLedgerTruthAllowed: false,
    readModelTruthAllowed: false,
    manualEditAllowed: true,
    sourceRefs: ["docs/oam/current-authority-index.json"],
    responsibilityZh
  };
}

function isGeneratedContract(file) {
  return file === "docs/oam/system-derived-contracts.json" ||
    file === "docs/oam/domain-derived-contracts.json" ||
    file === "docs/oam/generated-contracts-manifest.json" ||
    file === "docs/system/current-system-map.md" ||
    file.startsWith("docs/contracts/generated/") ||
    file.startsWith("docs/contracts/business/") ||
    file.startsWith("docs/contracts/definition/") ||
    file.startsWith("docs/contracts/read/") ||
    file.startsWith("docs/contracts/search/") ||
    file.startsWith("docs/contracts/bi-kpi/") ||
    file.startsWith("docs/contracts/evidence/") ||
    file.startsWith("docs/contracts/admission/") ||
    file.startsWith("docs/business/domains/dormitory/workitems/") ||
    (file.startsWith("docs/business/domains/dormitory/") && file !== "docs/business/domains/dormitory/dormitory-operating-kernel.json") ||
    file.startsWith("docs/business/dormitory/") ||
    file.startsWith("docs/scenarios/dormitory/");
}

function generatedFromFor(file) {
  if (file.startsWith("docs/business/") || file.startsWith("docs/scenarios/")) {
    return ["docs/business/domains/dormitory/dormitory-operating-kernel.json"];
  }
  if (file.startsWith("docs/contracts/generated/")) {
    return ["docs/business/domains/dormitory/dormitory-operating-kernel.json", "docs/oam/oam-kernel-graph.json"];
  }
  return ["docs/oam/system-operating-kernel.json", "docs/oam/oam-kernel-graph.json"];
}

function sourceRole(file) {
  if (file.includes("current-architecture") || file.endsWith("oam.current.json") || file.includes("responsibility-map") || file.endsWith("current-authority-index.json") || file.endsWith("oam-kernel-graph.json")) {
    return "architectureRoot";
  }
  if (file.includes("kernel") || file.includes("truth-owner") || file.includes("finance-ledger") || file.includes("identity-permission") || file.includes("surface-contract") || file.includes("language-contract") || file.includes("dormitory-13-scenario-control") || file.includes("dormitory-scenario") || file.includes("lodging-scenario-package-index")) {
    return "sourceKernel";
  }
  return "policySource";
}

function businessFactSource(file) {
  return [
    "docs/business/business-line-registry.json",
    "docs/business/admission/business-line-levels.yml",
    "docs/oam/current-admission-state.json",
    "docs/business/truth-owner-registry.yml",
    "docs/business/domains/dormitory/dormitory-operating-kernel.json",
    "docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json",
    "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json",
    "docs/business/domains/dormitory/dormitory-scenario1-benchmark-inheritance.authority.json",
    "docs/business/domains/dormitory/dormitory-scenario1-resource-basic-readiness.authority.json",
    "docs/business/domains/dormitory/dormitory-scenario2-resource-operation-status.authority.json",
    "docs/business/domains/dormitory/dormitory-scenario3-product-and-pricing.authority.json",
    "docs/business/domains/dormitory/dormitory-scenario4-inquiry-and-quote.authority.json",
    "docs/business/domains/dormitory/dormitory-scenario5-reservation-and-inventory-hold.authority.json",
    "docs/business/domains/dormitory/dormitory-scenario6-payment-deposit-and-guarantee.authority.json",
    "docs/business/domains/dormitory/dormitory-scenario7-check-in-processing.authority.json",
    "docs/business/domains/dormitory/dormitory-scenario8-in-stay-management.authority.json",
    "docs/business/domains/dormitory/dormitory-scenario9-checkout-settlement.authority.json",
    "docs/business/domains/dormitory/dormitory-scenario10-cancel-noshow-refund.authority.json",
    "docs/business/domains/dormitory/dormitory-scenario11-housekeeping-maintenance-outofservice.authority.json",
    "docs/business/domains/dormitory/dormitory-scenario12-channel-corporate-customer.authority.json",
    "docs/business/domains/dormitory/dormitory-scenario13-reporting-audit-review.authority.json",
    "docs/business/domains/dormitory/dormitory-bed-cardinality.authority.json",
    "docs/business/domains/dormitory/dormitory-command-contracts.authority.json",
    "docs/business/domains/dormitory/dormitory-failure-semantics.authority.json",
    "docs/business/domains/dormitory/dormitory-first-golden-chain.capability-decision.authority.json",
    "docs/business/domains/dormitory/dormitory-invariants.authority.json",
    "docs/business/domains/dormitory/dormitory-object-graph.authority.json",
    "docs/business/domains/finance/finance-operating-kernel.json",
    "docs/business/domains/maintenance/maintenance-operating-kernel.json",
    "docs/finance/finance-ledger-kernel.json",
    "docs/identity/identity-permission-kernel.json"
  ].includes(file);
}

function sourceReason(file) {
  if (file.includes("current-architecture") || file.endsWith("oam.current.json") || file.includes("responsibility-map") || file.endsWith("current-authority-index.json") || file.endsWith("oam-kernel-graph.json")) {
    return "架构权威 Source，定义当前 OAM 结构、边界和权威入口。";
  }
  if (file.includes("dormitory-operating-kernel")) return "宿舍领域唯一 Source，派生文件不得覆盖它。";
  if (file.includes("dormitory-13-scenario-control")) return "住宿经营 13 场景总控 Source Authority，只能人工维护；旧场景包只能作为迁移参考。";
  if (file.includes("lodging-scenario-package-index")) return "住宿经营场景包总索引 Source Authority，只能人工维护；旧项目表达只能作为迁移参考。";
  if (file.includes("dormitory-scenario1-benchmark-inheritance")) return "场景 1 标杆继承合同 Source Authority，只能人工维护；定义后续场景方法继承、启动门禁、差异模板和证据分层。";
  if (file.includes("dormitory-scenario1-resource-basic-readiness")) return "房源建档与基础就绪 Source Authority，只能人工维护；定义场景包 1 的对象、步骤、字段、CRUD、证据和边界。";
  if (file.includes("dormitory-scenario2-resource-operation-status")) return "房源运营就绪与状态维护 Source Authority，只能人工维护；定义场景包 2 的运营检查、状态维护、阻断和恢复边界。";
  if (file.includes("dormitory-scenario3-product-and-pricing")) return "住宿商品与价格 Source Authority，只能人工维护；定义场景包 3 的商品、价格方案、价格日历、版本和证据边界。";
  if (file.includes("dormitory-scenario4-inquiry-and-quote")) return "询价与报价 Source Authority，只能人工维护；定义场景包 4 的客户询价、入住需求、报价版本、价格快照和转预订准备边界。";
  if (file.includes("dormitory-scenario5-reservation-and-inventory-hold")) return "预订与库存锁定 Source Authority，只能人工维护；定义场景包 5 的可订复核、库存锁定、预订确认、预订号和下游入住办理边界。";
  if (file.includes("dormitory-scenario6-payment-deposit-and-guarantee")) return "收款、押金与担保 Source Authority，只能人工维护；定义场景包 6 的应收、押金、担保、凭证、finance-gate 和下游入住办理边界。";
  if (file.includes("dormitory-scenario7-check-in-processing")) return "入住办理 Source Authority，只能人工维护；定义场景包 7 的预订承接、身份核验、协议确认、房间/床位交付、确认入住和入住凭证边界。";
  if (file.includes("dormitory-scenario8-in-stay-management")) return "在住管理 Source Authority，只能人工维护；定义场景包 8 的在住状态、服务、异常、续住、换房换床、凭证和退房准备边界。";
  if (file.includes("dormitory-scenario9-checkout-settlement")) return "退房结算 Source Authority，只能人工维护；定义场景包 9 的退房办理、交接、验房、费用核算、押金抵扣、财务请求和资源恢复边界。";
  if (file.includes("dormitory-scenario10-cancel-noshow-refund")) return "取消、未到店与退款处理 Source Authority，只能人工维护；定义场景包 10 的取消、未到店、政策金额、库存释放、退款/扣费请求和 finance-gate 边界。";
  if (file.includes("dormitory-scenario11-housekeeping-maintenance-outofservice")) return "房务、维修与停售协同 Source Authority，只能人工维护；定义场景包 11 的保洁、维修、检查、停售建议、恢复建议、费用意向和证据边界。";
  if (file.includes("dormitory-scenario12-channel-corporate-customer")) return "渠道与企业客户 Source Authority，只能人工维护；定义场景包 12 的渠道、企业客户、协议、商品资格、发布规则、佣金/结算意向和证据边界。";
  if (file.includes("dormitory-scenario13-reporting-audit-review")) return "经营报表、审计与复盘 Source Authority，只能人工维护；定义场景包 13 的报表、指标、审计、复盘、行动计划、只读治理和 finance-gate 读取边界。";
  if (file.includes("finance-ledger")) return "Finance / Ledger Source，只有它可以定义账务真值边界。";
  if (file.includes("read-intelligence")) return "读侧智能 Source，只定义读侧消费边界，不写业务事实。";
  if (file.includes("surface-contract")) return "Surface Source，只定义展示、解释和交互边界。";
  if (file.includes("database")) return "数据库 ownership 边界 Source；具体 migration 不得作为业务 Source。";
  return "少而硬的 Source Layer 权威输入，只能人工维护。";
}

function sourceRefsFor(file) {
  if (file === "docs/oam/current-authority-index.json") return ["docs/oam/current-architecture.md", "docs/contracts/oam.current.json"];
  return ["docs/oam/current-authority-index.json"];
}

function entry(path, identity, owner, checker, evidence, notesZh) {
  return { path, identity, owner, checker, evidence, currentTruthAllowed: true, notesZh };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(path.join(root, file), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function slash(value) {
  return String(value).replace(/\\/g, "/");
}
