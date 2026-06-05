import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

const contractPath = path.join(root, "docs/contracts/business-anchor/business-anchor-contract.json");
const contractIndexPath = path.join(root, "docs/contracts/oam-cab/contract-index.json");
const kernelPath = path.join(root, "apps/mobile/src/businessAnchorKernel.js");
const expectedScenarioIds = [
  "dorm-cert-001",
  "dorm-cert-002",
  "dorm-cert-003",
  "dorm-cert-004",
  "dorm-cert-005",
  "dorm-cert-006",
  "dorm-cert-007",
  "dorm-cert-008",
  "dorm-cert-009",
  "dorm-cert-010"
];

const contract = readJson(contractPath);
const contractIndex = readJson(contractIndexPath);
const kernel = readText(kernelPath);

if (contract.version !== "oam-cab.business-anchor-contract.v1") {
  failures.push("Business Anchor contract version mismatch.");
}
if (contract.kernel !== "Business Anchor Kernel") {
  failures.push("Business Anchor contract must declare Business Anchor Kernel.");
}
if (!String(contract.rule || "").includes("must not become authoritative business facts")) {
  failures.push("Business Anchor contract must state anchors are not authoritative facts.");
}
for (const field of ["residentName", "customerName", "contactName", "guestName", "leadName", "residentPhone", "customerPhone", "contactPhone", "phone", "mobile"]) {
  if (!contract.truthBoundary?.displaySearchOnlyFields?.includes(field)) {
    failures.push(`displaySearchOnlyFields must include ${field}.`);
  }
}
for (const forbidden of ["using name or phone as fact owner", "submitting anchor text as command truth", "letting frontend-generated anchors replace backend object ids"]) {
  if (!contract.truthBoundary?.forbiddenUses?.includes(forbidden)) {
    failures.push(`Business Anchor forbiddenUses missing: ${forbidden}.`);
  }
}
const scenarioIds = new Set((contract.scenarioAnchors || []).map((item) => item.scenarioId));
for (const scenarioId of expectedScenarioIds) {
  if (!scenarioIds.has(scenarioId)) failures.push(`Business Anchor contract missing ${scenarioId}.`);
}
if ((contract.scenarioAnchors || []).length !== 10) {
  failures.push("Business Anchor contract must cover exactly 10 dormitory sample scenarios.");
}
for (const scenario of contract.scenarioAnchors || []) {
  if (!Array.isArray(scenario.primaryTruthObjects) || scenario.primaryTruthObjects.length === 0) {
    failures.push(`${scenario.scenarioId} must declare primaryTruthObjects.`);
  }
  if (!Array.isArray(scenario.displayFields) || scenario.displayFields.length === 0) {
    failures.push(`${scenario.scenarioId} must declare displayFields.`);
  }
  if (!scenario.currentActionSource) {
    failures.push(`${scenario.scenarioId} must declare currentActionSource.`);
  }
}
if (contractIndex.contracts?.businessAnchorContract !== "docs/contracts/business-anchor/business-anchor-contract.json") {
  failures.push("contract-index must reference businessAnchorContract.");
}

for (const token of ["export function buildBusinessAnchor", "export function businessAnchorHtml", "maskPhone", "personAndPhoneAreDisplaySearchOnly"]) {
  if (!kernel.includes(token)) failures.push(`Business Anchor Kernel missing token: ${token}.`);
}
if (/fetch\(|localStorage\.setItem|postConfirm|submitCardOperation|confirmWorkItem/i.test(kernel)) {
  failures.push("Business Anchor Kernel must stay read-only and must not fetch, persist, or submit facts.");
}

const sharedUsageFiles = [
  "apps/mobile/src/views/experienceComponents.js",
  "apps/mobile/src/views/searchView.js",
  "apps/mobile/src/views/coachView.js",
  "apps/mobile/src/selectors/surfaceSelectors.js",
  "apps/mobile/src/selectors/searchSelectors.js",
  "apps/mobile/src/searchIntentHub.js"
];
for (const relative of sharedUsageFiles) {
  const text = readText(path.join(root, relative));
  if (!/businessAnchor|BusinessAnchor/.test(text)) {
    failures.push(`${relative} must use or preserve Business Anchor Kernel integration.`);
  }
}

writeResult();

if (failures.length) {
  console.error(JSON.stringify({ status: "failed", failures }, null, 2));
  throw new Error("Business Anchor Kernel check failed.");
}

console.log("Business Anchor Kernel check: PASS");

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    failures.push(`Cannot read JSON ${path.relative(root, filePath)}: ${error.message}`);
    return {};
  }
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    failures.push(`Cannot read file ${path.relative(root, filePath)}: ${error.message}`);
    return "";
  }
}

function writeResult() {
  const outputPath = path.join(root, "artifacts/surface/business-anchor-kernel-result.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify({
    status: failures.length ? "failed" : "passed",
    generatedAtUtc: new Date().toISOString(),
    contract: "docs/contracts/business-anchor/business-anchor-contract.json",
    scenarioCount: contract.scenarioAnchors?.length || 0,
    failures
  }, null, 2));
}
