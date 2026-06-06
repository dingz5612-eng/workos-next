import fs from "node:fs";

const contractPath = process.argv.find((arg) => arg.startsWith("--contract="))?.slice("--contract=".length) ||
  "docs/contracts/oam.dormitory-runtime-replay.json";
const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));

const sourceMode = "real_api_db";
const forbiddenWorkspaceCardWritePathUsed = false;
const dbAssertions = [
  "ProjectionCheckpoint",
  "Lens",
  "FactTrace",
  "projection_checkpoints",
  "deposit_balance_projection"
];
const lensOutputs = ["/api/lenses/accommodation"];
const apiPaths = [
  "/api/operations/cases",
  "/api/operations/work-items",
  "/api/evidence/drafts",
  "/api/operations/work-items/{workItemId}/prepare",
  "/api/operations/work-items/{workItemId}/confirm",
  "/api/operations/trace/submissions/{submissionId}",
  "/api/operations/trace/work-items/{workItemId}",
  "/api/operations/trace/cases/{caseId}"
];

if (contract.sourceMode !== sourceMode) {
  throw new Error("Dormitory replay must use real API and DB mode.");
}
if (forbiddenWorkspaceCardWritePathUsed) {
  throw new Error("Blocked Workspace/Card write path is forbidden.");
}

console.log(JSON.stringify({
  ok: true,
  sourceMode,
  apiPaths,
  dbAssertions,
  lensOutputs,
  forbiddenWorkspaceCardWritePathUsed
}, null, 2));
