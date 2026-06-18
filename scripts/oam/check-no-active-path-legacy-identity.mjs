import fs from "node:fs";
import path from "node:path";
import {
  CAPABILITY_ID,
  readJsonIfExists,
  stableStringify,
  writeJson
} from "./lib/capability-delivery-control-plane.mjs";

const root = process.cwd();
const boundaryPath = "docs/oam/capabilities/dormitory-first-golden-chain.active-path-boundary.json";
const resultPath = "artifacts/oam/checks/no-active-path-legacy-identity-result.json";
const scanRoots = ["services", "apps/mobile", "scripts/surface", ".github", "docs/oam", "docs/contracts"];
const skipFiles = new Set(["apps/mobile/package-lock.json", "package-lock.json"]);
const boundary = readJsonIfExists(boundaryPath, root);
const failures = [];
const allowedOccurrences = [];
const scannedFiles = filesUnderRoots(scanRoots);

if (!boundary) {
  failures.push(`${boundaryPath} is missing.`);
} else {
  requireEqual(boundary.version, "oam.capability-active-path-boundary.v1", "boundary.version", failures);
  requireEqual(boundary.capabilityId, CAPABILITY_ID, "boundary.capabilityId", failures);
}

const forbiddenTerms = boundary?.forbiddenActiveTerms ?? [];
const activePathFiles = new Set(boundary?.activePathFiles ?? []);
const allowedReferenceZones = flattenAllowedZones(boundary?.allowedReferenceZones ?? {});

for (const file of activePathFiles) {
  const payload = activePayloadFor(file);
  if (payload === null) {
    failures.push(`active path file missing or unreadable: ${file}.`);
    continue;
  }
  const text = typeof payload === "string" ? payload : stableStringify(payload);
  for (const term of forbiddenTerms) {
    if (termFound(text, term)) {
      failures.push(`active path ${file} contains forbidden active legacy identity term: ${term}.`);
    }
  }
}

for (const file of scannedFiles) {
  if (file === boundaryPath || skipFiles.has(file)) continue;
  const text = readText(file);
  for (const term of forbiddenTerms) {
    if (!termFound(text, term)) continue;
    const zone = allowedZoneFor(file, allowedReferenceZones);
    if (!zone) {
      failures.push(`unclassified legacy identity term ${term} found in scanned consumer ${file}.`);
      continue;
    }
    if (file === ".github/workflows/ci.yml" && /ten-scenario|all-steps/.test(term)) {
      if (!/Generate dormitory(?: 13-scenario)? real-browser evidence[\s\S]*continue-on-error:\s*true/.test(text)) {
        failures.push(`CI legacy browser audit reference ${term} must remain advisory/continue-on-error.`);
      }
    }
    allowedOccurrences.push({ file, term, allowedZone: zone });
  }
}

const result = {
  version: "oam.no-active-path-legacy-identity-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  capabilityId: boundary?.capabilityId ?? CAPABILITY_ID,
  activePathLegacyIdentityAllowed: false,
  scannedRoots: scanRoots,
  forbiddenActiveTerms: forbiddenTerms,
  activePathFiles: [...activePathFiles],
  allowedReferenceZones: Object.keys(boundary?.allowedReferenceZones ?? {}),
  allowedOccurrenceCount: allowedOccurrences.length,
  failures
};

writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("No active-path legacy identity check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`No active-path legacy identity check: PASS (${CAPABILITY_ID})`);

function activePayloadFor(file) {
  const doc = readJsonIfExists(file, root);
  if (!doc) {
    const full = path.join(root, file);
    return fs.existsSync(full) ? fs.readFileSync(full, "utf8") : null;
  }
  if (file.endsWith("dormitory-first-golden-chain.current.json")) {
    return pick(doc, [
      "capabilityId",
      "currentFilesMode",
      "activeAuthority",
      "generatedBundle",
      "runtimeTestConsumptionAdmitted",
      "runtimeConsumptionReady",
      "businessFeatureDevelopmentAllowed",
      "productionConfirmAllowed",
      "releaseAuthority",
      "finalGoNoGo"
    ]);
  }
  if (file.endsWith("dormitory-first-golden-chain.registry.json")) {
    return pick(doc, [
      "capabilityId",
      "authorityMode",
      "currentFilesMode",
      "activeAuthority",
      "projectionOnlyCurrentRefs"
    ]);
  }
  if (file.endsWith("dormitory-first-golden-chain.authority-ledger.json")) {
    return {
      capabilityId: doc.capabilityId,
      ledgerMode: doc.ledgerMode,
      events: (doc.events ?? []).map((event) => pick(event, [
        "eventId",
        "capabilityId",
        "eventType",
        "subjectDigest",
        "bundleDigest",
        "inputDigests",
        "outputDigests",
        "decision"
      ]))
    };
  }
  if (file.endsWith("generated-candidate-acceptance.current.json")) {
    return pick(doc, [
      "version",
      "decisionStatus",
      "generatedCandidateAcceptedBy00",
      "acceptedGeneratedBundleDigest",
      "acceptedGeneratedContractBundle",
      "acceptedGeneratedFiles",
      "acceptedRuntimeConsumableDigests",
      "runtimeConsumptionReady",
      "businessFeatureDevelopmentAllowed",
      "productionConfirmAllowed",
      "releaseAuthority",
      "finalGoNoGo"
    ]);
  }
  if (file.endsWith("dormitory-runtime-admission.current.json")) {
    return pick(doc, [
      "version",
      "runtimeAdmissionStatus",
      "acceptedGeneratedBundleDigest",
      "runtimeConsumedBundleDigest",
      "runtimeConsumedFilesDigestList",
      "acceptedRuntimeConsumableDigests",
      "bundleDigestMatch",
      "runtimeConsumptionReadyAuthority",
      "allowedOperationCases",
      "runtimeBoundary",
      "businessFeatureDevelopmentAllowed",
      "productionConfirmAllowed",
      "releaseAuthority",
      "finalGoNoGo"
    ]);
  }
  return stripReferenceOnly(doc);
}

function pick(value, keys) {
  return Object.fromEntries(keys.map((key) => [key, value?.[key]]).filter(([, child]) => child !== undefined));
}

function stripReferenceOnly(value) {
  if (Array.isArray(value)) return value.map(stripReferenceOnly);
  if (value && typeof value === "object") {
    const result = {};
    for (const [key, child] of Object.entries(value)) {
      if ([
        "historicalAppendix",
        "compatibilityBox",
        "compatibilityBoxRef",
        "migrationRefs",
        "legacyRegressionLane",
        "deletionLedger",
        "referenceOnlyAuditPackage",
        "deprecatedAliasReferences"
      ].includes(key)) continue;
      result[key] = stripReferenceOnly(child);
    }
    return result;
  }
  return value;
}

function flattenAllowedZones(zones) {
  const entries = [];
  for (const [zone, prefixes] of Object.entries(zones)) {
    for (const prefix of prefixes ?? []) entries.push({ zone, prefix: slash(prefix) });
  }
  return entries;
}

function allowedZoneFor(file, zones) {
  const normalized = slash(file);
  const found = zones.find(({ prefix }) => normalized === prefix || normalized.startsWith(prefix));
  return found?.zone ?? null;
}

function termFound(text, term) {
  if (/^S[5-8]$/.test(term)) return new RegExp(`(^|[^0-9A-Za-z])${term}($|[^0-9A-Za-z])`).test(text);
  return text.includes(term);
}

function filesUnderRoots(roots) {
  const files = [];
  for (const dir of roots) {
    const full = path.join(root, dir);
    if (!fs.existsSync(full)) continue;
    walk(full, files);
  }
  return files.map((file) => slash(path.relative(root, file))).filter(shouldScanText);
}

function walk(current, files) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    if (entry.isDirectory() && [".git", "node_modules", "bin", "obj", "dist", "TestResults"].includes(entry.name)) continue;
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
}

function shouldScanText(file) {
  if (file.startsWith("artifacts/")) return false;
  return [".cs", ".js", ".mjs", ".json", ".yml", ".yaml", ".md", ".ps1"].includes(path.extname(file));
}

function readText(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function slash(value) {
  return value.replace(/\\/g, "/");
}

function requireEqual(actual, expected, label, target) {
  if (actual !== expected) target.push(`${label} must be ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}.`);
}
