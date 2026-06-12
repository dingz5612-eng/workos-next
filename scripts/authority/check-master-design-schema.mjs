import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const schemaPath = "schemas/authority/master-design.schema.json";
const contractPath = "docs/contracts/authority/master-design.contract.json";
const resultPath = "artifacts/oam/checks/master-design-schema-result.json";
const proofPath = "artifacts/oam/evidence/master-design-proof.json";
const writeProofArtifact = process.argv.includes("--write-proof") || process.env.OAM_WRITE_PROOF === "1";
const violations = [];

const schema = readJson(schemaPath);
const contract = readJson(contractPath);
const expectedOrder = [
  "catalog.GetWorkItem",
  "definitions.Resolve(workItem)",
  "unresolved 422 reject",
  "VerifiedDeviceTrustContext.FromServerSession",
  "admission.EvaluateConfirm",
  "OperationsCommandRequest",
  "unitOfWork.Commit",
  "RecordWorkItemTransition",
  "DispatchNextOperationWorkItem"
];

if (schema.$id !== "workosnext.authority.master-design.schema.v1") fail("master_design.schema_id", `${schemaPath} $id mismatch.`);
for (const field of [
  "version",
  "status",
  "architecture",
  "designId",
  "authorityRefs",
  "currentArchitectureUniqueEffective",
  "fourGraphViewPolicy",
  "threeLayerPartitionPolicy",
  "sixLoopExecutionOrder",
  "notGoSignals",
  "secondAuthorityForbiddenSources",
  "canonicalConfirmOrder",
  "blockedMutationClasses",
  "releaseLocks"
]) {
  if (!(schema.required ?? []).includes(field)) fail("master_design.schema_required", `${schemaPath} must require ${field}.`);
}
for (const [field, expected] of Object.entries({
  version: "workosnext.authority.master-design.v1",
  status: "authoritative-current-no-go",
  architecture: "oam.current"
})) {
  if (contract[field] !== expected) fail("master_design.contract_identity", `${contractPath} ${field} mismatch.`);
}
for (const ref of contract.authorityRefs ?? []) requirePath(ref, "authorityRefs");
checkCurrentArchitectureUniqueEffective();
checkFourThreeSixModel();
checkLayerOverreachPolicy();
checkNoGoSignalPolicy();
checkSecondAuthorityPolicy();
if (JSON.stringify(contract.canonicalConfirmOrder) !== JSON.stringify(expectedOrder)) {
  fail("master_design.confirm_order", "Canonical confirm order drifted.");
}
for (const mutationClass of ["UnitOfWork", "CommandSubmission", "DomainEvent", "WorkItemEvent", "LedgerTransaction", "LedgerEntry", "Outbox", "confirmed transition", "next work item", "projection", "lens", "search", "WriteLog"]) {
  if (!(contract.blockedMutationClasses ?? []).includes(mutationClass)) {
    fail("master_design.blocked_mutation_missing", `Missing blocked mutation class ${mutationClass}.`);
  }
}
for (const [field, expected] of Object.entries({
  businessProduction: "BLOCKED",
  dormitoryL2: "BLOCKED",
  productionConfirmAllowed: false,
  finalGoNoGo: "NO_GO",
  nextStageAllowed: false
})) {
  if (contract.releaseLocks?.[field] !== expected) fail("master_design.release_lock_drift", `releaseLocks.${field} must remain ${expected}.`);
}

writeResult();
if (writeProofArtifact) writeProof();
if (violations.length) {
  for (const item of violations) console.error(`${item.id}: ${item.message}`);
  process.exit(1);
}
console.log("Master design authority check: PASS");

function checkCurrentArchitectureUniqueEffective() {
  const policy = contract.currentArchitectureUniqueEffective ?? {};
  if (policy.architecture !== "oam.current" || policy.uniqueEffective !== true || policy.secondAuthorityAllowed !== false) {
    fail("master_design.unique_current_architecture", "Current architecture must be the only effective architecture and must forbid a second authority.");
  }
  if (policy.currentArchitectureRef) requirePath(policy.currentArchitectureRef, "currentArchitectureRef");
}

function checkFourThreeSixModel() {
  const requiredGraphs = ["authorityGraph", "kernelCompileGraph", "runtimeEffectGraph", "readEvidenceGraph"];
  const graphPolicies = new Map((contract.fourGraphViewPolicy ?? []).map((item) => [item.graphId, item]));
  for (const graphId of requiredGraphs) {
    const item = graphPolicies.get(graphId);
    if (!item) {
      fail("master_design.graph_missing", `Missing four-graph view policy ${graphId}.`);
      continue;
    }
    if (item.role !== "viewOnly" || item.notArtifactClass !== true) {
      fail("master_design.graph_not_view", `${graphId} must be viewOnly and not an artifact class.`);
    }
  }

  const expectedLoops = [
    "Authority Closure",
    "Source Kernel Closure",
    "Compiler Closure",
    "Runtime WorkItem Effect Closure",
    "Read / Surface Consumption Closure",
    "Release Evidence Closure"
  ];
  if (JSON.stringify(contract.sixLoopExecutionOrder) !== JSON.stringify(expectedLoops)) {
    fail("master_design.six_loop_order", "Six loops must remain the execution order.");
  }
}

function checkLayerOverreachPolicy() {
  const policies = new Map((contract.threeLayerPartitionPolicy ?? []).map((item) => [item.layerId, item]));
  for (const layerId of ["Source Layer", "Generated Layer", "Runtime / Evidence Layer"]) {
    const item = policies.get(layerId);
    if (!item) {
      fail("master_design.layer_missing", `Missing three-layer partition policy ${layerId}.`);
      continue;
    }
    if (item.executionOrderRole !== false) fail("master_design.layer_execution_role", `${layerId} must not be execution order.`);
    if (!Array.isArray(item.forbiddenOverreach) || item.forbiddenOverreach.length === 0) {
      fail("master_design.layer_overreach_missing", `${layerId} must declare forbidden overreach.`);
    }
  }
  if (policies.get("Generated Layer")?.allowedAuthorityWrite !== false) {
    fail("master_design.generated_authority_write", "Generated Layer must not write authority.");
  }
  if (policies.get("Runtime / Evidence Layer")?.allowedAuthorityWrite !== false) {
    fail("master_design.runtime_evidence_authority_write", "Runtime / Evidence Layer must not write authority.");
  }
}

function checkNoGoSignalPolicy() {
  for (const signal of ["ci.green", "artifact.exists", "browser.evidence", "finalReport.exists"]) {
    if (!(contract.notGoSignals ?? []).includes(signal)) {
      fail("master_design.not_go_signal_missing", `${signal} must be recorded as not equal to GO.`);
    }
  }
}

function checkSecondAuthorityPolicy() {
  for (const source of ["closed catalog", "closed seed", "generated view", "dashboard", "search", "surface"]) {
    if (!(contract.secondAuthorityForbiddenSources ?? []).includes(source)) {
      fail("master_design.second_authority_missing", `${source} must be forbidden as second authority.`);
    }
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function requirePath(file, label) {
  if (!fs.existsSync(path.join(root, file))) fail("master_design.path_missing", `${label} references missing path: ${file}`);
}

function fail(id, message) {
  violations.push({ id, message });
}

function writeResult() {
  fs.mkdirSync(path.dirname(path.join(root, resultPath)), { recursive: true });
  fs.writeFileSync(path.join(root, resultPath), `${JSON.stringify({
    version: "workosnext.authority.master-design-check.v1",
    checkedAtUtc: new Date().toISOString(),
    status: violations.length ? "failed" : "passed",
    violations
  }, null, 2)}\n`);
}

function writeProof() {
  fs.mkdirSync(path.dirname(path.join(root, proofPath)), { recursive: true });
  fs.writeFileSync(path.join(root, proofPath), `${JSON.stringify({
    version: "workosnext.authority.master-design-proof.v1",
    checkedAtUtc: new Date().toISOString(),
    status: violations.length ? "failed" : "passed",
    severityOnFailure: "P0",
    proves: [
      "Current architecture is the only effective architecture.",
      "Four graphs are views, three layers are partitions, and six loops are execution order.",
      "Source, Generated, and Runtime / Evidence layers cannot overreach each other.",
      "CI green, artifact exists, browser evidence, and Final Report exists do not equal GO.",
      "Closed catalog, closed seed, generated view, dashboard, search, and surface cannot become a second authority."
    ],
    proofRefs: {
      contract: contractPath,
      schema: schemaPath,
      currentArchitecture: contract.currentArchitectureUniqueEffective?.currentArchitectureRef
    },
    violations
  }, null, 2)}\n`);
}
