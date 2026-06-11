import fs from "node:fs";
import { validateLocalPathReferences } from "./check-local-path-references.mjs";

const projectionSchema = JSON.parse(fs.readFileSync("docs/contracts/projection-contract.schema.json", "utf8"));
const openApi = JSON.parse(fs.readFileSync("docs/contracts/workos-runtime.openapi.json", "utf8"));
const sliceManifest = JSON.parse(fs.readFileSync("docs/contracts/slice-manifest.json", "utf8"));
const policyContract = JSON.parse(fs.readFileSync("docs/contracts/policy-contract.json", "utf8"));
const surfacePolicy = JSON.parse(fs.readFileSync("docs/contracts/runtime-surface-policy.json", "utf8"));
const lensContract = JSON.parse(fs.readFileSync("docs/contracts/accommodation-lens-contract.json", "utf8"));
const oamContract = JSON.parse(fs.readFileSync("docs/contracts/oam.current.json", "utf8"));
const oamManifest = JSON.parse(fs.readFileSync("docs/oam/current-architecture.manifest.json", "utf8"));
const architectureExceptions = JSON.parse(fs.readFileSync("docs/oam/current-architecture-exceptions.json", "utf8"));
const biKpiContract = JSON.parse(fs.readFileSync("docs/contracts/bi-kpi/bi-kpi-contract.json", "utf8"));
const businessLineLevels = JSON.parse(fs.readFileSync("docs/business/admission/business-line-levels.yml", "utf8"));
const definitionCompatibilityFence = JSON.parse(fs.readFileSync("docs/contracts/definition/definition-compatibility-fence.json", "utf8"));

const requiredProjectionFields = ["projection", "version", "languages", "sourceOfTruth", "workspaces", "events"];
for (const field of requiredProjectionFields) {
  if (!projectionSchema.required?.includes(field)) {
    throw new Error(`Projection schema must require ${field}`);
  }
}

const confirmPath = openApi.paths?.["/api/operations/work-items/{workItemId}/confirm"];
const confirmPost = confirmPath?.post;
if (!confirmPost) throw new Error("OpenAPI must define Operations WorkItem confirm POST path.");

const actorHeader = confirmPost.parameters?.find((item) => item.name === "X-WorkOS-Actor-Token" && item.in === "header" && item.required === true);
if (!actorHeader) throw new Error("Confirm OpenAPI path must require X-WorkOS-Actor-Token header.");

const confirmSchema = openApi.components?.schemas?.ConfirmWorkItemRequest;
for (const field of ["language", "idempotencyKey", "submissionId", "cardInstanceId", "fieldValues", "evidenceIds"]) {
  if (!confirmSchema?.required?.includes(field)) {
    throw new Error(`ConfirmWorkItemRequest schema must require ${field}`);
  }
}

for (const statusCode of ["200", "400", "401", "403", "409", "422", "404"]) {
  if (!confirmPost.responses?.[statusCode]) {
    throw new Error(`Confirm OpenAPI path must document HTTP ${statusCode}`);
  }
}

if (!openApi.paths?.["/api/observability/runtime"]?.get) {
  throw new Error("OpenAPI must define runtime observability endpoint.");
}

for (const surfacePath of ["/api/lenses/home-surface", "/api/lenses/work-queue", "/api/lenses/search", "/api/lenses/learning-catalog"]) {
  if (!openApi.paths?.[surfacePath]?.get) {
    throw new Error(`OpenAPI must define runtime surface lens ${surfacePath}.`);
  }
}

for (const field of ["service", "version", "persistence", "workspaceCount", "cardCount", "auditEventCount", "outboxCount", "pendingOutboxCount", "deadLetterOutboxCount", "behaviorEventCount", "projectionLagSeconds", "failedConfirmReasonDistribution", "surfaceCoverageMissingCount", "ledgerInvariantViolationCount", "schemaVersion", "activeArchitectureExceptionCount", "activeArchitectureExceptions"]) {
  if (!openApi.components?.schemas?.RuntimeObservation?.required?.includes(field)) {
    throw new Error(`RuntimeObservation schema must require ${field}`);
  }
}

const workspaceProjectionType = projectionSchema.$defs?.workspace?.properties?.projectionType?.const;
if (workspaceProjectionType !== "IntentWorkspaceProjection") {
  throw new Error("Projection schema workspace projectionType must match runtime API output.");
}

const cardProjectionType = projectionSchema.$defs?.card?.properties?.projectionType?.const;
if (cardProjectionType !== "WorkspaceCardProjection") {
  throw new Error("Projection schema card projectionType must match runtime API output.");
}

for (const field of ["correlationId", "causationId", "requestId"]) {
  if (!projectionSchema.$defs?.workspaceEvent?.required?.includes(field)) {
    throw new Error(`Projection schema workspaceEvent must require ${field}`);
  }
}

if (!fs.existsSync("scripts/validate-runtime-api.mjs")) {
  throw new Error("Runtime API response validation script is required.");
}

const requiredSlices = [
  "Accommodation.ResourceSetup",
  "Accommodation.CheckIn",
  "Accommodation.CheckOutSettlement",
  "Accommodation.DepositLedger",
  "Accommodation.PaymentLedger",
  "Accommodation.ServiceTask",
  "Accommodation.PeriodAnalytics"
];
const sliceIds = new Set(sliceManifest.slices?.map((slice) => slice.id));
for (const slice of requiredSlices) {
  if (!sliceIds.has(slice)) throw new Error(`Slice manifest missing ${slice}`);
}

for (const slice of sliceManifest.slices || []) {
  if (slice.status !== "production-slice") {
    throw new Error(`Slice ${slice.id} must be current production-slice; non-current runtime statuses are forbidden.`);
  }
  for (const field of ["workspaceId", "cards", "events", "ownsAggregates", "status"]) {
    if (!slice[field] || (Array.isArray(slice[field]) && slice[field].length === 0)) {
      throw new Error(`Slice ${slice.id} missing ${field}`);
    }
  }
}

const policiesBySlice = new Map((surfacePolicy.policies || []).map((policy) => [policy.sliceId, policy]));
const lensIds = new Set((lensContract.lenses || []).map((lens) => lens.id));
for (const policy of surfacePolicy.policies || []) {
  if (!sliceIds.has(policy.sliceId)) {
    throw new Error(`RuntimeSurfacePolicy ${policy.sliceId} is not declared in current slice manifest.`);
  }
}
for (const slice of sliceManifest.slices || []) {
  const policy = policiesBySlice.get(slice.id);
  if (!policy) {
    throw new Error(`Slice ${slice.id} must have RuntimeSurfacePolicy.`);
  }
  if (policy.workspaceId !== slice.workspaceId) {
    throw new Error(`Slice ${slice.id} RuntimeSurfacePolicy workspaceId mismatch.`);
  }
  if (slice.status === "production-slice") {
    if (!policy.defaultLens || !(policy.lenses || []).includes(policy.defaultLens)) {
      throw new Error(`Production slice ${slice.id} must declare a default lens in RuntimeSurfacePolicy.`);
    }
    for (const lens of policy.lenses || []) {
      if (!lensIds.has(lens) && !["bed-inventory", "room-readiness", "rate-plan", "today-operations", "active-stay", "deposit-liability", "stay-balance", "expense-analytics"].includes(lens)) {
        throw new Error(`Production slice ${slice.id} references unknown lens ${lens}.`);
      }
    }
  }
}

for (const code of [
  "allowed",
  "invalid_actor_token",
  "canonical_field_id_required",
  "missing_required_field",
  "ai_confirmation_forbidden",
  "role_confirmation_forbidden",
  "slice_runtime_forbidden",
  "deposit_evidence_required",
  "payment_evidence_required",
  "deposit_refund_exceeds_held_amount",
  "payment_allocation_exceeds_confirmed_amount",
  "payment_deposit_purpose_forbidden",
  "business_rule_violation",
  "idempotency_duplicate",
  "idempotency_conflict",
  "aggregate_ref_required",
  "invalid_option_value",
  "evidence_object_required",
  "evidence_object_not_found",
  "evidence_object_scope_mismatch",
  "evidence_requirement_mismatch",
  "evidence_object_not_attached",
  "evidence_object_already_used"
]) {
  if (!policyContract.decisionCodes?.includes(code)) {
    throw new Error(`Policy contract missing decision code ${code}`);
  }
}

for (const evidencePath of ["/api/evidence", "/api/evidence/drafts", "/api/evidence/{evidenceId}/attachments", "/api/evidence/{evidenceId}/verify", "/api/evidence/{evidenceId}/reject"]) {
  if (!openApi.paths?.[evidencePath]) {
    throw new Error(`OpenAPI must define evidence runtime path ${evidencePath}`);
  }
}

for (const schemaName of ["EvidenceDraftRequest", "EvidenceAttachmentRequest", "EvidenceDecisionRequest"]) {
  if (!openApi.components?.schemas?.[schemaName]) {
    throw new Error(`OpenAPI must define ${schemaName}`);
  }
}

if (oamContract.version !== "oam.current.v1") {
  throw new Error("OAM contract must declare oam.current.v1.");
}

if (oamManifest.version !== "oam.current.v1") {
  throw new Error("OAM manifest must declare oam.current.v1.");
}

for (const capability of oamContract.productCapabilities || []) {
  for (const field of ["id", "module", "owns", "forbidden"]) {
    if (!(field in capability) || (Array.isArray(capability[field]) && capability[field].length === 0)) {
      throw new Error(`Product capability ${capability.id || "<missing>"} missing ${field}`);
    }
  }
  if (!oamManifest.modules.required.includes(capability.module)) {
    throw new Error(`Product capability ${capability.id} references unknown module ${capability.module}`);
  }
}

for (const exception of architectureExceptions.exceptions || []) {
  for (const field of ["ruleId", "owner", "reason", "createdAt", "expiresAt", "removalCondition", "linkedTest"]) {
    if (!exception[field]) {
      throw new Error(`OAM architecture exception missing ${field}`);
    }
  }
  if (Date.parse(exception.expiresAt) < Date.now()) {
    throw new Error(`OAM architecture exception expired for ${exception.ruleId}`);
  }
}

if (biKpiContract.readOnly !== true || biKpiContract.businessFactWriteAllowed !== false) {
  throw new Error("BI/KPI contract must stay read-only and forbid business fact writes.");
}
for (const ref of biKpiContract.contractRefs || []) {
  if (!fs.existsSync(ref)) {
    throw new Error(`BI/KPI contract ref missing: ${ref}`);
  }
  const subContract = JSON.parse(fs.readFileSync(ref, "utf8"));
  if (subContract.readOnly !== true || subContract.businessFactWriteAllowed !== false) {
    throw new Error(`BI/KPI sub-contract must stay read-only: ${ref}`);
  }
  for (const field of ["version", "status", "requiredFields"]) {
    if (!(field in subContract)) {
      throw new Error(`BI/KPI sub-contract ${ref} missing ${field}`);
    }
  }
}

const levelMachineValues = new Set((businessLineLevels.levels || []).map((level) => level.machineValue));
if (!levelMachineValues.has("L1_INTERNAL_PILOT")) {
  throw new Error("Business line levels must define L1_INTERNAL_PILOT.");
}
for (const level of businessLineLevels.levels || []) {
  for (const language of ["zh-CN", "ru-RU", "ky-KG"]) {
    if (typeof level.display?.[language] !== "string" || level.display[language].trim() === "") {
      throw new Error(`Business line level ${level.machineValue} missing ${language} display text.`);
    }
  }
}
for (const value of ["business-3", "business-4", "business-5", "business-6", "business-7"]) {
  if (!(businessLineLevels.retiredRegistryValues || []).includes(value)) {
    throw new Error(`Business line levels must list ${value} as retired.`);
  }
}
for (const resolver of ["ResolveByWorkspaceCard", "FindBySourceCardId"]) {
  const entry = (definitionCompatibilityFence.compatibilityOnlyResolvers || []).find((item) => item.name === resolver);
  if (!entry) throw new Error(`Definition compatibility fence missing ${resolver}.`);
  for (const forbidden of ["confirm path", "command identity", "truth owner resolution", "ledger source", "production admission"]) {
    if (!entry.forbidden?.includes(forbidden)) {
      throw new Error(`${resolver} must forbid ${forbidden}.`);
    }
  }
}
if (definitionCompatibilityFence.businessRegistryDecision?.L1MachineValue !== "L1_INTERNAL_PILOT") {
  throw new Error("Definition compatibility fence must normalize L1 to L1_INTERNAL_PILOT.");
}

const pathReferenceViolations = validateLocalPathReferences();
if (pathReferenceViolations.length > 0) {
  const details = pathReferenceViolations
    .map((violation) => `${violation.file}:${violation.line} -> ${violation.ref}`)
    .join("\n");
  throw new Error(`Local path references must exist:\n${details}`);
}

console.log("Contract files: PASS");
