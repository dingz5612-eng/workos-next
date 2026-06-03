import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

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
  "businessObject",
  "evidence",
  "ledger",
  "payment",
  "deposit",
  "correction",
  "reconciliation",
  "gateResult",
  "release",
  "lensItem",
  "auditEvent",
  "learningItem"
];
const requiredResultFields = [
  "resultId",
  "resultType",
  "title",
  "summary",
  "matchedTerms",
  "score",
  "target",
  "admission",
  "traceRefs",
  "sourceRefs",
  "language",
  "explain"
];

checkContract();
checkSourcesAndSchema();
checkRankingAndPermission();
checkLegacyAdapterBoundary();
checkRuntimeImplementation();

if (failures.length > 0) {
  for (const failure of failures) console.error(`P0 ${failure}`);
  throw new Error("Search Kernel check failed.");
}

console.log("Search Kernel check: PASS");

function checkContract() {
  if (searchContract.version !== "oam.search-contract.v1") failures.push("search-contract version mismatch.");
  if (languageContract.version !== "oam.language-contract.v1") failures.push("Search Kernel must reference the Language Kernel contract.");
  if (admissionContract.version !== "oam.admission-contract.v1") failures.push("Search Kernel must reference the Admission Kernel contract.");

  for (const objectType of requiredObjectTypes) {
    if (!(searchContract.objectTypes || []).includes(objectType)) failures.push(`search-contract missing objectType ${objectType}.`);
  }
  for (const field of requiredResultFields) {
    if (!(searchContract.requiredResultFields || []).includes(field)) failures.push(`search-contract missing required SearchResult field ${field}.`);
  }
  if (searchContract.languageSynonymRef !== "docs/contracts/language/search-synonyms.json") {
    failures.push("search-contract must reference Language Kernel search synonyms.");
  }
}

function checkSourcesAndSchema() {
  const coveredTypes = new Set((indexSources.sources || []).flatMap((source) => source.objectTypes || []));
  for (const objectType of requiredObjectTypes) {
    if (!coveredTypes.has(objectType)) failures.push(`search-index-sources missing objectType coverage ${objectType}.`);
  }
  for (const source of indexSources.sources || []) {
    if (source.admissionRequired !== true) failures.push(`${source.sourceId} must require admission.`);
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
}

function checkRankingAndPermission() {
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
    "legacy-adapter-label-required"
  ]) {
    if (!(permissionPolicy.rules || []).some((rule) => rule.ruleId === ruleId)) {
      failures.push(`search-permission-policy missing rule ${ruleId}.`);
    }
  }
}

function checkLegacyAdapterBoundary() {
  const adapters = searchContract.legacyAdapters || [];
  const lensAdapter = adapters.find((adapter) => adapter.name === "LensQueryService.Search");
  if (!lensAdapter || lensAdapter.status !== "legacy-adapter") {
    failures.push("LensQueryService.Search must be registered as a legacy adapter.");
  }
  if (lensAdapter && !exists(lensAdapter.path)) failures.push(`LensQueryService.Search path missing: ${lensAdapter.path}.`);

  const compatibility = read("docs/architecture/compatibility-components.yml");
  if (!compatibility.includes("LensQueryService legacy search")) {
    failures.push("compatibility-components.yml must classify LensQueryService legacy search.");
  }
  const quarantine = read("docs/architecture/compatibility-quarantine-rules.md");
  if (!quarantine.includes("LensQueryService legacy search 可以保留") || !quarantine.includes("SearchKernel")) {
    failures.push("compatibility quarantine rules must state LensQueryService is legacy and SearchKernel must take over.");
  }

  const lensSource = read("services/core-api/WorkOS.Api/Runtime/LensQueryService.cs");
  if (!/public\s+IReadOnlyList<object>\s+Search\s*\(/.test(lensSource)) {
    failures.push("LensQueryService.Search method missing.");
  }
  if (/\.Contains\(/.test(lensSource) && !lensAdapter) {
    failures.push("Contains-based LensQueryService search is only allowed through registered legacy adapter.");
  }
}

function checkRuntimeImplementation() {
  for (const file of [
    "services/core-api/WorkOS.Api/Runtime/SearchKernelService.cs",
    "services/core-api/WorkOS.Api/Runtime/WorkItemDefinitionRegistryService.cs",
    "services/core-api/WorkOS.Api/Runtime/AdmissionKernelService.cs"
  ]) {
    if (!exists(file)) failures.push(`Search Kernel runtime implementation missing: ${file}.`);
  }

  const searchKernel = read("services/core-api/WorkOS.Api/Runtime/SearchKernelService.cs");
  for (const term of [
    "SearchKernelService",
    "LegacyWorkspaceSearchAdapter",
    "EvaluateSearch",
    "LanguageSearchSynonymCatalog",
    "\"resultType\"",
    "\"admission\"",
    "\"traceRefs\"",
    "\"sourceRefs\"",
    "\"language\""
  ]) {
    if (!searchKernel.includes(term)) failures.push(`SearchKernelService.cs missing ${term}.`);
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
