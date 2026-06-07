import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const policyPath = "docs/oam/file-lifecycle-policy.json";
const graphPath = "docs/oam/oam-kernel-graph.json";
const resultPath = "artifacts/oam/checks/reference-blocker-result.json";
const scanExtensions = new Set([".cs", ".js", ".mjs", ".json", ".yml", ".yaml", ".md", ".sql", ".ps1", ".tsx", ".ts"]);
const skipSegments = new Set([".git", "node_modules", "bin", "obj", "dist", "TestResults"]);
const violations = [];
const policy = readJson(policyPath);
const graph = readJson(graphPath);
const currentFiles = listCurrentFiles();
const currentFileSet = new Set(currentFiles);
const fileNodes = (graph.nodes ?? []).filter((node) => node.nodeType === "File");
const deleteNowNodes = fileNodes.filter((node) => node.lifecycleState === "delete_now");
const blockedRefs = new Set([
  ...deleteNowNodes.map((node) => slash(node.sourceFile)).filter(Boolean),
  ...(policy.referenceBlockedPathPrefixes ?? [])
]);

for (const node of deleteNowNodes) {
  const file = slash(node.sourceFile);
  if (currentFileSet.has(file) || fs.existsSync(abs(file))) {
    fail("delete_now_file_exists", `delete_now 文件仍存在：${file}`);
  }
}

for (const ref of blockedRefs) {
  if (!ref) continue;
  for (const file of repositoryTextFiles()) {
    const relative = slash(path.relative(root, file));
    if (relative === policyPath || relative === graphPath || relative === resultPath) continue;
    const text = fs.readFileSync(file, "utf8");
    if (text.includes(ref)) {
      fail("blocked_reference_present", `被阻断引用仍存在：${relative} -> ${ref}`);
    }
  }
}

const requiredEdgeTypes = ["referenceBlockedBy", "deletionProvenBy", "mustNotBeReferencedBy"];
for (const edgeType of requiredEdgeTypes) {
  if (!(graph.requiredEdgeTypes ?? []).includes(edgeType)) {
    fail("blocked_reference_edge_type_missing", `OAM 图谱缺少引用阻断关系：${edgeType}`);
  }
}

writeResult();

if (violations.length) {
  for (const violation of violations) console.error(`${violation.id}: ${violation.message}`);
  process.exit(1);
}

console.log("Reference blocker check: PASS");

function repositoryTextFiles() {
  return currentFiles
    .filter((file) => scanExtensions.has(path.extname(file)))
    .filter((file) => !file.split("/").some((segment) => skipSegments.has(segment)))
    .map(abs)
    .filter((file) => fs.existsSync(file));
}

function listCurrentFiles() {
  const output = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8" });
  return output
    .split(/\r?\n/)
    .map((item) => slash(item.trim()))
    .filter(Boolean)
    .filter((item) => !item.startsWith("artifacts/oam/checks/"))
    .filter((item) => !item.startsWith("artifacts/oam/evidence/"))
    .filter((item) => !item.startsWith("artifacts/oam/test-results/"))
    .filter((item) => item !== "artifacts/oam/final-report.json")
    .sort((left, right) => left.localeCompare(right));
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(abs(file), "utf8"));
  } catch (error) {
    fail("json_invalid", `${file} 不是合法 JSON：${error.message}`);
    return {};
  }
}

function writeResult() {
  const full = abs(resultPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify({
    version: "oam.reference-blocker-check.v1",
    checkedAtUtc: new Date().toISOString(),
    architecture: "oam.current",
    status: violations.length ? "failed" : "passed",
    blockedReferenceCount: blockedRefs.size,
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

function slash(value) {
  return String(value || "").replace(/\\/g, "/");
}
