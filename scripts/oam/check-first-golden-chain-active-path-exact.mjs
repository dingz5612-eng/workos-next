import fs from "node:fs";
import path from "node:path";
import {
  CAPABILITY_ID,
  writeJson
} from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/first-golden-chain-active-path-exact-result.json";
const projectionSource = read("services/core-api/WorkOS.Api/Runtime/AcceptedCapabilityRuntimeProjection.cs");
const projectionSeed = read("services/core-api/WorkOS.Api/Runtime/ProjectionSeed.cs");
const searchKernel = read("services/core-api/WorkOS.Api/Runtime/SearchKernelService.cs");
const capabilityProjection = read("apps/mobile/src/capabilityProjection.js");
const searchIntent = read("apps/mobile/src/searchIntentRegistry.js");
const workspaceView = read("apps/mobile/src/views/workspaceView.js");
const failures = [];
const expectedCards = [
  "Dorm.RoomSetupConfirm",
  "Dorm.BedSetupConfirm",
  "Dorm.ResourceReadinessConfirm"
];
const forbidden = ["rateSetup", "roomBlock", "roomRelease", "W-STAY-RESOURCE"];

requireInOrder(projectionSource, expectedCards, "AcceptedCapabilityRuntimeProjection card order", failures);
requireInOrder(capabilityProjection, expectedCards, "mobile FIRST_GOLDEN_CHAIN_STEPS order", failures);

if (!projectionSource.includes("1/3 房间配置确认") ||
  !projectionSource.includes("2/3 床位配置确认") ||
  !projectionSource.includes("3/3 资源就绪确认")) {
  failures.push("runtime active step rail must use exact 1/3, 2/3, 3/3 labels.");
}
for (const term of forbidden.slice(0, 3)) {
  if (projectionSource.includes(term)) failures.push(`runtime active projection must not contain ${term}.`);
}
if (!projectionSeed.includes("!seed.Id.Equals(AcceptedCapabilityRuntimeProjection.LegacyResourceWorkspaceId")) {
  failures.push("ProjectionSeed must explicitly exclude the legacy W-STAY-RESOURCE seed from current first golden chain.");
}
if (searchKernel.includes("W-STAY-RESOURCE")) {
  failures.push("SearchKernelService active search entry must not reference W-STAY-RESOURCE.");
}
if (searchIntent.includes("W-STAY-RESOURCE")) {
  failures.push("searchIntentRegistry active search intent must not reference W-STAY-RESOURCE.");
}
if (/sourceCardId\s*===|workspaceCardId\s*===/.test(workspaceView)) {
  failures.push("workspaceView must not use sourceCardId/workspaceCardId active matching.");
}
if (!capabilityProjection.includes(`FIRST_GOLDEN_CHAIN_CAPABILITY_ID = "${CAPABILITY_ID}"`)) {
  failures.push("mobile capability projection must bind Dormitory.FirstGoldenChain.");
}

const result = {
  version: "oam.first-golden-chain-active-path-exact-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  capabilityId: CAPABILITY_ID,
  activeStepRail: expectedCards.map((cardId, index) => ({ step: `${index + 1}/3`, cardId })),
  oldSixCardFlowIsCurrentFirstGoldenChain: false,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("First golden chain active path exact check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("First golden chain active path exact check: PASS");

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function requireInOrder(text, terms, label, target) {
  let previous = -1;
  for (const term of terms) {
    const index = text.indexOf(term);
    if (index < 0) {
      target.push(`${label} missing ${term}.`);
      continue;
    }
    if (index <= previous) target.push(`${label} must keep ${terms.join(" -> ")}.`);
    previous = index;
  }
}
