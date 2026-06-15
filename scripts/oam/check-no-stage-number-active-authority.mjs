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
const resultPath = "artifacts/oam/checks/no-stage-number-active-authority-result.json";
const scanRoots = ["services", "apps/mobile", "scripts/surface", ".github", "docs/oam", "docs/contracts"];
const stagePattern = /(^|[^0-9A-Za-z])S[5-8](?:[_\-.][0-9A-Za-z]+)?($|[^0-9A-Za-z])/;
const skipFiles = new Set(["apps/mobile/package-lock.json", "package-lock.json"]);
const boundary = readJsonIfExists(boundaryPath, root);
const failures = [];
const allowedOccurrences = [];

if (!boundary) {
  failures.push(`${boundaryPath} is missing.`);
} else {
  requireEqual(boundary.capabilityId, CAPABILITY_ID, "boundary.capabilityId", failures);
}

const activePathFiles = new Set(boundary?.activePathFiles ?? []);
const allowedReferenceZones = flattenAllowedZones(boundary?.allowedReferenceZones ?? {});
for (const file of activePathFiles) {
  const active = activePayloadFor(file);
  if (active === null) {
    failures.push(`active path file missing or unreadable: ${file}.`);
    continue;
  }
  if (stagePattern.test(typeof active === "string" ? active : stableStringify(active))) {
    failures.push(`active path ${file} contains S-stage authority wording.`);
  }
}

for (const file of filesUnderRoots(scanRoots)) {
  if (file === boundaryPath || skipFiles.has(file)) continue;
  const text = fs.readFileSync(path.join(root, file), "utf8");
  if (!stagePattern.test(text)) continue;
  const zone = allowedZoneFor(file, allowedReferenceZones);
  if (!zone) {
    failures.push(`unclassified S-stage authority wording found in scanned consumer ${file}.`);
    continue;
  }
  allowedOccurrences.push({ file, allowedZone: zone });
}

const result = {
  version: "oam.no-stage-number-active-authority-check.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  capabilityId: boundary?.capabilityId ?? CAPABILITY_ID,
  stageNumberActiveAuthorityAllowed: false,
  scannedRoots: scanRoots,
  allowedOccurrenceCount: allowedOccurrences.length,
  failures
};

writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("No stage-number active authority check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`No stage-number active authority check: PASS (${CAPABILITY_ID})`);

function activePayloadFor(file) {
  const doc = readJsonIfExists(file, root);
  if (!doc) {
    const full = path.join(root, file);
    return fs.existsSync(full) ? fs.readFileSync(full, "utf8") : null;
  }
  if (file.endsWith("dormitory-first-golden-chain.current.json")) {
    return pick(doc, ["capabilityId", "activeAuthority", "generatedBundle", "lifecycleAchieved", "lifecycleNotAdmitted"]);
  }
  if (file.endsWith("dormitory-first-golden-chain.registry.json")) {
    return pick(doc, ["capabilityId", "authorityMode", "currentFilesMode", "activeAuthority", "projectionOnlyCurrentRefs"]);
  }
  if (file.endsWith("dormitory-first-golden-chain.authority-ledger.json")) {
    return {
      capabilityId: doc.capabilityId,
      events: (doc.events ?? []).map((event) => pick(event, [
        "eventId",
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
      "decisionStatus",
      "acceptedGeneratedBundleDigest",
      "acceptedGeneratedContractBundle",
      "acceptedGeneratedFiles",
      "acceptedRuntimeConsumableDigests",
      "runtimeConsumptionReady",
      "releaseAuthority",
      "finalGoNoGo"
    ]);
  }
  if (file.endsWith("dormitory-runtime-admission.current.json")) {
    return pick(doc, [
      "runtimeAdmissionStatus",
      "acceptedGeneratedBundleDigest",
      "runtimeConsumedBundleDigest",
      "runtimeConsumedFilesDigestList",
      "acceptedRuntimeConsumableDigests",
      "runtimeConsumptionReadyAuthority",
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
  return zones.find(({ prefix }) => normalized === prefix || normalized.startsWith(prefix))?.zone ?? null;
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

function slash(value) {
  return value.replace(/\\/g, "/");
}

function requireEqual(actual, expected, label, target) {
  if (actual !== expected) target.push(`${label} must be ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}.`);
}
