import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourcePath = "docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json";
const resultPath = "artifacts/oam/checks/dormitory-13-scenario-generated-contracts-result.json";
const generatedBy = "scripts/business/generate-dormitory-13-scenario-control-contracts.mjs";
const generatedFiles = [
  "docs/contracts/generated/dormitory/13-scenario-control.generated.json",
  "apps/mobile/src/generated/oam/dormitory-13-scenario-control.generated.json",
  "services/core-api/WorkOS.Api/Runtime/Dormitory13ScenarioControl.generated.json",
  "docs/contracts/generated/dormitory/13-scenario-index.generated.json",
  "docs/contracts/generated/dormitory/13-scenario-state-ladder.generated.json",
  "docs/contracts/generated/dormitory/13-scenario-object-ownership.generated.json",
  "docs/contracts/generated/dormitory/13-scenario-field-source-matrix.generated.json",
  "docs/contracts/generated/dormitory/13-scenario-crud-policy.generated.json",
  "docs/contracts/generated/dormitory/13-scenario-evidence-policy.generated.json",
  "docs/contracts/generated/dormitory/13-scenario-finance-boundary.generated.json",
  "docs/contracts/generated/dormitory/13-scenario-page-entry-policy.generated.json",
  "docs/contracts/generated/dormitory/13-scenario-handoff-summaries.generated.json",
  "docs/contracts/generated/dormitory/13-scenario-old-package-migration.generated.json",
  "docs/contracts/generated/dormitory/13-scenario-test-plan.generated.json"
];
const failures = [];
const sourceDigest = fileDigest(sourcePath);
const documents = new Map();

for (const file of generatedFiles) {
  const document = readJsonIfExists(file);
  if (!document) {
    fail(`${file} is missing.`);
    continue;
  }
  documents.set(file, document);
  if (document.generated !== true || document.doNotEdit !== true) fail(`${file} must be generated and doNotEdit.`);
  if (document.generatedBy !== generatedBy) fail(`${file} generatedBy mismatch.`);
  if (JSON.stringify(document.generatedFrom ?? []) !== JSON.stringify([sourcePath])) fail(`${file} generatedFrom must point only to control Source.`);
  if (document.sourceContentDigest !== sourceDigest) fail(`${file} sourceContentDigest mismatch.`);
  if (document.productionConfirmAllowed !== false || document.releaseAuthority !== false || document.finalGoNoGo !== "NO_GO") {
    fail(`${file} must keep production/release/final GO closed.`);
  }
  const expectedDigest = digestObject({ ...document, outputContentDigest: "sha256:pending" });
  if (document.outputContentDigest !== expectedDigest) fail(`${file} outputContentDigest mismatch.`);
}

const scenarioIndex = documents.get("docs/contracts/generated/dormitory/13-scenario-index.generated.json");
const stateLadder = documents.get("docs/contracts/generated/dormitory/13-scenario-state-ladder.generated.json");
const objectOwnership = documents.get("docs/contracts/generated/dormitory/13-scenario-object-ownership.generated.json");
const fieldMatrix = documents.get("docs/contracts/generated/dormitory/13-scenario-field-source-matrix.generated.json");
const crudPolicy = documents.get("docs/contracts/generated/dormitory/13-scenario-crud-policy.generated.json");
const evidencePolicy = documents.get("docs/contracts/generated/dormitory/13-scenario-evidence-policy.generated.json");
const financeBoundary = documents.get("docs/contracts/generated/dormitory/13-scenario-finance-boundary.generated.json");
const pageEntryPolicy = documents.get("docs/contracts/generated/dormitory/13-scenario-page-entry-policy.generated.json");
const handoff = documents.get("docs/contracts/generated/dormitory/13-scenario-handoff-summaries.generated.json");
const oldPackage = documents.get("docs/contracts/generated/dormitory/13-scenario-old-package-migration.generated.json");
const testPlan = documents.get("docs/contracts/generated/dormitory/13-scenario-test-plan.generated.json");

if (scenarioIndex?.scenarios?.length !== 13) fail("scenario index must contain exactly 13 scenarios.");
for (let index = 1; index <= 13; index += 1) {
  if (!scenarioIndex?.scenarios?.some((item) => item.scenarioNo === index)) fail(`scenario index missing ${index}.`);
}
if (JSON.stringify(scenarioIndex?.scenarios?.filter((item) => item.chainLayer === "main_operating_chain").map((item) => item.scenarioNo)) !== JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])) {
  fail("main operating chain must be scenarios 1-10.");
}
if (JSON.stringify(scenarioIndex?.scenarios?.filter((item) => item.chainLayer === "horizontal_support_chain").map((item) => item.scenarioNo)) !== JSON.stringify([11, 12])) {
  fail("horizontal support chain must be scenarios 11 and 12.");
}
if (JSON.stringify(scenarioIndex?.scenarios?.filter((item) => item.chainLayer === "readonly_governance_chain").map((item) => item.scenarioNo)) !== JSON.stringify([13])) {
  fail("readonly governance chain must be scenario 13.");
}

for (const item of stateLadder?.stateLadder ?? []) {
  if (!Array.isArray(item.producerScenarios) || item.producerScenarios.length === 0) fail(`state ${item.state} missing producers.`);
  if (!Array.isArray(item.notEquivalentTo) || item.notEquivalentTo.length === 0) fail(`state ${item.state} missing non-equivalence.`);
}
if ((stateLadder?.stateLadder ?? []).length !== 14) fail("state ladder must contain 14 states.");

const objectToOwner = new Map();
for (const group of objectOwnership?.objectOwnership ?? []) {
  const owners = group.writeOwnerScenarios ?? [group.writeOwnerScenario];
  for (const objectName of group.objects ?? []) {
    if (objectToOwner.has(objectName)) fail(`${objectName} duplicate ownership.`);
    objectToOwner.set(objectName, owners);
  }
}
for (const forbidden of ["Payment", "Deposit", "Refund", "LedgerEntry", "LedgerTransaction", "FinanceReceipt"]) {
  if (objectToOwner.has(forbidden)) fail(`${forbidden} must not be owned by business scenarios.`);
}

for (const internal of fieldMatrix?.forbiddenUserInputFields ?? []) {
  if ((fieldMatrix.fieldSourceMatrix?.userFilled ?? []).includes(internal) ||
    (fieldMatrix.fieldSourceMatrix?.userSelected ?? []).includes(internal)) {
    fail(`${internal} must not be a user input field.`);
  }
}

if (!String(crudPolicy?.crudPolicy?.read ?? "").includes("只读")) fail("CRUD read policy must be readonly.");
if (evidencePolicy?.evidencePolicy?.noSideEffectsRequired !== true) fail("evidence failures must require no side effects.");
if (JSON.stringify(financeBoundary?.financeBoundary?.exclusiveTruthWriters ?? []) !== JSON.stringify(["finance-gate", "finance-kernel"])) {
  fail("finance truth writers must be finance-gate and finance-kernel.");
}
if (!String(pageEntryPolicy?.pageEntryPolicy?.search ?? "").includes("只读")) fail("search page entry must be readonly.");
const entryAdmissionContract = pageEntryPolicy?.entryAdmissionContract ?? {};
for (const field of ["businessTitle", "businessSummary", "legalActions", "admissionDecision", "nextAction", "cannotSubmitReason", "readonlyReason", "sourceScenario"]) {
  if (!(entryAdmissionContract.requiredFields ?? []).includes(field)) fail(`entry admission generated contract missing ${field}.`);
}
if (entryAdmissionContract.rules?.frontendButtonJudgementForbidden !== true ||
  entryAdmissionContract.rules?.searchReadonlyOnly !== true ||
  entryAdmissionContract.rules?.oldWStayCurrentEntryForbidden !== true ||
  entryAdmissionContract.rules?.writeFactsOnlyThroughOperationsRuntime !== true) {
  fail("entry admission generated contract rules must keep frontend/search/legacy/runtime boundaries closed.");
}
if (JSON.stringify(entryAdmissionContract.resolverChain ?? []) !== JSON.stringify(["LegalAction Resolver", "Admission Attach", "Runtime Prepare", "WorkItem"])) {
  fail("entry admission generated contract resolver chain mismatch.");
}
for (const summary of handoff?.summaries ?? []) {
  if (!Array.isArray(summary.summaryOutputs) || summary.summaryOutputs.length === 0) fail(`scenario ${summary.scenarioNo} missing handoff summary outputs.`);
  if (!String(summary.downstreamRuleZh ?? "").includes("不得要求用户重新填写")) fail(`scenario ${summary.scenarioNo} missing downstream no-refill rule.`);
}
if (oldPackage?.oldPackageIsolationPolicy?.mustBeLabeledAs !== "migration_reference_only") fail("oldPackage isolation label must be migration_reference_only.");
for (const item of oldPackage?.oldPackageMigrationMap ?? []) {
  if (!String(item.allowedUse ?? "").includes("参考")) fail(`${item.oldPackage} must be reference only.`);
}
for (const row of testPlan?.scenarioTestMatrix ?? []) {
  if (row.positiveBrowserScreenshotRequired !== true ||
    row.negativeBrowserScreenshotRequired !== true ||
    row.screenshotAnalysisRequired !== true ||
    row.noSideEffectsProofRequired !== true) {
    fail(`scenario ${row.scenarioNo} missing positive/negative/screenshot/no-side-effects test requirements.`);
  }
}
if ((testPlan?.scenarioTestMatrix ?? []).length !== 13) fail("test plan must cover 13 scenarios.");

const result = {
  version: "oam.dormitory-13-scenario-generated-contracts-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  sourcePath,
  sourceDigest,
  generatedFileCount: generatedFiles.length,
  generatedFiles: generatedFiles.map((file) => ({
    path: file,
    outputContentDigest: documents.get(file)?.outputContentDigest ?? null
  })),
  gates: {
    sourceCheck: "scripts/business/check-dormitory-13-scenario-control-authority.mjs",
    generatedContractConsistency: true,
    oldPackageIsolation: true,
    stateLadderUniqueOwnership: true,
    fieldSourceMatrix: true,
    financeBoundary: true,
    pageEntryPolicy: true,
    handoffSummaryContract: true,
    positiveNegativeTestPlan: true
  },
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result);

if (result.status !== "PASS") {
  console.error("Dormitory 13 scenario generated contracts check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory 13 scenario generated contracts check: PASS (${generatedFiles.length} files)`);

function readJsonIfExists(file) {
  const full = path.join(root, file);
  return fs.existsSync(full) ? JSON.parse(fs.readFileSync(full, "utf8")) : null;
}

function writeJson(file, value) {
  const full = path.join(root, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function fileDigest(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex")}`;
}

function digestObject(value) {
  return `sha256:${crypto.createHash("sha256").update(stableStringify(value)).digest("hex")}`;
}

function stableStringify(value) {
  return JSON.stringify(sortValue(value));
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortValue(child)]));
  }
  return value;
}

function fail(message) {
  failures.push(message);
}
