import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const violations = [];

const authorityFiles = [
  "docs/oma/current-architecture.md",
  "docs/oma/current-architecture.manifest.json",
  "docs/system/current-system-map.md",
  "docs/contracts/oma.current.json",
  ".github/pull_request_template.md",
  ".github/workflows/ci.yml"
];

for (const file of authorityFiles) {
  requireFile(file);
}

const contract = readJson("docs/contracts/oma.current.json");
const manifest = readJson("docs/oma/current-architecture.manifest.json");

if (contract.version !== "oma.current.v1") {
  violations.push("OMA contract must declare version oma.current.v1.");
}
if (contract.status !== "authoritative") {
  violations.push("OMA contract must be authoritative.");
}
if (contract.primaryWritePath !== "POST /api/operations/work-items/{workItemId}/confirm") {
  violations.push("OMA primary write path must be Operations Confirm.");
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
    violations.push(`Product Capability missing from OMA contract: ${capability}`);
  }
}

assertDirectory("services", ["core-api"]);
assertDirectory("modules", ["accommodation", "finance-gate", "identity", "maintenance"]);
assertDirectory("packages", ["surface-view-models"]);

for (const moduleName of ["accommodation", "finance-gate", "identity", "maintenance"]) {
  const moduleManifest = readJson(`modules/${moduleName}/oma-module.manifest.json`);
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
  violations.push("services/core-api must declare confirm-runtime responsibility in the OMA manifest.");
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
  violations.push("OMA API boundary must have exactly one businessConfirm route.");
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
  for (const pattern of retiredTermPatterns()) {
    if (pattern.test(text)) {
      violations.push(`${file} contains retired rule term ${pattern}.`);
    }
  }
}
for (const required of ["OMA", "API boundary", "module manifest", "database", "coverage"]) {
  if (!prTemplate.includes(required)) {
    violations.push(`PR template must include current OMA checklist term: ${required}`);
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
      violations.push(`${dir}/${name} is not allowed by current OMA.`);
    }
  }
  for (const name of allowed) {
    if ((dir === "services" && name !== "core-api") || (dir === "packages" && name !== "surface-view-models")) {
      continue;
    }
    if (!actual.includes(name)) {
      violations.push(`${dir}/${name} is required by current OMA.`);
    }
  }
}

function requireFile(file) {
  if (!fs.existsSync(path.join(root, file))) {
    violations.push(`Required OMA authority file missing: ${file}`);
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

function retiredTermPatterns() {
  const exact = (parts) => new RegExp(parts.join("").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const word = (parts) => new RegExp(`\\b${parts.join("")}\\b`, "i");
  return [
    exact(["v", "5", ".", "4"]),
    exact(["v", "5", "_", "4"]),
    exact(["v", "5", ".", "5"]),
    exact(["v", "5", "_", "5"]),
    word(["O", "A", "M"]),
    word(["R", "T"]),
    word(["M", "R"]),
    exact(["WON", "-", "18"]),
    exact(["attes", "tation"]),
    exact(["evidence", " ", "phase"])
  ];
}
