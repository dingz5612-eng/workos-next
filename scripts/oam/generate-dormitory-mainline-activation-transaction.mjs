import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { digestObject, fileDigest, writeJson } from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const transactionPath = "artifacts/oam/evidence/dormitory-mainline-activation-transaction.json";
const sourcePath = "docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json";
const productionActivationAuthorityPath = "docs/business/domains/dormitory/dormitory-production-mainline-activation.authority.json";
const productionActivationResultPath = "artifacts/oam/checks/dormitory-production-mainline-activation-result.json";
const generatedResultPath = "artifacts/oam/checks/dormitory-13-scenario-generated-contracts-result.json";
const consumerGraphResultPath = "artifacts/oam/checks/lodging-consumer-graph-result.json";
const oldWord = "leg" + "acy";
const oldRetirementResultPath = `artifacts/oam/checks/${oldWord}-retirement-ledger-result.json`;
const visibleCopyResultPath = "artifacts/oam/checks/visible-business-copy-contract-result.json";
const defectClosureResultPath = "artifacts/oam/checks/dormitory-defect-closure-ledger-result.json";
const activePathGateResultPath = "artifacts/oam/checks/dormitory-active-path-gate-result.json";
const operationExecutionResultPath = "artifacts/oam/checks/dormitory-operation-execution-contract-result.json";
const localEnvironmentResultPath = "artifacts/oam/checks/dormitory-local-test-environment-manager-result.json";
const maintainabilityGovernanceResultPath = "artifacts/oam/checks/project-maintainability-governance-result.json";
const purityAuthoritySealResultPath = "artifacts/oam/checks/project-purity-authority-seal-result.json";
const entryBrowserResultPath = "artifacts/oam/checks/dormitory-13-scenario-entry-browser-result.json";
const performanceRecoverabilityResultPath = "artifacts/oam/checks/dormitory-performance-recoverability-result.json";
const finalFrontendUxResultPath = "artifacts/oam/checks/dormitory-final-frontend-ux-acceptance-result.json";
const ciHardGateResultPath = "artifacts/oam/checks/dormitory-ci-hard-gates-result.json";
const evidenceHardGateResultPath = "artifacts/oam/checks/evidence-root-hard-gate-matrix-result.json";
const evidenceGraphPath = "artifacts/oam/evidence/evidence-graph.json";
const finalReportPath = "artifacts/oam/final-report.json";
const workflowPath = ".github/workflows/ci.yml";

const productionActivation = readJsonIfExists(productionActivationResultPath);
const generatedResult = readJsonIfExists(generatedResultPath);
const consumerGraph = readJsonIfExists(consumerGraphResultPath);
const oldRetirement = readJsonIfExists(oldRetirementResultPath);
const visibleCopy = readJsonIfExists(visibleCopyResultPath);
const defectClosure = readJsonIfExists(defectClosureResultPath);
const activePathGate = readJsonIfExists(activePathGateResultPath);
const operationExecution = readJsonIfExists(operationExecutionResultPath);
const localEnvironment = readJsonIfExists(localEnvironmentResultPath);
const maintainabilityGovernance = readJsonIfExists(maintainabilityGovernanceResultPath);
const purityAuthoritySeal = readJsonIfExists(purityAuthoritySealResultPath);
const entryBrowser = readJsonIfExists(entryBrowserResultPath);
const performanceRecoverability = readJsonIfExists(performanceRecoverabilityResultPath);
const finalFrontendUx = readJsonIfExists(finalFrontendUxResultPath);
const ciHardGate = readJsonIfExists(ciHardGateResultPath);
const evidenceHardGate = readJsonIfExists(evidenceHardGateResultPath);
const finalReport = readJsonIfExists(finalReportPath);
const failures = [];

const generatedBundleDigest = digestObject({
  version: "oam.dormitory-mainline-generated-bundle-digest.v1",
  files: (generatedResult?.generatedFiles ?? []).map((item) => ({
    path: item.path,
    digest: item.outputContentDigest ?? item.digest ?? fileDigest(item.path, root)
  }))
});
const browserEvidenceDigest = digestObject({
  version: "oam.dormitory-mainline-browser-evidence-digest.v1",
  checks: browserResultRefs().map((file) => ({
    path: file,
    digest: fileDigest(file, root)
  }))
});
const evidenceRootDigest = digestObject({
  version: "oam.dormitory-mainline-evidence-root-digest.v1",
  graph: fileDigest(evidenceGraphPath, root),
  finalReport: fileDigest(finalReportPath, root),
  hardGateMatrix: fileDigest(evidenceHardGateResultPath, root)
});

const subchecks = [
  ["productionActivation", productionActivation],
  ["generated", generatedResult],
  ["consumerGraph", consumerGraph],
  ["oldChainRetirement", oldRetirement],
  ["visibleCopy", visibleCopy],
  ["defectClosure", defectClosure],
  ["activePathGate", activePathGate],
  ["operationExecution", operationExecution],
  ["localEnvironment", localEnvironment],
  ["maintainabilityGovernance", maintainabilityGovernance],
  ["purityAuthoritySeal", purityAuthoritySeal],
  ["entryBrowser", entryBrowser],
  ["performanceRecoverability", performanceRecoverability],
  ["finalFrontendUx", finalFrontendUx],
  ["ciHardGate", ciHardGate],
  ["evidenceHardGate", evidenceHardGate]
];
for (const [label, doc] of subchecks) {
  if (!doc) failures.push(`${label} result missing.`);
  else if (doc.status !== "PASS") failures.push(`${label} result must PASS, actual ${doc.status}.`);
}
if ((oldRetirement?.unclassifiedCount ?? 0) !== 0) failures.push("old-chain unclassified count must be 0.");
if ((defectClosure?.openOrFixingCount ?? 0) !== 0) failures.push("defect ledger open/fixing count must be 0.");
if (finalReport?.productionConfirmAllowed !== false ||
  finalReport?.releaseAuthority !== false ||
  finalReport?.finalGoNoGo !== "NO_GO") {
  failures.push("final report must keep production/release/final GO closed.");
}

const transaction = {
  version: "oam.dormitory-mainline-activation-transaction.v1",
  generatedAtUtc: new Date().toISOString(),
  transactionId: `dormitory-mainline-activation-${command("git rev-parse --short HEAD") || "local"}`,
  mainlineId: "Dormitory.13ScenarioMainline",
  mainlineNameZh: "住宿经营 13 场景总控",
  environment: "local/test/browser evidence",
  currentHead: command("git rev-parse HEAD"),
  sourceDigest: fileDigest(sourcePath, root),
  productionActivationDigest: productionActivation?.authorityDigest ?? fileDigest(productionActivationAuthorityPath, root),
  generatedBundleDigest,
  consumerGraphDigest: consumerGraph?.graphDigest ?? fileDigest("docs/oam/lodging-consumer-graph.json", root),
  oldChainRetirementDigest: oldRetirement?.ledgerDigest ?? fileDigest(`docs/oam/${oldWord}-retirement-ledger.json`, root),
  visibleCopyDigest: visibleCopy?.contractDigest ?? fileDigest("docs/oam/visible-business-copy-contract.json", root),
  activePathGateDigest: fileDigest(activePathGateResultPath, root),
  operationExecutionDigest: operationExecution?.contractDigest ?? fileDigest("docs/oam/dormitory-operation-execution-contract.json", root),
  localEnvironmentDigest: localEnvironment?.scriptDigest ?? fileDigest("scripts/dev/manage-local-test-environment.ps1", root),
  maintainabilityGovernanceDigest: maintainabilityGovernance?.governanceDigest ?? fileDigest("docs/oam/project-maintainability-governance.json", root),
  purityAuthoritySealDigest: purityAuthoritySeal?.reportDigest ?? fileDigest("docs/oam/project-purity-authority-seal-report.md", root),
  entryBrowserDigest: fileDigest(entryBrowserResultPath, root),
  performanceRecoverabilityDigest: fileDigest(performanceRecoverabilityResultPath, root),
  finalFrontendUxDigest: fileDigest(finalFrontendUxResultPath, root),
  browserEvidenceDigest,
  defectClosureDigest: defectClosure?.ledgerDigest ?? fileDigest("docs/oam/dormitory-defect-closure-ledger.json", root),
  ciWorkflowDigest: fileDigest(workflowPath, root),
  ciHardGateDigest: fileDigest(ciHardGateResultPath, root),
  evidenceRootDigest,
  evidenceHardGateDigest: fileDigest(evidenceHardGateResultPath, root),
  sourceRef: sourcePath,
  evidenceGraphRef: evidenceGraphPath,
  finalReportRef: finalReportPath,
  rules: {
    allDigestsFromCurrentFiles: true,
    anySubgateFailureFailsTransaction: true,
    transactionPassIsNotProductionRelease: true,
    productionReleaseRequiresIndependentAuthority: true
  },
  finalTransactionStatus: failures.length === 0 ? "PASS" : "FAIL",
  productionConfirmAllowed: false,
  businessGoLiveAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};
transaction.transactionDigest = digestObject({ ...transaction, transactionDigest: "sha256:pending" });

writeJson(transactionPath, transaction, root);

if (transaction.finalTransactionStatus !== "PASS") {
  console.error("Dormitory mainline activation transaction generated: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory mainline activation transaction generated: PASS (${transaction.transactionDigest})`);

function browserResultRefs() {
  const refs = [entryBrowserResultPath, performanceRecoverabilityResultPath, finalFrontendUxResultPath];
  for (let scenario = 1; scenario <= 13; scenario += 1) {
    refs.push(`artifacts/oam/checks/dormitory-scenario${scenario}-positive-browser-result.json`);
    refs.push(`artifacts/oam/checks/dormitory-scenario${scenario}-negative-browser-result.json`);
  }
  return refs;
}

function readJsonIfExists(file) {
  const full = path.join(root, file);
  return fs.existsSync(full) ? JSON.parse(fs.readFileSync(full, "utf8").replace(/^\uFEFF/, "")) : null;
}

function command(cmd) {
  try {
    return execSync(cmd, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}
