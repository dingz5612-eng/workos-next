import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const contractPath = "docs/oam/system-failure-routing-contract.json";
const graphPath = "docs/oam/oam-kernel-graph.json";
const resultPath = "artifacts/oam/checks/system-failure-routing-contract-result.json";
const requiredFailures = new Set([
  "field_missing",
  "definition_missing",
  "permission_denied",
  "device_untrusted",
  "evidence_missing",
  "duplicate_submission",
  "finance_unbalanced",
  "projection_pending",
  "lens_stale",
  "derived_contract_mismatch",
  "file_unregistered",
  "p0_not_passed",
  "ci_evidence_missing",
  "db_owner_conflict",
  "surface_copy_out_of_boundary",
  "search_readonly_broken"
]);
const requiredFields = ["failureId", "owner", "recoveryPath", "blockingGate", "proofTest", "evidenceRecord", "failClosed"];
const violations = [];
const contract = readJson(contractPath);
const graph = readJson(graphPath);
const routes = contract.routes ?? [];

if (contract.version !== "oam.system-failure-routing-contract.v1" || contract.status !== "authoritative") {
  fail("failure_routing_identity_invalid", "系统失败路由合同必须声明 oam.system-failure-routing-contract.v1 authoritative。");
}
if (contract.architecture !== "oam.current") {
  fail("failure_routing_architecture_invalid", "系统失败路由合同必须绑定 oam.current。");
}
const routeIds = new Set(routes.map((route) => route.failureId));
for (const failure of requiredFailures) {
  if (!routeIds.has(failure)) fail("failure_route_missing", `缺少失败路由：${failure}`);
}
for (const route of routes) {
  for (const field of requiredFields) {
    if (!(field in route) || route[field] === "") {
      fail("failure_route_field_missing", `${route.failureId ?? "<missing>"} 缺少 ${field}。`);
    }
  }
  if (route.failClosed !== true) {
    fail("failure_route_not_fail_closed", `${route.failureId} 必须 failClosed=true。`);
  }
  requirePath(route.blockingGate, `${route.failureId} blockingGate`);
  requirePath(route.proofTest, `${route.failureId} proofTest`);
}
if (!graph.nodes?.some((node) => node.nodeId === "contract.failure-routing")) {
  fail("failure_routing_graph_node_missing", "OAM 图谱缺少失败路由合同节点。");
}

writeResult();

if (violations.length) {
  for (const violation of violations) console.error(`${violation.id}: ${violation.message}`);
  process.exit(1);
}

console.log("System failure routing contract check: PASS");

function readJson(file) {
  requirePath(file, file);
  try {
    return JSON.parse(fs.readFileSync(abs(file), "utf8"));
  } catch (error) {
    fail("json_invalid", `${file} 不是合法 JSON：${error.message}`);
    return {};
  }
}

function requirePath(file, label) {
  if (String(file).startsWith("artifacts/oam/")) return;
  if (!file || !fs.existsSync(abs(file))) {
    fail("path_missing", `${label} 不存在：${file}`);
  }
}

function writeResult() {
  const full = abs(resultPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify({
    version: "oam.system-failure-routing-contract-check.v1",
    checkedAtUtc: new Date().toISOString(),
    architecture: "oam.current",
    status: violations.length ? "failed" : "passed",
    routeCount: routes.length,
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
