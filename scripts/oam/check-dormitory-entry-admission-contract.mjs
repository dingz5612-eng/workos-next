import fs from "node:fs";
import path from "node:path";
import { writeJson } from "./lib/generated-candidate-subject.mjs";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/dormitory-entry-admission-contract-result.json";
const sourcePath = "docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json";
const generatedPath = "docs/contracts/generated/dormitory/13-scenario-page-entry-policy.generated.json";
const runtimeMirrorPath = "services/core-api/WorkOS.Api/Runtime/Dormitory13ScenarioControl.generated.json";
const files = {
  source: readJson(sourcePath),
  generated: readJson(generatedPath),
  runtimeMirror: readJson(runtimeMirrorPath),
  searchKernel: readText("services/core-api/WorkOS.Api/Runtime/SearchKernelService.cs"),
  operationsRuntime: readText("services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs"),
  canonicalOperations: readText("services/core-api/WorkOS.Api/Runtime/CanonicalOperationsApiService.cs"),
  capabilityProjection: readText("apps/mobile/src/capabilityProjection.js"),
  searchIntentHub: readText("apps/mobile/src/searchIntentHub.js"),
  runtimeStore: readText("apps/mobile/src/runtime/runtimeStore.js"),
  surfaceSelectors: readText("apps/mobile/src/selectors/surfaceSelectors.js"),
  searchTests: readText("apps/mobile/src/__tests__/SearchIntentHubContract.test.js"),
  selectorTests: readText("apps/mobile/src/__tests__/surfaceSelectors.test.js"),
  apiTests: readText("tests/WorkOS.UnitTests/SearchKernelServiceTests.cs") +
    "\n" +
    readText("tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs")
};

const failures = [];
const requiredFields = [
  "businessTitle",
  "businessSummary",
  "legalActions",
  "admissionDecision",
  "nextAction",
  "cannotSubmitReason",
  "readonlyReason",
  "sourceScenario"
];
const legalActionFields = ["action", "label", "view", "allowed", "writeBusinessFact", "admissionDecision"];
const sourceContract = files.source.entryAdmissionContract;
const generatedContract = files.generated.entryAdmissionContract;
const runtimeContract = files.runtimeMirror.entryAdmissionContract;

requireContract(sourceContract, "Source Authority");
requireContract(generatedContract, "generated page entry policy");
requireContract(runtimeContract, "runtime generated mirror");
requireSameFields(sourceContract?.requiredFields, generatedContract?.requiredFields, "source vs generated requiredFields");
requireSameFields(sourceContract?.requiredFields, runtimeContract?.requiredFields, "source vs runtime mirror requiredFields");
requireSameFields(sourceContract?.legalActionFields, generatedContract?.legalActionFields, "source vs generated legalActionFields");

requireText(files.searchKernel, "EntryLegalActions", "SearchKernelService must use LegalAction Resolver output.");
requireText(files.searchKernel, "[\"businessTitle\"]", "SearchKernelService must emit businessTitle.");
requireText(files.searchKernel, "[\"businessSummary\"]", "SearchKernelService must emit businessSummary.");
requireText(files.searchKernel, "[\"legalActions\"]", "SearchKernelService must emit legalActions.");
requireText(files.searchKernel, "[\"sourceScenario\"]", "SearchKernelService must emit sourceScenario.");
requireText(files.searchKernel, "AcceptedCapabilityRuntimeProjection.SearchCommands()", "SearchKernelService must consume current generated capability commands.");
requireText(files.searchKernel, "DormitoryScenario2RuntimeProjection.SearchCommands()", "SearchKernelService must consume scenario 2 generated commands.");
forbidText(files.searchKernel, "W-STAY-DEPOSIT-LEDGER", "SearchKernelService must not keep static old W-STAY command entries.");

requireText(files.operationsRuntime, "public sealed record EntryLegalAction", "OperationsRuntimeService must declare EntryLegalAction.");
for (const field of pascalRequiredFields()) {
  requireText(files.operationsRuntime, field, `WorkItem/Surface record must carry ${field}.`);
}
requireText(files.canonicalOperations, "EntryAdmissionFor", "CanonicalOperationsApiService must attach entry admission fields.");
requireText(files.canonicalOperations, "AttachAdmission(createdWorkItem", "StartWorkspaceCase must return the same attached entry contract as list/detail.");
requireText(files.canonicalOperations, "SourceScenarioFor", "CanonicalOperationsApiService must declare sourceScenario.");
requireText(files.canonicalOperations, "submitWorkItem", "WorkItem legalActions must include submitWorkItem under runtime control.");

requireText(files.capabilityProjection, "MAINLINE_ENTRY_ADMISSION_CONTRACT", "Frontend must expose generated entry admission contract.");
requireText(files.searchIntentHub, "MAINLINE_ENTRY_ADMISSION_CONTRACT", "Search VM must consume generated entry admission contract.");
for (const field of requiredFields) {
  requireText(files.searchIntentHub, field, `SearchResultVM must expose ${field}.`);
  requireText(files.runtimeStore, field, `runtimeStore work queue must expose ${field}.`);
}
requireText(files.surfaceSelectors, "isOldWStaySearchEntry", "Search selector must keep old W-STAY entries out of current search.");
requireText(files.surfaceSelectors, "...result", "Search selector must preserve backend SearchResult contract fields.");
requireText(files.searchTests, "preserves generated entry admission contract fields", "Search entry contract test must exist.");
requireText(files.selectorTests, "does not mix old W-STAY search entries", "Search old-entry filter test must exist.");
requireText(files.apiTests, "businessTitle", "Backend tests must assert entry businessTitle.");
requireText(files.apiTests, "sourceScenario", "Backend tests must assert sourceScenario.");
requireText(files.apiTests, "W-STAY-DEPOSIT-LEDGER", "Backend tests must prove old W-STAY search command is absent.");

const result = {
  version: "oam.dormitory-entry-admission-contract-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  sourceAuthorityRef: sourcePath,
  generatedContractRef: generatedPath,
  runtimeMirrorRef: runtimeMirrorPath,
  requiredFields,
  legalActionFields,
  resolverChain: sourceContract?.resolverChain ?? [],
  rules: sourceContract?.rules ?? {},
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};
writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Dormitory entry admission contract check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Dormitory entry admission contract check: PASS");

function requireContract(contract, label) {
  if (!contract) {
    failures.push(`${label} must declare entryAdmissionContract.`);
    return;
  }
  requireEqual(contract.version, "oam.dormitory.entry-admission-contract.v1", `${label}.version`);
  requireSameFields(contract.requiredFields, requiredFields, `${label}.requiredFields`);
  requireSameFields(contract.legalActionFields, legalActionFields, `${label}.legalActionFields`);
  requireIncludes(contract.objects, "SearchResult", `${label}.objects`);
  requireIncludes(contract.objects, "WorkItem", `${label}.objects`);
  requireIncludes(contract.entryPages, "search", `${label}.entryPages`);
  requireIncludes(contract.entryPages, "workItems", `${label}.entryPages`);
  requireIncludes(contract.resolverChain, "LegalAction Resolver", `${label}.resolverChain`);
  requireIncludes(contract.resolverChain, "Admission Attach", `${label}.resolverChain`);
  requireIncludes(contract.resolverChain, "Runtime Prepare", `${label}.resolverChain`);
  requireIncludes(contract.resolverChain, "WorkItem", `${label}.resolverChain`);
  requireEqual(contract.rules?.frontendButtonJudgementForbidden, true, `${label}.rules.frontendButtonJudgementForbidden`);
  requireEqual(contract.rules?.searchReadonlyOnly, true, `${label}.rules.searchReadonlyOnly`);
  requireEqual(contract.rules?.oldWStayCurrentEntryForbidden, true, `${label}.rules.oldWStayCurrentEntryForbidden`);
}

function pascalRequiredFields() {
  return requiredFields.map((field) => field.charAt(0).toUpperCase() + field.slice(1));
}

function requireSameFields(actual, expected, label) {
  const left = [...(actual ?? [])].sort();
  const right = [...(expected ?? [])].sort();
  if (JSON.stringify(left) !== JSON.stringify(right)) {
    failures.push(`${label} mismatch: expected ${right.join(", ")}, actual ${left.join(", ")}.`);
  }
}

function requireIncludes(values, expected, label) {
  if (!(values ?? []).includes(expected)) {
    failures.push(`${label} must include ${expected}.`);
  }
}

function requireEqual(actual, expected, label) {
  if (actual !== expected) {
    failures.push(`${label} must be ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}.`);
  }
}

function requireText(text, needle, message) {
  if (!text.includes(needle)) failures.push(message);
}

function forbidText(text, needle, message) {
  if (text.includes(needle)) failures.push(message);
}

function readJson(file) {
  return JSON.parse(readText(file));
}

function readText(file) {
  return fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, "");
}
