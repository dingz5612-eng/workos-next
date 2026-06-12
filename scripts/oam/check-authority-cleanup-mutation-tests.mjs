import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const reportPath = "artifacts/oam/authority-cleanup/mutation-tests-result.json";
const currentGitHead = gitHead();
const index = readJson("docs/oam/current-authority-index.json");
const generatedManifest = readJson("docs/oam/generated-contracts-manifest.json");
const dashboardContract = readJson("docs/contracts/bi-kpi/dashboard-contract.json");
const evidenceGraph = fs.existsSync(abs("artifacts/oam/evidence/evidence-graph.json"))
  ? readJson("artifacts/oam/evidence/evidence-graph.json")
  : { nodes: [{ id: "placeholder", proofType: "placeholder", source: ["placeholder"], hash: "sha256:0000000000000000000000000000000000000000000000000000000000000000", dependsOn: ["placeholder"], status: "blocked", goNoGo: "NO_GO" }] };
const releaseEvidenceObject = fs.existsSync(abs("artifacts/oam/evidence/current-oam-release-evidence-object.json"))
  ? readJson("artifacts/oam/evidence/current-oam-release-evidence-object.json")
  : { sourceCommitSha: currentGitHead, evidenceRunSha: currentGitHead, referenceOnly: false, stale: false, bindingStatus: "current", finalGoNoGo: "NO_GO" };
const finalReport = fs.existsSync(abs("artifacts/oam/final-report.json"))
  ? readJson("artifacts/oam/final-report.json")
  : { latestCommit: currentGitHead, finalGoNoGo: "NO_GO", controlPlaneGateResult: { status: "passed" }, noGoReasons: ["当前阶段 NO_GO。"] };
const admissionSurfaceSource = readText("apps/mobile/src/admissionSurface.js");
const searchIntentHubSource = readText("apps/mobile/src/searchIntentHub.js");

const tests = [
  mutationTest("generated_file_manual_edit_should_fail", () => {
    const clone = cloneIndex();
    const entry = mustEntry(clone, "docs/contracts/business/oam-business-object-field-registry.json");
    entry.manualEditAllowed = true;
    return validateAuthorityIndex(clone).some((item) => item.id === "generated_manual_edit_allowed");
  }),
  mutationTest("derived_file_marked_source_should_fail", () => {
    const clone = cloneIndex();
    const entry = mustEntry(clone, "docs/business/domains/dormitory/handoff-contract.json");
    entry.layer = "source";
    entry.generated = false;
    entry.doNotEdit = false;
    entry.businessFactAuthorityAllowed = true;
    delete entry.generatedFrom;
    entry.sourceRefs = ["docs/oam/current-authority-index.json"];
    return validateAuthorityIndex(clone).some((item) => item.id === "source_not_whitelisted" || item.id === "business_fact_forbidden_path");
  }),
  mutationTest("search_bi_surface_business_fact_should_fail", () => {
    const clone = cloneIndex();
    for (const file of [
      "docs/contracts/search/search-contract.json",
      "docs/contracts/bi-kpi/metric-registry.contract.json",
      "docs/surface/surface-contract.yml"
    ]) {
      const entry = clone.entries.find((item) => item.path === file);
      if (entry) entry.businessFactAuthorityAllowed = true;
    }
    return validateAuthorityIndex(clone).some((item) => item.id === "business_fact_forbidden_path" || item.id === "surface_business_fact_forbidden");
  }),
  mutationTest("search_business_fact_should_fail", () => {
    const clone = cloneIndex();
    const entry = clone.entries.find((item) => item.path === "docs/contracts/search/search-contract.json");
    if (entry) entry.businessFactAuthorityAllowed = true;
    return validateAuthorityIndex(clone).some((item) => item.id === "business_fact_forbidden_path");
  }),
  mutationTest("surface_business_fact_should_fail", () => {
    const clone = cloneIndex();
    const entry = mustEntry(clone, "docs/surface/surface-contract.yml");
    entry.businessFactAuthorityAllowed = true;
    return validateAuthorityIndex(clone).some((item) => item.id === "surface_business_fact_forbidden");
  }),
  mutationTest("dashboard_business_fact_should_fail", () => {
    const contract = structuredClone(dashboardContract);
    contract.businessFactWriteAllowed = true;
    contract.dashboards[0].writeFactsAllowed = true;
    return validateDashboardReadonly(contract).some((item) => item.id === "dashboard_business_fact_write");
  }),
  mutationTest("non_finance_kernel_ledger_entry_should_fail", () => {
    const consumer = {
      owner: "dashboard",
      file: "docs/contracts/bi-kpi/dashboard-contract.json",
      writes: ["LedgerEntry"]
    };
    return validateLedgerEntryWriter(consumer).some((item) => item.id === "ledger_entry_non_finance_writer");
  }),
  mutationTest("missing_admission_surface_confirm_true_should_fail", () => {
    const mutated = admissionSurfaceSource.replace(
      "export function missingAdmissionState(mode = \"contract_preview\") {",
      "export function missingAdmissionState(mode = \"contract_preview\") {"
    ).replace("confirmAllowed: false,", "confirmAllowed: true,");
    return validateMissingAdmissionFallback(mutated, searchIntentHubSource).some((item) => item.id === "missing_admission_confirm_allowed");
  }),
  mutationTest("missing_admission_search_infers_confirm_should_fail", () => {
    const mutated = searchIntentHubSource.replace(
      "return missingAdmissionState(\"contract_preview\");",
      "return normalizeAdmissionState({ visibleAllowed: true, prepareAllowed: true, confirmAllowed: true, productionAllowed: false });"
    );
    return validateMissingAdmissionFallback(admissionSurfaceSource, mutated).some((item) => item.id === "search_missing_admission_infers_confirm");
  }),
  mutationTest("evidence_graph_node_missing_proof_fields_should_fail", () => {
    const graph = structuredClone(evidenceGraph);
    const node = graph.nodes?.[0] ?? {};
    delete node.proofType;
    delete node.source;
    delete node.hash;
    delete node.dependsOn;
    return validateEvidenceGraphNodes(graph).some((item) => item.id === "evidence_node_missing_minimum_field");
  }),
  mutationTest("release_evidence_old_sha_should_fail_or_no_go", () => {
    const release = structuredClone(releaseEvidenceObject);
    release.sourceCommitSha = "0000000000000000000000000000000000000000";
    release.evidenceRunSha = "0000000000000000000000000000000000000000";
    release.stale = false;
    release.referenceOnly = false;
    release.bindingStatus = "current";
    release.finalGoNoGo = "GO";
    return validateReleaseBinding(release).some((item) => item.id === "release_old_sha_not_reference_only" || item.id === "release_stale_go");
  }),
  mutationTest("generated_manifest_source_hash_removed_should_fail", () => {
    const manifest = structuredClone(generatedManifest);
    delete manifest.sourceHash;
    delete manifest.sourceRefs;
    return validateGeneratedManifest(manifest).some((item) => item.id === "generated_metadata_missing");
  }),
  mutationTest("runtime_consumes_old_derived_authority_view_should_fail", () => {
    const runtimeConsumer = {
      path: "services/core-api/WorkOS.Api/Runtime/SearchKernelService.cs",
      consumes: ["docs/contracts/authority/master-design.contract.json"]
    };
    return validateRuntimeConsumer(runtimeConsumer).some((item) => item.id === "runtime_consumes_old_derived_source");
  }),
  mutationTest("ci_green_as_go_should_fail", () => {
    const report = structuredClone(finalReport);
    report.controlPlaneGateResult = { status: "passed", failedGateCount: 0 };
    report.finalGoNoGo = "GO";
    report.businessProductionGoNoGo = "GO";
    report.dormitoryL2GoNoGo = "GO";
    report.productionConfirmGoNoGo = "GO";
    report.noGoReasons = [];
    return validateGoNoGo(report).some((item) => item.id === "ci_green_cannot_promote_go");
  })
];

const failed = tests.filter((item) => item.status !== "passed");
writeJson(reportPath, {
  version: "oam.authority-cleanup-mutation-tests.v1",
  checkedAtUtc: stableTimestamp(reportPath, {
    version: "oam.authority-cleanup-mutation-tests.v1",
    checkedAtUtc: "pending",
    status: failed.length === 0 ? "passed" : "failed",
    mutationCount: tests.length,
    failedMutationCount: failed.length,
    tests
  }, "checkedAtUtc"),
  status: failed.length === 0 ? "passed" : "failed",
  mutationCount: tests.length,
  failedMutationCount: failed.length,
  tests
});

if (failed.length > 0) {
  for (const item of failed) console.error(`${item.id}: ${item.messageZh}`);
  process.exit(1);
}

console.log(`Authority cleanup mutation tests: PASS (${tests.length})`);

function mutationTest(id, fn) {
  try {
    const detected = fn();
    return {
      id,
      status: detected ? "passed" : "failed",
      messageZh: detected ? "突变已被门禁识别。" : "突变未被门禁识别，必须修复。"
    };
  } catch (error) {
    return {
      id,
      status: "failed",
      messageZh: `突变测试执行异常：${error.message}`
    };
  }
}

function validateAuthorityIndex(doc) {
  const violations = [];
  const sourceWhitelist = new Set(doc.classificationModel?.sourceLayerWhitelist ?? []);
  for (const entry of doc.entries ?? []) {
    if (entry.layer === "source" && !sourceWhitelist.has(entry.path)) {
      violations.push({ id: "source_not_whitelisted", path: entry.path });
    }
    if (entry.layer === "generated" && entry.manualEditAllowed !== false) {
      violations.push({ id: "generated_manual_edit_allowed", path: entry.path });
    }
    if (entry.generated === true && entry.businessFactAuthorityAllowed === true) {
      violations.push({ id: "generated_business_fact_allowed", path: entry.path });
    }
    if (entry.businessFactAuthorityAllowed === true && businessFactForbidden(entry.path)) {
      violations.push({ id: "business_fact_forbidden_path", path: entry.path });
    }
    if (entry.path === "docs/surface/surface-contract.yml" && entry.businessFactAuthorityAllowed === true) {
      violations.push({ id: "surface_business_fact_forbidden", path: entry.path });
    }
  }
  return violations;
}

function validateGeneratedManifest(manifest) {
  const violations = [];
  for (const field of ["generated", "doNotEdit", "generatedFrom", "sourceRefs", "sourceHash", "compilerInputDigest", "outputContentDigest", "deterministicSort"]) {
    const value = manifest[field];
    if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
      violations.push({ id: "generated_metadata_missing", field });
    }
  }
  return violations;
}

function validateRuntimeConsumer(consumer) {
  const violations = [];
  for (const source of consumer.consumes ?? []) {
    if (source.startsWith("docs/contracts/authority/") || source === "docs/business/domains/dormitory/handoff-contract.json") {
      violations.push({ id: "runtime_consumes_old_derived_source", source });
    }
  }
  return violations;
}

function validateGoNoGo(report) {
  const violations = [];
  if (report.controlPlaneGateResult?.status === "passed" && report.finalGoNoGo === "GO") {
    violations.push({ id: "ci_green_cannot_promote_go" });
  }
  return violations;
}

function validateDashboardReadonly(contract) {
  const violations = [];
  if (contract.businessFactWriteAllowed !== false) violations.push({ id: "dashboard_business_fact_write" });
  if (contract.financeFactWriteAllowed !== false) violations.push({ id: "dashboard_finance_fact_write" });
  if (contract.ledgerEntryWriteAllowed !== false) violations.push({ id: "dashboard_ledger_write" });
  if (contract.workItemDefinitionMutationAllowed !== false) violations.push({ id: "dashboard_workitem_definition_write" });
  for (const dashboard of contract.dashboards ?? []) {
    if (dashboard.writeFactsAllowed !== false) violations.push({ id: "dashboard_business_fact_write", dashboardId: dashboard.dashboardId });
    if (dashboard.writeFinancialFactsAllowed !== false) violations.push({ id: "dashboard_finance_fact_write", dashboardId: dashboard.dashboardId });
    if (dashboard.writeLedgerEntryAllowed !== false) violations.push({ id: "dashboard_ledger_write", dashboardId: dashboard.dashboardId });
    if (dashboard.modifyWorkItemDefinitionAllowed !== false) violations.push({ id: "dashboard_workitem_definition_write", dashboardId: dashboard.dashboardId });
    if (dashboard.truthOwnerAllowed !== false) violations.push({ id: "dashboard_truth_owner", dashboardId: dashboard.dashboardId });
  }
  return violations;
}

function validateLedgerEntryWriter(consumer) {
  const violations = [];
  const allowedFinanceKernel = consumer.owner === "finance-ledger-kernel" ||
    consumer.file === "docs/finance/finance-ledger-kernel.json";
  if ((consumer.writes ?? []).includes("LedgerEntry") && !allowedFinanceKernel) {
    violations.push({ id: "ledger_entry_non_finance_writer", file: consumer.file });
  }
  return violations;
}

function validateMissingAdmissionFallback(admissionSurface, searchIntentHub) {
  const violations = [];
  if (!/function\s+missingAdmissionState[\s\S]*prepareAllowed:\s*false[\s\S]*confirmAllowed:\s*false[\s\S]*productionAllowed:\s*false/.test(admissionSurface)) {
    violations.push({ id: "missing_admission_confirm_allowed" });
  }
  if (admissionSurface.includes("prepareAllowed: value.prepareAllowed !== false")) {
    violations.push({ id: "missing_admission_prepare_default_true" });
  }
  if (!/if\s*\(!hasExplicitAdmission\)\s*return\s+missingAdmissionState/.test(admissionSurface)) {
    violations.push({ id: "surface_missing_admission_bypasses_kernel" });
  }
  if (!searchIntentHub.includes("missingAdmissionState") || /prepareAllowed:\s*true[\s\S]{0,160}confirmAllowed:\s*true/.test(searchIntentHub)) {
    violations.push({ id: "search_missing_admission_infers_confirm" });
  }
  return violations;
}

function validateEvidenceGraphNodes(graph) {
  const violations = [];
  for (const node of graph.nodes ?? []) {
    for (const field of ["proofType", "source", "hash", "dependsOn"]) {
      const value = node[field];
      if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
        violations.push({ id: "evidence_node_missing_minimum_field", nodeId: node.id, field });
      }
    }
  }
  return violations;
}

function validateReleaseBinding(release) {
  const violations = [];
  const current = finalReport.latestCommit ?? finalReport.binding?.sourceCommitSha ?? currentGitHead;
  const stale = release.sourceCommitSha !== current || release.evidenceRunSha !== current;
  if (stale && (release.stale !== true || release.referenceOnly !== true || release.bindingStatus !== "stale")) {
    violations.push({ id: "release_old_sha_not_reference_only" });
  }
  if (stale && release.finalGoNoGo === "GO") {
    violations.push({ id: "release_stale_go" });
  }
  return violations;
}

function businessFactForbidden(file) {
  return [
    "docs/contracts/bi-kpi/",
    "docs/contracts/business/",
    "docs/contracts/definition/",
    "docs/contracts/read/",
    "docs/contracts/search/",
    "infra/db/",
    "schemas/",
    "scripts/",
    "services/",
    "apps/"
  ].some((prefix) => file.startsWith(prefix));
}

function cloneIndex() {
  return structuredClone(index);
}

function mustEntry(doc, file) {
  const entry = doc.entries.find((item) => item.path === file);
  if (!entry) throw new Error(`missing entry: ${file}`);
  return entry;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(abs(file), "utf8"));
}

function readText(file) {
  return fs.readFileSync(abs(file), "utf8");
}

function writeJson(file, value) {
  const full = abs(file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function stableTimestamp(file, nextDocument, field) {
  const full = abs(file);
  if (!fs.existsSync(full)) return new Date().toISOString();
  try {
    const previous = JSON.parse(fs.readFileSync(full, "utf8"));
    if (sameExceptField(previous, nextDocument, field)) {
      return previous[field] ?? new Date().toISOString();
    }
  } catch {
    return new Date().toISOString();
  }
  return new Date().toISOString();
}

function sameExceptField(left, right, field) {
  const leftClone = { ...left };
  const rightClone = { ...right };
  delete leftClone[field];
  delete rightClone[field];
  return JSON.stringify(leftClone) === JSON.stringify(rightClone);
}

function abs(file) {
  return path.join(root, file);
}

function gitHead() {
  try {
    return execSync("git rev-parse HEAD", { cwd: root, encoding: "utf8" }).trim();
  } catch {
    // Fall through to a stable non-SHA marker; validation will still treat old SHA as stale.
  }
  return "current-git-head-unavailable";
}
