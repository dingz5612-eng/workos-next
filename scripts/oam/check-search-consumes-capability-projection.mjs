import fs from "node:fs";
import path from "node:path";
import {
  CAPABILITY_ID,
  writeJson
} from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/search-consumes-capability-projection-result.json";
const searchKernel = read("services/core-api/WorkOS.Api/Runtime/SearchKernelService.cs");
const searchView = read("apps/mobile/src/views/searchView.js");
const searchIntent = read("apps/mobile/src/searchIntentRegistry.js");
const capabilityProjection = read("apps/mobile/src/capabilityProjection.js");
const generatedCapabilityProjection = JSON.parse(fs.readFileSync(path.join(root, "apps/mobile/src/generated/oam/capability-projection.generated.json"), "utf8"));
const failures = [];

if (searchKernel.includes("W-STAY-RESOURCE")) {
  failures.push("SearchKernelService must not hardcode W-STAY-RESOURCE for the current first golden chain search entry.");
}
if (searchIntent.includes("W-STAY-RESOURCE")) {
  failures.push("searchIntentRegistry must not hardcode W-STAY-RESOURCE for accommodationResourceSetup.");
}
if (!searchKernel.includes("AcceptedCapabilityRuntimeProjection.SearchCommands()")) {
  failures.push("SearchKernelService must build the current entry from compiler generated capability projection.");
}
if (!searchView.includes("capabilityCommandCatalog")) {
  failures.push("searchView must consume capabilityCommandCatalog for current first golden chain commands.");
}
if (!searchView.includes("isAccommodationResourceSetupQuery(query)") ||
  !searchView.includes('return [section("activeCommands", commands)]')) {
  failures.push("searchView must collapse 新增房间 intent to the current capability entry only.");
}
if (!capabilityProjection.includes("FIRST_GOLDEN_CHAIN_WORKSPACE_ID = capabilityProjection.workspaceId")) {
  failures.push("capabilityProjection must expose the compiler generated capability workspace id as the current search projection identity.");
}
for (const term of ["rateSetup", "roomBlock", "roomRelease"]) {
  const activeCommandBlock = capabilityProjection.slice(
    capabilityProjection.indexOf("export function capabilityCommandCatalog"),
    capabilityProjection.indexOf("export function runtimeWorkItemMatchesCapabilityCard")
  );
  if (activeCommandBlock.includes(term)) failures.push(`current search command projection must not contain ${term}.`);
}
if (/新增住宿房源|创建住宿资源|住宿资源建档/.test(searchKernel) || /新增住宿房源|创建住宿资源|住宿资源建档/.test(searchIntent)) {
  failures.push("current search entry must not use old accommodation resource wording.");
}
if (!searchKernel.includes("CommandTermMatches") || !searchKernel.includes("term.Contains(keyword")) {
  failures.push("SearchKernelService command matching must not let ordinary 房间/room query trigger the generated start command.");
}
const currentCommand = generatedCapabilityProjection.commandCatalog?.[0] ?? {};
if (currentCommand.templateWorkspaceId !== CAPABILITY_ID ||
  currentCommand.firstCardId !== "Dorm.RoomSetupConfirm") {
  failures.push("generated capability search command must target Dormitory.FirstGoldenChain / Dorm.RoomSetupConfirm.");
}
if ((currentCommand.keywords ?? []).includes("房间") ||
  (currentCommand.keywords ?? []).includes("room") ||
  (currentCommand.keywords ?? []).includes("resource")) {
  failures.push("generated capability search command must not include broad ordinary-room keywords.");
}

const result = {
  version: "oam.search-consumes-capability-projection-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  capabilityId: CAPABILITY_ID,
  searchEntryWorkspaceId: CAPABILITY_ID,
  searchEntryFirstCardId: "Dorm.RoomSetupConfirm",
  oldWStayResourceDisplayedForAddRoom: false,
  priceBlockReleaseEntryAllowed: false,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Search consumes capability projection check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Search consumes capability projection check: PASS");

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}
