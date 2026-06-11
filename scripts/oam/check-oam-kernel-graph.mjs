import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const graphPath = "docs/oam/oam-kernel-graph.json";
const decisionPath = "docs/business/dormitory/workitem-decision-table.json";
const definitionPath = "docs/contracts/definition/workitem-definition-registry.json";
const dbPath = "docs/contracts/database/oam-db-ownership-map.json";
const resultPath = "artifacts/oam/checks/oam-kernel-graph-result.json";
const requiredNodeTypes = new Set([
  "authorityFile",
  "systemKernel",
  "kernel",
  "domainKernel",
  "WorkItem",
  "Definition",
  "Command",
  "BusinessObject",
  "StateMachine",
  "DomainEvent",
  "LedgerEntry",
  "DatabaseTable",
  "Admission",
  "Evidence",
  "Search",
  "Projection",
  "Lens",
  "Mobile Surface",
  "PC Governance Surface",
  "GateScript",
  "Test",
  "ci",
  "engineeringLedger",
  "p0RuleLedger",
  "evidenceArtifact",
  "File"
]);
const requiredEdgeTypes = new Set([
  "owns",
  "writes",
  "reads",
  "requires",
  "emits",
  "projectsTo",
  "guardedBy",
  "testedBy",
  "evidencedBy",
  "derivedFrom",
  "forbiddenTo",
  "absorbedBy",
  "replacedBy",
  "referenceBlockedBy",
  "deletionProvenBy",
  "mustNotBeReferencedBy"
]);
const nodeRequiredFields = [
  "nodeId",
  "nodeType",
  "owner",
  "sourceFile",
  "runtimeBinding",
  "testBinding",
  "gateBinding",
  "evidenceBinding",
  "currentTruthAllowed",
  "deletionCondition"
];
const edgeRequiredFields = ["from", "to", "edgeType", "allowedDirection", "forbiddenDirection", "checker", "evidence"];
const fileFactAuthorityForbiddenPrefixes = [
  "apps/",
  "artifacts/oam/",
  "docs/contracts/authority/",
  "docs/contracts/bi-kpi/",
  "docs/contracts/business/",
  "docs/contracts/definition/",
  "docs/contracts/evidence/",
  "docs/contracts/generated/",
  "docs/contracts/read/",
  "docs/contracts/search/",
  "docs/oam/kernel-schemas/",
  "infra/db/migrations/",
  "schemas/",
  "scripts/",
  "services/",
  "tests/"
];
const violations = [];
const graph = readJson(graphPath);
const decisions = readJson(decisionPath);
const definitions = readJson(definitionPath);
const db = readJson(dbPath);
const nodes = graph.nodes ?? [];
const edges = graph.edges ?? [];
const nodeById = new Map(nodes.map((node) => [node.nodeId, node]));
const currentFiles = listCurrentFiles();

if (graph.version !== "oam.kernel-graph.v1" || graph.status !== "authoritative") {
  fail("graph_identity_invalid", "OAM 图谱必须声明 oam.kernel-graph.v1 authoritative。");
}
for (const schema of Object.values(graph.schemas ?? {})) {
  requirePath(schema, `图谱 schema ${schema}`);
}
for (const type of requiredNodeTypes) {
  if (!nodes.some((node) => node.nodeType === type)) {
    fail("graph_node_type_missing", `OAM 图谱缺少节点类型：${type}`);
  }
}
for (const type of requiredEdgeTypes) {
  if (!(graph.requiredEdgeTypes ?? []).includes(type)) {
    fail("graph_edge_type_missing", `OAM 图谱缺少关系类型：${type}`);
  }
}

for (const node of nodes) {
  for (const field of nodeRequiredFields) {
    const value = node[field];
    if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
      fail("graph_node_field_missing", `${node.nodeId ?? "<missing>"} 缺少 ${field}。`);
    }
  }
  requirePath(node.sourceFile, `${node.nodeId} sourceFile`, { allowEvidence: true });
  checkFileNodeAuthorityBoundary(node);
}
for (const edge of edges) {
  for (const field of edgeRequiredFields) {
    if (!edge[field]) fail("graph_edge_field_missing", `${edge.from ?? "<missing>"} -> ${edge.to ?? "<missing>"} 缺少 ${field}。`);
  }
  if (!nodeById.has(edge.from)) fail("graph_edge_from_missing", `关系 from 不存在：${edge.from}`);
  if (!nodeById.has(edge.to)) fail("graph_edge_to_missing", `关系 to 不存在：${edge.to}`);
  if (!requiredEdgeTypes.has(edge.edgeType)) fail("graph_edge_type_unknown", `未知关系类型：${edge.edgeType}`);
  requirePath(edge.checker, `${edge.edgeType} checker`, { allowEvidence: true });
}

for (const decision of (decisions.decisions ?? []).filter((item) => item.definitionRequired === true)) {
  requireNode(`workitem.${decision.workItemType}`, "当前 WorkItem");
  requireNode(`definition.${decision.definitionId}`, "当前 Definition");
  requireNode(`command.${decision.commandType}`, "当前 Command");
}
for (const definition of (definitions.definitions ?? []).filter((item) => item.definitionMode === "oam-certification-current")) {
  requireNode(`definition.${definition.definitionId}`, "当前 Definition 注册项");
}
for (const group of db.tableGroups ?? []) {
  requireNode(`dbgroup.${group.groupId}`, "数据库表组");
  for (const table of group.tables ?? []) {
    requireNode(`table.${table.table}`, "数据库表");
  }
}
for (const file of currentFiles) {
  const fileNodeId = `file.${file}`;
  if (!nodeById.has(fileNodeId)) {
    fail("graph_file_node_missing", `当前文件缺少 File 节点：${file}`);
  }
}

writeResult();

if (violations.length) {
  for (const violation of violations) console.error(`${violation.id}: ${violation.message}`);
  process.exit(1);
}

console.log(`OAM kernel graph check: PASS (nodes=${nodes.length}, edges=${edges.length})`);

function requireNode(nodeId, label) {
  if (!nodeById.has(nodeId)) fail("graph_required_node_missing", `${label} 缺少节点：${nodeId}`);
}

function checkFileNodeAuthorityBoundary(node) {
  if (node.nodeType !== "File") return;
  const file = String(node.sourceFile ?? "").replace(/\\/g, "/");
  if (node.currentTruthAllowed === true && fileFactAuthorityForbiddenPrefixes.some((prefix) => file.startsWith(prefix))) {
    fail("graph_file_truth_forbidden_path", `${file} 是 schema/read/BI/runtime/db/evidence/generated/validation 文件，不得在图谱中 currentTruthAllowed=true。`);
  }
  const hasGeneratedMarker = node.generated === true || node.doNotEdit === true || node.generatedBy || node.derivedFrom || node.lifecycleState === "derived_view";
  if (hasGeneratedMarker && node.currentTruthAllowed === true) {
    fail("graph_generated_file_truth_forbidden", `${file} 是 generated/derived 文件，图谱不得允许定义当前事实。`);
  }
  if (node.lifecycleState === "derived_view" && node.manualEditAllowed !== false) {
    fail("graph_derived_manual_edit_allowed", `${file} 是 derived_view，必须 manualEditAllowed=false。`);
  }
}

function listCurrentFiles() {
  const output = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8" });
  return output
    .split(/\r?\n/)
    .map((item) => item.trim().replace(/\\/g, "/"))
    .filter(Boolean)
    .filter((item) => !item.startsWith("artifacts/oam/authority-cleanup/"))
    .filter((item) => !item.startsWith("artifacts/oam/checks/"))
    .filter((item) => !item.startsWith("artifacts/oam/evidence/"))
    .filter((item) => !item.startsWith("artifacts/oam/test-results/"))
    .filter((item) => item !== "artifacts/oam/final-report.json")
    .sort((left, right) => left.localeCompare(right));
}

function readJson(file) {
  requirePath(file, file);
  try {
    return JSON.parse(fs.readFileSync(abs(file), "utf8"));
  } catch (error) {
    fail("json_invalid", `${file} 不是合法 JSON：${error.message}`);
    return {};
  }
}

function requirePath(file, label, options = {}) {
  if (options.allowEvidence && String(file).startsWith("artifacts/oam/")) return;
  if (!file || !fs.existsSync(abs(file))) {
    fail("path_missing", `${label} 不存在：${file}`);
  }
}

function writeResult() {
  const full = abs(resultPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify({
    version: "oam.kernel-graph-check.v1",
    checkedAtUtc: new Date().toISOString(),
    architecture: "oam.current",
    status: violations.length ? "failed" : "passed",
    nodeCount: nodes.length,
    edgeCount: edges.length,
    violationCount: violations.length,
    violations
  }, null, 2)}\n`, "utf8");
}

function fail(id, message) {
  violations.push({ id, severity: "P0", message });
}

function abs(file) {
  return path.join(root, file);
}
