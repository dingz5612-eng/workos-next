import fs from "node:fs";

const projectionSchema = JSON.parse(fs.readFileSync("docs/contracts/projection-contract.schema.json", "utf8"));
const openApi = JSON.parse(fs.readFileSync("docs/contracts/workos-runtime.openapi.json", "utf8"));
const sliceManifest = JSON.parse(fs.readFileSync("docs/contracts/slice-manifest.json", "utf8"));
const policyContract = JSON.parse(fs.readFileSync("docs/contracts/policy-contract.json", "utf8"));
const rulesIndex = JSON.parse(fs.readFileSync("docs/architecture/rules/index.json", "utf8"));
const architectureExceptions = JSON.parse(fs.readFileSync("docs/architecture/architecture-exceptions.json", "utf8"));

const requiredProjectionFields = ["projection", "version", "languages", "sourceOfTruth", "workspaces", "events"];
for (const field of requiredProjectionFields) {
  if (!projectionSchema.required?.includes(field)) {
    throw new Error(`Projection schema must require ${field}`);
  }
}

const confirmPath = openApi.paths?.["/api/workspaces/{workspaceId}/cards/{cardId}/confirm"];
const confirmPost = confirmPath?.post;
if (!confirmPost) throw new Error("OpenAPI must define confirm POST path.");

const actorHeader = confirmPost.parameters?.find((item) => item.name === "X-WorkOS-Actor-Token" && item.in === "header" && item.required === true);
if (!actorHeader) throw new Error("Confirm OpenAPI path must require X-WorkOS-Actor-Token header.");

const confirmSchema = openApi.components?.schemas?.ConfirmCardRequest;
for (const field of ["language", "idempotencyKey", "submissionId", "cardInstanceId", "fieldValues", "evidenceIds"]) {
  if (!confirmSchema?.required?.includes(field)) {
    throw new Error(`ConfirmCardRequest schema must require ${field}`);
  }
}

for (const statusCode of ["200", "400", "401", "403", "409", "422", "404", "500"]) {
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

for (const field of ["service", "version", "persistence", "workspaceCount", "cardCount", "auditEventCount", "outboxCount", "pendingOutboxCount"]) {
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

for (const code of [
  "allowed",
  "invalid_actor_token",
  "ai_confirmation_forbidden",
  "role_confirmation_forbidden",
  "slice_runtime_forbidden",
  "deposit_evidence_required",
  "payment_evidence_required",
  "deposit_refund_exceeds_held_amount",
  "payment_allocation_exceeds_confirmed_amount",
  "business_rule_violation",
  "idempotency_duplicate",
  "idempotency_conflict"
]) {
  if (!policyContract.decisionCodes?.includes(code)) {
    throw new Error(`Policy contract missing decision code ${code}`);
  }
}

for (const rule of rulesIndex.rules || []) {
  for (const field of ["id", "title", "scope", "severity", "owner", "ruleFile", "enforcedBy", "exceptionAllowed"]) {
    if (!(field in rule) || (Array.isArray(rule[field]) && rule[field].length === 0)) {
      throw new Error(`Rule registry entry ${rule.id || "<missing>"} missing ${field}`);
    }
  }
  if (!fs.existsSync(rule.ruleFile)) {
    throw new Error(`Rule registry file does not exist for ${rule.id}: ${rule.ruleFile}`);
  }
}

const rulesById = new Map((rulesIndex.rules || []).map((rule) => [rule.id, rule]));
for (const exception of architectureExceptions.exceptions || []) {
  for (const field of ["ruleId", "owner", "reason", "createdAt", "expiresAt", "removalCondition", "linkedTest"]) {
    if (!exception[field]) {
      throw new Error(`Architecture exception missing ${field}`);
    }
  }
  const rule = rulesById.get(exception.ruleId);
  if (!rule) {
    throw new Error(`Architecture exception references unknown ruleId ${exception.ruleId}`);
  }
  if (!rule.exceptionAllowed) {
    throw new Error(`Rule ${exception.ruleId} does not allow exceptions`);
  }
  if (Date.parse(exception.expiresAt) < Date.now()) {
    throw new Error(`Architecture exception expired for ${exception.ruleId}`);
  }
}

console.log("Contract files: PASS");
