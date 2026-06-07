import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const kernelPath = "docs/oam/system-operating-kernel.json";
const authorityPath = "docs/oam/current-authority-index.json";
const graphPath = "docs/oam/oam-kernel-graph.json";
const resultPath = "artifacts/oam/checks/system-operating-kernel-result.json";
const requiredKernelIds = new Set([
  "kernel.authority",
  "kernel.domain",
  "kernel.runtime",
  "kernel.finance-truth",
  "kernel.evidence",
  "kernel.admission",
  "kernel.projection-search-lens",
  "kernel.surface",
  "kernel.release-control",
  "kernel.engineering-ledger"
]);
const requiredFields = [
  "kernelId",
  "nameZh",
  "owner",
  "responsibilityZh",
  "inputs",
  "outputs",
  "forbiddenBehaviors",
  "upstreamAuthorities",
  "downstreamConsumers",
  "gates",
  "evidence",
  "failureHandling",
  "deletionCondition"
];
const violations = [];
const kernel = readJson(kernelPath);
const authority = readJson(authorityPath);

if (kernel.version !== "oam.system-operating-kernel.v1" || kernel.status !== "authoritative") {
  fail("system_kernel_identity", "系统运行内核必须声明 oam.system-operating-kernel.v1 authoritative。");
}
if (kernel.architecture !== "oam.current") {
  fail("system_kernel_architecture", "系统运行内核必须绑定 oam.current。");
}
if (kernel.authorityEntry !== authorityPath) {
  fail("system_kernel_authority_entry", "系统运行内核必须作为 current-authority-index 下级入口。");
}
for (const file of [authorityPath, kernel.currentSystemMap, kernel.machineContract, kernel.responsibilityMatrix, kernel.engineeringLedger, graphPath]) {
  requirePath(file, `系统内核引用 ${file}`);
}

const kernels = kernel.kernels ?? [];
const kernelIds = new Set(kernels.map((item) => item.kernelId));
for (const id of requiredKernelIds) {
  if (!kernelIds.has(id)) fail("system_kernel_required_missing", `系统运行内核缺少 ${id}。`);
}
for (const item of kernels) {
  for (const field of requiredFields) {
    const value = item[field];
    if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
      fail("system_kernel_field_missing", `${item.kernelId ?? "<missing>"} 缺少 ${field}。`);
    }
  }
  for (const gate of item.gates ?? []) {
    if (gate.startsWith("scripts/")) requirePath(gate, `${item.kernelId} gate`);
  }
  for (const upstream of item.upstreamAuthorities ?? []) {
    if (String(upstream).startsWith("docs/")) requirePath(upstream, `${item.kernelId} upstream`);
  }
}

const authorityEntries = new Set((authority.entries ?? []).map((entry) => entry.path));
for (const required of [kernelPath, "docs/oam/system-operating-kernel.md", graphPath]) {
  if (!authorityEntries.has(required)) {
    fail("system_kernel_authority_index_missing", `权威索引未登记系统内核入口：${required}`);
  }
}

writeResult();

if (violations.length) {
  for (const violation of violations) console.error(`${violation.id}: ${violation.message}`);
  process.exit(1);
}

console.log("System operating kernel check: PASS");

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
  if (!file || (!isEvidencePath(file) && !fs.existsSync(abs(file)))) {
    fail("path_missing", `${label} 不存在：${file}`);
  }
}

function isEvidencePath(file) {
  return String(file).startsWith("artifacts/oam/");
}

function writeResult() {
  const full = abs(resultPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify({
    version: "oam.system-operating-kernel-check.v1",
    checkedAtUtc: new Date().toISOString(),
    architecture: "oam.current",
    status: violations.length ? "failed" : "passed",
    kernelCount: kernels.length,
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
