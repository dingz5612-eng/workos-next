import fs from "node:fs";
import path from "node:path";
import {
  readJsonIfExists,
  writeJson
} from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/business-ui-copy-no-technical-leak-result.json";
const projection = readJsonIfExists("apps/mobile/src/generated/oam/capability-projection.generated.json", root);
const visibleCopyContract = readJsonIfExists("docs/oam/visible-business-copy-contract.json", root);
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
if (!visibleCopyContract || visibleCopyContract.status !== "authoritative") {
  failures.push("VisibleBusinessCopyContract must exist and be authoritative.");
}
for (const label of visibleCopyContract?.requiredScenario1BusinessLabels ?? []) {
  if (!operationCopy.includes(label)) failures.push(`business landing submit copy missing ${label}.`);
}
for (const label of visibleCopyContract?.forbiddenLegacyScenario1Labels ?? []) {
  if (operationCopy.includes(label)) failures.push(`legacy business landing submit copy must not appear: ${label}.`);
}
for (const term of visibleCopyContract?.forbiddenVisibleTerms ?? []) {
  if (operationCopyValues(operationCopy).some((value) => value.includes(term))) {
    failures.push(`ordinary business copy contains forbidden visible term: ${term}.`);
  }
}
if (!experienceComponents.includes("const shouldOpen =") || !experienceComponents.includes('ctx.state?.debugSurface')) {
  failures.push("TechnicalAuditDetails must remain collapsed unless debug/audit context opens it.");
}
if (!workspaceView.includes("房源建档与基础就绪完成")) {
  failures.push("completion page must expose lodging scenario 1 business completion surface.");
}
if (!workspaceView.includes("不代表可运营、可报价、可预订")) {
  failures.push("completion page must not imply operation, quote, or reservation readiness.");
}
if (projection?.businessUi?.technicalDetailsDefaultExpanded !== false) {
  failures.push("generated businessUi must set technicalDetailsDefaultExpanded=false.");
}

const result = {
  version: "oam.business-ui-copy-no-technical-leak-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  mainlineId: "Dormitory.13ScenarioMainline",
  visibleCopyContractRef: "docs/oam/visible-business-copy-contract.json",
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

function operationCopyValues(source) {
  const values = [];
  const pattern = /"[^"]+"\s*:\s*"((?:\\"|[^"])*)"/g;
  let match = pattern.exec(source);
  while (match) {
    const value = match[1].replace(/\\"/g, "\"");
    if (!/^[A-Za-z0-9_.:-]+$/.test(value)) values.push(value);
    match = pattern.exec(source);
  }
  return values;
}
