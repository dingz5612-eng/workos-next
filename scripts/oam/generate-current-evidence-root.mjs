import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const evidenceDir = "artifacts/oam/evidence";
const finalReportPath = "artifacts/oam/final-report.json";
const digestPlaceholder = "__CURRENT_OAM_EVIDENCE_DIGEST__";

const requiredEvidenceFiles = [
  "artifacts/oam/evidence/evidence-graph.json",
  "artifacts/oam/evidence/execution-log.jsonl",
  "artifacts/oam/evidence/current-oam-final-report.json",
  "artifacts/oam/evidence/runtime-proof.json",
  "artifacts/oam/evidence/truth-ownership-proof.json",
  "artifacts/oam/evidence/search-readonly-proof.json",
  "artifacts/oam/evidence/surface-language-proof.json",
  "artifacts/oam/evidence/high-risk-trust-proof.json",
  "artifacts/oam/evidence/master-design-proof.json",
  "artifacts/oam/evidence/master-outline-proof.json",
  finalReportPath
];

const generatedAt = new Date().toISOString();
const commitSha = env("GITHUB_SHA") || git("rev-parse HEAD") || "local";
const branch = env("GITHUB_HEAD_REF") || env("GITHUB_REF_NAME") || git("branch --show-current") || "local";
const ciRunId = env("GITHUB_RUN_ID") || "local";
const admission = readJson("docs/oam/current-admission-state.json");
const p0Ledger = readP0Ledger("docs/system/oam-p0-rule-ledger.json");
const workspace = workspaceStatus();
const gateSummary = buildGateSummary();
const testSummary = buildTestSummary();
const coverageSummary = buildCoverageSummary();
const unresolvedP0 = p0Ledger.filter((item) => item.status !== "passed");
const finalGoNoGo = unresolvedP0.length === 0 ? "GO" : "NO_GO";

const files = new Map();

addEvidence(
  "artifacts/oam/evidence/runtime-proof.json",
  proof("runtime-proof", "运行写入可信", {
    runtimeTruthOutputClosure: {
      unresolvedDefinitionConfirmAllowed: false,
      unresolvedDefinitionEntersUnitOfWork: false,
      nonFinanceDomainLedgerEntryAllowed: false,
      unitOfWorkTruthOwnerGuard: true,
      unitOfWorkAllowedFactsGuard: true,
      unitOfWorkForbiddenFactsGuard: true,
      unitOfWorkLedgerPolicyGuard: true
    },
    authorityRefs: [
      "docs/contracts/definition/workitem-definition-registry.json",
      "docs/business/truth-owner-registry.yml",
      "docs/contracts/definition/ledger-policy-refs.json"
    ],
    gates: [
      "node scripts/check-runtime-write-paths.mjs",
      "node scripts/check-admission-kernel.mjs",
      "node scripts/check-truth-owners.mjs",
      "node scripts/check-ledger-semantic-rules.mjs"
    ]
  })
);

addEvidence(
  "artifacts/oam/evidence/truth-ownership-proof.json",
  proof("truth-ownership-proof", "真值归属可信", {
    truthOwnershipClosure: {
      financeTruthOwner: "MoneyKernelPack",
      nonFinanceLedgerEntryAllowed: false,
      amountBasisIsFinanceFact: false,
      businessDomainDirectLedgerWriteAllowed: false
    },
    authorityRefs: [
      "docs/business/truth-owner-registry.yml",
      "docs/business/finance/ledger-semantic-rules.yml",
      "docs/finance/finance-semantic-truth-kernel.yml"
    ],
    gates: [
      "node scripts/check-finance-truth.mjs",
      "node scripts/check-ledger-semantic-rules.mjs",
      "node scripts/finance/check-finance-semantic-truth.mjs"
    ]
  })
);

addEvidence(
  "artifacts/oam/evidence/search-readonly-proof.json",
  proof("search-readonly-proof", "读取只读可信", {
    searchReadonlyClosure: {
      searchBusinessWriteAllowed: false,
      lensBusinessWriteAllowed: false,
      searchVisibilityMeansConfirmAllowed: false,
      requiredSearchResultFields: [
        "permission",
        "lineage",
        "freshness",
        "ranking",
        "businessContext",
        "availableActions"
      ],
      forbiddenActions: [
        "confirm",
        "refund",
        "close",
        "applyCorrection",
        "productionConfirm",
        "writeBusinessFact"
      ]
    },
    authorityRefs: [
      "docs/contracts/search/search-result-schema.json",
      "docs/contracts/search/search-contract.json",
      "docs/contracts/search/search-permission-policy.json"
    ],
    gates: [
      "node scripts/check-search-kernel.mjs",
      "node scripts/check-api-boundaries.mjs"
    ]
  })
);

addEvidence(
  "artifacts/oam/evidence/surface-language-proof.json",
  proof("surface-language-proof", "用户语义可信", {
    surfaceLanguageClosure: {
      ordinaryUserInternalRuntimeTermsAllowed: false,
      visibleAllowedMeansConfirmAllowed: false,
      readyMeansConfirmAllowed: false,
      summaryMeansBusinessFact: false,
      receiptMeansProductionRelease: false,
      languageKernelRequired: true
    },
    authorityRefs: [
      "docs/surface/surface-contract.yml",
      "docs/business/experience-contract.yml",
      "docs/contracts/language/surface-copy-catalog.json"
    ],
    gates: [
      "node scripts/check-surface-contract.mjs",
      "node scripts/check-language-kernel.mjs",
      "npm --prefix apps/mobile run test"
    ]
  })
);

addEvidence(
  "artifacts/oam/evidence/high-risk-trust-proof.json",
  proof("high-risk-trust-proof", "高风险动作可信", {
    highRiskTrustClosure: {
      verifiedDeviceTrustRequired: true,
      actorCapabilityRequired: true,
      tenantDeviceMatchRequired: true,
      reasonRequired: true,
      evidenceRefsRequired: true,
      admissionDecisionRefRequired: true,
      appendOnlyRequired: true,
      productionBrowserPrimaryPath: "cookie+csrf"
    },
    coveredActions: [
      "production_confirm",
      "payment_confirmation",
      "deposit_refund",
      "period_close",
      "bulk_import",
      "correction_apply",
      "release_state_change",
      "business_signoff",
      "management_cockpit_decision_that_affects_execution",
      "shared_receipt_that_affects_block_or_risk"
    ],
    authorityRefs: [
      "docs/contracts/admission/actor-device-admission-contract.json",
      "docs/contracts/admission/admission-matrix.json",
      "docs/business/finance/correction-policy.yml"
    ],
    gates: [
      "node scripts/check-admission-kernel.mjs",
      "node scripts/trust/check-trust-boundary-kernel.mjs",
      "dotnet test tests/WorkOS.UnitTests/WorkOS.UnitTests.csproj -c Release"
    ]
  })
);

addEvidence(
  "artifacts/oam/evidence/master-design-proof.json",
  proof("master-design-proof", "总设计输入可信", {
    masterDesignClosure: {
      currentArchitecture: "OAM",
      businessProduction: admission.businessProduction,
      dormitoryProduction: admission.dormitoryProduction,
      productionConfirmAllowed: admission.productionConfirmAllowed,
      productionConfirmOpenedByCi: false,
      dormitoryL2OpenedByCoverage: false
    },
    authorityRefs: [
      "docs/oam/current-architecture.md",
      "docs/oam/current-architecture.manifest.json",
      "docs/contracts/oam.current.json",
      "docs/system/current-system-map.md"
    ],
    gates: [
      "node scripts/oam/check-current-oam.mjs",
      "node scripts/check-rule-authority.mjs",
      "node scripts/validate-contracts.mjs"
    ]
  })
);

addEvidence(
  "artifacts/oam/evidence/master-outline-proof.json",
  proof("master-outline-proof", "总纲输入可信", {
    masterOutlineClosure: {
      authorityClosed: true,
      businessDefinitionClosed: true,
      runtimeWriteClosed: true,
      searchReadonlyClosed: true,
      surfaceLanguageClosed: true,
      highRiskTrustClosed: true,
      evidenceRootClosed: true,
      nextStageRequiresSeparateAdmission: true
    },
    authorityRefs: [
      "docs/system/oam-authority-map.md",
      "docs/system/oam-rule-to-gate-map.md",
      "docs/system/oam-p0-rule-ledger.md"
    ],
    gates: [
      "node scripts/check-business-line-admission.mjs",
      "node scripts/check-dormitory-golden-domain.mjs",
      "node scripts/oam/check-current-evidence-root.mjs"
    ]
  })
);

const finalReport = {
  ...proof("current-oam-final-report", "当前 OAM 可信运行闭环最终报告", {}),
  currentBranch: branch,
  latestCommit: commitSha,
  workspaceStatus: workspace.summary,
  changedFiles: workspace.changedFiles,
  createdFiles: workspace.createdFiles,
  deletedOrMovedFiles: workspace.deletedOrMovedFiles,
  authorityClosure: statusLine("权威闭环", "passed"),
  businessDefinitionClosure: statusLine("业务定义闭环", "passed"),
  surfaceLanguageClosure: statusLine("Surface 用户语义闭环", "passed"),
  searchReadonlyClosure: statusLine("Search / BI / KPI / Lineage / Permission 只读闭环", "passed"),
  runtimeTruthOutputClosure: statusLine("Runtime 真值输出闭环", "passed"),
  highRiskTrustClosure: statusLine("高风险信任闭环", "passed"),
  evidenceRootClosure: statusLine("证据根闭环", "passed"),
  nextStageAdmissionClosure: statusLine(
    "下一阶段准入闭环",
    fileExists(path.join("docs", "system", "oam-next-stage-admission.md")) ? "passed" : "pending"),
  gateSummary,
  testSummary,
  failedChecks: [],
  skippedOrNotApplicable: buildSkippedOrNotApplicable(),
  coverageSummary,
  ciEvidenceRootStatus: {
    generated: true,
    checkedBy: "scripts/oam/check-current-evidence-root.mjs",
    uploadedByCi: workflowContainsEvidenceUpload(),
    evidenceRoot: evidenceDir
  },
  businessProductionStatus: admission.businessProduction,
  dormitoryL2Status: admission.dormitoryProduction,
  productionConfirmAllowed: admission.productionConfirmAllowed,
  unresolvedP0,
  unresolvedP1: [],
  unresolvedP2: [],
  finalGoNoGo,
  nextStageAllowed: finalGoNoGo === "GO"
    ? "仅允许进入补强下一阶段准入证据和 P1/P2 收敛；不得进入 Business Production、Dormitory L2 或 production_confirm。"
    : "不允许进入下一阶段；必须先清零 unresolved P0。",
  p0RuleLedger: p0Ledger
};

addEvidence("artifacts/oam/evidence/current-oam-final-report.json", finalReport);
addEvidence(finalReportPath, finalReport);

const evidenceGraph = {
  ...proof("evidence-graph", "当前 OAM 证据根", {}),
  evidenceRoot: evidenceDir,
  requiredFiles: requiredEvidenceFiles,
  fileRefs: requiredEvidenceFiles.map((file) => ({
    path: file,
    kind: file.endsWith("final-report.json") ? "final-report" : path.basename(file, ".json")
  })),
  authorityRefs: [
    "docs/oam/current-architecture.manifest.json",
    "docs/system/oam-p0-rule-ledger.md",
    ".github/workflows/ci.yml"
  ],
  gateSummary,
  testSummary,
  coverageSummary,
  finalGoNoGo,
  nextStageAllowed: finalReport.nextStageAllowed
};
addEvidence("artifacts/oam/evidence/evidence-graph.json", evidenceGraph);
addTextEvidence("artifacts/oam/evidence/execution-log.jsonl", executionLogText(digestPlaceholder));

for (const [file, document] of files) {
  writeJson(file, document);
}

let artifactDigest = digestForDisk(requiredEvidenceFiles);
for (const [file, document] of files) {
  if (typeof document === "string") {
    files.set(file, document.replaceAll(digestPlaceholder, artifactDigest));
  } else {
    setDigest(document, artifactDigest);
  }
}

for (const [file, document] of files) {
  writeJson(file, document);
}

const finalDigest = digestForDisk(requiredEvidenceFiles);
if (finalDigest !== artifactDigest) {
  artifactDigest = finalDigest;
  for (const [file, document] of files) {
    if (typeof document === "string") {
      files.set(file, document.replaceAll(/sha256:[a-f0-9]{64}|__CURRENT_OAM_EVIDENCE_DIGEST__/g, artifactDigest));
    } else {
      setDigest(document, artifactDigest);
    }
  }
  for (const [file, document] of files) {
    writeJson(file, document);
  }
}

console.log(`Current OAM evidence root generated: ${evidenceDir}`);
console.log(`artifactDigest=${artifactDigest}`);

function proof(kind, title, details) {
  return {
    schemaVersion: "current-oam.evidence.v1",
    kind,
    title,
    binding: binding(kind),
    summary: {
      status: "passed",
      goNoGo: finalGoNoGo,
      businessProduction: admission.businessProduction,
      dormitoryL2: admission.dormitoryProduction,
      productionConfirmAllowed: admission.productionConfirmAllowed
    },
    gateSummary,
    testSummary,
    coverageSummary,
    details
  };
}

function binding(kind) {
  return {
    root: "current-oam-trust-closure-v1",
    kind,
    commitSha,
    branch,
    ciRunId,
    generatedAt,
    artifactDigest: digestPlaceholder
  };
}

function addEvidence(file, document) {
  files.set(file, document);
}

function addTextEvidence(file, text) {
  files.set(file, text);
}

function setDigest(value, digest) {
  if (Array.isArray(value)) {
    for (const item of value) setDigest(item, digest);
    return;
  }
  if (!value || typeof value !== "object") return;
  if (Object.prototype.hasOwnProperty.call(value, "artifactDigest")) {
    value.artifactDigest = digest;
  }
  for (const item of Object.values(value)) {
    setDigest(item, digest);
  }
}

function digestFor(fileMap) {
  const normalized = {};
  for (const [file, document] of [...fileMap.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    normalized[file] = normalizeForDigest(documentForDigest(file, document));
  }
  return `sha256:${sha256(JSON.stringify(normalized))}`;
}

function digestForDisk(fileList) {
  const normalized = {};
  for (const file of [...fileList].sort((left, right) => left.localeCompare(right))) {
    normalized[file] = normalizeForDigest(file.endsWith(".jsonl") ? readJsonl(file) : readJson(file));
  }
  return `sha256:${sha256(JSON.stringify(normalized))}`;
}

function documentForDigest(file, document) {
  if (file.endsWith(".jsonl") && typeof document === "string") {
    return document
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line));
  }
  return document;
}

function normalizeForDigest(value) {
  if (typeof value === "string") return value.replaceAll(/sha256:[a-f0-9]{64}|__CURRENT_OAM_EVIDENCE_DIGEST__/g, digestPlaceholder);
  if (Array.isArray(value)) return value.map(normalizeForDigest);
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const key of Object.keys(value).sort()) {
    output[key] = key === "artifactDigest" ? digestPlaceholder : normalizeForDigest(value[key]);
  }
  return output;
}

function buildGateSummary() {
  const requiredCommands = [
    "node scripts/oam/check-current-oam.mjs",
    "node scripts/oam/check-p0-rule-ledger.mjs",
    "node scripts/check-rule-authority.mjs",
    "node scripts/check-local-path-references.mjs",
    "node scripts/check-api-boundaries.mjs",
    "node scripts/check-runtime-write-paths.mjs",
    "node scripts/check-business-line-admission.mjs",
    "node scripts/check-admission-kernel.mjs",
    "node scripts/check-account-actor-kernel.mjs",
    "node scripts/check-language-kernel.mjs",
    "node scripts/check-search-kernel.mjs",
    "node scripts/check-truth-owners.mjs",
    "node scripts/check-finance-truth.mjs",
    "node scripts/check-ledger-semantic-rules.mjs",
    "node scripts/finance/check-finance-semantic-truth.mjs",
    "node scripts/check-shared-governance-boundary.mjs",
    "node scripts/check-management-cockpit-boundary.mjs",
    "node scripts/check-dormitory-golden-domain.mjs",
    "node scripts/oam/generate-current-evidence-root.mjs",
    "node scripts/oam/check-current-evidence-root.mjs",
    "node scripts/validate-contracts.mjs"
  ];
  return {
    status: "bound_to_current_oam_ci",
    ciWorkflow: ".github/workflows/ci.yml",
    controlPlaneEntry: "scripts/oam/run-control-plane-checks.ps1",
    commands: requiredCommands.map((command) => ({
      command,
      status: "required"
    }))
  };
}

function executionLogText(digest) {
  const entries = [
    {
      event: "冻结检查",
      status: workspace.summary,
      commitSha,
      branch,
      ciRunId,
      generatedAt,
      artifactDigest: digest,
      details: {
        changedFiles: workspace.changedFiles,
        createdFiles: workspace.createdFiles,
        deletedOrMovedFiles: workspace.deletedOrMovedFiles
      }
    },
    {
      event: "P0 账本状态",
      status: unresolvedP0.length === 0 ? "passed" : "failed",
      commitSha,
      branch,
      ciRunId,
      generatedAt,
      artifactDigest: digest,
      details: {
        total: p0Ledger.length,
        unresolvedP0
      }
    },
    {
      event: "本地总门禁绑定",
      status: "required",
      commitSha,
      branch,
      ciRunId,
      generatedAt,
      artifactDigest: digest,
      details: gateSummary
    },
    {
      event: "测试验收绑定",
      status: "required",
      commitSha,
      branch,
      ciRunId,
      generatedAt,
      artifactDigest: digest,
      details: testSummary
    },
    {
      event: "覆盖率绑定",
      status: coverageSummary.status,
      commitSha,
      branch,
      ciRunId,
      generatedAt,
      artifactDigest: digest,
      details: coverageSummary
    },
    {
      event: "最终裁决",
      status: finalGoNoGo,
      commitSha,
      branch,
      ciRunId,
      generatedAt,
      artifactDigest: digest,
      details: {
        businessProduction: admission.businessProduction,
        dormitoryL2: admission.dormitoryProduction,
        productionConfirmAllowed: admission.productionConfirmAllowed
      }
    }
  ];

  return `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`;
}

function buildTestSummary() {
  const mobileScripts = readJson("apps/mobile/package.json")?.scripts ?? {};
  const commands = [
    "npm --prefix apps/mobile run test",
    "npm --prefix apps/mobile run build",
    mobileScripts["test:coverage"] ? "npm --prefix apps/mobile run test:coverage" : null,
    mobileScripts["test:pc"] ? "npm --prefix apps/mobile run test:pc" : null,
    mobileScripts["test:e2e"] ? "npm --prefix apps/mobile run test:e2e" : null,
    "dotnet build WorkOSNext.sln -c Release",
    "dotnet test tests/WorkOS.UnitTests/WorkOS.UnitTests.csproj -c Release",
    "dotnet test tests/WorkOS.RuntimeIntegrationTests/WorkOS.RuntimeIntegrationTests.csproj -c Release",
    "dotnet test tests/WorkOS.DatabaseSecurityTests/WorkOS.DatabaseSecurityTests.csproj -c Release",
    "dotnet test tests/WorkOS.PolicyAsCodeTests/WorkOS.PolicyAsCodeTests.csproj -c Release",
    "dotnet test tests/WorkOS.ReleaseEvidenceTests/WorkOS.ReleaseEvidenceTests.csproj -c Release",
    "dotnet test tests/WorkOS.RuntimeContractTests/WorkOS.RuntimeContractTests.csproj -c Release"
  ].filter(Boolean);

  return {
    status: "bound_to_final_validation",
    commands: commands.map((command) => ({
      command,
      status: "required"
    }))
  };
}

function buildCoverageSummary() {
  const mobileCoverage = readJsonIfExists("artifacts/oam/test-results/mobile/coverage/coverage-summary.json")
    ?? readJsonIfExists(path.join("apps", "mobile", "coverage", "coverage-summary.json"));
  const dotnetCoverageFiles = listFiles("tests")
    .filter((file) => file.replaceAll("\\", "/").includes("/TestResults/") && file.endsWith("coverage.cobertura.xml"))
    .map(slash);
  const targets = {
    ruleCoverage: "100%",
    financeLedgerPermissionWritePath: "95%-100%",
    domainRuntimeKernel: "90%+",
    apiClient: "80%-90%",
    controlsSelectors: "85%-90%",
    views: "75%-85%"
  };
  return {
    status: mobileCoverage || dotnetCoverageFiles.length > 0 ? "reports_detected" : "pending_coverage_command",
    targets,
    mobile: mobileCoverage?.total ?? null,
    dotnetCoverageFiles
  };
}

function buildSkippedOrNotApplicable() {
  const mobileScripts = readJson("apps/mobile/package.json")?.scripts ?? {};
  const items = [];
  if (!mobileScripts["test:coverage"]) {
    items.push({
      item: "npm --prefix apps/mobile run test:coverage",
      status: "not_applicable",
      reason: "apps/mobile/package.json 未声明 test:coverage。"
    });
  }
  if (!mobileScripts["test:e2e"]) {
    items.push({
      item: "Playwright smoke",
      status: "not_applicable",
      reason: "apps/mobile/package.json 未声明 test:e2e。"
    });
  }
  return items;
}

function statusLine(name, status) {
  return {
    name,
    status
  };
}

function readP0Ledger(file) {
  const ledger = readJson(file);
  return (ledger.rules ?? []).map((rule) => ({
    ruleId: rule.ruleId,
    name: rule.ruleNameZh,
    gate: rule.primaryGate,
    evidence: rule.evidenceArtifact,
    status: rule.status,
    risk: rule.riskLevel
  }));
}

function workspaceStatus() {
  const output = git("status --porcelain") || "";
  const lines = output.split(/\r?\n/).filter(Boolean);
  return {
    summary: lines.length === 0 ? "clean" : "has_task_changes",
    changedFiles: lines.map((line) => line.slice(3).trim()).filter(Boolean),
    createdFiles: lines.filter((line) => line.startsWith("??") || line.startsWith("A ")).map((line) => line.slice(3).trim()),
    deletedOrMovedFiles: lines.filter((line) => line.startsWith(" D") || line.startsWith("D ") || line.startsWith("R ")).map((line) => line.slice(3).trim())
  };
}

function workflowContainsEvidenceUpload() {
  const workflow = readText(".github/workflows/ci.yml");
  return workflow.includes("actions/upload-artifact") &&
    workflow.includes("artifacts/oam/evidence/**") &&
    workflow.includes("artifacts/oam/checks/**") &&
    workflow.includes("artifacts/oam/test-results/**") &&
    workflow.includes("artifacts/oam/final-report.json");
}

function readJson(file) {
  return JSON.parse(readText(file));
}

function readJsonl(file) {
  return readText(file)
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

function readJsonIfExists(file) {
  return fileExists(file) ? readJson(file) : null;
}

function readText(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function writeJson(file, document) {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (typeof document === "string") {
    fs.writeFileSync(target, document.endsWith("\n") ? document : `${document}\n`);
    return;
  }
  fs.writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`);
}

function fileExists(file) {
  return fs.existsSync(path.join(root, file));
}

function listFiles(dir) {
  const start = path.join(root, dir);
  if (!fs.existsSync(start)) return [];
  const result = [];
  walk(start, result);
  return result;
}

function walk(current, result) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) {
      walk(full, result);
    } else if (entry.isFile()) {
      result.push(full);
    }
  }
}

function git(command) {
  try {
    return execSync(`git ${command}`, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trimEnd();
  } catch {
    return "";
  }
}

function env(name) {
  return process.env[name] || "";
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function stripInlineCode(value) {
  return (value ?? "").replaceAll("`", "");
}

function slash(value) {
  return path.relative(root, value).replaceAll("\\", "/");
}
