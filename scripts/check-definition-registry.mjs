import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const registry = readJson("docs/contracts/definition/workitem-definition-registry.json");
const fieldRefs = readJson("docs/contracts/definition/field-contract-refs.json");
const evidenceRefs = readJson("docs/contracts/definition/evidence-policy-refs.json");
const riskRefs = readJson("docs/contracts/definition/risk-policy-refs.json");
const ledgerRefs = readJson("docs/contracts/definition/ledger-policy-refs.json");
const sliceManifest = readJson("docs/contracts/slice-manifest.json");
const surfacePolicy = readJson("docs/contracts/runtime-surface-policy.json");
const businessRegistry = readJson("docs/business/business-line-registry.json");
const factOwnership = read("docs/rules/v5.5/fact-ownership.yml");

const requiredLegacyCards = [
  "roomSetup",
  "bedSetup",
  "rateSetup",
  "roomReadiness",
  "roomBlock",
  "roomRelease",
  "depositAssessment",
  "depositReceipt",
  "depositConfirmation",
  "depositDeduction",
  "depositRefundApproval",
  "depositRefundPayment",
  "depositClose",
  "paymentReceipt",
  "paymentConfirmation",
  "paymentAllocation",
  "paymentAdjustment",
  "finalBalanceClose",
  "bedRelease",
  "periodClose",
  "expenseRecord",
  "ledgerCorrectionApply"
];

checkRegistryShape();
checkDefinitionCoverage();
checkDefinitionRefs();
checkSliceAndSurfaceAlignment();
checkFactOwnershipAlignment();
checkRuntimeImplementation();

if (failures.length > 0) {
  for (const failure of failures) console.error(`P0 ${failure}`);
  throw new Error("Definition Registry check failed.");
}

console.log("Definition Registry check: PASS");

function checkRegistryShape() {
  if (registry.version !== "oam.definition-registry.v1") failures.push("workitem-definition-registry version mismatch.");
  if (!String(registry.axis || "").includes("Definition -> OperationCase -> WorkItem -> CommandSubmission")) {
    failures.push("workitem-definition-registry must declare the Operations Runtime axis.");
  }
  if (!Array.isArray(registry.definitions) || registry.definitions.length < requiredLegacyCards.length) {
    failures.push("workitem-definition-registry must include all required definitions.");
  }
}

function checkDefinitionCoverage() {
  const byLegacyCard = new Map((registry.definitions || []).map((definition) => [definition.legacyCardId, definition]));
  for (const legacyCardId of requiredLegacyCards) {
    if (!byLegacyCard.has(legacyCardId)) failures.push(`Missing definition for ${legacyCardId}.`);
  }

  const seenDefinitionIds = new Set();
  for (const definition of registry.definitions || []) {
    for (const field of [
      "definitionId",
      "businessLineId",
      "sliceId",
      "workspaceId",
      "legacyCardId",
      "workItemType",
      "commandType",
      "ownerSlice",
      "fieldContractRef",
      "evidencePolicyRef",
      "riskPolicyRef",
      "ledgerPolicyRef",
      "admissionPolicyRef",
      "surfacePolicyRef",
      "definitionMode",
      "removalImpact"
    ]) {
      if (!present(definition[field])) failures.push(`${definition.legacyCardId || "<unknown>"} missing ${field}.`);
    }
    if (seenDefinitionIds.has(definition.definitionId)) failures.push(`Duplicate definitionId: ${definition.definitionId}.`);
    seenDefinitionIds.add(definition.definitionId);
    if (!Array.isArray(definition.allowedFacts) || definition.allowedFacts.length === 0) {
      failures.push(`${definition.definitionId} must declare allowedFacts.`);
    }
    if (!Array.isArray(definition.forbiddenFacts) || definition.forbiddenFacts.length === 0) {
      failures.push(`${definition.definitionId} must declare forbiddenFacts.`);
    }
    if (definition.productionConfirmAllowed !== false) {
      failures.push(`${definition.definitionId} productionConfirmAllowed must remain false in OAM-CAB v1.`);
    }
    const overlap = (definition.allowedFacts || []).filter((fact) => (definition.forbiddenFacts || []).includes(fact));
    if (overlap.length) failures.push(`${definition.definitionId} has facts in both allowedFacts and forbiddenFacts: ${overlap.join(", ")}.`);
    if (definition.definitionMode !== "governance-provisional" && definition.ownerSlice !== definition.sliceId) {
      failures.push(`${definition.definitionId} ownerSlice must equal sliceId unless governance-provisional.`);
    }
  }
}

function checkDefinitionRefs() {
  const fieldRefIds = new Set((fieldRefs.refs || []).map((item) => item.ref));
  const evidenceRefIds = new Set((evidenceRefs.refs || []).map((item) => item.ref));
  const riskRefIds = new Set((riskRefs.refs || []).map((item) => item.ref));
  const ledgerRefIds = new Set((ledgerRefs.refs || []).map((item) => item.ref));
  const businessLineIds = new Set((businessRegistry.businessLines || []).map((item) => item.businessLineId));

  for (const definition of registry.definitions || []) {
    if (!fieldRefIds.has(definition.fieldContractRef)) failures.push(`${definition.definitionId} references missing fieldContractRef ${definition.fieldContractRef}.`);
    if (!evidenceRefIds.has(definition.evidencePolicyRef)) failures.push(`${definition.definitionId} references missing evidencePolicyRef ${definition.evidencePolicyRef}.`);
    if (!riskRefIds.has(definition.riskPolicyRef)) failures.push(`${definition.definitionId} references missing riskPolicyRef ${definition.riskPolicyRef}.`);
    if (!ledgerRefIds.has(definition.ledgerPolicyRef)) failures.push(`${definition.definitionId} references missing ledgerPolicyRef ${definition.ledgerPolicyRef}.`);
    if (!businessLineIds.has(definition.businessLineId)) failures.push(`${definition.definitionId} references missing businessLineId ${definition.businessLineId}.`);
    if (!definition.admissionPolicyRef.startsWith("admission.")) failures.push(`${definition.definitionId} admissionPolicyRef must be an admission ref.`);
    if (!definition.surfacePolicyRef.startsWith("surface.")) failures.push(`${definition.definitionId} surfacePolicyRef must be a surface ref.`);
  }

  for (const ref of fieldRefs.refs || []) {
    if (!Array.isArray(ref.requiredFieldIds) || ref.requiredFieldIds.length === 0) failures.push(`${ref.ref} must declare requiredFieldIds.`);
  }
  for (const ref of evidenceRefs.refs || []) {
    if (!Array.isArray(ref.requiredEvidenceIds) || ref.requiredEvidenceIds.length === 0) failures.push(`${ref.ref} must declare requiredEvidenceIds.`);
  }
  for (const ref of ledgerRefs.refs || []) {
    if (typeof ref.appendOnly !== "boolean") failures.push(`${ref.ref} appendOnly must be boolean.`);
  }
}

function checkSliceAndSurfaceAlignment() {
  const slices = new Map((sliceManifest.slices || []).map((slice) => [slice.id, slice]));
  const surfacePolicies = new Map((surfacePolicy.policies || []).map((policy) => [policy.sliceId, policy]));

  for (const definition of registry.definitions || []) {
    if (definition.definitionMode === "governance-provisional") {
      if (definition.sliceId !== "Governance.CorrectionCenter" || definition.workspaceId !== "PC-GOVERNANCE") {
        failures.push(`${definition.definitionId} governance-provisional definitions must stay in PC-GOVERNANCE.`);
      }
      continue;
    }

    const slice = slices.get(definition.sliceId);
    if (!slice) {
      failures.push(`${definition.definitionId} references missing slice ${definition.sliceId}.`);
      continue;
    }
    if (slice.workspaceId !== definition.workspaceId) {
      failures.push(`${definition.definitionId} workspaceId ${definition.workspaceId} does not match slice manifest ${slice.workspaceId}.`);
    }
    if (!(slice.cards || []).includes(definition.legacyCardId)) {
      failures.push(`${definition.definitionId} legacyCardId ${definition.legacyCardId} is not in slice manifest.`);
    }

    const policy = surfacePolicies.get(definition.sliceId);
    const card = (policy?.cards || []).find((item) => item.cardId === definition.legacyCardId);
    if (!card) failures.push(`${definition.definitionId} surface policy missing ${definition.sliceId}/${definition.legacyCardId}.`);
  }
}

function checkFactOwnershipAlignment() {
  const factNames = new Set([...factOwnership.matchAll(/^\s*-\s+fact:\s*([A-Za-z0-9_]+)/gm)].map((match) => match[1]));
  for (const definition of registry.definitions || []) {
    for (const fact of [...(definition.allowedFacts || []), ...(definition.forbiddenFacts || [])]) {
      if (!factNames.has(fact)) failures.push(`${definition.definitionId} references fact not declared in fact-ownership.yml: ${fact}.`);
    }
    if ((definition.allowedFacts || []).includes("LedgerEntry") && definition.ledgerPolicyRef === "ledger.none.v1") {
      failures.push(`${definition.definitionId} cannot allow LedgerEntry with ledger.none.v1.`);
    }
    if (!(definition.allowedFacts || []).includes("LedgerEntry") && definition.ledgerPolicyRef !== "ledger.none.v1" && /ledger\.(deposit|payment|checkout|expense|correction)/.test(definition.ledgerPolicyRef)) {
      failures.push(`${definition.definitionId} ledger policy requires LedgerEntry in allowedFacts.`);
    }
  }
}

function checkRuntimeImplementation() {
  const registryService = read("services/core-api/WorkOS.Api/Runtime/WorkItemDefinitionRegistryService.cs");
  for (const term of [
    "WorkItemDefinitionRegistryService",
    "Resolve(WorkItem workItem",
    "ResolveByWorkspaceCard",
    "DefinitionMode",
    "ProductionConfirmAllowed"
  ]) {
    if (!registryService.includes(term)) failures.push(`WorkItemDefinitionRegistryService.cs missing ${term}.`);
  }

  const canonical = read("services/core-api/WorkOS.Api/Runtime/CanonicalOperationsApiService.cs");
  for (const term of [
    "definitions.Resolve(workItem",
    "definition.ToTrace()",
    "[\"definitionId\"]",
    "[\"definitionMode\"]"
  ]) {
    if (!canonical.includes(term)) failures.push(`CanonicalOperationsApiService.cs missing Definition Registry binding: ${term}.`);
  }
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function read(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) throw new Error(`Missing file: ${relativePath}`);
  return fs.readFileSync(fullPath, "utf8");
}

function present(value) {
  return typeof value === "string" ? value.trim().length > 0 : value !== undefined && value !== null;
}
