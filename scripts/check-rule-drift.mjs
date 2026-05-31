import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const cli = parseArgs(process.argv.slice(2));
const drifts = [];
const mode = cli.get("mode", "dev");
const waiverFile = cli.get("waivers", "docs/rules/v5.5/rule-drift-waivers.json");

if (cli.has("self-test")) {
  runSelfTest();
  process.exit(0);
}

function addDrift(severity, id, message, evidence = {}) {
  drifts.push({ severity, id, message, evidence });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, file), "utf8"));
}

function readOptionalJson(file, fallback) {
  const full = path.isAbsolute(file) ? file : path.join(repoRoot, file);
  if (!fs.existsSync(full)) return fallback;
  return JSON.parse(fs.readFileSync(full, "utf8"));
}

function minimalApiSource() {
  const program = fs.readFileSync(path.join(repoRoot, "services/core-api/WorkOS.Api/Program.cs"), "utf8");
  const endpointFiles = listFiles(path.join(repoRoot, "services/core-api/WorkOS.Api"))
    .filter((file) => file.endsWith("Endpoints.cs"));
  return [program, ...endpointFiles.map((file) => fs.readFileSync(file, "utf8"))].join("\n");
}

function listFiles(dir) {
  const result = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (item.name === "bin" || item.name === "obj") continue;
    const full = path.join(dir, item.name);
    if (item.isDirectory()) result.push(...listFiles(full));
    if (item.isFile()) result.push(full);
  }
  return result;
}

function extractMinimalApiPaths(source) {
  return new Set([...source.matchAll(/\bMap(?:Get|Post|Put|Patch|Delete)\("([^"]+)"/g)].map((match) => match[1]));
}

function extractRuntimeApiPaths(source) {
  const paths = new Set();
  for (const match of source.matchAll(/:\s*"([^"]+)"/g)) {
    if (match[1].startsWith("/")) paths.add(match[1]);
  }
  for (const match of source.matchAll(/`([^`]+)`/g)) {
    const normalized = match[1].replace(/\$\{([^}]+)\}/g, (_, name) => `{${name}}`);
    if (normalized.startsWith("/")) paths.add(normalized);
  }
  return paths;
}

function runNodeCheck(script, args = []) {
  const result = spawnSync("node", [script, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.status !== 0) {
    addDrift("P0", `drift.${path.basename(script, ".mjs")}`, `${script} failed`, {
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim()
    });
  }
}

const openApi = readJson("docs/contracts/workos-runtime.openapi.json");
const openApiPaths = new Set(Object.keys(openApi.paths ?? {}).filter((item) => item === "/health" || item.startsWith("/api/")));
const minimalPaths = extractMinimalApiPaths(minimalApiSource());

for (const pathName of openApiPaths) {
  if (!minimalPaths.has(pathName)) {
    addDrift("P1", "drift.openapi_minimal_api", `OpenAPI path has no Minimal API endpoint: ${pathName}`);
  }
}
for (const pathName of minimalPaths) {
  if ((pathName === "/health" || pathName.startsWith("/api/")) && !openApiPaths.has(pathName)) {
    addDrift("P1", "drift.openapi_minimal_api", `Minimal API path has no OpenAPI contract: ${pathName}`);
  }
}

const runtimeApiSource = fs.readFileSync(path.join(repoRoot, "apps/mobile/src/generated/runtimeApiPaths.js"), "utf8");
for (const pathName of extractRuntimeApiPaths(runtimeApiSource)) {
  if (!openApiPaths.has(pathName)) {
    addDrift("P1", "drift.runtime_api_paths_openapi", `runtimeApiPaths path missing from OpenAPI: ${pathName}`);
  }
}

runNodeCheck("scripts/check-api-boundaries.mjs", ["--out=.tmp/v5_5/api-boundary-check-v3.json"]);
runNodeCheck("scripts/check-fact-ownership.mjs");
runNodeCheck("scripts/check-mr-contract.mjs");
runNodeCheck("scripts/check-invariant-maturity.mjs");
runNodeCheck("scripts/check-gate-result-hardening.mjs");

const invariantDefinitions = readJson("docs/v5.4/invariant-definitions.json");
const definedInvariantKeys = new Set((invariantDefinitions.invariants ?? []).map((item) => item.key ?? item.invariant_key));
const maturity = fs.readFileSync(path.join(repoRoot, "docs/rules/v5.5/invariant-maturity.yml"), "utf8");
for (const match of maturity.matchAll(/^\s*-\s+key:\s*([A-Za-z0-9_.-]+)\s*$/gm)) {
  const key = match[1];
  if (!definedInvariantKeys.has(key) && !maturityForFutureMr(maturity, key)) {
    addDrift("P1", "drift.invariant_runner_support", `Invariant maturity key is not in V5.4 invariant definitions and is not marked as future MR: ${key}`);
  }
}

const waivers = readOptionalJson(waiverFile, { waivers: [] }).waivers ?? [];
const policy = evaluatePolicy(drifts, waivers, mode, new Date());
const report = {
  generated_at_utc: new Date().toISOString(),
  mode,
  status: policy.blocking.length > 0 ? "failed" : "passed",
  drift_count: drifts.length,
  p0_drift_count: drifts.filter((item) => item.severity === "P0").length,
  p1_drift_count: drifts.filter((item) => item.severity === "P1").length,
  p2_drift_count: drifts.filter((item) => item.severity === "P2").length,
  blocking_count: policy.blocking.length,
  waiver_status: policy.waiverStatus,
  waiver_usage: policy.waiverUsage,
  blocking: policy.blocking,
  drifts
};

const out = cli.get("out", ".tmp/v5_5/rule-drift-report.json");
const outPath = path.isAbsolute(out) ? out : path.join(repoRoot, out);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

if (cli.has("json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Rule drift check: ${report.status.toUpperCase()} (${report.drift_count} drift items, mode=${mode}, P0=${report.p0_drift_count}, P1=${report.p1_drift_count}, blocking=${report.blocking_count})`);
}

if (policy.blocking.length > 0) {
  process.exit(1);
}

function maturityForFutureMr(source, key) {
  const match = new RegExp(`key:\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?deadlineMr:\\s*MR-(0[3-9]|10)`, "m").exec(source);
  return Boolean(match);
}

function evaluatePolicy(items, waivers, currentMode, now) {
  if (!["dev", "final"].includes(currentMode)) {
    return {
      blocking: [{ severity: "P0", id: "drift.mode.invalid", message: `Unsupported rule drift mode: ${currentMode}` }],
      waiverUsage: [],
      waiverStatus: "invalid_mode"
    };
  }

  const blocking = [];
  const waiverUsage = [];
  const waiverViolations = validateWaivers(waivers, now);
  blocking.push(...waiverViolations);

  for (const item of items) {
    if (item.severity === "P0") {
      blocking.push(item);
      if (waivers.some((waiver) => waiver.driftId === item.id)) {
        blocking.push({
          severity: "P0",
          id: "drift.waiver.p0_not_allowed",
          message: `P0 drift cannot be waived: ${item.id}`
        });
      }
      continue;
    }

    if (item.severity === "P1" && currentMode === "final") {
      const waiver = validWaiverFor(item, waivers, now);
      if (!waiver) {
        blocking.push(item);
      } else {
        waiverUsage.push({
          driftId: item.id,
          waiverId: waiver.id,
          owner: waiver.owner,
          expiresAt: waiver.expiresAt,
          linkedIssue: waiver.linkedIssue ?? null,
          linkedPR: waiver.linkedPR ?? null
        });
      }
    }
  }

  return {
    blocking,
    waiverUsage,
    waiverStatus: waiverViolations.length > 0
      ? "invalid"
      : waiverUsage.length > 0
        ? "used"
        : "none"
  };
}

function validateWaivers(waivers, now) {
  const violations = [];
  for (const waiver of waivers) {
    for (const field of ["id", "driftId", "severity", "owner", "reason", "expiresAt", "approvedBy", "createdAt"]) {
      if (!waiver[field] || String(waiver[field]).trim() === "") {
        violations.push({
          severity: "P0",
          id: "drift.waiver.invalid",
          message: `Rule drift waiver is missing ${field}: ${waiver.id ?? waiver.driftId ?? "unknown"}`
        });
      }
    }
    if (!waiver.linkedIssue && !waiver.linkedPR) {
      violations.push({
        severity: "P0",
        id: "drift.waiver.invalid",
        message: `Rule drift waiver must include linkedIssue or linkedPR: ${waiver.id ?? waiver.driftId ?? "unknown"}`
      });
    }
    if (waiver.severity === "P0") {
      violations.push({
        severity: "P0",
        id: "drift.waiver.p0_not_allowed",
        message: `P0 waivers are not allowed: ${waiver.id ?? waiver.driftId ?? "unknown"}`
      });
    }
    const expiresAt = Date.parse(waiver.expiresAt ?? "");
    if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) {
      violations.push({
        severity: "P0",
        id: "drift.waiver.expired",
        message: `Rule drift waiver is expired or has invalid expiresAt: ${waiver.id ?? waiver.driftId ?? "unknown"}`
      });
    }
  }
  return violations;
}

function validWaiverFor(item, waivers, now) {
  return waivers.find((waiver) =>
    waiver.driftId === item.id &&
    waiver.severity === item.severity &&
    waiver.owner &&
    waiver.reason &&
    waiver.expiresAt &&
    Date.parse(waiver.expiresAt) > now.getTime() &&
    waiver.approvedBy &&
    waiver.createdAt &&
    (waiver.linkedIssue || waiver.linkedPR)
  );
}

function runSelfTest() {
  const now = new Date("2026-05-31T00:00:00.000Z");
  const p1 = [{ severity: "P1", id: "drift.openapi_minimal_api", message: "fixture P1" }];
  const p0 = [{ severity: "P0", id: "drift.api_boundary_routes", message: "fixture P0" }];
  const validWaiver = {
    id: "waiver-rf3-fixture",
    driftId: "drift.openapi_minimal_api",
    severity: "P1",
    owner: "platform-governance",
    reason: "Fixture waiver proves final mode records waiver usage.",
    expiresAt: "2026-06-30T00:00:00.000Z",
    approvedBy: "release-owner",
    createdAt: "2026-05-31T00:00:00.000Z",
    linkedPR: "#rf3-fixture"
  };

  assertPolicy("P1 dev mode is non-blocking", evaluatePolicy(p1, [], "dev", now), false);
  assertPolicy("P1 final mode blocks", evaluatePolicy(p1, [], "final", now), true);
  assertPolicy("P1 final mode valid waiver passes", evaluatePolicy(p1, [validWaiver], "final", now), false);
  assertPolicy("expired waiver blocks", evaluatePolicy(p1, [{ ...validWaiver, expiresAt: "2026-05-01T00:00:00.000Z" }], "final", now), true, "expired");
  assertPolicy("missing owner blocks", evaluatePolicy(p1, [{ ...validWaiver, owner: "" }], "final", now), true, "missing owner");
  assertPolicy("P0 blocks even with waiver", evaluatePolicy(p0, [{ ...validWaiver, driftId: "drift.api_boundary_routes", severity: "P0" }], "final", now), true, "P0");

  console.log("Rule drift final mode self-test: PASS");
}

function assertPolicy(name, result, shouldBlock, expectedText = "") {
  const blocked = result.blocking.length > 0;
  if (blocked !== shouldBlock) {
    failSelfTest(name, result.blocking.length > 0 ? result.blocking : [{ message: "Expected blocking policy result." }]);
  }
  if (expectedText && !result.blocking.some((item) => item.message.includes(expectedText) || item.id.includes(expectedText))) {
    failSelfTest(name, result.blocking);
  }
}

function failSelfTest(name, details) {
  for (const detail of details) console.error(`- ${detail.message ?? JSON.stringify(detail)}`);
  throw new Error(`check-rule-drift self-test failed: ${name}`);
}

function parseArgs(argv) {
  const flags = new Set();
  const values = new Map();
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const trimmed = arg.slice(2);
    const separator = trimmed.indexOf("=");
    if (separator >= 0) values.set(trimmed.slice(0, separator), trimmed.slice(separator + 1));
    else flags.add(trimmed);
  }
  return {
    has: (name) => flags.has(name) || values.has(name),
    get: (name, fallback = undefined) => values.get(name) ?? fallback
  };
}
