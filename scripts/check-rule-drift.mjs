import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const cli = parseArgs(process.argv.slice(2));
const drifts = [];

function addDrift(severity, id, message, evidence = {}) {
  drifts.push({ severity, id, message, evidence });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, file), "utf8"));
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

const report = {
  generated_at_utc: new Date().toISOString(),
  status: drifts.some((item) => item.severity === "P0") ? "failed" : "passed",
  drift_count: drifts.length,
  p0_drift_count: drifts.filter((item) => item.severity === "P0").length,
  p1_drift_count: drifts.filter((item) => item.severity === "P1").length,
  p2_drift_count: drifts.filter((item) => item.severity === "P2").length,
  drifts
};

const out = cli.get("out", ".tmp/v5_5/rule-drift-report.json");
const outPath = path.isAbsolute(out) ? out : path.join(repoRoot, out);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

if (cli.has("json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Rule drift check: ${report.status.toUpperCase()} (${report.drift_count} drift items, P0=${report.p0_drift_count})`);
}

if (report.p0_drift_count > 0) {
  process.exit(1);
}

function maturityForFutureMr(source, key) {
  const match = new RegExp(`key:\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?deadlineMr:\\s*MR-(0[3-9]|10)`, "m").exec(source);
  return Boolean(match);
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
