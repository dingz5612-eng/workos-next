import fs from "node:fs";

const projectionSchema = JSON.parse(fs.readFileSync("docs/contracts/projection-contract.schema.json", "utf8"));
const openApi = JSON.parse(fs.readFileSync("docs/contracts/workos-runtime.openapi.json", "utf8"));
const sliceManifest = JSON.parse(fs.readFileSync("docs/contracts/slice-manifest.json", "utf8"));
const policyContract = JSON.parse(fs.readFileSync("docs/contracts/policy-contract.json", "utf8"));

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
for (const field of ["language", "idempotencyKey", "fieldValues", "evidenceIds"]) {
  if (!confirmSchema?.required?.includes(field)) {
    throw new Error(`ConfirmCardRequest schema must require ${field}`);
  }
}

if (!openApi.paths?.["/api/observability/runtime"]?.get) {
  throw new Error("OpenAPI must define runtime observability endpoint.");
}

for (const field of ["service", "version", "persistence", "workspaceCount", "cardCount", "auditEventCount", "outboxCount", "pendingOutboxCount"]) {
  if (!openApi.components?.schemas?.RuntimeObservation?.required?.includes(field)) {
    throw new Error(`RuntimeObservation schema must require ${field}`);
  }
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

for (const code of ["allowed", "ai_confirmation_forbidden", "role_confirmation_forbidden"]) {
  if (!policyContract.decisionCodes?.includes(code)) {
    throw new Error(`Policy contract missing decision code ${code}`);
  }
}

console.log("Contract files: PASS");
