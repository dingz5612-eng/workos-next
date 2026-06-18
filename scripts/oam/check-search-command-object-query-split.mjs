import fs from "node:fs";
import path from "node:path";
import {
  CAPABILITY_ID,
  readJsonIfExists,
  writeJson
} from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/search-command-object-query-split-result.json";
const projection = readJsonIfExists("apps/mobile/src/generated/oam/capability-projection.generated.json", root);
const searchKernel = read("services/core-api/WorkOS.Api/Runtime/SearchKernelService.cs");
const searchView = read("apps/mobile/src/views/searchView.js");
const failures = [];
const command = projection?.commandCatalog?.[0] ?? {};
const keywords = command.keywords ?? [];

for (const query of ["新增房间", "创建房间"]) {
  if (!keywords.includes(query)) failures.push(`current command keywords missing ${query}.`);
}
for (const broad of ["D01", "101房间", "床位", "房间", "room", "bed"]) {
  if (keywords.includes(broad)) failures.push(`current command keywords must not include object query ${broad}.`);
}
if (projection?.searchProjection?.objectQueriesStartCommand !== false) {
  failures.push("object queries must not start the current command.");
}
for (const example of ["D01", "101房间", "床位"]) {
  if (!(projection?.searchProjection?.objectQueryExamples ?? []).includes(example)) {
    failures.push(`searchProjection.objectQueryExamples missing ${example}.`);
  }
}
if (!searchKernel.includes("CommandTermMatches") || !searchKernel.includes("term.Contains(keyword")) {
  failures.push("SearchKernelService must match command terms by explicit command keywords only.");
}
if (!searchView.includes("isAccommodationResourceSetupQuery(query)") || !searchView.includes('return [section("activeCommands", commands)]')) {
  failures.push("searchView must isolate add-room command queries to active command results.");
}

const result = {
  version: "oam.search-command-object-query-split-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  capabilityId: CAPABILITY_ID,
  commandQueries: ["新增房间", "创建房间"],
  objectQueries: ["D01", "101房间", "床位"],
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Search command/object query split check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Search command/object query split check: PASS");

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}
