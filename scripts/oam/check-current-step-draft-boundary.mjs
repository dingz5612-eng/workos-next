import fs from "node:fs";
import path from "node:path";
import {
  CAPABILITY_ID,
  readJsonIfExists,
  writeJson
} from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/current-step-draft-boundary-result.json";
const projection = readJsonIfExists("apps/mobile/src/generated/oam/capability-projection.generated.json", root);
const operationController = read("apps/mobile/src/operationController.js");
const operationDrafts = read("apps/mobile/src/operationDrafts.js");
const failures = [];

const draftPolicy = projection?.draftPolicy ?? {};
if (draftPolicy.scope !== "current_step_user_input_only") failures.push("draftPolicy.scope must be current_step_user_input_only.");
if (draftPolicy.excludesSystemDerivedFields !== true) failures.push("draftPolicy must exclude system-derived fields.");
if (draftPolicy.noCrossWorkItem !== true || draftPolicy.noCrossStep !== true) failures.push("draftPolicy must prohibit cross-workItem and cross-step drafts.");
if (draftPolicy.notEvidence !== true) failures.push("draftPolicy must state drafts are not evidence.");
if (!operationController.includes("draftableOperationValues")) failures.push("operationController must filter draftableOperationValues before saveDraft.");
if (!operationController.includes("draftableCapabilityFieldIds")) failures.push("draft filtering must come from generated capability projection.");
if (!operationController.includes("clearDraft(item.id, card.id)")) failures.push("successful projected submit must clear current step draft.");
if (!operationDrafts.includes("draftKey(workspaceId, cardId)")) failures.push("draft storage key must remain scoped by workspaceId and cardId.");

const result = {
  version: "oam.current-step-draft-boundary-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  capabilityId: CAPABILITY_ID,
  systemFieldsInDraftAllowed: false,
  crossWorkItemDraftAllowed: false,
  crossStepDraftAllowed: false,
  draftIsEvidence: false,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Current step draft boundary check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Current step draft boundary check: PASS");

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}
