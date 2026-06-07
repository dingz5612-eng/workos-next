import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const contractPath = path.join(repoRoot, "docs", "contracts", "oam.current.json");
const routeRoot = path.join(repoRoot, "services", "core-api");
const cli = parseArgs(process.argv.slice(2));

const allowedWriteCategories = [
  "businessConfirm",
  "prepareOnly",
  "workItemCreation",
  "identitySession",
  "accountGovernance",
  "evidenceObject",
  "reconciliationGovernance",
  "correctionCenter",
  "pcGovernance",
  "projectionMaintenance",
  "mobileAuxiliary",
  "behaviorEvent"
];

const businessConfirmRoute = "POST /api/operations/work-items/{workItemId}/confirm";
const forbiddenWritePatterns = [
  /^POST \/api\/workspaces\/[^/]+\/cards\/[^/]+\/confirm$/,
  /^POST \/api\/payment\/confirm$/,
  /^POST \/api\/mobile\/.*\/confirm$/,
  /^POST \/api\/checkout\/close$/,
  /^POST \/api\/projection.*\/confirm$/
];
const strictTenantGovernanceCategories = new Set(["reconciliationGovernance", "correctionCenter"]);

function readContract() {
  return JSON.parse(fs.readFileSync(contractPath, "utf8"));
}

function routeKey(method, route) {
  return `${method.toUpperCase()} ${route}`;
}

function extractRoutes(source, file = "<memory>") {
  const routes = [];
  const pattern = /\bMap(Post|Put|Patch|Delete|Get)\(\s*"([^"]+)"/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    const method = match[1].toUpperCase();
    const route = match[2];
    routes.push({
      file,
      method,
      route,
      key: routeKey(method, route),
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

function listRouteFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (item.name === "bin" || item.name === "obj") continue;
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      files.push(...listRouteFiles(fullPath));
    } else if (item.isFile() && fullPath.endsWith(".cs")) {
      files.push(fullPath);
    }
  }
  return files;
}

function writeRouteMap(contract) {
  const configured = contract.apiBoundary?.writeRoutes ?? {};
  return Object.fromEntries(allowedWriteCategories.map((category) => [category, configured[category] ?? []]));
}

function routeCategoryMap(contract) {
  const map = new Map();
  const duplicates = [];
  const writeRoutes = writeRouteMap(contract);
  for (const [category, routes] of Object.entries(writeRoutes)) {
    for (const route of routes) {
      const prior = map.get(route);
      if (prior) {
        duplicates.push(`${route} in ${prior} and ${category}`);
      }
      map.set(route, category);
    }
  }
  return { map, duplicates, writeRoutes };
}

function writeGovernance(contract) {
  return contract.apiBoundary?.writeGovernance ?? {};
}

function isActorExemptRoute(route, contract) {
  return (writeGovernance(contract).actorExemptRoutes ?? []).includes(route.key);
}

function hasActorGovernance(route) {
  if (!route.handlerSource.includes("HttpRequest")) {
    return false;
  }

  return route.handlerSource.includes("RequireActor(") ||
    route.handlerSource.includes("StartOperationsWorkspace(") ||
    route.handlerSource.includes("AppendExperienceEvent(");
}

function hasTenantGovernance(route) {
  if (!route.handlerSource.includes("HttpRequest")) {
    return false;
  }

  return route.handlerSource.includes("TenantMatches(") ||
    route.handlerSource.includes("actor.TenantId");
}

function isApiRoute(route) {
  return route.route.startsWith("/api/");
}

function isWriteRoute(route) {
  return isApiRoute(route) && route.method !== "GET";
}

function containsBusinessFactToken(route) {
  return [
    "PaymentConfirmed",
    "DepositConfirmed",
    "CheckoutClosed",
    "BedReleased",
    "RoomReleased",
    "payment_confirmed",
    "deposit_confirmed",
    "checkout_closed",
    "bed_released",
    "room_released"
  ].find((token) => route.handlerSource.includes(token));
}

function validateContract(contract) {
  const violations = [];
  if (contract.version !== "oam.current.v1") {
    violations.push("docs/contracts/oam.current.json must declare version oam.current.v1");
  }
  if (contract.primaryWritePath !== businessConfirmRoute) {
    violations.push(`primaryWritePath must be ${businessConfirmRoute}`);
  }
  const governance = writeGovernance(contract);
  if (governance.defaultRequiresActor !== true) {
    violations.push("apiBoundary.writeGovernance.defaultRequiresActor must be true");
  }
  if (!Array.isArray(governance.actorExemptRoutes) ||
      governance.actorExemptRoutes.length !== 1 ||
      !governance.actorExemptRoutes.includes("POST /api/auth/login")) {
    violations.push("apiBoundary.writeGovernance.actorExemptRoutes must explicitly list only actor-exempt login");
  }
  if (!Array.isArray(governance.previewRoutesRequireActorNoCommitProof) ||
      !governance.previewRoutesRequireActorNoCommitProof.includes("POST /api/reconciliation/bank-statement-imports/preview")) {
    violations.push("apiBoundary.writeGovernance.previewRoutesRequireActorNoCommitProof must include bank statement preview");
  }
  for (const category of ["reconciliationGovernance", "correctionCenter"]) {
    if (!(governance.tenantScopedCategories ?? []).includes(category)) {
      violations.push(`apiBoundary.writeGovernance.tenantScopedCategories must include ${category}`);
    }
    if (!(governance.auditRequiredCategories ?? []).includes(category)) {
      violations.push(`apiBoundary.writeGovernance.auditRequiredCategories must include ${category}`);
    }
  }
  for (const category of allowedWriteCategories) {
    if (!Array.isArray(contract.apiBoundary?.writeRoutes?.[category])) {
      violations.push(`apiBoundary.writeRoutes.${category} must be an array`);
    }
    if (!contract.apiBoundary?.routePolicies?.[category]) {
      violations.push(`apiBoundary.routePolicies.${category} is required`);
    }
  }
  const businessRoutes = contract.apiBoundary?.writeRoutes?.businessConfirm ?? [];
  if (businessRoutes.length !== 1 || businessRoutes[0] !== businessConfirmRoute) {
    violations.push("businessConfirm may contain only the Operations Confirm route");
  }
  const blockedWrite = String(contract.apiBoundary?.writeRoutes?.blockedBusinessWrite ?? "");
  if (blockedWrite) {
    violations.push("blockedBusinessWrite must not exist in current OAM");
  }
  return violations;
}

function validateRoute(route, category, contract) {
  const violations = [];
  const policy = contract.apiBoundary.routePolicies[category] ?? {};
  const businessToken = containsBusinessFactToken(route);
  const governance = writeGovernance(contract);

  if (governance.defaultRequiresActor === true &&
      !isActorExemptRoute(route, contract) &&
      !hasActorGovernance(route)) {
    violations.push(`${route.file}: current OAM write route must require actor governance: ${route.key}`);
  }
  if (strictTenantGovernanceCategories.has(category) &&
      (governance.tenantScopedCategories ?? []).includes(category) &&
      !hasTenantGovernance(route)) {
    violations.push(`${route.file}: current OAM ${category} route must bind tenant governance to current actor: ${route.key}`);
  }

  if (category !== "businessConfirm" && category !== "correctionCenter" && businessToken) {
    violations.push(`${route.file}: ${category} route must not write business fact token ${businessToken}: ${route.key}`);
  }
  if (category === "businessConfirm" && route.key !== businessConfirmRoute) {
    violations.push(`${route.file}: ordinary business write must use ${businessConfirmRoute}: ${route.key}`);
  }
  if (category === "prepareOnly" && policy.writesBusinessFact !== false) {
    violations.push("prepareOnly policy must declare writesBusinessFact=false");
  }
  if (category === "projectionMaintenance" && policy.writesBusinessFact !== false) {
    violations.push("projectionMaintenance policy must declare writesBusinessFact=false");
  }
  if (category === "mobileAuxiliary" && policy.writesBusinessFact !== false) {
    violations.push("mobileAuxiliary policy must declare writesBusinessFact=false");
  }
  return violations;
}

function findViolations(routes, contract, options = {}) {
  const violations = [...validateContract(contract)];
  const { map, duplicates, writeRoutes } = routeCategoryMap(contract);
  violations.push(...duplicates.map((item) => `write route classified multiple times: ${item}`));

  for (const route of routes) {
    if (!isApiRoute(route)) continue;

    if (forbiddenWritePatterns.some((pattern) => pattern.test(route.key))) {
      violations.push(`${route.file}: blocked or forbidden write route is registered: ${route.key}`);
    }

    if (!isWriteRoute(route)) continue;

    const category = map.get(route.key);
    if (!category) {
      violations.push(`${route.file}: unclassified current OAM write route: ${route.key}`);
      continue;
    }
    violations.push(...validateRoute(route, category, contract));
  }

  if (options.enforceBidirectional === true) {
    const sourceWriteRoutes = new Set(routes.filter(isWriteRoute).map((route) => route.key));
    for (const [category, configuredRoutes] of Object.entries(writeRoutes)) {
      for (const configuredRoute of configuredRoutes) {
        if (!sourceWriteRoutes.has(configuredRoute)) {
          violations.push(`docs/contracts/oam.current.json: ${category} route missing from source: ${configuredRoute}`);
        }
      }
    }
  }

  return violations;
}

function buildReport(routes, contract, violations) {
  const apiRoutes = routes.filter(isApiRoute);
  const writeRoutes = apiRoutes.filter(isWriteRoute);
  const { map, writeRoutes: configured } = routeCategoryMap(contract);
  const categoryCounts = Object.fromEntries(allowedWriteCategories.map((category) => [category, 0]));
  const unclassifiedWriteRoutes = [];
  const sourceWriteRouteSet = new Set(writeRoutes.map((route) => route.key));
  const boundaryOnlyWriteRoutes = Object.values(configured).flat().filter((route) => !sourceWriteRouteSet.has(route));

  for (const route of writeRoutes) {
    const category = map.get(route.key);
    if (!category) {
      unclassifiedWriteRoutes.push(route.key);
    } else {
      categoryCounts[category] += 1;
    }
  }

  return {
    version: "oam.current.v1",
    source_type: "oam-api-boundary-check",
    config_path: path.relative(repoRoot, contractPath).replaceAll("\\", "/"),
    status: violations.length === 0 ? "passed" : "failed",
    violation_count: violations.length,
    route_count: routes.length,
    api_route_count: apiRoutes.length,
    write_route_count: writeRoutes.length,
    classified_write_route_count: writeRoutes.length - unclassifiedWriteRoutes.length,
    unclassified_write_route_count: unclassifiedWriteRoutes.length,
    boundary_only_write_route_count: boundaryOnlyWriteRoutes.length,
    business_write_route_count: categoryCounts.businessConfirm,
    category_counts: categoryCounts,
    violations: violations.map((message, index) => ({ index, message })),
    unclassified_write_routes: unclassifiedWriteRoutes,
    boundary_only_write_routes: boundaryOnlyWriteRoutes
  };
}

function writeReport(report) {
  const out = cli.get("out");
  if (out) {
    const resolved = path.isAbsolute(out) ? out : path.join(repoRoot, out);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  if (cli.has("json")) {
    console.log(JSON.stringify(report, null, 2));
  }
}

function expectViolation(routes, contract, expectedRoute, reason) {
  const violations = findViolations(routes, contract);
  if (!violations.some((item) => item.includes(expectedRoute))) {
    throw new Error(`Self-test failed: ${reason}. Violations: ${violations.join("; ")}`);
  }
}

function expectNoViolation(routes, contract, reason) {
  const violations = findViolations(routes, contract);
  if (violations.length > 0) {
    throw new Error(`Self-test failed: ${reason}: ${violations.join("; ")}`);
  }
}

function runSelfTest() {
  const contract = readContract();

  expectViolation(
    extractRoutes('app.MapPost("/api/payment/confirm", () => Results.Ok());', "simulated-payment-forbidden.cs"),
    contract,
    "POST /api/payment/confirm",
    "direct payment confirm was not rejected");

  expectViolation(
    extractRoutes('app.MapPost("/api/reconciliation/unknown", () => Results.Ok());', "simulated-reconciliation-unclassified.cs"),
    contract,
    "POST /api/reconciliation/unknown",
    "unclassified reconciliation route was not rejected");

  expectViolation(
    extractRoutes('app.MapPost("/api/reconciliation/match-candidates/generate", (ReconciliationCandidateGenerationRequest request) => Results.Ok());', "simulated-reconciliation-missing-actor.cs"),
    contract,
    "POST /api/reconciliation/match-candidates/generate",
    "classified write route without actor governance was not rejected");

  expectViolation(
    extractRoutes('app.MapPost("/api/reconciliation/match-candidates/generate", (ReconciliationCandidateGenerationRequest request, HttpRequest httpRequest) => { var actor = httpRequest.HttpContext.RequireActor(); return Results.Ok(runtime.GenerateReconciliationMatchCandidates(request)); });', "simulated-reconciliation-missing-tenant.cs"),
    contract,
    "POST /api/reconciliation/match-candidates/generate",
    "reconciliation write route without actor tenant governance was not rejected");

  expectNoViolation(
    extractRoutes('app.MapPost("/api/operations/work-items/{workItemId}/confirm", (ConfirmCardRequest request, HttpRequest httpRequest) => { httpRequest.HttpContext.RequireActor(); return Results.Ok(); });', "simulated-operations-confirm.cs"),
    contract,
    "Operations Confirm route was rejected");

  expectNoViolation(
    extractRoutes('app.MapPost("/api/operations/workspaces/start", (StartWorkspaceRequest request, HttpRequest httpRequest) => StartOperationsWorkspace(request, "W", httpRequest, runtime, operations, roles, "forbidden"));', "simulated-workspace-start.cs"),
    contract,
    "Operations workspace start route was rejected");

  expectViolation(
    extractRoutes('app.MapPost("/api/workspaces/{workspaceId}/cards/{cardId}/confirm", () => Results.Ok());', "simulated-blocked-workspace-card-confirm.cs"),
    contract,
    "POST /api/workspaces/{workspaceId}/cards/{cardId}/confirm",
    "blocked Workspace/Card confirm was not rejected");

  expectNoViolation(
    extractRoutes('app.MapPost("/api/evidence/{evidenceId}/attachments", (string evidenceId, EvidenceAttachmentRequest request, HttpRequest httpRequest) => { httpRequest.HttpContext.RequireActor(); return Results.Ok(); });', "simulated-evidence-attachment.cs"),
    contract,
    "evidence attachment route was rejected");

  const boundaryOnlyViolations = findViolations(
    extractRoutes('app.MapPost("/api/operations/work-items/{workItemId}/confirm", () => Results.Ok());', "simulated-one-route-source.cs"),
    contract,
    { enforceBidirectional: true });
  if (!boundaryOnlyViolations.some((item) => item.includes("route missing from source"))) {
    throw new Error("Self-test failed: route-source/api-boundary drift was not rejected");
  }

  console.log("API boundary self-test: PASS");
}

function runScan() {
  const contract = readContract();
  const routes = listRouteFiles(routeRoot).flatMap((file) => extractRoutes(fs.readFileSync(file, "utf8"), path.relative(repoRoot, file)));
  const violations = findViolations(routes, contract, { enforceBidirectional: true });
  const report = buildReport(routes, contract, violations);
  writeReport(report);

  if (violations.length > 0) {
    for (const violation of violations) {
      console.error(violation);
    }
    process.exit(1);
  }

  if (!cli.has("json")) {
    console.log("API boundary check: PASS");
  }
}

function parseArgs(argv) {
  const flags = new Set();
  const values = new Map();
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const trimmed = arg.slice(2);
    const separator = trimmed.indexOf("=");
    if (separator >= 0) {
      values.set(trimmed.slice(0, separator), trimmed.slice(separator + 1));
    } else {
      flags.add(trimmed);
    }
  }
  return {
    has: (name) => flags.has(name) || values.has(name),
    get: (name, fallback = undefined) => values.get(name) ?? fallback
  };
}

if (cli.has("self-test")) {
  runSelfTest();
} else {
  runScan();
}
