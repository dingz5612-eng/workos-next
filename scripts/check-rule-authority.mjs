import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const violations = [];

const authorityFiles = [
  "docs/oam/current-architecture.md",
  "docs/oam/current-authority-index.json",
  "docs/oam/current-architecture.manifest.json",
  "docs/contracts/oam-responsibility-boundary-matrix.json",
  "docs/system/current-system-map.md",
  "docs/system/oam-authority-map.md",
  "docs/system/oam-rule-to-gate-map.md",
  "docs/system/oam-p0-rule-ledger.md",
  "docs/system/oam-p0-rule-ledger.json",
  "docs/system/oam-next-stage-admission.md",
  "docs/contracts/oam.current.json",
  ".github/pull_request_template.md",
  ".github/workflows/ci.yml"
];

for (const file of authorityFiles) {
  requireFile(file);
}

const contract = readJson("docs/contracts/oam.current.json");
const manifest = readJson("docs/oam/current-architecture.manifest.json");

if (contract.version !== "oam.current.v1") {
  violations.push("OAM contract must declare version oam.current.v1.");
}
if (contract.status !== "authoritative") {
  violations.push("OAM contract must be authoritative.");
}
if (contract.primaryWritePath !== "POST /api/operations/work-items/{workItemId}/confirm") {
  violations.push("OAM primary write path must be Operations Confirm.");
}

for (const capability of [
  "accommodation.resource",
  "accommodation.lead-reservation",
  "accommodation.checkin",
  "accommodation.lifecycle",
  "accommodation.checkout",
  "accommodation.service-task",
  "finance.payment",
  "finance.deposit",
  "finance.expense",
  "finance.reconciliation",
  "identity.account-actor",
  "governance.release-control"
]) {
  if (!contract.productCapabilities?.some((item) => item.id === capability)) {
    violations.push(`Product Capability missing from OAM contract: ${capability}`);
  }
}

assertDirectory("services", ["core-api"]);
assertDirectory("modules", ["accommodation", "finance-gate", "identity", "maintenance"]);
assertDirectory("packages", ["surface-view-models"]);

for (const moduleName of ["accommodation", "finance-gate", "identity", "maintenance"]) {
  const moduleManifest = readJson(`modules/${moduleName}/oam-module.manifest.json`);
  if (moduleManifest.module !== moduleName) {
    violations.push(`${moduleName} manifest has wrong module id.`);
  }
  for (const key of ["productCapability", "domainInvariant", "api", "database", "tests", "rules"]) {
    if (!Array.isArray(moduleManifest[key]) || moduleManifest[key].length === 0) {
      violations.push(`${moduleName} manifest must bind ${key}.`);
    }
  }
}

if (!manifest.services?.entries?.["core-api"]?.responsibilities?.includes("confirm-runtime")) {
  violations.push("services/core-api must declare confirm-runtime responsibility in the OAM manifest.");
}
if (manifest.services?.entries?.["ai-personalization"]?.emptyShellAllowed !== false) {
  violations.push("ai-personalization empty service shell must be forbidden.");
}
if (manifest.services?.entries?.workers?.emptyShellAllowed !== false) {
  violations.push("workers empty service shell must be forbidden.");
}
if (manifest.packages?.entries?.["surface-view-models"]?.forbidden?.includes("business-write") !== true) {
  violations.push("surface-view-models must forbid business-write logic.");
}
if (manifest.infra?.dockerCompose?.responsibility !== "local-postgres-runtime") {
  violations.push("infra/docker-compose.yml must declare local Postgres runtime responsibility.");
}

const apiBoundary = contract.apiBoundary?.writeRoutes ?? {};
if (!Array.isArray(apiBoundary.businessConfirm) || apiBoundary.businessConfirm.length !== 1) {
  violations.push("OAM API boundary must have exactly one businessConfirm route.");
}
if ((apiBoundary.businessConfirm ?? [])[0] !== contract.primaryWritePath) {
  violations.push("businessConfirm route must equal primaryWritePath.");
}

const prTemplate = readText(".github/pull_request_template.md");
const ciWorkflow = readText(".github/workflows/ci.yml");
for (const [file, text] of [
  [".github/pull_request_template.md", prTemplate],
  [".github/workflows/ci.yml", ciWorkflow]
]) {
  for (const pattern of previousTermPatterns()) {
    if (pattern.test(text)) {
      violations.push(`${file} contains previous rule term ${pattern}.`);
    }
  }
}
for (const required of ["OAM", "API boundary", "module manifest", "database", "coverage"]) {
  if (!prTemplate.includes(required)) {
    violations.push(`PR template must include current OAM checklist term: ${required}`);
  }
}

const ruleLedger = readText("docs/system/oam-p0-rule-ledger.md");
for (const ruleId of Array.from({ length: 14 }, (_, index) => `P0-${String(index + 1).padStart(2, "0")}`)) {
  if (!ruleLedger.includes(ruleId)) {
    violations.push(`OAM P0 rule ledger missing ${ruleId}.`);
  }
}
for (const required of ["权威文件", "结构化合同", "运行时执行点", "主门禁", "辅助门禁", "证据产物", "当前状态", "风险等级", "是否阻断发布", "中文风险说明"]) {
  if (!ruleLedger.includes(required)) {
    violations.push(`OAM P0 rule ledger missing column ${required}.`);
  }
}
const machineRuleLedger = readJson("docs/system/oam-p0-rule-ledger.json");
if (machineRuleLedger.status !== "authoritative") {
  violations.push("OAM P0 machine rule ledger must be authoritative.");
}
if (!Array.isArray(machineRuleLedger.rules) || machineRuleLedger.rules.length < 14) {
  violations.push("OAM P0 machine rule ledger must contain P0-01 through P0-14.");
}

const nextStageAdmission = readText("docs/system/oam-next-stage-admission.md");
for (const required of [
  "docs/system/oam-p0-rule-ledger.md",
  "artifacts/oam/evidence/evidence-graph.json",
  "artifacts/oam/final-report.json",
  "CI success 不等于 Business Production GO",
  "Coverage 达标不等于 Dormitory L2 GO",
  "Surface 可见不等于 confirmAllowed",
  "Search 命中不等于可办理",
  "final go/no-go",
  "next_stage_allowed"
]) {
  if (!nextStageAdmission.includes(required)) {
    violations.push(`OAM next-stage admission missing required rule: ${required}`);
  }
}

if (violations.length > 0) {
  for (const violation of violations) {
    console.error(violation);
  }
  throw new Error(`Rule authority check failed: ${violations.length} violation(s).`);
}

console.log("Rule authority check: PASS");

function assertDirectory(dir, allowed) {
  requireFile(dir);
  const actual = fs.readdirSync(path.join(root, dir), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const name of actual) {
    if (!allowed.includes(name)) {
      violations.push(`${dir}/${name} is not allowed by current OAM.`);
    }
  }
  for (const name of allowed) {
    if ((dir === "services" && name !== "core-api") || (dir === "packages" && name !== "surface-view-models")) {
      continue;
    }
    if (!actual.includes(name)) {
      violations.push(`${dir}/${name} is required by current OAM.`);
    }
  }
}

function requireFile(file) {
  if (!fs.existsSync(path.join(root, file))) {
    violations.push(`Required OAM authority file missing: ${file}`);
  }
}

function readText(file) {
  requireFile(file);
  return fs.existsSync(path.join(root, file)) ? fs.readFileSync(path.join(root, file), "utf8") : "";
}

function readJson(file) {
  const text = readText(file);
  try {
    return JSON.parse(text);
  } catch (error) {
    violations.push(`${file} is not valid JSON: ${error.message}`);
    return {};
  }
}

function previousTermPatterns() {
  const exact = (parts) => new RegExp(parts.join("").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const word = (parts) => new RegExp(`\\b${parts.join("")}\\b`, "i");
  return [
    exact(["v", "5", ".", "4"]),
    exact(["v", "5", "_", "4"]),
    exact(["v", "5", ".", "5"]),
    exact(["v", "5", "_", "5"]),
    word(["O", "M", "A"]),
    word(["R", "T"]),
    word(["M", "R"]),
    exact(["WON", "-", "18"]),
    exact(["evidence", " ", "phase"])
  ];
}
