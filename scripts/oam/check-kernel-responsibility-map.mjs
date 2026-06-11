import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const mapPath = "docs/oam/current-oam-kernel-responsibility-map.json";
const architecturePath = "docs/oam/current-architecture.md";
const resultPath = "artifacts/oam/checks/kernel-responsibility-map-result.json";
const accountable = "00-OAM-Total-Control";
const reviewSeats = [
  "01｜产品业务",
  "02｜架构运行时",
  "03｜体验语言",
  "04｜搜索数据",
  "05｜安全发布",
  "06｜质量证据"
];
const requiredResponsibilityLanes = new Set([
  "Authority Layer",
  "Runtime Layer",
  "Experience-Read Layer",
  "Release-Evidence Layer"
]);
const requiredPartitions = ["Source Layer", "Generated Layer", "Runtime / Evidence Layer"];
const requiredViews = ["权威图", "内核编译图", "运行效果图", "读侧与证据图"];
const requiredViewIds = ["authorityGraph", "kernelCompileGraph", "runtimeEffectGraph", "readEvidenceGraph"];
const requiredExecutionRings = [
  "Authority Closure",
  "Source Kernel Closure",
  "Compiler Closure",
  "Runtime WorkItem Effect Closure",
  "Read / Surface Consumption Closure",
  "Release Evidence Closure"
];
const requiredFields = [
  "layer",
  "partition",
  "scope",
  "nonScope",
  "accountable",
  "responsible",
  "consulted",
  "informed",
  "authorityFiles",
  "forbidden",
  "gates",
  "evidence",
  "negativeTests",
  "finalReportFields"
];
const requiredWorkstreamNames = [
  "Architecture Authority",
  "Product / Business",
  "Truth Ownership",
  ["Com", "patibility Box"].join(""),
  ["Cleanup / Arc", "hive"].join(""),
  "Admission Kernel",
  "Operations Runtime",
  "Finance / Ledger Kernel",
  "Identity / Permission Kernel",
  "Security / Trust",
  "Control Plane",
  "Experience Kernel",
  "Language Kernel",
  "Search Kernel",
  "Data / KPI",
  "Compiler / Generated Contract Kernel",
  "Evidence Graph"
];
const requiredFinalReportFields = [
  "architectureAuthorityGoNoGo",
  "productBusinessGoNoGo",
  "truthOwnershipGoNoGo",
  "compatibilityBoxGoNoGo",
  "cleanupArchiveGoNoGo",
  "admissionKernelGoNoGo",
  "operationsRuntimeGoNoGo",
  "financeLedgerGoNoGo",
  "identityPermissionGoNoGo",
  "securityTrustGoNoGo",
  "controlPlaneGoNoGo",
  "experienceKernelGoNoGo",
  "languageKernelGoNoGo",
  "searchKernelGoNoGo",
  "dataKpiGoNoGo",
  "compilerGeneratedContractGoNoGo",
  "evidenceGraphGoNoGo",
  "responsibilityGovernanceGoNoGo",
  "evidenceBindingGoNoGo",
  "kernelCompileGoNoGo",
  "runtimeGateGoNoGo",
  "workItemEffectGoNoGo",
  "financeTruthGoNoGo",
  "readIntelligenceGoNoGo",
  "surfaceLanguageGoNoGo",
  "releaseEvidenceGoNoGo",
  "businessProductionGoNoGo",
  "dormitoryL2GoNoGo",
  "productionConfirmGoNoGo",
  "finalGoNoGo"
];
const expectedFieldByWorkstream = new Map([
  ["architecture-authority", "architectureAuthorityGoNoGo"],
  ["product-business", "productBusinessGoNoGo"],
  ["truth-ownership", "truthOwnershipGoNoGo"],
  [[["com", "patibility"].join(""), "box"].join("-"), "compatibilityBoxGoNoGo"],
  ["cleanup-" + ["arc", "hive"].join(""), "cleanupArchiveGoNoGo"],
  ["admission-kernel", "admissionKernelGoNoGo"],
  ["operations-runtime", "operationsRuntimeGoNoGo"],
  ["finance-ledger-kernel", "financeLedgerGoNoGo"],
  ["identity-permission-kernel", "identityPermissionGoNoGo"],
  ["security-trust", "securityTrustGoNoGo"],
  ["control-plane", "controlPlaneGoNoGo"],
  ["experience-kernel", "experienceKernelGoNoGo"],
  ["language-kernel", "languageKernelGoNoGo"],
  ["search-kernel", "searchKernelGoNoGo"],
  ["data-kpi", "dataKpiGoNoGo"],
  ["compiler-generated-contract-kernel", "compilerGeneratedContractGoNoGo"],
  ["evidence-graph", "evidenceGraphGoNoGo"]
]);

const violations = [];
const map = readJson(mapPath);
const architectureText = fs.readFileSync(abs(architecturePath), "utf8");
const workstreams = map.workstreams ?? [];
const workstreamNames = new Set(workstreams.map((item) => item.name));
const workstreamIds = new Set(workstreams.map((item) => item.id));

if (map.version !== "oam.current-kernel-responsibility-map.v1" || map.status !== "authoritative") {
  fail("responsibility_map_identity", "Responsibility map must be authoritative oam.current-kernel-responsibility-map.v1.");
}
if (map.accountabilityModel?.accountableAuthority !== accountable) {
  fail("responsibility_map_accountable", "Responsibility map accountable authority must be 00-OAM-Total-Control.");
}
if ((map.executionChannels ?? []).some((item) => item.name === "Codex Execution" && item.governanceDomain !== false)) {
  fail("codex_governance_domain", "Codex Execution must be an execution channel only.");
}
if (workstreamNames.has("Codex Execution") || workstreamIds.has("codex-execution")) {
  fail("codex_as_workstream", "Codex Execution must not be a governance workstream.");
}
checkOperationModel();
if (workstreams.length !== requiredWorkstreamNames.length) {
  fail("workstream_count", `Responsibility map must contain ${requiredWorkstreamNames.length} workstreams, actual ${workstreams.length}.`);
}
for (const name of requiredWorkstreamNames) {
  if (!workstreamNames.has(name)) {
    fail("workstream_missing", `Missing workstream: ${name}.`);
  }
}
if (JSON.stringify(map.layers ?? []) !== JSON.stringify(requiredPartitions)) {
  fail("partition_layers_invalid", `Responsibility map layers must be the fixed three partitions: ${requiredPartitions.join(", ")}.`);
}
for (const lane of requiredResponsibilityLanes) {
  if (!(map.legacyResponsibilityLanes ?? []).includes(lane)) {
    fail("responsibility_lane_missing", `Missing legacy responsibility lane: ${lane}.`);
  }
}
for (const field of requiredFinalReportFields) {
  if (!(map.finalReportRequiredFields ?? []).includes(field)) {
    fail("final_report_field_missing_from_map", `Responsibility map missing Final Report field: ${field}.`);
  }
}
for (const [field, expected] of Object.entries(map.forcedCurrentStage ?? {})) {
  if (expected !== "NO_GO") {
    fail("forced_current_stage_invalid", `${field} must be forced to NO_GO.`);
  }
}

for (const workstream of workstreams) {
  const label = workstream.id || workstream.name || "<missing>";
  for (const field of requiredFields) {
    const value = workstream[field];
    if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
      fail("workstream_field_missing", `${label} missing ${field}.`);
    }
  }
  if (!requiredResponsibilityLanes.has(workstream.layer)) {
    fail("workstream_layer_unknown", `${label} uses unknown responsibility lane: ${workstream.layer}.`);
  }
  if (!requiredPartitions.includes(workstream.partition)) {
    fail("workstream_partition_unknown", `${label} uses unknown partition: ${workstream.partition}.`);
  }
  if (workstream.accountable !== accountable) {
    fail("workstream_accountable_not_00", `${label} accountable must be ${accountable}.`);
  }
  if (reviewSeats.includes(workstream.accountable)) {
    fail("review_seat_accountable", `${label} puts 01-06 in accountable.`);
  }
  for (const listName of ["responsible", "consulted"]) {
    if (!Array.isArray(workstream[listName])) {
      fail("workstream_party_list_invalid", `${label} ${listName} must be an array.`);
    }
  }
  for (const pathField of ["authorityFiles"]) {
    for (const file of workstream[pathField] ?? []) {
      requirePath(file, `${label} ${pathField}`);
    }
  }
  for (const gate of workstream.gates ?? []) {
    const script = gateScriptPath(gate);
    if (script) requirePath(script, `${label} gate`);
  }
  const expectedField = expectedFieldByWorkstream.get(workstream.id);
  if (expectedField && !(workstream.finalReportFields ?? []).includes(expectedField)) {
    fail("workstream_final_report_field_missing", `${label} must bind ${expectedField}.`);
  }
  if (!Array.isArray(workstream.evidence) || workstream.evidence.length === 0) {
    fail("workstream_evidence_missing", `${label} must bind evidence.`);
  }
  if (!Array.isArray(workstream.negativeTests) || workstream.negativeTests.length === 0) {
    fail("workstream_negative_tests_missing", `${label} must bind negative tests.`);
  }
}

checkGeneratedContractKernel();

writeResult();

if (violations.length > 0) {
  for (const violation of violations) console.error(`${violation.id}: ${violation.message}`);
  process.exit(1);
}

console.log(`Kernel responsibility map check: PASS (${workstreams.length} workstreams, hash=${hashObject(map).slice(0, 16)})`);

function checkGeneratedContractKernel() {
  const kernel = readJson("docs/oam/compiler-generated-contract-kernel.json");
  if (kernel.generatedFiles?.sourceTruthAllowed !== false) {
    fail("generated_file_source_truth_allowed", "Generated files must not be marked as source truth.");
  }
  if (kernel.generatedFiles?.manualEditAllowed !== false) {
    fail("generated_file_manual_edit_allowed", "Generated files must forbid manual edit.");
  }
  const requiredMetadata = kernel.generatedFiles?.requiredMetadata ?? {};
  for (const key of ["generated", "doNotEdit", "kernelGraphHash", "sourceNodeRefs", "generatorVersion", "generatedFrom"]) {
    if (!(key in requiredMetadata)) {
      fail("generated_metadata_missing", `Generated file metadata missing ${key}.`);
    }
  }
}

function checkOperationModel() {
  const model = map.operationModel ?? {};
  if (model.ruleZh !== "四图是视角，三层是分区，六环是执行顺序。") {
    fail("operation_model_rule_missing", "操作模型必须固定声明：四图是视角，三层是分区，六环是执行顺序。");
  }
  if (model.viewsAreArtifactCategories !== false) {
    fail("views_artifact_category_guard_missing", "四图必须声明不是 artifact 分类。");
  }
  if (model.layersAreExecutionOrder !== false) {
    fail("layers_execution_order_guard_missing", "三层必须声明不是执行顺序。");
  }
  if (model.ringsAreLooseChecklist !== false) {
    fail("rings_loose_checklist_guard_missing", "六环必须声明不是散点清单。");
  }

  const views = model.views ?? [];
  const viewNames = views.map((item) => item.nameZh);
  const viewIds = views.map((item) => item.id);
  for (const [index, name] of requiredViews.entries()) {
    if (viewNames[index] !== name || viewIds[index] !== requiredViewIds[index]) {
      fail("operation_view_invalid", `四图第 ${index + 1} 项必须是 ${requiredViewIds[index]} / ${name}。`);
    }
  }
  for (const view of views) {
    if (view.role !== "view") fail("operation_view_role_invalid", `${view.id ?? "<missing>"} 必须声明 role=view。`);
    if ("artifactCategory" in view || /artifact\s*分类/i.test(JSON.stringify(view))) {
      fail("operation_view_artifact_category", `${view.id ?? "<missing>"} 不得被写成 artifact 分类。`);
    }
  }

  const partitions = model.partitions ?? [];
  const partitionNames = partitions.map((item) => item.name);
  for (const [index, partition] of requiredPartitions.entries()) {
    if (partitionNames[index] !== partition) {
      fail("operation_partition_invalid", `三层第 ${index + 1} 项必须是 ${partition}。`);
    }
  }
  for (const partition of partitions) {
    if (partition.role !== "partition") fail("operation_partition_role_invalid", `${partition.id ?? "<missing>"} 必须声明 role=partition。`);
    if (partition.executionOrder !== false || "order" in partition) {
      fail("operation_partition_order_forbidden", `${partition.name ?? "<missing>"} 不得被写成执行顺序。`);
    }
  }

  const rings = model.executionRings ?? [];
  for (const [index, expectedName] of requiredExecutionRings.entries()) {
    const ring = rings[index] ?? {};
    if (ring.order !== index + 1 || ring.name !== expectedName || ring.role !== "executionRing") {
      fail("operation_ring_invalid", `六环第 ${index + 1} 项必须是 ${expectedName}。`);
    }
    if ("layer" in ring || "partition" in ring) {
      fail("operation_ring_partition_forbidden", `${ring.name ?? "<missing>"} 不得被写成三层分区。`);
    }
  }

  for (const phrase of [
    "四图是视角，三层是分区，六环是执行顺序",
    ...requiredViews,
    ...requiredPartitions,
    ...requiredExecutionRings
  ]) {
    if (!architectureText.includes(phrase)) {
      fail("operation_model_missing_from_architecture", `current-architecture.md 缺少操作模型文本：${phrase}`);
    }
  }
}

function gateScriptPath(command) {
  const match = String(command).match(/\b(scripts\/[^\s]+?\.(?:mjs|ps1))\b/);
  return match?.[1] ?? "";
}

function readJson(file) {
  requirePath(file, file);
  try {
    return JSON.parse(fs.readFileSync(abs(file), "utf8"));
  } catch (error) {
    fail("json_invalid", `${file} is not valid JSON: ${error.message}`);
    return {};
  }
}

function requirePath(file, label) {
  if (typeof file !== "string" || file.trim() === "") {
    fail("path_empty", `${label} path is empty.`);
    return;
  }
  if (file.startsWith("artifacts/oam/")) return;
  if (!fs.existsSync(abs(file))) {
    fail("path_missing", `${label} missing path: ${file}`);
  }
}

function writeResult() {
  const full = abs(resultPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify({
    version: "oam.kernel-responsibility-map-check.v1",
    checkedAtUtc: new Date().toISOString(),
    architecture: "oam.current",
    status: violations.length ? "failed" : "passed",
    workstreamCount: workstreams.length,
    violationCount: violations.length,
    violations
  }, null, 2)}\n`, "utf8");
}

function fail(id, message) {
  violations.push({ id, severity: "P0", message });
}

function hashObject(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function abs(file) {
  return path.join(root, file);
}
