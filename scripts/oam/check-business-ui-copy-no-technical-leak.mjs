import fs from "node:fs";
import path from "node:path";
import {
  CAPABILITY_ID,
  readJsonIfExists,
  writeJson
} from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/business-ui-copy-no-technical-leak-result.json";
const projection = readJsonIfExists("apps/mobile/src/generated/oam/capability-projection.generated.json", root);
const runtimeProjectionSource = read("services/core-api/WorkOS.Api/Runtime/AcceptedCapabilityRuntimeProjection.cs");
const operationCopy = read("apps/mobile/src/i18n/operationCopy.js");
const experienceComponents = read("apps/mobile/src/views/experienceComponents.js");
const workspaceView = read("apps/mobile/src/views/workspaceView.js");
const failures = [];
const forbiddenMainFormTerms = [
  "accepted capability bundle projection",
  "generated capability projection"
];

for (const term of forbiddenMainFormTerms) {
  if (runtimeProjectionSource.includes(term)) {
    failures.push(`runtime business copy must not contain technical term: ${term}.`);
  }
}
if (!operationCopy.includes('"capabilitySubmit.runtimeTestOnly": "提交内测记录"')) {
  failures.push("runtime-test-only submit copy must be 提交内测记录.");
}
for (const label of ["确认房间配置", "确认床位配置", "确认资源就绪"]) {
  if (!operationCopy.includes(label)) failures.push(`business landing submit copy missing ${label}.`);
}
if (!experienceComponents.includes("const shouldOpen =") || !experienceComponents.includes('ctx.state?.debugSurface')) {
  failures.push("TechnicalAuditDetails must remain collapsed unless debug/audit context opens it.");
}
if (!workspaceView.includes("data-capability-completion=\"Dormitory.FirstGoldenChain\"")) {
  failures.push("completion page must expose first golden chain business completion surface.");
}
if (projection?.businessUi?.technicalDetailsDefaultExpanded !== false) {
  failures.push("generated businessUi must set technicalDetailsDefaultExpanded=false.");
}

const result = {
  version: "oam.business-ui-copy-no-technical-leak-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  capabilityId: CAPABILITY_ID,
  technicalDetailsDefaultExpanded: false,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Business UI copy no technical leak check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Business UI copy no technical leak check: PASS");

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}
