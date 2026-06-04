import fs from "node:fs";
import path from "node:path";
import {
  currentHead,
  exists,
  failIfNeeded,
  readJson,
  updateProjectHygiene,
  writeJson
} from "./project/project-hygiene-lib.mjs";

const contractPath = "docs/contracts/company-kernels/company-kernel-alignment-contract.json";
const mapPath = "docs/architecture/business-reality-oam-kernel-map.json";
const resultPath = "artifacts/oam-cab/company-kernel-alignment-result.json";
const requiredKernelIds = [
  "BusinessDomainKernel",
  "MasterObjectKernel",
  "TruthBoundaryKernel",
  "FinanceTruthKernel",
  "EventStateSummaryKernel",
  "BIKPIKernel",
  "AccountApplicationBoundaryKernel"
];
const generatedAtUtc = new Date().toISOString();
const noGoItems = [];

const contract = readJson(contractPath);
const realityMap = readJson(mapPath);
const activeComponents = readText("docs/architecture/active-components.yml");
const baseline = readText("docs/architecture/CURRENT_ARCHITECTURE_BASELINE.md");
const contractIndex = readJson("docs/contracts/oam-cab/contract-index.json");
const definitionRegistry = readJson("docs/contracts/definition/workitem-definition-registry.json");
const admissionContract = readJson("docs/contracts/admission/admission-contract.json");
const evidenceGraphRefs = readJson("docs/contracts/evidence/evidence-graph-refs-contract.json");

checkContractShape();
checkRealityMap();
checkActiveArchitecture();
checkRegistryScope();
checkAdmissionScope();
checkEvidenceBinding();
checkReadSideAndControlPlanePolicies();

const result = {
  generatedAtUtc,
  generatedBy: "check-company-kernel-alignment",
  stage: "OAM-CAB-V1.1-COMPANY-KERNEL-ALIGNMENT",
  status: noGoItems.length ? "failed" : "passed",
  headSha: currentHead(),
  contractRef: contractPath,
  businessRealityMapRef: mapPath,
  kernelCount: requiredKernelIds.length,
  kernels: requiredKernelIds.map((kernelId) => ({
    kernelId,
    activeComponent: activeComponents.includes(`- id: ${kernelId}`),
    mappedBusinessReality: (realityMap.mapping ?? []).some((item) => item.kernelId === kernelId),
    proofRefs: proofRefsFor(kernelId)
  })),
  definitionRegistryScope: definitionRegistry.companyKernelScope,
  evidenceGraphProofRef: resultPath,
  noGoItems,
  nextStageAllowed: false,
  productionAllowed: false,
  dormitoryL2ProductionAllowed: false,
  businessProduction: "blocked",
  repairPartsHrStatus: "L0 Contract Preview"
};

writeJson(resultPath, result);
updateProjectHygiene("company_kernel_alignment", result);
failIfNeeded(noGoItems, "company kernel alignment check");
console.log("company kernel alignment check: PASS");

function checkContractShape() {
  if (contract.version !== "oam-cab.company-kernel-alignment.v1") noGoItems.push("company kernel contract version mismatch.");
  if (contract.nextStageAllowed !== false) noGoItems.push("company kernel contract must block nextStageAllowed.");
  if (contract.businessProductionAllowed !== false) noGoItems.push("company kernel contract must block Business Production.");
  if (contract.noNewBusinessFeature !== true) noGoItems.push("company kernel alignment must be no-new-business-feature.");
  assertExactIds(contract.kernelIds ?? [], "company kernel contract kernelIds");

  const kernels = new Map((contract.kernels ?? []).map((kernel) => [kernel.kernelId, kernel]));
  for (const kernelId of requiredKernelIds) {
    const kernel = kernels.get(kernelId);
    if (!kernel) {
      noGoItems.push(`company kernel contract missing ${kernelId}.`);
      continue;
    }
    for (const field of ["name", "status", "owns", "mustNotOwn", "contractRefs", "guardRefs", "evidenceRefs"]) {
      if (!hasValue(kernel[field])) noGoItems.push(`${kernelId} missing ${field}.`);
    }
    if (kernel.status !== "active") noGoItems.push(`${kernelId} must be active.`);
    for (const ref of [...(kernel.contractRefs ?? []), ...(kernel.guardRefs ?? []), ...(kernel.evidenceRefs ?? [])]) {
      if (!exists(ref)) noGoItems.push(`${kernelId} references missing proof file: ${ref}`);
    }
  }
}

function checkRealityMap() {
  if (realityMap.version !== "oam-cab.business-reality-kernel-map.v1") noGoItems.push("business reality map version mismatch.");
  if (realityMap.nextStageAllowed !== false) noGoItems.push("business reality map must block nextStageAllowed.");
  const mapped = (realityMap.mapping ?? []).map((item) => item.kernelId);
  assertExactIds(mapped, "business reality map kernelIds");
  for (const item of realityMap.mapping ?? []) {
    for (const field of ["businessReality", "kernelId", "oamEntry", "runtimeBoundary"]) {
      if (!hasValue(item[field])) noGoItems.push(`business reality mapping for ${item.kernelId ?? "<unknown>"} missing ${field}.`);
    }
  }
}

function checkActiveArchitecture() {
  for (const kernelId of requiredKernelIds) {
    const block = componentBlock(activeComponents, kernelId);
    if (!block) {
      noGoItems.push(`active-components.yml missing ${kernelId}.`);
      continue;
    }
    if (!/status:\s*active/.test(block)) noGoItems.push(`${kernelId} must be active in active-components.yml.`);
    for (const field of ["name", "path", "owner_domain", "reason", "allowed_usage", "forbidden_usage", "evidence"]) {
      if (!new RegExp(`${field}:\\s*\\S`).test(block)) noGoItems.push(`${kernelId} active component missing ${field}.`);
    }
  }
  for (const term of [
    "OAM-CAB v1.1 公司级内核对齐",
    "Business Domain Kernel",
    "Master Object Kernel",
    "Truth Boundary Kernel",
    "Finance Truth Kernel",
    "Event-State-Summary Kernel",
    "BI/KPI Kernel",
    "Account/Application Boundary Kernel",
    "不进入下一业务阶段"
  ]) {
    if (!baseline.includes(term)) noGoItems.push(`CURRENT_ARCHITECTURE_BASELINE.md missing company-kernel statement: ${term}`);
  }
  if (contractIndex.contracts?.companyKernelAlignmentContract !== contractPath) {
    noGoItems.push("contract-index missing companyKernelAlignmentContract.");
  }
  if (contractIndex.contracts?.businessRealityKernelMap !== mapPath) {
    noGoItems.push("contract-index missing businessRealityKernelMap.");
  }
}

function checkRegistryScope() {
  const scope = definitionRegistry.companyKernelScope;
  if (!scope) {
    noGoItems.push("Definition Registry missing companyKernelScope.");
    return;
  }
  for (const field of ["eventDefinitions", "stateDefinitions", "summaryDefinitions", "metricDefinitions"]) {
    if (!Array.isArray(scope[field]) || scope[field].length === 0) {
      noGoItems.push(`Definition Registry companyKernelScope missing ${field}.`);
      continue;
    }
    for (const item of scope[field]) {
      for (const itemField of ["definitionId", "ownerKernel", "refs"]) {
        if (!hasValue(item[itemField])) noGoItems.push(`${field} item missing ${itemField}.`);
      }
      for (const ref of item.refs ?? []) {
        if (!exists(ref)) noGoItems.push(`${item.definitionId} references missing Definition Registry scope ref: ${ref}`);
      }
    }
  }
}

function checkAdmissionScope() {
  const authorities = admissionContract.inputAuthorities ?? {};
  for (const key of ["actor", "device", "businessLine", "risk", "evidence", "releaseState"]) {
    if (!authorities[key]) noGoItems.push(`Admission contract missing input authority: ${key}.`);
  }
  for (const output of ["requiredCapabilities", "requiredDeviceTrust", "businessLineState", "releaseState", "blockingSources", "noGoItems"]) {
    if (!admissionContract.outputFields?.[output]) noGoItems.push(`Admission contract missing output field: ${output}.`);
  }
}

function checkEvidenceBinding() {
  if (!Array.isArray(evidenceGraphRefs.requiredRefs) || !evidenceGraphRefs.requiredRefs.includes(resultPath)) {
    noGoItems.push("evidence-graph-refs-contract must require company kernel alignment proof artifact.");
  }
  if (contract.evidenceGraphPolicy?.proofArtifact !== resultPath) {
    noGoItems.push("company kernel contract proofArtifact must match generated result path.");
  }
}

function checkReadSideAndControlPlanePolicies() {
  for (const field of ["search", "language", "projection"]) {
    if (!contract.readSideKernelPolicy?.[field]) noGoItems.push(`readSideKernelPolicy missing ${field}.`);
  }
  if (contract.controlPlanePolicy?.directBusinessFactWriteAllowed !== false) {
    noGoItems.push("ControlPlane/ManagementCockpit policy must forbid direct business fact writes.");
  }
  if (!readText("docs/contracts/control-plane/control-plane-command-append-only-contract.json").includes("businessFactWriteAllowed")) {
    noGoItems.push("ControlPlaneCommand contract must declare businessFactWriteAllowed.");
  }
}

function proofRefsFor(kernelId) {
  const kernel = (contract.kernels ?? []).find((item) => item.kernelId === kernelId) ?? {};
  return {
    contracts: kernel.contractRefs ?? [],
    guards: kernel.guardRefs ?? [],
    evidence: kernel.evidenceRefs ?? []
  };
}

function assertExactIds(actual, label) {
  const expected = [...requiredKernelIds].sort();
  const got = [...actual].sort();
  if (expected.length !== got.length || expected.some((id, index) => id !== got[index])) {
    noGoItems.push(`${label} must exactly be ${expected.join(", ")}; actual ${got.join(", ")}.`);
  }
}

function componentBlock(text, id) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`(^|\\n)\\s*-\\s+id:\\s*${escaped}\\s*\\n[\\s\\S]*?(?=\\n\\s*-\\s+id:\\s|$)`));
  return match ? match[0] : "";
}

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return typeof value === "string" ? value.trim().length > 0 : value !== undefined && value !== null;
}

function readText(relativePath) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}
