import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outPath = path.join(root, "artifacts", "oam-cab", "oam-cab-v1-inventory.json");

const routeFiles = listFiles(path.join(root, "services"), [".cs"]);
const routes = routeFiles.flatMap((file) => extractRoutes(readAbs(file), rel(file)));
const nonGetRoutes = routes.filter((route) => route.method !== "GET" && route.route.startsWith("/api/"));
const apiBoundary = parseApiBoundary(read("docs/rules/v5.5/api-boundary.yml"));
const classification = nonGetRoutes.map((route) => ({
  ...route,
  classification: classifyRoute(route, apiBoundary),
  legacyWritePathClass: legacyWritePathClass(route, apiBoundary)
}));

const businessWrites = classification.filter((route) =>
  route.classification === "operationsBusinessWrite" ||
  route.classification === "correctionCenterWrite");

const definitionRegistry = readJson("docs/contracts/definition/workitem-definition-registry.json");
const fieldRefs = readJson("docs/contracts/definition/field-contract-refs.json");
const factOwnership = parseFactOwnership(read("docs/rules/v5.5/fact-ownership.yml"));
const searchContract = readJson("docs/contracts/search/search-contract.json");
const languageContract = readJson("docs/contracts/language/language-contract.json");

const runtimeSources = listFiles(path.join(root, "services", "core-api", "WorkOS.Api", "Runtime"), [".cs"])
  .filter((file) => !file.includes(`${path.sep}bin${path.sep}`) && !file.includes(`${path.sep}obj${path.sep}`))
  .map((file) => ({ path: rel(file), text: readAbs(file) }));
const mobileSources = listFiles(path.join(root, "apps", "mobile", "src"), [".js", ".ts"])
  .filter((file) => !file.includes(`${path.sep}dist${path.sep}`))
  .map((file) => ({ path: rel(file), text: readAbs(file) }));

const inventory = {
  version: "oam-cab.inventory.v1",
  generatedAt: new Date().toISOString(),
  route_inventory: routes.map(({ handlerSource, ...route }) => route),
  non_get_route_classification: classification.map(({ handlerSource, ...route }) => route),
  business_write_path_inventory: businessWrites.map(({ handlerSource, ...route }) => route),
  legacy_write_path_classification: classification
    .filter((route) => route.legacyWritePathClass !== "non-business write")
    .map(({ handlerSource, ...route }) => route),
  definition_registry_coverage: {
    version: definitionRegistry.version,
    definitionCount: (definitionRegistry.definitions || []).length,
    definitionIds: (definitionRegistry.definitions || []).map((item) => item.definitionId),
    requiredFieldsCovered: new Set((fieldRefs.refs || []).flatMap((item) => item.requiredFieldIds || [])).size
  },
  work_item_definition_coverage: {
    cards: (definitionRegistry.definitions || []).map((item) => ({
      definitionId: item.definitionId,
      sliceId: item.sliceId,
      legacyCardId: item.legacyCardId,
      commandType: item.commandType,
      projectionOwner: item.projectionOwner,
      allowedFacts: item.allowedFacts || []
    }))
  },
  handler_allowedFacts_coverage: scanAllowedFacts(runtimeSources),
  fact_ownership_matrix: factOwnership,
  compatibility_scan: {
    projectionRuntime: scanSource(runtimeSources, ["ProjectionRuntime", "RuntimeAggregateLensStorage", "shadow_runtime"]),
    retiredWorkspaceCardWritePath: scanSource(runtimeSources, ["WorkspaceCardCompatibilityAdapter", "ConfirmWorkspaceCard", "PrepareWorkspaceCard"]),
    runtimeDocuments: scanSource(runtimeSources, ["runtime_documents", "RuntimeDocumentStorage"]),
    lensQueryService: scanSource(runtimeSources, ["LensQueryService", "Search("])
  },
  projection_runtime_write_usage_scan: scanSource(runtimeSources, ["ProjectionRuntime", "RecordProjection", "ProcessOutbox", "runtime_documents"]),
  retired_workspace_card_write_usage_scan: scanSource(runtimeSources, ["ConfirmWorkspaceCard", "PrepareWorkspaceCard", "WorkspaceCardCompatibilityAdapter"]),
  runtime_documents_source_of_truth_usage_scan: scanSource(runtimeSources, ["runtime_documents", "authoritative", "source of truth"]),
  runtime_documents_snapshot_only_audit: {
    status: "snapshot-only-contract",
    evidence: ["docs/architecture/compatibility-components.yml", "docs/architecture/compatibility-quarantine-rules.md", "scripts/check-fact-ownership.mjs"]
  },
  search_usage_inventory: {
    objectTypes: searchContract.objectTypes,
    requiredResultFields: searchContract.requiredResultFields,
    projectionAdapters: searchContract.projectionAdapters,
    runtimeBindings: scanSource(runtimeSources, ["SearchKernelService", "ProjectionWorkspaceSearchAdapter", "LensQueryService"])
  },
  language_key_status_explanation_inventory: {
    supportedLanguages: languageContract.supportedLanguages,
    catalogs: languageContract.authoritativeCatalogs,
    runtimeBindings: languageContract.runtimeBindings,
    mobileStatusKeys: scanSource(mobileSources, ["blocked", "confirmAllowed", "productionAllowed", "idempotency_conflict_409", "business_blocked_422"])
  },
  control_plane_write_capability_inventory: {
    routes: classification.filter((route) => ["controlPlaneWrite", "pcGovernanceWrite", "governanceWrite"].includes(route.classification)).map(({ handlerSource, ...route }) => route),
    runtimeBindings: scanSource(runtimeSources, ["ControlPlaneWriteStore", "GateResultWrite", "RollbackInstruction", "BusinessSignoff"])
  },
  evidence_graph_write_reference_inventory: {
    refs: existingRefs([
      "artifacts/rt4/evidence-graph.json",
      "artifacts/oam-cab/oam-cab-v1-current-state.md",
      "artifacts/oam-cab/oam-cab-v1-final-report.json",
      "artifacts/oam-cab/execution-log.jsonl",
      "artifacts/oam-cab/browser-checks/phase-5/check-result.json"
    ]),
    runtimeBindings: scanSource(runtimeSources, ["Evidence", "FactTrace", "RuntimeProof", "GateResult"])
  },
  forbidden_findings: classification.filter((route) => route.classification === "unclassified" || route.legacyWritePathClass === "forbidden"),
  summary: {}
};

inventory.summary = {
  routeCount: inventory.route_inventory.length,
  nonGetRouteCount: inventory.non_get_route_classification.length,
  businessWriteRouteCount: inventory.business_write_path_inventory.length,
  forbiddenFindingCount: inventory.forbidden_findings.length,
  definitionCount: inventory.definition_registry_coverage.definitionCount,
  searchResultTypeCount: (searchContract.objectTypes || []).length,
  languageCount: (languageContract.supportedLanguages || []).length
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
console.log(`OAM-CAB inventory written: ${path.relative(root, outPath).replaceAll("\\", "/")}`);

function extractRoutes(source, file) {
  const routes = [];
  const pattern = /\bMap(Post|Put|Patch|Delete|Get)\(\s*"([^"]+)"/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    routes.push({
      file,
      method: match[1].toUpperCase(),
      route: match[2],
      key: `${match[1].toUpperCase()} ${match[2]}`,
      handlerSource: routeHandlerSource(source, match.index)
    });
  }
  return routes;
}

function routeHandlerSource(source, startIndex) {
  const rest = source.slice(startIndex + 1);
  const next = rest.search(/\bMap(?:Post|Put|Patch|Delete|Get)\(\s*"/);
  return next < 0 ? source.slice(startIndex) : source.slice(startIndex, startIndex + 1 + next);
}

function parseApiBoundary(source) {
  const categories = {};
  let category = "";
  for (const rawLine of source.split(/\r?\n/)) {
    const indent = rawLine.match(/^\s*/)[0].length;
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (indent === 2 && /^[-\w]+:\s*$/.test(line)) {
      category = line.slice(0, -1);
      categories[category] ??= [];
      continue;
    }
    if (indent === 4 && line.startsWith("- route:")) {
      const route = line.slice("- route:".length).trim().replace(/^["']|["']$/g, "");
      categories[category] ??= [];
      categories[category].push(route);
    }
  }
  return categories;
}

function classifyRoute(route, boundary) {
  for (const [category, routesInCategory] of Object.entries(boundary)) {
    if (routesInCategory.includes(route.key)) return category;
  }
  return route.route.startsWith("/api/") && route.method !== "GET" ? "unclassified" : "non-api-or-read";
}

function legacyWritePathClass(route, boundary) {
  const category = classifyRoute(route, boundary);
  if (category === "operationsBusinessWrite") return "primary operations confirm";
  if (category === "compatibilityBusinessWrite") return "retired";
  if (category === "unclassified") return "forbidden";
  return "non-business write";
}

function scanAllowedFacts(sources) {
  return sources
    .filter((source) => source.text.includes("AllowedFacts") || source.text.includes("allowedFacts") || source.text.includes("SliceCommandHandlerDefinition"))
    .map((source) => ({
      path: source.path,
      mentions: countMentions(source.text, ["AllowedFacts", "allowedFacts", "SliceCommandHandlerDefinition", "ValidateFactOwnership"])
    }));
}

function parseFactOwnership(source) {
  const facts = [...source.matchAll(/^\s*-\s+fact:\s*"?([^"\r\n]+)"?/gm)].map((match) => match[1].trim());
  const owners = [...source.matchAll(/owner:\s*"?([^"\r\n]+)"?/g)].map((match) => match[1].trim());
  return {
    source: "docs/rules/v5.5/fact-ownership.yml",
    factCount: facts.length,
    facts,
    owners: [...new Set(owners)]
  };
}

function scanSource(sources, terms) {
  return sources
    .map((source) => ({
      path: source.path,
      mentions: countMentions(source.text, terms)
    }))
    .filter((source) => Object.values(source.mentions).some((count) => count > 0));
}

function countMentions(text, terms) {
  return Object.fromEntries(terms.map((term) => [term, (text.match(new RegExp(escapeRegex(term), "g")) || []).length]));
}

function existingRefs(paths) {
  return paths.map((item) => ({ path: item, exists: fs.existsSync(path.join(root, item)) }));
}

function listFiles(dir, extensions, output = []) {
  if (!fs.existsSync(dir)) return output;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "bin" || entry.name === "obj" || entry.name === "node_modules" || entry.name === "dist") continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) listFiles(fullPath, extensions, output);
    else if (extensions.some((extension) => entry.name.endsWith(extension))) output.push(fullPath);
  }
  return output;
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function readAbs(file) {
  return fs.readFileSync(file, "utf8");
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function rel(file) {
  return path.relative(root, file).replaceAll("\\", "/");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
