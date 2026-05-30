import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const allowlistPath = path.join(repoRoot, "docs", "rules", "v5.5", "api-boundary.yml");
const routeRoot = path.join(repoRoot, "services");
const cli = parseArgs(process.argv.slice(2));

const writeAllowlistCategories = [
  "operationsBusinessWrite",
  "compatibilityBusinessWrite",
  "mobileExperienceWrite",
  "evidenceWrite",
  "evidenceRead",
  "governanceWrite",
  "reconciliationGovernanceWrite",
  "correctionCenterWrite",
  "pcGovernanceWrite",
  "securitySessionWrite",
  "systemProjectionWrite",
  "behaviorEventWrite",
  "controlPlaneWrite"
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
  const source = fs.readFileSync(allowlistPath, "utf8");
  return parseApiBoundaryYaml(source);
}

function parseApiBoundaryYaml(source) {
  const result = {
    version: undefined,
    categories: {},
    forbiddenBusinessWritePatterns: []
  };

  let section = "";
  let category = "";
  let currentEntry = null;
  let currentArrayField = "";

  for (const rawLine of source.split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.trim().startsWith("#")) continue;

    const indent = rawLine.match(/^\s*/)[0].length;
    const line = rawLine.trim();

    if (indent === 0) {
      currentEntry = null;
      currentArrayField = "";
      const match = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line);
      if (!match) continue;
      const [, key, value] = match;
      if (key === "version") {
        result.version = Number.parseInt(value, 10);
      } else if (key === "categories" || key === "forbiddenBusinessWritePatterns") {
        section = key;
      }
      continue;
    }

    if (section === "forbiddenBusinessWritePatterns" && indent === 2 && line.startsWith("- ")) {
      result.forbiddenBusinessWritePatterns.push(parseScalar(line.slice(2)));
      continue;
    }

    if (section !== "categories") continue;

    if (indent === 2) {
      const match = /^([A-Za-z0-9_]+):\s*$/.exec(line);
      if (!match) continue;
      category = match[1];
      result.categories[category] ??= [];
      currentEntry = null;
      currentArrayField = "";
      continue;
    }

    if (!category) continue;

    if (indent === 4 && line.startsWith("- ")) {
      currentEntry = {};
      result.categories[category].push(currentEntry);
      currentArrayField = "";
      const rest = line.slice(2);
      const pair = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(rest);
      if (pair) {
        currentEntry[pair[1]] = parseScalar(pair[2]);
      }
      continue;
    }

    if (!currentEntry) continue;

    if (indent === 6) {
      const pair = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line);
      if (!pair) continue;
      const [, key, value] = pair;
      if (value === "") {
        currentEntry[key] = [];
        currentArrayField = key;
      } else {
        currentEntry[key] = parseScalar(value);
        currentArrayField = "";
      }
      continue;
    }

    if (indent === 8 && currentArrayField && line.startsWith("- ")) {
      currentEntry[currentArrayField].push(parseScalar(line.slice(2)));
    }
  }

  for (const categoryName of writeAllowlistCategories) {
    result[categoryName] = result.categories[categoryName] ?? [];
  }

  return result;
}

function parseScalar(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  return trimmed;
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

function boolValue(entry, singular, plural = `${singular}s`) {
  if (Object.prototype.hasOwnProperty.call(entry, singular)) return entry[singular];
  if (Object.prototype.hasOwnProperty.call(entry, plural)) return entry[plural];
  return undefined;
}

function validateAllowlist(allowlist) {
  const violations = [];
  if (allowlist.version !== 3) {
    violations.push("api-boundary.yml must declare version 3");
  }

  for (const category of writeAllowlistCategories) {
    if (!Array.isArray(allowlist[category])) {
      violations.push(`api-boundary.yml missing ${category} array`);
    }
  }

  for (const category of writeAllowlistCategories) {
    for (const { route, entry } of routeEntries(allowlist, category)) {
      if (!route) {
        violations.push(`${category} contains an entry without route`);
        continue;
      }

      for (const field of ["class", "owner", "evidenceType", "severity"]) {
        if (!entry[field]) {
          violations.push(`${category} ${route} must declare ${field}`);
        }
      }
      for (const field of ["writesBusinessFact", "writesGovernanceFact", "requiresOperationsConfirm", "appendOnly"]) {
        if (typeof entry[field] !== "boolean") {
          violations.push(`${category} ${route} must declare boolean ${field}`);
        }
      }
      if (!Array.isArray(entry.requiredInvariant) || entry.requiredInvariant.length === 0) {
        violations.push(`${category} ${route} must declare requiredInvariant`);
      }
      if (entry.class && entry.class !== category) {
        violations.push(`${category} ${route} class must match category`);
      }
    }
  }

  for (const { route } of routeEntries(allowlist, "operationsBusinessWrite")) {
    if (!exactBusinessWriteRoutes.has(route)) {
      violations.push(`operationsBusinessWrite may only contain Operations Confirm: ${route}`);
    }
  }

  for (const { route } of routeEntries(allowlist, "systemProjectionWrite")) {
    if (!route.includes(" /api/operations/") && route !== "POST /api/projections/process-outbox") {
      violations.push(`systemProjectionWrite route must be Operations coordination or projector maintenance: ${route}`);
    }
    if (exactBusinessWriteRoutes.has(route)) {
      violations.push(`Operations Confirm must stay in operationsBusinessWrite, not systemProjectionWrite: ${route}`);
    }
  }

  for (const { route } of routeEntries(allowlist, "compatibilityBusinessWrite")) {
    if (!compatibilityRoutes.has(route)) {
      violations.push(`compatibilityBusinessWrite may only contain old Workspace/Card prepare/confirm: ${route}`);
    }
  }

  for (const { route } of routeEntries(allowlist, "mobileExperienceWrite")) {
    if (!allowedMobileExperienceRoutes.has(route)) {
      violations.push(`mobileExperienceWrite route is not an approved mobile experience route: ${route}`);
    }
  }

  for (const { route } of routeEntries(allowlist, "evidenceWrite")) {
    if (!route.includes(" /api/evidence/")) {
      violations.push(`evidenceWrite route must be under /api/evidence: ${route}`);
    }
  }

  for (const { route } of routeEntries(allowlist, "securitySessionWrite")) {
    if (!route.includes(" /api/auth/") && !route.includes(" /api/device-sessions")) {
      violations.push(`securitySessionWrite route must be under /api/auth or /api/device-sessions: ${route}`);
    }
  }

  for (const { route, entry } of routeEntries(allowlist, "controlPlaneWrite")) {
    if (!route.includes(" /api/control-plane/")) {
      violations.push(`controlPlaneWrite route must be under /api/control-plane: ${route}`);
    }
    if (boolValue(entry, "writesBusinessFact") !== false) {
      violations.push(`controlPlaneWrite route must declare writesBusinessFact=false: ${route}`);
    }
  }

  for (const { route, entry } of routeEntries(allowlist, "reconciliationGovernanceWrite")) {
    if (!route.includes(" /api/reconciliation/")) {
      violations.push(`reconciliationGovernanceWrite route must be under /api/reconciliation: ${route}`);
    }
    if (entry.writesBusinessFact !== false || entry.writesGovernanceFact !== true || entry.appendOnly !== true) {
      violations.push(`reconciliationGovernanceWrite ${route} must be append-only governance/provisional and must not write business facts`);
    }
  }

  for (const { route, entry } of routeEntries(allowlist, "correctionCenterWrite")) {
    if (!route.includes(" /api/correction-center/")) {
      violations.push(`correctionCenterWrite route must be under /api/correction-center: ${route}`);
    }
    const appendOnlyCorrectionService = entry.appendOnlyCorrectionService === true;
    if (entry.writesBusinessFact === true && !appendOnlyCorrectionService) {
      violations.push(`correctionCenterWrite ${route} may write business facts only through appendOnlyCorrectionService=true`);
    }
    if (entry.appendOnly !== true) {
      violations.push(`correctionCenterWrite ${route} must be append-only`);
    }
    if (appendOnlyCorrectionService && !entry.requiredInvariant.includes("ledger.no_edit_old_entry")) {
      violations.push(`correctionCenterWrite ${route} append-only correction service must declare ledger.no_edit_old_entry`);
    }
  }

  for (const { route, entry } of routeEntries(allowlist, "pcGovernanceWrite")) {
    if (!route.includes(" /api/pc-governance/")) {
      violations.push(`pcGovernanceWrite route must be under /api/pc-governance: ${route}`);
    }
    if (entry.requiresCapability !== true || entry.requiresAudit !== true) {
      violations.push(`pcGovernanceWrite ${route} must require capability and audit`);
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
  const businessToken = containsBusinessFactToken(route.handlerSource);

  if (category === "operationsBusinessWrite" && !exactBusinessWriteRoutes.has(route.key)) {
    violations.push(`${route.file}: business write route is not the Operations Confirm route: ${route.key}`);
  }

  if (category === "compatibilityBusinessWrite" && route.key.endsWith("/confirm") && entry.requiresOperationsConfirm !== true) {
    violations.push(`${route.file}: old Workspace/Card confirm compatibility route must require Operations Confirm: ${route.key}`);
  }

  if (category === "systemProjectionWrite" && businessToken) {
    violations.push(`${route.file}: system projection route must not write business fact token ${businessToken}: ${route.key}`);
  }

  if (category === "mobileExperienceWrite" && businessToken) {
    violations.push(`${route.file}: mobile experience route must not write business fact token ${businessToken}: ${route.key}`);
  }

  if (category === "evidenceWrite" && businessToken) {
    violations.push(`${route.file}: evidence file route must not write business fact token ${businessToken}: ${route.key}`);
  }

  if (category === "controlPlaneWrite" && businessToken) {
    violations.push(`${route.file}: control plane write route must not write business fact token ${businessToken}: ${route.key}`);
  }

  if (category === "reconciliationGovernanceWrite" && businessToken) {
    violations.push(`${route.file}: reconciliation governance route must not directly write business fact token ${businessToken}: ${route.key}`);
  }

  if (category === "pcGovernanceWrite" && businessToken) {
    violations.push(`${route.file}: PC governance route must not directly write business fact token ${businessToken}: ${route.key}`);
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
    version: 3,
    source_type: "api-boundary-check-v3",
    compatibility_source_type: "api-boundary-check-v2",
    config_path: path.relative(repoRoot, allowlistPath).replaceAll("\\", "/"),
    status: violations.length === 0 ? "passed" : "failed",
    violation_count: violations.length,
    route_count: routes.length,
    api_route_count: apiRoutes.length,
    write_route_count: writeRoutes.length,
    classified_write_route_count: writeRoutes.length - unclassifiedWriteRoutes.length - multiClassifiedWriteRoutes.length,
    unclassified_write_route_count: unclassifiedWriteRoutes.length,
    multi_classified_write_route_count: multiClassifiedWriteRoutes.length,
    business_write_route_count: categoryCounts.operationsBusinessWrite,
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
    withoutRoute(allowlist, "correctionCenterWrite", "POST /api/correction-center/ledger-correction-requests/{correctionRequestId}/apply"),
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
    console.log("API boundary check v3: PASS");
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
