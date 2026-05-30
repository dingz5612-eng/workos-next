import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const allowlistPath = path.join(repoRoot, "docs", "v5.4", "operations-api-allowlist.json");
const routeRoot = path.join(repoRoot, "services");
const cli = parseArgs(process.argv.slice(2));

const writeAllowlistCategories = [
  "businessWriteAllowlist",
  "operationsRuntimeWriteAllowlist",
  "compatibilityWriteAllowlist",
  "mobileExperienceWriteAllowlist",
  "evidenceFileWriteAllowlist",
  "authDeviceWriteAllowlist",
  "controlPlaneWriteAllowlist",
  "governanceWriteAllowlist",
  "behaviorEventWriteAllowlist",
  "runtimeMaintenanceWriteAllowlist"
];

const exactBusinessWriteRoutes = new Set([
  "POST /api/operations/work-items/{workItemId}/confirm"
]);

const allowedMobileExperienceRoutes = new Set([
  "POST /api/mobile/drafts",
  "POST /api/mobile/client-events",
  "POST /api/mobile/recent-objects"
]);

const compatibilityRoutes = new Set([
  "POST /api/workspaces/{workspaceId}/cards/{cardId}/prepare",
  "POST /api/workspaces/{workspaceId}/cards/{cardId}/confirm"
]);

const nonBusinessFactTokens = [
  "PaymentConfirmed",
  "DepositConfirmed",
  "CheckoutClosed",
  "BedReleased",
  "RoomReleased",
  "payment_confirmed",
  "deposit_confirmed",
  "checkout_closed",
  "bed_released",
  "room_released",
  "deposit_entries",
  "payment_facts"
];

function readAllowlist() {
  return JSON.parse(fs.readFileSync(allowlistPath, "utf8"));
}

function wildcardPatternToRegex(pattern) {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replaceAll("*", ".*");
  return new RegExp(`^${escaped}$`);
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
  const items = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const item of items) {
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

function routeEntryRoute(entry) {
  return typeof entry === "string" ? entry : entry.route;
}

function routeEntries(allowlist, category) {
  return (allowlist[category] ?? []).map((entry) => {
    const route = routeEntryRoute(entry);
    return {
      route,
      entry: typeof entry === "string" ? { route } : entry
    };
  });
}

function categoryRouteSet(allowlist, category) {
  return new Set(routeEntries(allowlist, category).map((item) => item.route));
}

function findRouteEntry(allowlist, category, key) {
  return routeEntries(allowlist, category).find((item) => item.route === key)?.entry;
}

function classifiedCategories(route, allowlist) {
  return writeAllowlistCategories.filter((category) => categoryRouteSet(allowlist, category).has(route.key));
}

function isApiRoute(route) {
  return route.route.startsWith("/api/");
}

function isWriteRoute(route) {
  return isApiRoute(route) && route.method !== "GET";
}

function containsBusinessFactToken(text) {
  return nonBusinessFactTokens.find((token) => text.includes(token));
}

function hasBoolean(entry, field) {
  return Object.prototype.hasOwnProperty.call(entry, field) && typeof entry[field] === "boolean";
}

function validateAllowlist(allowlist) {
  const violations = [];
  if (allowlist.version !== 2) {
    violations.push("operations-api-allowlist.json must declare version 2");
  }

  for (const category of writeAllowlistCategories) {
    if (!Array.isArray(allowlist[category])) {
      violations.push(`operations-api-allowlist.json missing ${category} array`);
    }
  }

  for (const { route } of routeEntries(allowlist, "businessWriteAllowlist")) {
    if (!exactBusinessWriteRoutes.has(route)) {
      violations.push(`businessWriteAllowlist may only contain Operations Confirm: ${route}`);
    }
  }

  for (const { route } of routeEntries(allowlist, "operationsRuntimeWriteAllowlist")) {
    if (!route.startsWith("POST /api/operations/")) {
      violations.push(`operationsRuntimeWriteAllowlist route must be under /api/operations: ${route}`);
    }
    if (exactBusinessWriteRoutes.has(route)) {
      violations.push(`Operations Confirm must stay in businessWriteAllowlist, not operationsRuntimeWriteAllowlist: ${route}`);
    }
  }

  for (const { route } of routeEntries(allowlist, "compatibilityWriteAllowlist")) {
    if (!compatibilityRoutes.has(route)) {
      violations.push(`compatibilityWriteAllowlist may only contain old Workspace/Card prepare/confirm: ${route}`);
    }
  }

  for (const { route } of routeEntries(allowlist, "mobileExperienceWriteAllowlist")) {
    if (!allowedMobileExperienceRoutes.has(route)) {
      violations.push(`mobileExperienceWriteAllowlist route is not an approved mobile experience route: ${route}`);
    }
  }

  for (const { route } of routeEntries(allowlist, "evidenceFileWriteAllowlist")) {
    if (!route.includes(" /api/evidence/")) {
      violations.push(`evidenceFileWriteAllowlist route must be under /api/evidence: ${route}`);
    }
  }

  for (const { route } of routeEntries(allowlist, "authDeviceWriteAllowlist")) {
    if (!route.includes(" /api/auth/") && !route.includes(" /api/device-sessions")) {
      violations.push(`authDeviceWriteAllowlist route must be under /api/auth or /api/device-sessions: ${route}`);
    }
  }

  for (const { route, entry } of routeEntries(allowlist, "controlPlaneWriteAllowlist")) {
    if (!route.includes(" /api/control-plane/")) {
      violations.push(`controlPlaneWriteAllowlist route must be under /api/control-plane: ${route}`);
    }
    if (entry.writesOnlyControlPlane !== true || entry.writesBusinessFacts !== false) {
      violations.push(`controlPlaneWriteAllowlist route must declare writesOnlyControlPlane=true and writesBusinessFacts=false: ${route}`);
    }
  }

  for (const { route, entry } of routeEntries(allowlist, "governanceWriteAllowlist")) {
    for (const field of [
      "writesBusinessFacts",
      "usesOperationsConfirm",
      "writesOnlyControlGovernanceOrProvisionalRecords",
      "appendOnly"
    ]) {
      if (!hasBoolean(entry, field)) {
        violations.push(`governanceWriteAllowlist ${route} must declare boolean guard ${field}`);
      }
    }

    const appendOnlyCorrectionService = entry.appendOnlyCorrectionService === true;
    if (entry.writesBusinessFacts === true && entry.usesOperationsConfirm !== true && !appendOnlyCorrectionService) {
      violations.push(`governanceWriteAllowlist ${route} must not write business facts outside Operations Confirm or an explicit append-only correction service`);
    }
    if (entry.writesOnlyControlGovernanceOrProvisionalRecords !== true && !appendOnlyCorrectionService) {
      violations.push(`governanceWriteAllowlist ${route} must only write control/governance/provisional records unless it declares appendOnlyCorrectionService=true`);
    }
    if (entry.appendOnly !== true) {
      violations.push(`governanceWriteAllowlist ${route} must be append-only`);
    }
    if (appendOnlyCorrectionService && !Array.isArray(entry.invariantEvidence)) {
      violations.push(`governanceWriteAllowlist ${route} append-only correction service must declare invariantEvidence`);
    }
  }

  const seenRoutes = new Map();
  for (const category of writeAllowlistCategories) {
    for (const { route } of routeEntries(allowlist, category)) {
      const prior = seenRoutes.get(route);
      if (prior) {
        violations.push(`write route classified multiple times: ${route} in ${prior} and ${category}`);
      }
      seenRoutes.set(route, category);
    }
  }

  return violations;
}

function validateRouteCategory(route, category, allowlist) {
  const violations = [];
  const entry = findRouteEntry(allowlist, category, route.key) ?? {};

  if (category === "businessWriteAllowlist" && !exactBusinessWriteRoutes.has(route.key)) {
    violations.push(`${route.file}: business write route is not the Operations Confirm route: ${route.key}`);
  }

  if (category === "operationsRuntimeWriteAllowlist" && containsBusinessFactToken(route.handlerSource)) {
    violations.push(`${route.file}: Operations runtime coordination route appears to write business fact token ${containsBusinessFactToken(route.handlerSource)}: ${route.key}`);
  }

  if (category === "mobileExperienceWriteAllowlist" && containsBusinessFactToken(route.handlerSource)) {
    violations.push(`${route.file}: mobile experience route must not write business fact token ${containsBusinessFactToken(route.handlerSource)}: ${route.key}`);
  }

  if (category === "evidenceFileWriteAllowlist" && containsBusinessFactToken(route.handlerSource)) {
    violations.push(`${route.file}: evidence file route must not write business fact token ${containsBusinessFactToken(route.handlerSource)}: ${route.key}`);
  }

  if (category === "controlPlaneWriteAllowlist") {
    if (entry.writesOnlyControlPlane !== true) {
      violations.push(`${route.file}: control plane write route must declare writesOnlyControlPlane=true: ${route.key}`);
    }
    if (containsBusinessFactToken(route.handlerSource)) {
      violations.push(`${route.file}: control plane write route must not write business fact token ${containsBusinessFactToken(route.handlerSource)}: ${route.key}`);
    }
  }

  if (category === "governanceWriteAllowlist" && containsBusinessFactToken(route.handlerSource)) {
    violations.push(`${route.file}: governance write route must not directly write business fact token ${containsBusinessFactToken(route.handlerSource)}: ${route.key}`);
  }

  return violations;
}

function findViolations(routes, allowlist) {
  const violations = [...validateAllowlist(allowlist)];
  const forbiddenPatterns = (allowlist.forbiddenBusinessWritePatterns || []).map((item) => ({
    label: item,
    regex: wildcardPatternToRegex(item)
  }));

  for (const route of routes) {
    if (!isApiRoute(route)) {
      continue;
    }

    for (const forbidden of forbiddenPatterns) {
      if (forbidden.regex.test(route.key)) {
        violations.push(`${route.file}: P0 forbidden business write route ${route.key} matches ${forbidden.label}`);
      }
    }

    if (!isWriteRoute(route)) {
      continue;
    }

    const categories = classifiedCategories(route, allowlist);
    if (categories.length === 0) {
      violations.push(`${route.file}: P0 unclassified write route ${route.key}. All non-GET /api/* routes must be explicitly classified.`);
      continue;
    }

    if (categories.length > 1) {
      violations.push(`${route.file}: P0 write route ${route.key} matches multiple classifications: ${categories.join(", ")}`);
      continue;
    }

    violations.push(...validateRouteCategory(route, categories[0], allowlist));
  }

  return violations;
}

function buildReport(routes, allowlist, violations) {
  const apiRoutes = routes.filter(isApiRoute);
  const writeRoutes = apiRoutes.filter(isWriteRoute);
  const categoryCounts = Object.fromEntries(writeAllowlistCategories.map((category) => [category, 0]));
  const unclassifiedWriteRoutes = [];
  const multiClassifiedWriteRoutes = [];

  for (const route of writeRoutes) {
    const categories = classifiedCategories(route, allowlist);
    if (categories.length === 0) {
      unclassifiedWriteRoutes.push(route.key);
      continue;
    }
    if (categories.length > 1) {
      multiClassifiedWriteRoutes.push(route.key);
      continue;
    }
    categoryCounts[categories[0]] += 1;
  }

  return {
    version: 2,
    status: violations.length === 0 ? "passed" : "failed",
    violation_count: violations.length,
    route_count: routes.length,
    api_route_count: apiRoutes.length,
    write_route_count: writeRoutes.length,
    classified_write_route_count: writeRoutes.length - unclassifiedWriteRoutes.length - multiClassifiedWriteRoutes.length,
    unclassified_write_route_count: unclassifiedWriteRoutes.length,
    multi_classified_write_route_count: multiClassifiedWriteRoutes.length,
    business_write_route_count: categoryCounts.businessWriteAllowlist,
    category_counts: categoryCounts,
    violations: violations.map((message, index) => ({ index, message })),
    unclassified_write_routes: unclassifiedWriteRoutes,
    multi_classified_write_routes: multiClassifiedWriteRoutes
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

function withoutRoute(allowlist, category, route) {
  return {
    ...allowlist,
    [category]: (allowlist[category] ?? []).filter((entry) => routeEntryRoute(entry) !== route)
  };
}

function expectViolation(routes, allowlist, expectedRoute, reason) {
  const violations = findViolations(routes, allowlist);
  if (!violations.some((item) => item.includes(expectedRoute))) {
    throw new Error(`Self-test failed: ${reason}. Violations: ${violations.join("; ")}`);
  }
}

function expectNoViolation(routes, allowlist, reason) {
  const violations = findViolations(routes, allowlist);
  if (violations.length > 0) {
    throw new Error(`Self-test failed: ${reason}: ${violations.join("; ")}`);
  }
}

function runSelfTest() {
  const allowlist = readAllowlist();

  expectViolation(
    extractRoutes('app.MapPost("/api/payment/confirm", () => Results.Ok());', "simulated-payment-forbidden.cs"),
    allowlist,
    "POST /api/payment/confirm",
    "/api/payment/confirm was not rejected");

  expectViolation(
    extractRoutes('app.MapPost("/api/reconciliation/match-candidates/{id}/accept", () => Results.Ok());', "simulated-reconciliation-unclassified.cs"),
    allowlist,
    "POST /api/reconciliation/match-candidates/{id}/accept",
    "unclassified reconciliation accept was not rejected");

  expectViolation(
    extractRoutes('app.MapPost("/api/correction-center/ledger-correction-requests/{correctionRequestId}/apply", () => Results.Ok());', "simulated-correction-unclassified.cs"),
    withoutRoute(allowlist, "governanceWriteAllowlist", "POST /api/correction-center/ledger-correction-requests/{correctionRequestId}/apply"),
    "POST /api/correction-center/ledger-correction-requests/{correctionRequestId}/apply",
    "unclassified correction apply was not rejected");

  expectNoViolation(
    extractRoutes('app.MapPost("/api/operations/work-items/{workItemId}/confirm", () => Results.Ok());', "simulated-operations-confirm.cs"),
    allowlist,
    "Operations Confirm route was rejected");

  expectNoViolation(
    extractRoutes('app.MapPost("/api/evidence/{evidenceId}/attachments", () => Results.Ok());', "simulated-evidence-attachment.cs"),
    allowlist,
    "evidence attachment route was rejected");

  console.log("API boundary self-test: PASS");
}

function runScan() {
  const allowlist = readAllowlist();
  const routes = listRouteFiles(routeRoot).flatMap((file) => extractRoutes(fs.readFileSync(file, "utf8"), path.relative(repoRoot, file)));
  const violations = findViolations(routes, allowlist);
  const report = buildReport(routes, allowlist, violations);
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
    if (!arg.startsWith("--")) {
      continue;
    }

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
