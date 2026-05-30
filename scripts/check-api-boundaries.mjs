import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const allowlistPath = path.join(repoRoot, "docs", "v5.4", "operations-api-allowlist.json");
const routeRoot = path.join(repoRoot, "services");

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
  const pattern = /Map(Post|Put|Patch|Delete|Get)\("([^"]+)"/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    routes.push({
      file,
      method: match[1].toUpperCase(),
      route: match[2],
      key: routeKey(match[1], match[2])
    });
  }
  return routes;
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

function routeLooksLikeBusinessWrite(route) {
  return /\/(confirm|refund|close|release)(\/|$)/i.test(route);
}

function findViolations(routes, allowlist) {
  const businessWriteAllowlist = new Set(allowlist.businessWriteAllowlist || []);
  const operationsApiAllowlist = new Set(allowlist.operationsApiAllowlist || []);
  const compatibilityApiAllowlist = new Set(allowlist.compatibilityApiAllowlist || []);
  const forbiddenPatterns = (allowlist.forbiddenBusinessWritePatterns || []).map((item) => ({
    label: item,
    regex: wildcardPatternToRegex(item)
  }));
  const violations = [];

  for (const route of routes) {
    for (const forbidden of forbiddenPatterns) {
      if (forbidden.regex.test(route.key)) {
        violations.push(`${route.file}: forbidden business write route ${route.key} matches ${forbidden.label}`);
      }
    }

    if (route.route.startsWith("/api/operations/") && !operationsApiAllowlist.has(route.key)) {
      violations.push(`${route.file}: Operations API route is not allowlisted: ${route.key}`);
    }

    if (route.method !== "GET" && routeLooksLikeBusinessWrite(route.route)) {
      const allowedBusinessWrite = businessWriteAllowlist.has(route.key) || compatibilityApiAllowlist.has(route.key);
      if (!allowedBusinessWrite) {
        violations.push(`${route.file}: business write route must use Operations Confirm or compatibility confirm: ${route.key}`);
      }
    }
  }

  return violations;
}

function runSelfTest() {
  const allowlist = readAllowlist();
  const simulatedForbidden = extractRoutes('app.MapPost("/api/payment/confirm", () => Results.Ok());', "simulated-forbidden.cs");
  const forbiddenViolations = findViolations(simulatedForbidden, allowlist);
  if (!forbiddenViolations.some((item) => item.includes("POST /api/payment/confirm"))) {
    throw new Error("Self-test failed: simulated forbidden route was not detected.");
  }

  const simulatedAllowed = extractRoutes('app.MapPost("/api/operations/work-items/{workItemId}/confirm", () => Results.Ok());', "simulated-allowed.cs");
  const allowedViolations = findViolations(simulatedAllowed, allowlist);
  if (allowedViolations.length > 0) {
    throw new Error(`Self-test failed: allowed Operations Confirm route was rejected: ${allowedViolations.join("; ")}`);
  }

  console.log("API boundary self-test: PASS");
}

function runScan() {
  const allowlist = readAllowlist();
  const routes = listRouteFiles(routeRoot).flatMap((file) => extractRoutes(fs.readFileSync(file, "utf8"), path.relative(repoRoot, file)));
  const violations = findViolations(routes, allowlist);
  if (violations.length > 0) {
    for (const violation of violations) {
      console.error(violation);
    }
    process.exit(1);
  }

  console.log("API boundary check: PASS");
}

if (process.argv.includes("--self-test")) {
  runSelfTest();
} else {
  runScan();
}
