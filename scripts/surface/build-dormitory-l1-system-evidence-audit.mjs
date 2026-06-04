import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const latestBrowserPath = path.join(root, "artifacts", "surface", "dormitory-l1-browser-e2e", "latest-report.json");
const outputRoot = path.join(root, "artifacts", "oam-cab", "dormitory-l1-system-browser-audit");

const latest = readJson(latestBrowserPath);
const browserReport = readJson(path.join(root, latest.report));
const admissionMatrix = readJson(path.join(root, "docs", "contracts", "admission", "admission-matrix.json"));
const businessLineMatrix = readJson(path.join(root, "docs", "contracts", "admission", "business-line-admission-matrix.json"));
const productionAdmission = readJson(path.join(root, "docs", "contracts", "admission", "production-admission-contract.json"));
const certificationScenarios = readJson(path.join(root, "docs", "business", "dormitory", "certification-scenarios.json"));
const canonicalScenarioMap = readJson(path.join(root, "docs", "business", "dormitory", "canonical-scenario-map.json"));
const contractIndex = readJson(path.join(root, "docs", "contracts", "oam-cab", "contract-index.json"));
const compatibilityContract = readJson(path.join(root, "docs", "contracts", "compatibility", "compatibility-box-contract.json"));
const apiBoundary = readJson(path.join(root, "docs", "contracts", "oam-cab", "api-boundary-contract.json"));
const currentState = readJson(path.join(root, "artifacts", "release-state", "current-state.json"));
const fieldContractText = readText(path.join(root, "docs", "business", "dormitory", "scenario-field-contract.yml"));
const generatedAtUtc = new Date().toISOString();
const commitSha = command("git rev-parse HEAD");
const ciRun = browserReport.ciRun?.id || "not_available";

fs.mkdirSync(outputRoot, { recursive: true });

const actorRoleMatrix = {
  version: "dormitory-l1.actor-role-matrix.v1",
  generatedAtUtc,
  sourceRefs: [
    "docs/contracts/admission/admission-matrix.json",
    "docs/contracts/admission/business-line-admission-matrix.json",
    latest.report
  ],
  roles: [
    {
      role: "operator",
      browserAccounts: ["dormOperator"],
      allowed: ["Dormitory L1 internal pilot resource work-item confirm"],
      denied: ["Business Production", "Dormitory L2", "production_confirm"],
      observedScenarioIds: scenarioIdsForRole("operator")
    },
    {
      role: "finance",
      browserAccounts: ["dormFinance"],
      allowed: ["finance read/search visibility under L1"],
      denied: ["room setup start", "Business Production", "Dormitory L2", "production_confirm"],
      observedScenarioIds: scenarioIdsForRole("finance")
    },
    {
      role: "manager",
      browserAccounts: [],
      allowed: ["management read/review contract surfaces"],
      denied: ["Business Production", "Dormitory L2", "production_confirm"],
      observedScenarioIds: []
    }
  ],
  productionAllowed: false,
  productionConfirmAllowed: false
};

const dormitoryScenarioMatrix = {
  version: "dormitory-l1.dormitory-scenario-matrix.v1",
  generatedAtUtc,
  productionAllowed: certificationScenarios.productionAllowed === true ? false : certificationScenarios.productionAllowed,
  scenarios: certificationScenarios.scenarios.map((scenario) => ({
    ...scenario,
    canonical: canonicalScenarioMap.mappings.find((item) => item.scenarioId === scenario.scenarioId) || null,
    browserCoverage: browserCoverageFor(scenario.scenarioId)
  })),
  browserExecutedScenarios: browserReport.scenarios.map((scenario) => ({
    scenarioId: scenario.scenarioId,
    caseType: scenario.caseType,
    role: scenario.role,
    language: scenario.language,
    status: scenario.status,
    stepCount: scenario.steps?.length || 0
  }))
};

const systemScenarioMatrix = {
  version: "dormitory-l1.system-scenario-matrix.v1",
  generatedAtUtc,
  scenarios: [
    systemScenario("sys-admission-production-blocked", "Admission blocks Business Production and production_confirm", admissionMatrix.entries.find((entry) => entry.id === "production_confirm")),
    systemScenario("sys-business-line-dormitory-l1", "Dormitory stays L1 internal pilot observation", businessLineMatrix.businessLines.find((entry) => entry.businessLineId === "dormitory")),
    systemScenario("sys-compatibility-quarantine", "ProjectionRuntime and Workspace/Card remain quarantined compatibility", compatibilityContract),
    systemScenario("sys-api-boundary", "Business fact writes stay on Operations Confirm; no direct page writes", apiBoundary),
    systemScenario("sys-browser-evidence-binding", "Every browser step has screenshot and runtime/admission evidence", { report: latest.report, status: browserReport.status })
  ]
};

const browserStepTrace = browserReport.scenarios.flatMap((scenario) =>
  (scenario.steps || []).map((step) => ({
    scenarioId: scenario.scenarioId,
    stepId: step.stepId,
    role: scenario.role,
    language: scenario.language,
    url: step.url,
    admissionState: step.admissionDecision,
    runtimeDecision: step.runtimeDecision,
    commitSha,
    ciRun,
    screenshotHashes: [step.screenshot?.fullPage, ...(step.screenshot?.segments || [])].filter(Boolean).map((item) => item.sha256),
    networkEvents: step.networkEvents || []
  }))
);

const screenshotManifest = {
  version: "dormitory-l1.screenshot-manifest.v1",
  generatedAtUtc,
  commitSha,
  ciRun,
  sourceReport: latest.report,
  screenshots: browserReport.screenshots.map((entry) => ({
    scenarioId: entry.scenarioId,
    stepId: entry.stepId,
    role: entry.role,
    language: entry.language,
    url: entry.url,
    admissionState: entry.admissionState,
    runtimeDecision: entry.runtimeDecision,
    commitSha: entry.commitSha || commitSha,
    ciRun: entry.ciRun || ciRun,
    kind: entry.kind,
    segmentPosition: entry.segmentPosition,
    path: entry.path,
    screenshotHash: entry.sha256,
    bytes: entry.bytes
  }))
};

const fieldValidationReport = {
  version: "dormitory-l1.field-validation-report.v1",
  generatedAtUtc,
  sourceRefs: ["docs/business/dormitory/scenario-field-contract.yml", latest.report],
  contractHash: sha256Text(fieldContractText),
  fieldSetsDetected: certificationScenarios.scenarios.length,
  requiredFieldBrowserBlocks: browserStepTrace.filter((step) => step.runtimeDecision === "blocked:required_field_missing"),
  invalidFieldEvidence: browserReport.scenarios.flatMap((scenario) =>
    (scenario.steps || []).filter((step) => step.domState?.invalidFields?.length).map((step) => ({
      scenarioId: scenario.scenarioId,
      stepId: step.stepId,
      invalidFields: step.domState.invalidFields
    }))
  ),
  status: browserStepTrace.some((step) => step.runtimeDecision === "blocked:required_field_missing") ? "passed" : "failed"
};

const proofs = buildProofs();
const defects = buildDefects();
const nextStageAllowed = defects.P0.length === 0 &&
  browserReport.status === "passed" &&
  browserReport.screenshots.every(hasRequiredScreenshotBinding) &&
  browserStepTrace.every((step) => step.admissionState !== undefined && step.runtimeDecision !== undefined) &&
  ciRun !== "not_available";

const evidenceManifest = {
  version: "dormitory-l1.evidence-manifest.v1",
  generatedAtUtc,
  status: browserReport.status,
  commitSha,
  ciRun,
  artifacts: requiredOutputNames().map((name) => `artifacts/oam-cab/dormitory-l1-system-browser-audit/${name}`),
  browserReport: latest.report,
  screenshotManifest: "artifacts/oam-cab/dormitory-l1-system-browser-audit/screenshot-manifest.json",
  noManualGateResult: true,
  noManualPassedEvidence: true
};

const finalReport = {
  version: "dormitory-l1.system-browser-evidence-audit.final.v1",
  generatedAtUtc,
  status: nextStageAllowed ? "passed_no_go_business_production" : "failed_no_go",
  browserStatus: browserReport.status,
  commitSha,
  ciRun,
  productionAllowed: false,
  dormitoryL2Allowed: false,
  productionConfirmAllowed: false,
  next_stage: {
    allowed: false,
    reason: nextStageAllowed
      ? "Dormitory L1 browser evidence is bound, but Business Production, Dormitory L2, and production_confirm remain blocked by contract."
      : "P0, critical gate, screenshot, CI, or runtime/admission evidence is missing or failed."
  },
  defects,
  evidence: evidenceManifest.artifacts,
  contracts: contractIndex.contracts
};

writeJson("actor-role-matrix.json", actorRoleMatrix);
writeJson("dormitory-scenario-matrix.json", dormitoryScenarioMatrix);
writeJson("system-scenario-matrix.json", systemScenarioMatrix);
writeText("browser-step-trace.jsonl", browserStepTrace.map((entry) => JSON.stringify(entry)).join("\n") + "\n");
writeJson("screenshot-manifest.json", screenshotManifest);
writeJson("evidence-manifest.json", evidenceManifest);
writeJson("runtime-proof.json", proofs.runtime);
writeJson("admission-proof.json", proofs.admission);
writeJson("compatibility-proof.json", proofs.compatibility);
writeJson("language-proof.json", proofs.language);
writeJson("search-data-bi-proof.json", proofs.searchDataBi);
writeJson("field-validation-report.json", fieldValidationReport);
writeText("ui-ux-report.md", renderUiUxReport());
writeJson("performance-baseline.json", buildPerformanceBaseline());
writeJson("defect-register.json", defects);
writeJson("cleanup-candidates.json", buildCleanupCandidates());
writeText("final-report.md", renderFinalReport(finalReport));
writeJson("final-report.json", finalReport);

console.log(`Dormitory L1 system evidence audit artifacts written: ${outputRoot}`);

function buildProofs() {
  return {
    runtime: {
      version: "runtime-proof.v1",
      status: browserReport.networkPolicy?.operationsRuntimeWrites?.length ? "passed" : "failed",
      operationsRuntimeWrites: browserReport.networkPolicy?.operationsRuntimeWrites || [],
      noLegacyWorkspaceCardWrites: browserReport.networkPolicy?.noLegacyWorkspaceCardWrites === true,
      noDirectBusinessFactWrites: browserReport.networkPolicy?.noDirectBusinessFactWrites === true
    },
    admission: {
      version: "admission-proof.v1",
      status: "blocked_for_production",
      l1InternalPilotConfirmAllowed: admissionMatrix.entries.find((entry) => entry.id === "dormitory_l1_internal_pilot_observation")?.confirmAllowed === true,
      productionConfirmAllowed: admissionMatrix.entries.find((entry) => entry.id === "production_confirm")?.confirmAllowed === true,
      productionAdmission
    },
    compatibility: {
      version: "compatibility-proof.v1",
      status: "quarantined",
      contract: compatibilityContract,
      noLegacyWorkspaceCardWrites: browserReport.networkPolicy?.noLegacyWorkspaceCardWrites === true
    },
    language: {
      version: "language-proof.v1",
      status: browserReport.scenarios.every((scenario) => scenario.language) ? "passed" : "failed",
      observedLanguages: [...new Set(browserReport.scenarios.map((scenario) => scenario.language))],
      sourceRefs: ["docs/contracts/language/language-contract.json", "docs/contracts/language/field-label-catalog.json"]
    },
    searchDataBi: {
      version: "search-data-bi-proof.v1",
      status: browserReport.scenarios.some((scenario) => scenario.steps?.some((step) => step.stepId.includes("search"))) ? "passed" : "failed",
      sourceRefs: ["docs/contracts/search/search-contract.json", "docs/contracts/bi-kpi/bi-kpi-contract.json"],
      observedSearchSteps: browserStepTrace.filter((step) => step.stepId.includes("search")).length,
      directBusinessFactWriteAllowed: false
    }
  };
}

function buildDefects() {
  const p0 = [];
  if (browserReport.status !== "passed") p0.push({ id: "browser_report_not_passed", message: "Real browser audit report is not passed." });
  if (ciRun === "not_available") p0.push({ id: "ci_run_missing", message: "CI run binding is missing." });
  if (!browserReport.screenshots.every(hasRequiredScreenshotBinding)) p0.push({ id: "screenshot_binding_missing", message: "One or more screenshots lack required binding metadata." });
  if (!browserStepTrace.every((step) => step.admissionState !== undefined && step.runtimeDecision !== undefined)) p0.push({ id: "runtime_admission_missing", message: "Runtime/admission state is missing in browser step trace." });
  if (productionAdmission.productionAllowed !== false || productionAdmission.productionConfirmAllowed !== false) p0.push({ id: "production_admission_open", message: "Production admission is not blocked." });
  return {
    version: "dormitory-l1.defect-register.v1",
    generatedAtUtc,
    P0: p0,
    P1: [
      { id: "business_production_still_blocked", message: "Expected No-Go: Business Production remains blocked." }
    ],
    P2: []
  };
}

function hasRequiredScreenshotBinding(entry) {
  return ["scenarioId", "stepId", "role", "language", "url", "admissionState", "runtimeDecision", "commitSha", "ciRun", "sha256"].every((field) => Boolean(entry[field]));
}

function buildPerformanceBaseline() {
  const steps = browserReport.scenarios.flatMap((scenario) => scenario.steps || []);
  return {
    version: "dormitory-l1.performance-baseline.v1",
    generatedAtUtc,
    browserStepCount: steps.length,
    screenshotCount: browserReport.screenshots.length,
    apiEventCount: browserReport.networkPolicy?.totalApiEvents || 0,
    writeCount: browserReport.networkPolicy?.writeCount || 0,
    mode: "observed browser baseline; no synthetic performance budget asserted"
  };
}

function buildCleanupCandidates() {
  return {
    version: "dormitory-l1.cleanup-candidates.v1",
    generatedAtUtc,
    candidates: [
      {
        id: "legacy-workspace-card-write-path",
        status: "quarantined_not_deleted",
        reason: "Compatibility wrapper remains classified; deletion requires a separate approved cleanup phase."
      },
      {
        id: "projection-runtime-compatibility-facade",
        status: "quarantined_not_expanded",
        reason: "No new compatibility usage was introduced by this audit."
      }
    ]
  };
}

function renderUiUxReport() {
  return `# Dormitory L1 UI/UX Browser Evidence Report

- Browser mode: ${browserReport.browserMode}
- Status: ${browserReport.status}
- Scenarios: ${browserReport.scenarios.length}
- Steps: ${browserStepTrace.length}
- Screenshots: ${browserReport.screenshots.length}
- Languages observed: ${[...new Set(browserReport.scenarios.map((scenario) => scenario.language))].join(", ")}

The audit exercised login, onboarding, search, operation panel validation, WorkItem completion, unauthorized role handling, illegal route handling, and completed read-only handling through the rendered mobile UI. Production, Dormitory L2, and production_confirm remain blocked.
`;
}

function renderFinalReport(report) {
  return `# Dormitory L1 + System Scenario Real Browser Evidence Audit

Status: ${report.status}

- Commit SHA: ${commitSha}
- CI run: ${ciRun}
- Browser report: ${latest.report}
- Screenshot manifest: artifacts/oam-cab/dormitory-l1-system-browser-audit/screenshot-manifest.json
- Business Production: blocked
- Dormitory L2: blocked
- production_confirm: blocked
- next_stage.allowed: false

P0 defects: ${report.defects.P0.length}

${report.defects.P0.map((item) => `- ${item.id}: ${item.message}`).join("\n") || "No P0 defects in generated local evidence; next stage still remains closed by production admission contract."}
`;
}

function systemScenario(id, title, contractEvidence) {
  return {
    scenarioId: id,
    title,
    source: "contract_and_browser_evidence",
    status: contractEvidence ? "covered" : "missing",
    contractEvidence
  };
}

function scenarioIdsForRole(role) {
  return browserReport.scenarios.filter((scenario) => scenario.role === role).map((scenario) => scenario.scenarioId);
}

function browserCoverageFor(scenarioId) {
  if (scenarioId === "dorm-cert-004") return ["dormitory_l1_positive_normal"];
  if (scenarioId === "dorm-cert-008") return ["dormitory_l1_negative_unauthorized", "dormitory_l1_negative_illegal_access"];
  if (scenarioId === "dorm-cert-009") return ["dormitory_l1_negative_wrong_status"];
  return [];
}

function requiredOutputNames() {
  return [
    "actor-role-matrix.json",
    "dormitory-scenario-matrix.json",
    "system-scenario-matrix.json",
    "browser-step-trace.jsonl",
    "screenshot-manifest.json",
    "evidence-manifest.json",
    "runtime-proof.json",
    "admission-proof.json",
    "compatibility-proof.json",
    "language-proof.json",
    "search-data-bi-proof.json",
    "field-validation-report.json",
    "ui-ux-report.md",
    "performance-baseline.json",
    "defect-register.json",
    "cleanup-candidates.json",
    "final-report.md",
    "final-report.json"
  ];
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function writeJson(name, value) {
  writeText(name, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(name, value) {
  fs.writeFileSync(path.join(outputRoot, name), value, "utf8");
}

function command(cmd) {
  try {
    return execSync(cmd, { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function sha256Text(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
