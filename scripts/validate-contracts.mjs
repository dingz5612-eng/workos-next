import fs from "node:fs";

const projectionSchema = JSON.parse(fs.readFileSync("docs/contracts/projection-contract.schema.json", "utf8"));
const openApi = JSON.parse(fs.readFileSync("docs/contracts/workos-runtime.openapi.json", "utf8"));

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

console.log("Contract files: PASS");
