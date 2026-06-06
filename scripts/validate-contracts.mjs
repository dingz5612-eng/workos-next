import fs from "node:fs";

const projectionSchema = JSON.parse(fs.readFileSync("docs/contracts/projection-contract.schema.json", "utf8"));
const openApi = JSON.parse(fs.readFileSync("docs/contracts/workos-runtime.openapi.json", "utf8"));
const sliceManifest = JSON.parse(fs.readFileSync("docs/contracts/slice-manifest.json", "utf8"));
const policyContract = JSON.parse(fs.readFileSync("docs/contracts/policy-contract.json", "utf8"));
const surfacePolicy = JSON.parse(fs.readFileSync("docs/contracts/runtime-surface-policy.json", "utf8"));
const lensContract = JSON.parse(fs.readFileSync("docs/contracts/accommodation-lens-contract.json", "utf8"));
const omaContract = JSON.parse(fs.readFileSync("docs/contracts/oma.current.json", "utf8"));
const omaManifest = JSON.parse(fs.readFileSync("docs/oma/current-architecture.manifest.json", "utf8"));
const architectureExceptions = JSON.parse(fs.readFileSync("docs/oma/current-architecture-exceptions.json", "utf8"));

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
  "Accommodation.CheckOut",
  "Finance.DepositException",
  "Repair.Dispatch",
  "Repair.Close"
];
const sliceIds = new Set(sliceManifest.slices?.map((slice) => slice.id));
for (const slice of requiredSlices) {
  if (!sliceIds.has(slice)) throw new Error(`Slice manifest missing ${slice}`);
}

for (const slice of sliceManifest.slices || []) {
  for (const field of ["workspaceId", "cards", "events", "ownsAggregates", "status"]) {
    if (!slice[field] || (Array.isArray(slice[field]) && slice[field].length === 0)) {
      throw new Error(`Slice ${slice.id} missing ${field}`);
    }
  }
}

const policiesBySlice = new Map((surfacePolicy.policies || []).map((policy) => [policy.sliceId, policy]));
const lensIds = new Set((lensContract.lenses || []).map((lens) => lens.id));
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

if (omaContract.version !== "oma.current.v1") {
  throw new Error("OMA contract must declare oma.current.v1.");
}

if (omaManifest.version !== "oma.current.v1") {
  throw new Error("OMA manifest must declare oma.current.v1.");
}

for (const capability of omaContract.productCapabilities || []) {
  for (const field of ["id", "module", "owns", "forbidden"]) {
    if (!(field in capability) || (Array.isArray(capability[field]) && capability[field].length === 0)) {
      throw new Error(`Product capability ${capability.id || "<missing>"} missing ${field}`);
    }
  }
  if (!omaManifest.modules.required.includes(capability.module)) {
    throw new Error(`Product capability ${capability.id} references unknown module ${capability.module}`);
  }
}

for (const exception of architectureExceptions.exceptions || []) {
  for (const field of ["ruleId", "owner", "reason", "createdAt", "expiresAt", "removalCondition", "linkedTest"]) {
    if (!exception[field]) {
      throw new Error(`OMA architecture exception missing ${field}`);
    }
  }
  if (Date.parse(exception.expiresAt) < Date.now()) {
    throw new Error(`OMA architecture exception expired for ${exception.ruleId}`);
  }
}

console.log("Contract files: PASS");
