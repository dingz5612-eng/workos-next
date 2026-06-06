import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const artifactPath = "artifacts/oam/checks/surface-productization-result.json";
const violations = [];
const files = [
  "packages/surface-view-models/src/index.js",
  "apps/mobile/src/viewModels/index.js",
  "apps/pc/src/viewModels/index.js",
  "docs/surface/view-model-contract.yml",
  "docs/surface/surface-product-experience-architecture.md"
];

for (const relativePath of files) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    violations.push(v("experience_envelope.file_missing", `缺少体验层文件：${relativePath}`, { relativePath }));
  }
}

const source = files.filter((file) => file.endsWith(".js")).map((file) => read(file)).join("\n");
for (const token of [
  "fetch(",
  "axios.",
  "insert into",
  "update ledger",
  "delete from",
  "DomainEvent(",
  "LedgerTransaction(",
  "CommandSubmission("
]) {
  if (source.toLowerCase().includes(token.toLowerCase())) {
    violations.push(v("experience_envelope.fact_write_token", `体验层不得包含事实写入 token：${token}`, { token }));
  }
}

if (!source.includes("sourceRefsFrom") || !source.includes("sourceRefs")) {
  violations.push(v("experience_envelope.source_refs_missing", "ExperienceEnvelope / ViewModel 必须保留 sourceRefs。"));
}

if (!read("docs/surface/view-model-contract.yml").includes('"viewModelFactSourceAllowed": false')) {
  violations.push(v("experience_envelope.fact_source_contract_missing", "合同必须明确 ViewModel 不得成为业务事实源。"));
}

writeArtifact();
if (violations.length) {
  for (const item of violations) console.error(`${item.severity} ${item.id}: ${item.message}`);
  throw new Error("experience envelope fact-source check failed.");
}

console.log("experience envelope fact-source check: PASS");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function writeArtifact() {
  const fullPath = path.join(root, artifactPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify({
    generatedAtUtc: new Date().toISOString(),
    generatedBy: "scripts/surface/check-experience-envelope-not-fact-source.mjs",
    status: violations.length ? "failed" : "passed",
    checkedFiles: files,
    viewModelFactSourceAllowed: false,
    productionAllowed: false,
    dormitoryL2ProductionAllowed: false,
    businessProduction: "blocked",
    repairPartsHrStatus: "L0 Contract Preview",
    violations
  }, null, 2)}\n`, "utf8");
}

function v(id, message, extra = {}) {
  return { severity: "P0", id, message, ...extra };
}
