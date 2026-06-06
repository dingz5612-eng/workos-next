import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const matrixPath = "docs/contracts/oam-responsibility-boundary-matrix.json";
const reportPath = "artifacts/oam/checks/oam-responsibility-boundary-matrix-result.json";
const requiredCategories = [
  "manuals",
  "architecture-contracts",
  "business-contracts",
  "admission-contracts",
  "truth-contracts",
  "rule-scripts",
  "runtime-services",
  "mobile-surface",
  "pc-governance-surface",
  "search-read-side",
  "database-assets",
  "tests-ci-evidence"
];

const violations = [];
const matrix = readJson(matrixPath);

if (matrix.version !== "oam.responsibility-boundary-matrix.v1" || matrix.status !== "authoritative") {
  fail("matrix_identity_invalid", "职责边界矩阵必须声明 oam.responsibility-boundary-matrix.v1 authoritative。");
}

const categories = matrix.categories ?? [];
const byCategory = new Map(categories.map((item) => [item.categoryId, item]));
for (const categoryId of requiredCategories) {
  if (!byCategory.has(categoryId)) {
    fail("category_missing", `职责边界矩阵缺少类别：${categoryId}`);
  }
}

for (const category of categories) {
  for (const field of ["categoryId", "displayNameZh", "upstreamAuthority", "acceptanceScript", "failureHandling", "reuseScope"]) {
    if (!category[field]) {
      fail("category_field_missing", `${category.categoryId ?? "<missing>"} 缺少 ${field}。`);
    }
  }
  for (const field of ["allowedResponsibilities", "forbiddenResponsibilities"]) {
    if (!Array.isArray(category[field]) || category[field].length === 0) {
      fail("category_list_missing", `${category.categoryId ?? "<missing>"} 缺少 ${field}。`);
    }
  }
  requirePath(category.upstreamAuthority, `${category.categoryId} 上游权威`);
  requirePath(category.acceptanceScript, `${category.categoryId} 验收脚本`);
}

for (const binding of matrix.currentContractBindings ?? []) {
  for (const field of ["contract", "owner", "checker", "runtimeBinding", "testBinding", "evidenceBinding"]) {
    if (!binding[field]) {
      fail("contract_binding_field_missing", `${binding.contract ?? "<missing>"} 缺少 ${field}。`);
    }
  }
  requirePath(binding.contract, `合同 ${binding.contract}`);
  requirePath(binding.checker, `合同检查器 ${binding.checker}`);
  requirePath(binding.runtimeBinding, `运行绑定 ${binding.runtimeBinding}`);
  requirePath(binding.testBinding, `测试绑定 ${binding.testBinding}`);
  if (!String(binding.evidenceBinding).startsWith("artifacts/oam/")) {
    fail("contract_evidence_not_oam", `${binding.contract} 的 evidenceBinding 必须位于 artifacts/oam。`);
  }
}

for (const contract of [
  "docs/contracts/oam.current.json",
  "docs/contracts/admission/admission-matrix.json",
  "docs/business/truth-owner-registry.yml",
  "docs/contracts/definition/workitem-definition-registry.json",
  "docs/contracts/search/search-contract.json",
  "docs/contracts/language/language-contract.json"
]) {
  if (!(matrix.currentContractBindings ?? []).some((binding) => binding.contract === contract)) {
    fail("required_contract_binding_missing", `关键合同缺少职责绑定：${contract}`);
  }
}

writeReport();

if (violations.length) {
  for (const item of violations) console.error(`${item.id}: ${item.message}`);
  process.exit(1);
}

console.log("OAM responsibility boundary matrix check: PASS");

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
  if (!file || !fs.existsSync(abs(file))) {
    fail("path_missing", `${label} 不存在：${file}`);
  }
}

function writeReport() {
  const full = abs(reportPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, JSON.stringify({
    checkedAt: new Date().toISOString(),
    architecture: "oam.current",
    status: violations.length ? "fail" : "pass",
    violations
  }, null, 2));
}

function fail(id, message) {
  violations.push({ id, severity: "P0", message });
}

function abs(file) {
  return path.join(root, file);
}
