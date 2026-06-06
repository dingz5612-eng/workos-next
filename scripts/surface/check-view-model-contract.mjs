import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const contractPath = "docs/surface/view-model-contract.yml";
const packagePath = "packages/surface-view-models/src/index.js";
const mobileVmPath = "apps/mobile/src/viewModels/index.js";
const pcVmPath = "apps/pc/src/viewModels/index.js";
const artifactPath = "artifacts/oam/checks/view-model-contract-result.json";

const violations = [];
const contract = readJson(contractPath);
const packageSource = read(packagePath);
const mobileVmSource = read(mobileVmPath);
const pcVmSource = read(pcVmPath);
const experienceSource = read("apps/mobile/src/views/experienceComponents.js");
const searchSource = read("apps/mobile/src/views/searchView.js");

for (const relativePath of [
  "docs/surface/surface-product-experience-architecture.md",
  contractPath,
  "schemas/surface/view-model-contract.schema.json",
  packagePath,
  mobileVmPath,
  pcVmPath
]) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    violations.push(v("view_model.file_missing", `缺少 ViewModel 合同文件：${relativePath}`, { relativePath }));
  }
}

if (contract.architecture !== "Runtime data -> ViewModel adapter -> User-facing surface") {
  violations.push(v("view_model.architecture_axis", "ViewModel 合同必须声明 Runtime data -> ViewModel adapter -> User-facing surface。"));
}

if (contract.centerModel?.viewModelFactSourceAllowed !== false) {
  violations.push(v("view_model.fact_source_not_blocked", "ViewModel 不得成为业务事实源。"));
}

for (const name of contract.viewModels || []) {
  if (!new RegExp(`export function ${name}\\b`).test(packageSource)) {
    violations.push(v("view_model.export_missing", `packages/surface-view-models 缺少 ${name}。`, { name }));
  }
  if (!mobileVmSource.includes(name) && !["PcFinanceCaseVM", "PcManagerTowerVM", "GovernanceTraceVM", "ReleaseControlVM", "AuditTraceVM"].includes(name)) {
    violations.push(v("view_model.mobile_reexport_missing", `mobile viewModels 未重新导出 ${name}。`, { name }));
  }
}

for (const ref of contract.sourceRefsRequired || []) {
  if (!packageSource.includes(ref)) {
    violations.push(v("view_model.source_ref_missing", `ViewModel sourceRefs 缺少 ${ref}。`, { ref }));
  }
}

for (const token of ["fetch(", "XMLHttpRequest", "localStorage.setItem", "DomainEvent", "LedgerEntry", "LedgerTransaction"]) {
  if (packageSource.includes(token)) {
    violations.push(v("view_model.forbidden_write_token", `ViewModel 包不得包含写入或事实源 token：${token}`, { token }));
  }
}

if (!packageSource.includes("retiredWorkItemKey")) {
  violations.push(v("view_model.retired_key_missing", "workspaceId:cardId 只能命名为 retiredWorkItemKey。"));
}

if (!experienceSource.includes("WorkItemDecisionVM") || !experienceSource.includes("TrustedConfirmVM")) {
  violations.push(v("view_model.mobile_component_not_using_vm", "移动端体验组件必须消费 WorkItemDecisionVM / TrustedConfirmVM。"));
}

if (!searchSource.includes("SearchResultVM")) {
  violations.push(v("view_model.search_not_using_vm", "Search 必须消费 SearchResultVM，禁止直接渲染 DTO。"));
}

if (!pcVmSource.includes("PcFinanceCaseVM") || !pcVmSource.includes("PcManagerTowerVM")) {
  violations.push(v("view_model.pc_vm_missing", "PC viewModels 必须包含 Finance / Manager VM。"));
}

if (contract.statusBoundary?.dormitoryL2ProductionAllowed !== false || contract.statusBoundary?.businessProductionGo !== false) {
  violations.push(v("view_model.production_boundary", "ViewModel 合同不得放开 L2 或 Business Production。"));
}

writeArtifact();
if (violations.length) {
  for (const item of violations) console.error(`${item.severity} ${item.id}: ${item.message}`);
  throw new Error("view model contract failed.");
}

console.log("view model contract check: PASS");

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function writeArtifact() {
  const fullPath = path.join(root, artifactPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify({
    generatedAtUtc: new Date().toISOString(),
    generatedBy: "scripts/surface/check-view-model-contract.mjs",
    status: violations.length ? "failed" : "passed",
    contractPath,
    packagePath,
    viewModels: contract.viewModels || [],
    productionAllowed: false,
    dormitoryL2ProductionAllowed: false,
    repairPartsHrProductionAllowed: false,
    violations
  }, null, 2)}\n`, "utf8");
}

function v(id, message, extra = {}) {
  return { severity: "P0", id, message, ...extra };
}
