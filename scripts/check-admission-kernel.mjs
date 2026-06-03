import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const contract = readJson("docs/contracts/admission/admission-contract.json");
const matrix = readJson("docs/contracts/admission/admission-matrix.json");
const sources = readJson("docs/contracts/admission/admission-sources.json");
const currentState = readJson("artifacts/release-state/current-state.json");
const registry = readJson("docs/business/business-line-registry.json");
const surfacePolicy = readJson("docs/contracts/runtime-surface-policy.json");

checkContract();
checkSources();
checkMatrix();
checkBusinessLineAlignment();
checkHighRiskSurfaceReasons();
checkRuntimeImplementation();

if (failures.length > 0) {
  for (const failure of failures) console.error(`P0 ${failure}`);
  throw new Error("Admission Kernel check failed.");
}

console.log("Admission Kernel check: PASS");

function checkContract() {
  if (contract.version !== "oam.admission-contract.v1") failures.push("admission-contract version mismatch.");
  for (const field of [
    "visibleAllowed",
    "prepareAllowed",
    "confirmAllowed",
    "productionAllowed",
    "mode",
    "reason",
    "blockingSources",
    "requiredCapabilities",
    "requiredDeviceTrust",
    "businessLineState",
    "releaseState",
    "surfaceState",
    "noGoItems"
  ]) {
    if (!contract.outputFields?.[field]) failures.push(`admission-contract missing output field: ${field}`);
  }
}

function checkSources() {
  const ids = new Set((sources.sources || []).map((source) => source.id));
  for (const id of [
    "businessLineRegistry",
    "releaseState",
    "sliceManifest",
    "surfacePolicy",
    "apiBoundary",
    "factOwnership",
    "actorSession",
    "deviceTrust",
    "surface",
    "workItemDefinition"
  ]) {
    if (!ids.has(id)) failures.push(`admission-sources missing source: ${id}`);
  }
}

function checkMatrix() {
  const entries = matrix.entries || [];
  const requiredEntries = [
    "dormitory_l1_internal_pilot_observation",
    "dormitory_production_blocked",
    "repair_l0_contract_preview",
    "parts_l0_contract_preview",
    "hr_l0_contract_preview",
    "business_3_7_l0_contract_preview",
    "payment_confirmation",
    "deposit_refund",
    "period_close",
    "bulk_import",
    "production_confirm",
    "prepare_only",
    "contract_preview"
  ];
  for (const id of requiredEntries) {
    if (!entries.some((entry) => entry.id === id)) failures.push(`admission-matrix missing entry: ${id}`);
  }

  if (currentState.authoritativeState?.businessProduction === "BLOCKED") {
    for (const entry of entries) {
      if (entry.productionAllowed !== false) failures.push(`${entry.id} productionAllowed must be false while Business Production is BLOCKED.`);
    }
  }

  for (const entry of entries) {
    for (const field of ["visibleAllowed", "prepareAllowed", "confirmAllowed", "productionAllowed"]) {
      if (typeof entry[field] !== "boolean") failures.push(`${entry.id}.${field} must be boolean.`);
    }
    if (!entry.mode || !entry.reason || !Array.isArray(entry.blockingSources) || !Array.isArray(entry.noGoItems)) {
      failures.push(`${entry.id} must include mode, reason, blockingSources, and noGoItems.`);
    }
    if (entry.mode === "contract_preview" || entry.mode === "prepare_only") {
      if (entry.visibleAllowed === entry.confirmAllowed) failures.push(`${entry.id} must prove visibleAllowed is not confirmAllowed.`);
      if (entry.prepareAllowed === entry.productionAllowed) failures.push(`${entry.id} must prove prepareAllowed is not productionAllowed.`);
      if (entry.confirmAllowed !== false || entry.productionAllowed !== false) failures.push(`${entry.id} cannot confirm or produce.`);
    }
    if (entry.highRisk) {
      if (!Array.isArray(entry.requiredCapabilities) || entry.requiredCapabilities.length === 0) failures.push(`${entry.id} high-risk action requires capability.`);
      if (!Array.isArray(entry.requiredDeviceTrust) || entry.requiredDeviceTrust.length === 0) failures.push(`${entry.id} high-risk action requires device trust.`);
      if (!entry.reason || entry.reason.length < 20) failures.push(`${entry.id} high-risk action requires admission reason.`);
    }
  }
}

function checkBusinessLineAlignment() {
  const entries = matrix.entries || [];
  const productionConfirm = entries.find((entry) => entry.id === "production_confirm");
  if (productionConfirm?.productionAllowed !== false || productionConfirm?.confirmAllowed !== false) {
    failures.push("production_confirm must be blocked.");
  }

  for (const line of registry.businessLines || []) {
    if (line.productionAllowed !== false) failures.push(`${line.businessLineId} registry productionAllowed must remain false.`);
    if (line.productionConfirmAllowed !== false) failures.push(`${line.businessLineId} registry productionConfirmAllowed must remain false.`);
    if (!(line.blockedActions || []).includes("production_confirm")) failures.push(`${line.businessLineId} must block production_confirm.`);

    const lineEntries = entries.filter((entry) =>
      entry.businessLineId === line.businessLineId ||
      (entry.businessLineIds || []).includes(line.businessLineId)
    );
    if (lineEntries.length === 0) failures.push(`admission-matrix missing business line coverage: ${line.businessLineId}`);
    if (line.level === "L0 Contract Preview") {
      for (const entry of lineEntries) {
        if (entry.confirmAllowed !== false || entry.productionAllowed !== false) {
          failures.push(`${line.businessLineId} L0 Contract Preview can only prepare/learn, not confirm.`);
        }
      }
    }
  }
}

function checkHighRiskSurfaceReasons() {
  const policies = surfacePolicy.policies || [];
  for (const entry of matrix.entries || []) {
    if (!entry.highRisk || !Array.isArray(entry.surfaceRefs)) continue;
    for (const ref of entry.surfaceRefs) {
      const policy = policies.find((item) => item.sliceId === ref.sliceId);
      const card = (policy?.cards || []).find((item) => item.cardId === ref.cardId);
      if (!card) {
        failures.push(`${entry.id} references missing surface card: ${ref.sliceId}/${ref.cardId}`);
        continue;
      }
      if (!card.admissionReason || card.admissionReason.length < 20) {
        failures.push(`${ref.sliceId}/${ref.cardId} high-risk surface card must declare admissionReason.`);
      }
    }
  }
}

function checkRuntimeImplementation() {
  const admissionSource = read("services/core-api/WorkOS.Api/Runtime/AdmissionKernelService.cs");
  for (const term of [
    "AdmissionKernelService",
    "EvaluateConfirm",
    "EvaluateSearch",
    "ProductionAllowed",
    "ConfirmAllowed",
    "BusinessLineAdmissionRegistry",
    "production_blocked",
    "contract_preview"
  ]) {
    if (!admissionSource.includes(term)) failures.push(`AdmissionKernelService.cs missing ${term}.`);
  }

  const canonical = read("services/core-api/WorkOS.Api/Runtime/CanonicalOperationsApiService.cs");
  for (const term of [
    "admission.EvaluateConfirm",
    "AdmissionRejected",
    "[\"admission\"]",
    "[\"admissionDecisionRef\"]"
  ]) {
    if (!canonical.includes(term)) failures.push(`CanonicalOperationsApiService.cs missing Admission Kernel binding: ${term}.`);
  }

  const searchKernel = read("services/core-api/WorkOS.Api/Runtime/SearchKernelService.cs");
  if (!searchKernel.includes("admission.EvaluateSearch")) {
    failures.push("SearchKernelService must label search results through Admission Kernel.");
  }
}

function read(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) throw new Error(`Missing file: ${relativePath}`);
  return fs.readFileSync(fullPath, "utf8");
}

function readJson(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) throw new Error(`Missing file: ${relativePath}`);
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}
