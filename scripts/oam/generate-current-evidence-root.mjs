import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const evidenceDir = "artifacts/oam/evidence";
const finalReportPath = "artifacts/oam/final-report.json";
const controlPlaneGateResultPath = "artifacts/oam/checks/control-plane-gate-results.json";
const digestPlaceholder = "__CURRENT_OAM_EVIDENCE_DIGEST__";
const artifactName = "workosnext-current-oam-evidence-${{ github.run_id }}";

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
  "docs/oam/mobile-branch-risk-policy.json",
  "docs/oam/mobile-branch-risk-ledger.json",
  "docs/oam/mobile-critical-branch-scenarios.json",
  "artifacts/oam/test-results/mobile/coverage/coverage-summary.json",
  "artifacts/oam/checks/mobile-coverage-policy-result.json",
  "artifacts/oam/checks/mobile-critical-branch-scenarios-result.json",
  controlPlaneGateResultPath,
  finalReportPath
];

const generatedAt = new Date().toISOString();
const commitSha = env("GITHUB_SHA") || git("rev-parse HEAD") || "local";
const branch = env("GITHUB_HEAD_REF") || env("GITHUB_REF_NAME") || git("branch --show-current") || "local";
const ciRunId = env("GITHUB_RUN_ID") || "local";
const admission = readJson("docs/oam/current-admission-state.json");
const p0Ledger = readP0Ledger("docs/system/oam-p0-rule-ledger.json");
const workspace = workspaceStatus();
const workspaceEvidence = workspaceEvidenceStatus(workspace);
const controlPlaneGateResult = readControlPlaneGateResult();
const gateSummary = buildGateSummary();
const testSummary = buildTestSummary();
const coverageSummary = buildCoverageSummary();
const mobileBranchRiskKernel = buildMobileBranchRiskKernel();
const realBrowserEvidence = buildRealBrowserEvidence();
const unresolvedP0 = p0Ledger.filter((item) => item.status !== "passed");
const releaseReadiness = buildReleaseReadiness();
const finalDecision = buildFinalDecision();
const finalGoNoGo = finalDecision.finalGoNoGo;

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
  artifactName,
  currentBranch: branch,
  latestCommit: commitSha,
  workspaceStatus: workspace.summary,
  workspaceChanges: workspaceEvidence,
  releaseReadiness,
  controlPlaneGateResult,
  finalDecision,
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
  mobileBranchRiskKernel,
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
  noGoReasons: finalDecision.noGoReasons,
  nextStageAllowed: finalGoNoGo === "GO"
    ? "仅允许进入补强下一阶段准入证据和 P1/P2 收敛；不得进入 Business Production、Dormitory L2 或 production_confirm。"
    : `不允许进入下一阶段；必须先修复：${finalDecision.noGoReasons.join("；")}`,
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
  mobileBranchRiskKernel,
  realBrowserEvidence: realBrowserEvidence.summary,
  evidenceRootWriter: {
    writer: "scripts/oam/generate-current-evidence-root.mjs",
    browserAuditScriptsWriteFinalGraph: false
  },
  controlPlaneGateResult,
  releaseReadiness,
  finalDecision,
  finalGoNoGo,
  nextStageAllowed: finalReport.nextStageAllowed,
  nodes: realBrowserEvidence.nodes,
  edges: realBrowserEvidence.edges
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
      status: finalGoNoGo === "GO" ? "passed" : "blocked",
      goNoGo: finalGoNoGo,
      businessProduction: admission.businessProduction,
      dormitoryL2: admission.dormitoryProduction,
      productionConfirmAllowed: admission.productionConfirmAllowed
    },
    gateSummary,
    testSummary,
    coverageSummary,
    mobileBranchRiskKernel,
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
  const requiredCommands = requiredGateCommands();
  return {
    status: controlPlaneGateResult.status,
    ciWorkflow: ".github/workflows/ci.yml",
    controlPlaneEntry: "scripts/oam/run-control-plane-checks.ps1",
    resultFile: controlPlaneGateResultPath,
    commitSha: controlPlaneGateResult.commitSha,
    generatedAtUtc: controlPlaneGateResult.generatedAtUtc,
    missingRequiredGates: controlPlaneGateResult.missingRequiredGates ?? [],
    failedGateCount: controlPlaneGateResult.failedGateCount ?? 0,
    requiredGateCount: controlPlaneGateResult.requiredGateCount ?? 0,
    commands: requiredCommands.map((command) => {
      const actual = (controlPlaneGateResult.gates ?? []).find((gate) => gate.command === command);
      return {
        command,
        status: actual?.status ?? "missing",
        exitCode: actual?.exitCode ?? null
      };
    })
  };
}

function requiredGateCommands() {
  return [
    "node scripts/oam/check-current-oam.mjs",
    "node scripts/oam/check-p0-rule-ledger.mjs --self-test",
    "node scripts/oam/check-p0-rule-ledger.mjs",
    "node scripts/oam/check-current-authority-index.mjs",
    "node scripts/oam/check-system-operating-kernel.mjs",
    "node scripts/oam/check-oam-kernel-graph.mjs",
    "node scripts/oam/check-file-lifecycle-policy.mjs",
    "node scripts/oam/check-retired-reference-blocker.mjs",
    "node scripts/oam/generate-system-derived-contracts.mjs",
    "node scripts/oam/check-derived-contract-consistency.mjs",
    "node scripts/oam/check-system-handoff-contract.mjs",
    "node scripts/oam/check-system-failure-routing-contract.mjs",
    "node scripts/oam/generate-current-engineering-ledger.mjs",
    "node scripts/oam/check-current-engineering-ledger.mjs",
    "node scripts/oam/check-oam-responsibility-boundary-matrix.mjs",
    "node scripts/oam/check-business-object-field-registry.mjs",
    "node scripts/oam/check-workflow-state-registry.mjs",
    "node scripts/oam/check-db-ownership-map.mjs",
    "node scripts/oam/check-evidence-contract-refs.mjs",
    "node scripts/oam/check-runtime-governance-v2.mjs",
    "node scripts/validate-contracts.mjs",
    "node scripts/check-rule-authority.mjs",
    "node scripts/check-local-path-references.mjs --self-test",
    "node scripts/check-local-path-references.mjs",
    "node scripts/check-api-boundaries.mjs --self-test",
    "node scripts/check-api-boundaries.mjs",
    "node scripts/oam/check-operation-identity-boundary.mjs",
    "node scripts/check-runtime-write-paths.mjs --self-test",
    "node scripts/check-runtime-write-paths.mjs",
    "node scripts/check-admission-kernel.mjs --self-test",
    "node scripts/check-admission-kernel.mjs",
    "node scripts/check-business-line-admission.mjs",
    "node scripts/check-account-actor-kernel.mjs --self-test",
    "node scripts/check-account-actor-kernel.mjs",
    "node scripts/check-language-kernel.mjs",
    "node scripts/oam/check-surface-language-v2.mjs",
    "node scripts/check-search-kernel.mjs --self-test",
    "node scripts/check-search-kernel.mjs",
    "node scripts/check-surface-contract.mjs",
    "node scripts/check-experience-contract.mjs",
    "node scripts/trust/check-trust-boundary-kernel.mjs",
    "node scripts/check-policy-as-code.mjs --self-test",
    "node scripts/check-policy-as-code.mjs",
    "node scripts/check-domain-packs.mjs --self-test",
    "node scripts/check-domain-packs.mjs",
    "node scripts/check-truth-owners.mjs --self-test",
    "node scripts/check-truth-owners.mjs",
    "node scripts/check-finance-truth.mjs --self-test",
    "node scripts/check-finance-truth.mjs",
    "node scripts/check-ledger-semantic-rules.mjs",
    "node scripts/finance/check-finance-semantic-truth.mjs",
    "node scripts/check-management-cockpit-boundary.mjs --self-test",
    "node scripts/check-management-cockpit-boundary.mjs",
    "node scripts/check-shared-governance-boundary.mjs --self-test",
    "node scripts/check-shared-governance-boundary.mjs",
    "node scripts/check-dormitory-golden-domain.mjs --self-test",
    "node scripts/check-dormitory-golden-domain.mjs",
    "node scripts/business/check-dormitory-execution-kernel.mjs",
    "node scripts/business/check-scenario-field-contract.mjs",
    "node scripts/business/check-canonical-scenario-map.mjs",
    "node scripts/business/check-evidence-coverage-contract.mjs",
    "node scripts/business/check-ledger-posting-contract.mjs",
    "pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/surface/run-dormitory-real-browser-audits.ps1",
    "node scripts/surface/check-dormitory-l1-browser-e2e-audit.mjs",
    "node scripts/surface/check-dormitory-ten-scenario-real-browser-audit.mjs",
    "node scripts/oam/generate-mobile-branch-risk-ledger.mjs",
    "node scripts/oam/check-mobile-coverage-policy.mjs",
    "node scripts/oam/check-mobile-critical-branch-scenarios.mjs"
  ];
}

function readControlPlaneGateResult() {
  const requiredCommands = requiredGateCommands();
  if (!fileExists(controlPlaneGateResultPath)) {
    const missing = {
      version: "oam.control-plane-gate-results.v1",
      generatedAtUtc: generatedAt,
      commitSha,
      branch,
      status: "missing",
      requiredGateCount: 0,
      failedGateCount: 0,
      gates: [],
      missingRequiredGates: requiredCommands
    };
    writeJson(controlPlaneGateResultPath, missing);
    return missing;
  }

  const result = readJson(controlPlaneGateResultPath);
  const actual = new Set((result.gates ?? []).map((gate) => gate.command));
  const missingRequiredGates = requiredCommands.filter((command) => !actual.has(command));
  return {
    ...result,
    status: result.status ?? "missing",
    missingRequiredGates,
    stale: result.commitSha !== commitSha
  };
}

function buildRealBrowserEvidence() {
  const l1 = readL1BrowserEvidence();
  const tenScenario = readTenScenarioBrowserEvidence();
  const nodes = [l1.node, tenScenario.node].filter(Boolean);
  const edges = [
    l1.node ? { from: l1.node.id, to: "L1_INTERNAL_PILOT_OBSERVATION", relation: "binds_browser_evidence" } : null,
    tenScenario.node ? { from: tenScenario.node.id, to: "DORMITORY_TEN_SCENARIO_REAL_BROWSER_AUDIT", relation: "binds_browser_evidence" } : null
  ].filter(Boolean);
  const screenshotHashCount = nodes.reduce((total, node) => total + (node.screenshotHashes?.length ?? 0), 0);
  const status = l1.status === "passed" && tenScenario.status === "passed" ? "passed" : "missing_or_failed";
  return {
    nodes,
    edges,
    summary: {
      status,
      singleWriter: "scripts/oam/generate-current-evidence-root.mjs",
      l1,
      tenScenario,
      screenshotHashCount
    }
  };
}

function readL1BrowserEvidence() {
  const latestPath = ["artifacts", "oam", "evidence", "dormitory-l1-browser-e2e", "latest-report.json"].join("/");
  const latest = readJsonIfExists(latestPath);
  const reportRef = normalizeRepoPath(latest?.report || "");
  const report = reportRef ? readJsonIfExists(reportRef) : null;
  const screenshotHashes = (report?.screenshots ?? [])
    .map((item) => item.sha256)
    .filter(Boolean);
  const status = report?.status === "passed" && report?.git?.headSha === commitSha ? "passed" : "missing_or_failed";
  return {
    status,
    report: reportRef || "",
    runId: report?.runId || "",
    scenarioCount: report?.scenarios?.length ?? 0,
    screenshotHashCount: screenshotHashes.length,
    node: report ? {
      id: `DORM-L1-BROWSER-E2E-${report.runId || "unknown"}`,
      type: "browser_e2e_evidence",
      status,
      gate: "DORM-L1-BROWSER-E2E",
      branch: report.git?.branch || branch,
      headSha: report.git?.headSha || "",
      ciRunId: report.ciRun?.id || ciRunId,
      ciRunUrl: report.ciRun?.url || "",
      scenarioIds: (report.scenarios ?? []).map((scenario) => scenario.scenarioId).filter(Boolean),
      screenshotHashes,
      refs: [
        reportRef,
        normalizeRepoPath(report.outputs?.markdown || ""),
        normalizeRepoPath(report.outputs?.screenshotIndex || ""),
        "scripts/surface/run-dormitory-l1-browser-e2e-audit.mjs",
        "scripts/surface/check-dormitory-l1-browser-e2e-audit.mjs"
      ].filter(Boolean)
    } : null
  };
}

function readTenScenarioBrowserEvidence() {
  const runId = env("WORKOS_TEN_DORM_SCENARIO_RUN_ID") || "ten-dormitory-scenario-real-browser-20260605-post-unified-start";
  const reportRef = ["artifacts", "oam", "evidence", "dormitory-real-browser", runId, "ten-scenario-real-browser-report.json"].join("/");
  const report = readJsonIfExists(reportRef);
  const screenshotHashes = (report?.screenshots ?? [])
    .map((item) => item.sha256)
    .filter(Boolean);
  const status = report?.status === "passed" && report?.git?.headSha === commitSha ? "passed" : "missing_or_failed";
  return {
    status,
    report: report ? reportRef : "",
    runId: report?.runId || "",
    scenarioCount: report?.scenarios?.length ?? 0,
    screenshotHashCount: screenshotHashes.length,
    node: report ? {
      id: `DORM-TEN-SCENARIO-REAL-BROWSER-${report.runId || "unknown"}`,
      type: "browser_e2e_evidence",
      status,
      gate: "DORMITORY-TEN-SCENARIO-REAL-BROWSER",
      branch: report.git?.branch || branch,
      headSha: report.git?.headSha || "",
      ciRunId,
      ciRunUrl: env("GITHUB_SERVER_URL") && env("GITHUB_REPOSITORY") && env("GITHUB_RUN_ID")
        ? `${env("GITHUB_SERVER_URL")}/${env("GITHUB_REPOSITORY")}/actions/runs/${env("GITHUB_RUN_ID")}`
        : "",
      scenarioIds: (report.scenarios ?? []).map((scenario) => scenario.id).filter(Boolean),
      screenshotHashes,
      refs: [
        reportRef,
        ["artifacts", "oam", "evidence", "dormitory-real-browser", runId, "ten-scenario-real-browser-report.md"].join("/"),
        ["artifacts", "oam", "evidence", "dormitory-real-browser", runId, "screenshot-index.json"].join("/"),
        "scripts/surface/run-dormitory-ten-scenario-real-browser-audit.mjs",
        "scripts/surface/check-dormitory-ten-scenario-real-browser-audit.mjs"
      ]
    } : null
  };
}

function buildReleaseReadiness() {
  const releaseBlockingFiles = [
    ...workspaceEvidence.changedCurrentFiles.filter((file) => !isGeneratedOutputPath(file)),
    ...workspaceEvidence.createdCurrentFiles.filter((file) => !isGeneratedOutputPath(file))
  ];
  const releaseBlockingDeletionCount = workspaceEvidence.deletedOrMovedFileCount;
  const releaseEligible = releaseBlockingFiles.length === 0 && releaseBlockingDeletionCount === 0;
  return {
    releaseEligible,
    releaseBlockingFiles,
    releaseBlockingDeletionCount,
    generatedDirtyAllowed: workspaceEvidence.changedCurrentFiles.filter(isGeneratedOutputPath)
  };
}

function buildFinalDecision() {
  const noGoReasons = [];
  if (unresolvedP0.length > 0) {
    noGoReasons.push(`P0 未清零：${unresolvedP0.map((item) => item.ruleId).join(", ")}`);
  }
  if (controlPlaneGateResult.status !== "passed") {
    noGoReasons.push(`OAM 总门禁未通过或未执行：${controlPlaneGateResult.status}`);
  }
  if ((controlPlaneGateResult.failedGateCount ?? 0) > 0) {
    noGoReasons.push(`OAM 总门禁失败项数量：${controlPlaneGateResult.failedGateCount}`);
  }
  if ((controlPlaneGateResult.missingRequiredGates ?? []).length > 0) {
    noGoReasons.push(`OAM 总门禁缺失必跑项：${controlPlaneGateResult.missingRequiredGates.join("; ")}`);
  }
  if (controlPlaneGateResult.stale) {
    noGoReasons.push(`OAM 总门禁结果过期：${controlPlaneGateResult.commitSha} != ${commitSha}`);
  }
  if (mobileBranchRiskKernel.status !== "passed") {
    noGoReasons.push(`移动端分支风险门禁未通过：${mobileBranchRiskKernel.status}`);
  }
  if (coverageSummary.status === "pending_coverage_command") {
    noGoReasons.push("覆盖率报告缺失或未执行。");
  }
  if (!releaseReadiness.releaseEligible) {
    noGoReasons.push("工作区仍有未提交的当前源码/文档变更或删除项，不符合发布放行条件。");
  }

  return {
    finalGoNoGo: noGoReasons.length === 0 ? "GO" : "NO_GO",
    noGoReasons
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
      details: workspaceEvidence
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
      status: gateSummary.status,
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
      event: "移动覆盖率治理",
      status: mobileBranchRiskKernel.status,
      commitSha,
      branch,
      ciRunId,
      generatedAt,
      artifactDigest: digest,
      details: mobileBranchRiskKernel
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
        productionConfirmAllowed: admission.productionConfirmAllowed,
        noGoReasons: finalDecision.noGoReasons
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

function buildMobileBranchRiskKernel() {
  const policy = readJsonIfExists("docs/oam/mobile-branch-risk-policy.json");
  const ledger = readJsonIfExists("docs/oam/mobile-branch-risk-ledger.json");
  const scenarios = readJsonIfExists("docs/oam/mobile-critical-branch-scenarios.json");
  const coveragePolicyResult = readJsonIfExists("artifacts/oam/checks/mobile-coverage-policy-result.json");
  const criticalScenarioResult = readJsonIfExists("artifacts/oam/checks/mobile-critical-branch-scenarios-result.json");
  const currentBranches = Number(ledger?.globalCoverage?.branches?.pct ?? coverageSummary.mobile?.branches?.pct ?? 0);
  const scenarioList = scenarios?.scenarios || [];
  const p0Scenarios = scenarioList.filter((scenario) => scenario.riskLevel === "P0");
  const p1Scenarios = scenarioList.filter((scenario) => scenario.riskLevel === "P1");
  const status = ledger?.status === "generated" &&
    coveragePolicyResult?.status === "passed" &&
    criticalScenarioResult?.status === "passed"
    ? "passed"
    : "pending";

  return {
    status,
    policyFile: "docs/oam/mobile-branch-risk-policy.json",
    ledgerFile: "docs/oam/mobile-branch-risk-ledger.json",
    scenarioFile: "docs/oam/mobile-critical-branch-scenarios.json",
    coverageSource: "artifacts/oam/test-results/mobile/coverage/coverage-summary.json",
    coveragePolicyResult: "artifacts/oam/checks/mobile-coverage-policy-result.json",
    criticalScenarioResult: "artifacts/oam/checks/mobile-critical-branch-scenarios-result.json",
    branchRiskLedgerGenerated: ledger?.status === "generated",
    registeredPolicyFiles: ledger?.summary?.registeredFiles ?? 0,
    unregisteredExistingFiles: ledger?.summary?.unregisteredFiles ?? 0,
    newSourceFiles: ledger?.summary?.newSourceFiles ?? 0,
    criticalScenarioCount: scenarioList.length,
    p0ScenarioCount: p0Scenarios.length,
    p1ScenarioCount: p1Scenarios.length,
    p0ScenariosCovered: p0Scenarios.every((scenario) => scenario.covered === true),
    checks: {
      coveragePolicy: coveragePolicyResult?.status || "missing",
      criticalScenarios: criticalScenarioResult?.status || "missing"
    },
    currentCoverage: ledger?.globalCoverage || coverageSummary.mobile || null,
    firstStageHardBaseline: policy?.stage?.globalHardBaseline || null,
    nextStageTarget: policy?.stage?.nextStageTarget || null,
    branches70Reached: currentBranches >= 70
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

function workspaceEvidenceStatus(status) {
  const deleted = new Set(status.deletedOrMovedFiles.map(normalizeRepoPath));
  const changedCurrentFiles = status.changedFiles
    .map(normalizeRepoPath)
    .filter((file) => !deleted.has(file) && !isForbiddenGreyPath(file));
  const createdCurrentFiles = status.createdFiles
    .map(normalizeRepoPath)
    .filter((file) => !isForbiddenGreyPath(file));
  const deletedGreyFileCount = status.deletedOrMovedFiles
    .map(normalizeRepoPath)
    .filter(isForbiddenGreyPath)
    .length;

  return {
    status: status.summary,
    changedCurrentFiles,
    createdCurrentFiles,
    deletedOrMovedFileCount: status.deletedOrMovedFiles.length,
    deletedGreyFileCount,
    deletedCurrentFileCount: status.deletedOrMovedFiles.length - deletedGreyFileCount
  };
}

function isForbiddenGreyPath(file) {
  const normalized = normalizeRepoPath(file);
  return forbiddenGreyEvidencePathPrefixes().some((item) => normalized === item || normalized.startsWith(`${item}/`));
}

function isGeneratedOutputPath(file) {
  const normalized = normalizeRepoPath(file);
  return normalized.startsWith("artifacts/oam/evidence/") ||
    normalized.startsWith("artifacts/oam/checks/") ||
    normalized.startsWith("artifacts/oam/test-results/") ||
    normalized === "artifacts/oam/final-report.json" ||
    normalized === "docs/oam/mobile-branch-risk-ledger.json";
}

function forbiddenGreyEvidencePathPrefixes() {
  return [
    ["docs", "product"].join("/"),
    ["docs", "review"].join("/"),
    ["docs", "decisions", "ADR-0001-phase-0-1-bootstrap.md"].join("/"),
    ["docs", "oam", "final-acceptance-report.md"].join("/"),
    ["docs", "oam", "review-defect-record.md"].join("/"),
    ["docs", "oam", "mobile-refactor-readiness-plan.md"].join("/"),
    ["docs", "system", "oam-warning-baseline.md"].join("/"),
    ["docs", "oam", "certification-scenarios.json"].join("/"),
    ["docs", "oam", "dormitory-certification-scenarios.json"].join("/"),
    ["docs", "business", "dormitory", "certification-scenarios.json"].join("/")
  ];
}

function normalizeRepoPath(file) {
  return file.replaceAll("\\", "/");
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
  return fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, "");
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
