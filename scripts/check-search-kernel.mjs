import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const selfTest = process.argv.includes("--self-test");

const searchContract = readJson("docs/contracts/search/search-contract.json");
const indexSources = readJson("docs/contracts/search/search-index-sources.json");
const resultSchema = readJson("docs/contracts/search/search-result-schema.json");
const rankingPolicy = readJson("docs/contracts/search/search-ranking-policy.json");
const permissionPolicy = readJson("docs/contracts/search/search-permission-policy.json");
const languageContract = readJson("docs/contracts/language/language-contract.json");
const admissionContract = readJson("docs/contracts/admission/admission-contract.json");

const requiredObjectTypes = [
  "workItem",
  "operationCase",
  "workspaceCardCompatibility",
  "gateResult",
  "businessObject",
  "evidence",
  "ledger",
  "payment",
  "deposit",
  "correction",
  "reconciliation",
  "release",
  "lensItem",
  "auditEvent",
  "learningItem"
];
const requiredResultFields = [
  "resultId",
  "resultType",
  "objectKind",
  "title",
  "summary",
  "matchedTerms",
  "score",
  "target",
  "admission",
  "permission",
  "lineage",
  "freshness",
  "ranking",
  "businessContext",
  "availableActions",
  "traceRefs",
  "sourceRefs",
  "language",
  "explain"
];

if (selfTest) {
  const bad = structuredClone(searchContract);
  bad.objectTypes = bad.objectTypes.filter((item) => item !== "workItem");
  const badFailures = runChecks({ searchContract: bad });
  if (!badFailures.some((item) => item.includes("workItem"))) {
    throw new Error("Search Kernel self-test did not detect missing workItem coverage.");
  }
  console.log("Search Kernel self-test: PASS");
}

const failures = runChecks({ searchContract });
if (failures.length > 0) {
  for (const failure of failures) console.error(`P0 ${failure}`);
  throw new Error("Search Kernel check failed.");
}

console.log("Search Kernel check: PASS");

function runChecks(context) {
  const failures = [];
  checkContract(context.searchContract, failures);
  checkSourcesAndSchema(failures);
  checkRankingAndPermission(failures);
  checkProjectionFacadeBoundary(context.searchContract, failures);
  checkRuntimeImplementation(failures);
  return failures;
}

function checkContract(contract, failures) {
  if (contract.version !== "oam.search-contract.v1") failures.push("search-contract version mismatch.");
  if (languageContract.version !== "oam.language-contract.v1") failures.push("Search Kernel must reference the current Language Kernel contract.");
  if (admissionContract.version !== "oam.admission-contract.v1") failures.push("Search Kernel must reference the current Admission Kernel contract.");

  for (const objectType of requiredObjectTypes) {
    if (!(contract.objectTypes || []).includes(objectType)) failures.push(`search-contract missing objectType ${objectType}.`);
  }
  for (const field of requiredResultFields) {
    if (!(contract.requiredResultFields || []).includes(field)) failures.push(`search-contract missing required SearchResult field ${field}.`);
  }
  if (contract.languageSynonymRef !== "docs/contracts/language/search-synonyms.json") {
    failures.push("search-contract must reference Language Kernel search synonyms.");
  }
  if (contract.indexSourcesRef !== "docs/contracts/search/search-index-sources.json") {
    failures.push("search-contract must reference Search index sources.");
  }
  if (!(contract.inputAdapters || []).some((adapter) => adapter.adapterId === "operationsRuntimeFactInput" && adapter.status === "active")) {
    failures.push("search-contract must declare active operationsRuntimeFactInput.");
  }
  if ((contract.inputAdapters || []).some((adapter) => adapter.status === "planned" || adapter.status === "future")) {
    failures.push("search-contract must not retain planned input adapter placeholders.");
  }
  if (!(contract.runtimeAdapters || []).some((adapter) => adapter.name === "OperationsReadStore.SearchOperations")) {
    failures.push("search-contract must register OperationsReadStore.SearchOperations as a runtime adapter.");
  }
  const invariantText = (contract.invariants || []).join(" ");
  if (!invariantText.includes("Operations Runtime confirmed events") || !invariantText.includes("display/search-only")) {
    failures.push("search-contract must state Operations events and business anchors search boundary.");
  }
}

function checkSourcesAndSchema(failures) {
  const coveredTypes = new Set((indexSources.sources || []).flatMap((source) => source.objectTypes || []));
  for (const objectType of requiredObjectTypes) {
    if (!coveredTypes.has(objectType)) failures.push(`search-index-sources missing objectType coverage ${objectType}.`);
  }
  for (const source of indexSources.sources || []) {
    if (source.admissionRequired !== true) failures.push(`${source.sourceId} must require admission.`);
  }
  const operationsEvents = (indexSources.sources || []).find((source) => source.sourceId === "operationsDomainEvents");
  if (!operationsEvents || !String(operationsEvents.ref || "").includes("OperationsReadStore.SearchOperations")) {
    failures.push("search-index-sources must include operationsDomainEvents through OperationsReadStore.SearchOperations.");
  }

  for (const field of requiredResultFields) {
    if (!(resultSchema.required || []).includes(field)) failures.push(`search-result-schema missing required field ${field}.`);
    if (!resultSchema.properties?.[field]) failures.push(`search-result-schema missing property ${field}.`);
  }
  for (const admissionField of ["visibleAllowed", "prepareAllowed", "confirmAllowed", "productionAllowed", "mode", "reason"]) {
    if (!(resultSchema.properties?.admission?.required || []).includes(admissionField)) {
      failures.push(`SearchResult.admission missing ${admissionField}.`);
    }
  }
  for (const targetField of ["view", "kind", "writeThroughSearchAllowed"]) {
    if (!(resultSchema.properties?.target?.required || []).includes(targetField)) {
      failures.push(`SearchResult.target missing ${targetField}.`);
    }
  }
  for (const [group, fields] of Object.entries({
    permission: ["visibility", "redaction", "dataClassification", "requiredPermissions", "checkedAt", "policyVersion"],
    lineage: ["sourceSystem", "sourceType", "sourceId", "sourceUpdatedAt", "definitionVersion"],
    freshness: ["indexedAt", "indexLagMs", "stale"]
  })) {
    for (const field of fields) {
      if (!(resultSchema.properties?.[group]?.required || []).includes(field)) {
        failures.push(`SearchResult.${group} missing ${field}.`);
      }
    }
  }
}

function checkRankingAndPermission(failures) {
  const rankingText = JSON.stringify(rankingPolicy);
  if (!rankingText.includes("docs/contracts/language/search-synonyms.json")) {
    failures.push("search-ranking-policy must use Language Kernel synonyms.");
  }
  if (!rankingText.includes("raw contains-only match")) {
    failures.push("search-ranking-policy must forbid contains-only final search.");
  }
  for (const ruleId of [
    "business-line-blocked-cannot-execute",
    "surface-visibility-not-confirm-permission",
    "high-risk-requires-capability-device",
    "tenant-filter-required",
    "projection-source-label-required",
    "operations-events-tenant-scoped-readonly",
    "search-result-required-trust-fields",
    "search-actions-readonly-only",
    "hidden-results-not-ranked",
    "sensitive-results-redacted-for-ordinary-users"
  ]) {
    if (!(permissionPolicy.rules || []).some((rule) => rule.ruleId === ruleId)) {
      failures.push(`search-permission-policy missing rule ${ruleId}.`);
    }
  }
}

function checkProjectionFacadeBoundary(contract, failures) {
  const adapters = contract.projectionAdapters || [];
  const lensAdapter = adapters.find((adapter) => adapter.name === "ProjectionWorkspaceSearchAdapter");
  if (!lensAdapter || lensAdapter.status !== "projection-facade-adapter") {
    failures.push("ProjectionWorkspaceSearchAdapter must be registered as a projection facade adapter.");
  }
  if (lensAdapter && !exists(lensAdapter.path)) failures.push(`ProjectionWorkspaceSearchAdapter path missing: ${lensAdapter.path}.`);

  const lensSource = read("services/core-api/WorkOS.Api/Runtime/LensQueryService.cs");
  if (!/public\s+IReadOnlyList<object>\s+Search\s*\(/.test(lensSource)) {
    failures.push("LensQueryService.Search method missing.");
  }
}

function checkRuntimeImplementation(failures) {
  for (const file of [
    "services/core-api/WorkOS.Api/Runtime/SearchKernelService.cs",
    "services/core-api/WorkOS.Api/Runtime/WorkItemDefinitionRegistryService.cs",
    "services/core-api/WorkOS.Api/Runtime/AdmissionKernelService.cs"
  ]) {
    if (!exists(file)) failures.push(`Search Kernel runtime implementation missing: ${file}`);
  }

  const searchKernel = read("services/core-api/WorkOS.Api/Runtime/SearchKernelService.cs");
  for (const term of [
    "SearchKernelService",
    "ProjectionWorkspaceSearchAdapter",
    "EvaluateSearch",
    "LanguageSearchSynonymCatalog",
    "\"resultType\"",
    "\"objectKind\"",
    "\"admission\"",
    "\"permission\"",
    "\"lineage\"",
    "\"freshness\"",
    "\"ranking\"",
    "\"businessContext\"",
    "\"availableActions\"",
    "\"writeThroughSearchAllowed\"",
    "\"writeBusinessFact\"",
    "\"traceRefs\"",
    "\"sourceRefs\"",
    "\"language\"",
    "SearchOperationsSources",
    "OperationsRuntime.SearchOperations",
    "OperationsReadStore.SearchOperations",
    "NextActionableWorkItem",
    "BusinessAnchorKeys"
  ]) {
    if (!searchKernel.includes(term)) failures.push(`SearchKernelService.cs missing ${term}`);
  }
  if (searchKernel.includes("[\"resultType\"] = FirstNonEmpty(ReadString(projectionSource, \"resultType\"), \"workspaceCardProjection\")")) {
    failures.push("Projection source results must expose workspaceCardCompatibility, not workspaceCardProjection.");
  }
  for (const action of ["confirm", "refund", "close", "applyCorrection", "productionConfirm", "writeBusinessFact"]) {
    if ((searchContract.forbiddenSearchActions || []).includes(action) === false && !JSON.stringify(searchContract).includes(action)) {
      failures.push(`search-contract must explicitly forbid Search action ${action}.`);
    }
  }
  const operationsUnitOfWork = read("services/core-api/WorkOS.Api/Runtime/OperationsUnitOfWork.cs");
  for (const term of ["SearchOperations(string tenantId", "operations_domain_events", "SearchText(record).Contains"]) {
    if (!operationsUnitOfWork.includes(term)) failures.push(`OperationsUnitOfWork.cs missing operations search term: ${term}`);
  }
  if (operationsUnitOfWork.includes("payload::text ilike")) {
    failures.push("Operations search must not use payload::text ilike because it matches JSON field names.");
  }
  const navigation = read("apps/mobile/src/navigationController.js");
  if (!navigation.includes("operationWorkItemsFromSearchResults") || !navigation.includes("applyRuntimeSurfacePayloads")) {
    failures.push("navigationController must merge Operations Search Kernel work items into runtime operation items.");
  }

  const program = read("services/core-api/WorkOS.Api/Program.cs");
  if (!program.includes("SearchKernelService")) failures.push("Program.cs must register/inject SearchKernelService.");
  if (!program.includes("searchKernel.Search(runtime, q, actor, language)")) {
    failures.push("Search routes must call SearchKernelService.Search.");
  }
  if (/return\s+runtime\.Search\(q\)/.test(program)) {
    failures.push("Program.cs search routes must not return runtime.Search(q) directly.");
  }
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function read(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) throw new Error(`Missing file: ${relativePath}`);
  return fs.readFileSync(fullPath, "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}
