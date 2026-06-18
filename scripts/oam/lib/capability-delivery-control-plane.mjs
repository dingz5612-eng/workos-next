import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { buildGeneratedContractBundle } from "./generated-contract-bundle.mjs";

export const CAPABILITY_ID = "Dormitory.FirstGoldenChain";
export const CAPABILITY_REGISTRY_PATH = "docs/oam/capabilities/dormitory-first-golden-chain.registry.json";
export const CAPABILITY_LEDGER_PATH = "docs/oam/capabilities/dormitory-first-golden-chain.authority-ledger.json";
export const CAPABILITY_PROJECTION_PATH = "docs/oam/capabilities/dormitory-first-golden-chain.current.json";
export const CAPABILITY_COMPATIBILITY_BOX_PATH = "docs/oam/compatibility/compatibility-box.current.json";

export const AUTHORITY_LEDGER_RESULT_PATH = "artifacts/oam/checks/authority-ledger-append-only-result.json";
export const CURRENT_PROJECTION_RESULT_PATH = "artifacts/oam/checks/current-projection-from-ledger-result.json";
export const NO_ACTIVE_LEGACY_RESULT_PATH = "artifacts/oam/checks/no-active-legacy-identity-result.json";
export const NO_ACTIVE_LEGACY_AUTHORITY_RESULT_PATH = "artifacts/oam/checks/no-active-legacy-authority-result.json";
export const NO_STAGE_AUTHORITY_RESULT_PATH = "artifacts/oam/checks/no-stage-number-authority-leak-result.json";
export const COMPATIBILITY_BOX_RESULT_PATH = "artifacts/oam/checks/compatibility-box-boundary-result.json";

export const lifecycleStates = [
  "SOURCE_CLOSED",
  "GENERATED_BUNDLE_BUILT",
  "GENERATED_BUNDLE_ACCEPTED",
  "RUNTIME_TEST_ADMITTED",
  "BUSINESS_LANDING_ADMITTED",
  "PRODUCTION_CONFIRMED",
  "RELEASE_AUTHORIZED"
];

export const supportedEventTypes = [
  "SOURCE_CLOSED",
  "GENERATED_BUNDLE_BUILT",
  "GENERATED_BUNDLE_ACCEPTED_BY_00",
  "RUNTIME_TEST_ADMITTED",
  "BUSINESS_LANDING_ADMITTED",
  "PRODUCTION_CONFIRMED",
  "RELEASE_AUTHORIZED",
  "AUTHORITY_REVOKED"
];

export const activeAuthorityFields = [
  "capabilityId",
  "sourceClosureDigest",
  "generatedBundleDigest",
  "acceptedGeneratedBundleDigest",
  "runtimeConsumedBundleDigest",
  "runtimeAdmissionDigest",
  "businessLandingDigest",
  "productionConfirmationDigest",
  "releaseAuthorityDigest"
];

export const generatedBundleFiles = [
  "docs/contracts/generated/dormitory/dormitory-kernel.generated.manifest.json",
  "docs/contracts/generated/dormitory/fields.generated.json",
  "docs/contracts/generated/dormitory/field-bindings.generated.json",
  "docs/contracts/generated/dormitory/workitems.generated.json",
  "docs/contracts/generated/dormitory/surface-input-model.generated.json",
  "docs/contracts/generated/dormitory/read-model.generated.json",
  "apps/mobile/src/generated/oam/dormitory-surface-input-model.generated.json"
];

const digestPattern = /^sha256:[a-f0-9]{64}$/;
const forbiddenActiveLegacyTerms = [
  "executionHead",
  "previousAuthorizedCandidateExecutionHead",
  "executionHeadCompatibilityAliasOf",
  "currentHeadDescendantPolicy",
  "cardId",
  "sourceCardId",
  "workspaceCardId",
  "legacy resolver",
  "legacyResolver",
  "deprecated alias",
  "deprecatedAlias"
];
const stageAuthorityPattern = /(^|[^0-9A-Za-z])S[4-8](?:[_\-.][0-9A-Za-z]+)?($|[^0-9A-Za-z])/;
const compatibilityCategories = [
  "historicalOnly",
  "migrationReadOnly",
  "languageAlias",
  "fieldNormalizationAlias",
  "forbiddenRuntimeIdentity"
];

export function readJson(file, root = process.cwd()) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, ""));
}

export function readJsonIfExists(file, root = process.cwd()) {
  const full = path.join(root, file);
  return fs.existsSync(full) ? readJson(file, root) : null;
}

export function writeJson(file, data, root = process.cwd()) {
  const full = path.join(root, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  if (data && typeof data === "object" && data.checkedAtUtc && fs.existsSync(full)) {
    try {
      const previous = JSON.parse(fs.readFileSync(full, "utf8").replace(/^\uFEFF/, ""));
      if (previous?.checkedAtUtc &&
        stableStringify(normalizeForStableResultWrite(previous)) ===
          stableStringify(normalizeForStableResultWrite(data))) {
        data = { ...data, checkedAtUtc: previous.checkedAtUtc };
      }
    } catch {
      // Fall through and write the fresh result.
    }
  }
  fs.writeFileSync(full, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function loadCapabilityDocuments(root = process.cwd()) {
  return {
    registry: readJsonIfExists(CAPABILITY_REGISTRY_PATH, root),
    ledger: readJsonIfExists(CAPABILITY_LEDGER_PATH, root),
    projection: readJsonIfExists(CAPABILITY_PROJECTION_PATH, root),
    compatibilityBox: readJsonIfExists(CAPABILITY_COMPATIBILITY_BOX_PATH, root)
  };
}

export function validateCapabilityRegistry({ registry, root = process.cwd() } = {}) {
  const failures = [];
  if (!registry || typeof registry !== "object") {
    return { status: "NO_GO", failures: [`${CAPABILITY_REGISTRY_PATH} is missing or invalid.`] };
  }
  requireEqual(registry.version, "oam.capability-delivery-registry.v1", "registry.version", failures);
  requireEqual(registry.capabilityId, CAPABILITY_ID, "registry.capabilityId", failures);
  requireEqual(registry.authorityMode, "ledger_replay_projection", "registry.authorityMode", failures);
  requireEqual(registry.currentFilesMode, "ledger_replay_projection_only", "registry.currentFilesMode", failures);
  requireEqual(registry.authorityLedgerRef, CAPABILITY_LEDGER_PATH, "registry.authorityLedgerRef", failures);
  requireEqual(registry.currentProjectionRef, CAPABILITY_PROJECTION_PATH, "registry.currentProjectionRef", failures);
  requireEqual(registry.compatibilityBoxRef, CAPABILITY_COMPATIBILITY_BOX_PATH, "registry.compatibilityBoxRef", failures);
  requireArrayExact(
    (registry.lifecycle ?? []).map((item) => item.state ?? item),
    lifecycleStates,
    "registry.lifecycle",
    failures
  );
  validateActiveAuthority(registry.activeAuthority, "registry.activeAuthority", failures);
  for (const file of [CAPABILITY_LEDGER_PATH, CAPABILITY_PROJECTION_PATH, CAPABILITY_COMPATIBILITY_BOX_PATH]) {
    if (!fs.existsSync(path.join(root, file))) failures.push(`registry referenced file missing: ${file}.`);
  }
  return { status: failures.length === 0 ? "PASS" : "NO_GO", failures };
}

export function validateAuthorityLedger({ ledger, root = process.cwd() } = {}) {
  const failures = [];
  if (!ledger || typeof ledger !== "object") {
    return { status: "NO_GO", failures: [`${CAPABILITY_LEDGER_PATH} is missing or invalid.`] };
  }
  requireEqual(ledger.version, "oam.capability-authority-ledger.v1", "ledger.version", failures);
  requireEqual(ledger.capabilityId, CAPABILITY_ID, "ledger.capabilityId", failures);
  requireEqual(ledger.ledgerMode, "append_only_immutable_authority_events", "ledger.ledgerMode", failures);
  requireArrayExact(ledger.supportedEventTypes, supportedEventTypes, "ledger.supportedEventTypes", failures);
  if (!Array.isArray(ledger.events) || ledger.events.length === 0) {
    failures.push("ledger.events must be a non-empty array.");
  }
  const seen = new Set();
  let previousDigest = null;
  for (const [index, event] of (ledger.events ?? []).entries()) {
    const label = `ledger.events[${index}]`;
    if (!event || typeof event !== "object") {
      failures.push(`${label} must be an object.`);
      continue;
    }
    if (seen.has(event.eventId)) failures.push(`${label}.eventId duplicates ${event.eventId}.`);
    seen.add(event.eventId);
    requireEqual(event.capabilityId, CAPABILITY_ID, `${label}.capabilityId`, failures);
    if (!supportedEventTypes.includes(event.eventType)) failures.push(`${label}.eventType unsupported: ${format(event.eventType)}.`);
    if (index === 0) {
      requireEqual(event.previousEventDigest, null, `${label}.previousEventDigest`, failures);
    } else {
      requireEqual(event.previousEventDigest, previousDigest, `${label}.previousEventDigest`, failures);
    }
    for (const field of [
      "eventId",
      "eventType",
      "inputDigests",
      "outputDigests",
      "decision",
      "decidedBy",
      "decidedAtUtc",
      "forbiddenInterpretations"
    ]) {
      if (event[field] === undefined || event[field] === null || event[field] === "") failures.push(`${label}.${field} is required.`);
    }
    if (!event.subjectDigest && !event.bundleDigest) failures.push(`${label} requires subjectDigest or bundleDigest.`);
    if (event.subjectDigest) requireDigest(event.subjectDigest, `${label}.subjectDigest`, failures);
    if (event.bundleDigest) requireDigest(event.bundleDigest, `${label}.bundleDigest`, failures);
    requireDigestMap(event.inputDigests, `${label}.inputDigests`, failures);
    requireDigestMap(event.outputDigests, `${label}.outputDigests`, failures);
    if (!Array.isArray(event.forbiddenInterpretations) || event.forbiddenInterpretations.length === 0) {
      failures.push(`${label}.forbiddenInterpretations must be non-empty.`);
    }
    if (event.eventDigest && event.eventDigest !== eventDigest(event)) {
      failures.push(`${label}.eventDigest mismatch: expected ${eventDigest(event)}, actual ${event.eventDigest}.`);
    }
    previousDigest = eventDigest(event);
  }
  const currentBundleDigest = generatedBundleDigest(root);
  const built = lastEventOfType(ledger.events, "GENERATED_BUNDLE_BUILT");
  if (built?.bundleDigest !== currentBundleDigest) {
    failures.push(`GENERATED_BUNDLE_BUILT.bundleDigest must equal current generated bundle digest ${currentBundleDigest}.`);
  }
  return {
    status: failures.length === 0 ? "PASS" : "NO_GO",
    failures,
    finalEventDigest: previousDigest,
    generatedBundleDigest: currentBundleDigest
  };
}

export function buildProjectionFromLedger(ledger, root = process.cwd()) {
  const activeAuthority = Object.fromEntries(activeAuthorityFields.map((field) => [field, null]));
  activeAuthority.capabilityId = CAPABILITY_ID;
  const achieved = [];
  for (const event of ledger?.events ?? []) {
    if (event.eventType === "AUTHORITY_REVOKED") {
      if (event.revokedEventType === "BUSINESS_LANDING_ADMITTED") {
        activeAuthority.businessLandingDigest = null;
        removeAchievedState(achieved, "BUSINESS_LANDING_ADMITTED");
      }
      if (event.revokedEventType === "PRODUCTION_CONFIRMED") {
        activeAuthority.productionConfirmationDigest = null;
        removeAchievedState(achieved, "PRODUCTION_CONFIRMED");
      }
      if (event.revokedEventType === "RELEASE_AUTHORIZED") {
        activeAuthority.releaseAuthorityDigest = null;
        removeAchievedState(achieved, "RELEASE_AUTHORIZED");
      }
      continue;
    }
    if (event.eventType === "SOURCE_CLOSED") {
      activeAuthority.sourceClosureDigest = event.outputDigests?.sourceClosureDigest ?? event.subjectDigest;
      admitState(achieved, "SOURCE_CLOSED");
    }
    if (event.eventType === "GENERATED_BUNDLE_BUILT") {
      revokeFromState(achieved, "GENERATED_BUNDLE_BUILT");
      activeAuthority.generatedBundleDigest = event.bundleDigest;
      activeAuthority.acceptedGeneratedBundleDigest = null;
      activeAuthority.runtimeConsumedBundleDigest = null;
      activeAuthority.runtimeAdmissionDigest = null;
      activeAuthority.businessLandingDigest = null;
      activeAuthority.productionConfirmationDigest = null;
      activeAuthority.releaseAuthorityDigest = null;
      admitState(achieved, "GENERATED_BUNDLE_BUILT");
    }
    if (event.eventType === "GENERATED_BUNDLE_ACCEPTED_BY_00") {
      revokeFromState(achieved, "GENERATED_BUNDLE_ACCEPTED");
      activeAuthority.acceptedGeneratedBundleDigest = event.bundleDigest;
      activeAuthority.runtimeConsumedBundleDigest = null;
      activeAuthority.runtimeAdmissionDigest = null;
      activeAuthority.businessLandingDigest = null;
      activeAuthority.productionConfirmationDigest = null;
      activeAuthority.releaseAuthorityDigest = null;
      admitState(achieved, "GENERATED_BUNDLE_ACCEPTED");
    }
    if (event.eventType === "RUNTIME_TEST_ADMITTED") {
      revokeFromState(achieved, "RUNTIME_TEST_ADMITTED");
      activeAuthority.runtimeConsumedBundleDigest = event.outputDigests?.runtimeConsumedBundleDigest ?? event.bundleDigest;
      activeAuthority.runtimeAdmissionDigest = event.subjectDigest;
      activeAuthority.businessLandingDigest = null;
      activeAuthority.productionConfirmationDigest = null;
      activeAuthority.releaseAuthorityDigest = null;
      admitState(achieved, "RUNTIME_TEST_ADMITTED");
    }
    if (event.eventType === "BUSINESS_LANDING_ADMITTED") {
      revokeFromState(achieved, "BUSINESS_LANDING_ADMITTED");
      activeAuthority.businessLandingDigest = event.subjectDigest;
      activeAuthority.productionConfirmationDigest = null;
      activeAuthority.releaseAuthorityDigest = null;
      admitState(achieved, "BUSINESS_LANDING_ADMITTED");
    }
    if (event.eventType === "PRODUCTION_CONFIRMED") {
      revokeFromState(achieved, "PRODUCTION_CONFIRMED");
      activeAuthority.productionConfirmationDigest = event.subjectDigest;
      activeAuthority.releaseAuthorityDigest = null;
      admitState(achieved, "PRODUCTION_CONFIRMED");
    }
    if (event.eventType === "RELEASE_AUTHORIZED") {
      activeAuthority.releaseAuthorityDigest = event.subjectDigest;
      admitState(achieved, "RELEASE_AUTHORIZED");
    }
  }
  const uniqueAchieved = [...achieved];
  const businessLandingAdmitted = uniqueAchieved.includes("BUSINESS_LANDING_ADMITTED");
  return {
    version: "oam.capability-ledger-current-projection.v1",
    capabilityId: CAPABILITY_ID,
    projectionSource: CAPABILITY_LEDGER_PATH,
    registryRef: CAPABILITY_REGISTRY_PATH,
    compatibilityBoxRef: CAPABILITY_COMPATIBILITY_BOX_PATH,
    currentFilesMode: "ledger_replay_projection_only",
    activeAuthority,
    generatedBundle: {
      digest: generatedBundleDigest(root),
      files: generatedBundleFileEntries(root)
    },
    lifecycleAchieved: uniqueAchieved,
    lifecycleNotAdmitted: lifecycleStates.filter((state) => !uniqueAchieved.includes(state)),
    runtimeTestConsumptionAdmitted: uniqueAchieved.includes("RUNTIME_TEST_ADMITTED"),
    runtimeConsumptionReady: false,
    runtimeGoNoGo: "NO_GO",
    businessFeatureDevelopmentAllowed: businessLandingAdmitted,
    businessLandingGoNoGo: businessLandingAdmitted ? "GO" : "NO_GO",
    businessLandingDigestActive: businessLandingAdmitted ? activeAuthority.businessLandingDigest : null,
    productionConfirmAllowed: false,
    productionGoNoGo: "NO_GO",
    releaseAuthority: false,
    finalGoNoGo: "NO_GO",
    legacyCurrentFilesAreAuthority: false,
    forbiddenInterpretations: commonForbiddenInterpretations()
  };
}

export function validateCurrentProjection({ registry, ledger, projection, root = process.cwd() } = {}) {
  const failures = [];
  const registryState = validateCapabilityRegistry({ registry, root });
  const ledgerState = validateAuthorityLedger({ ledger, root });
  failures.push(...registryState.failures, ...ledgerState.failures);
  if (!projection || typeof projection !== "object") {
    failures.push(`${CAPABILITY_PROJECTION_PATH} is missing or invalid.`);
  } else {
    const expected = buildProjectionFromLedger(ledger, root);
    for (const field of [
      "version",
      "capabilityId",
      "projectionSource",
      "registryRef",
      "compatibilityBoxRef",
      "currentFilesMode",
      "activeAuthority",
      "generatedBundle",
      "lifecycleAchieved",
      "lifecycleNotAdmitted",
      "runtimeTestConsumptionAdmitted",
      "runtimeConsumptionReady",
      "runtimeGoNoGo",
      "businessFeatureDevelopmentAllowed",
      "businessLandingGoNoGo",
      "businessLandingDigestActive",
      "productionConfirmAllowed",
      "productionGoNoGo",
      "releaseAuthority",
      "finalGoNoGo",
      "legacyCurrentFilesAreAuthority"
    ]) {
      if (!sameJson(projection[field], expected[field])) {
        failures.push(`projection.${field} must replay from ledger.`);
      }
    }
    validateActiveAuthority(projection.activeAuthority, "projection.activeAuthority", failures);
    if (!sameJson(registry?.activeAuthority, projection.activeAuthority)) {
      failures.push("registry.activeAuthority must equal ledger replay projection.activeAuthority.");
    }
  }
  return { status: failures.length === 0 ? "PASS" : "NO_GO", failures };
}

export function validateCompatibilityBox({ compatibilityBox } = {}) {
  const failures = [];
  if (!compatibilityBox || typeof compatibilityBox !== "object") {
    return { status: "NO_GO", failures: [`${CAPABILITY_COMPATIBILITY_BOX_PATH} is missing or invalid.`] };
  }
  requireEqual(compatibilityBox.version, "oam.capability-compatibility-box.v1", "compatibilityBox.version", failures);
  requireEqual(compatibilityBox.capabilityId, CAPABILITY_ID, "compatibilityBox.capabilityId", failures);
  for (const category of compatibilityCategories) {
    if (!Array.isArray(compatibilityBox[category])) failures.push(`compatibilityBox.${category} must be an array.`);
  }
  for (const term of forbiddenActiveLegacyTerms) {
    const allEntries = compatibilityCategories.flatMap((category) => compatibilityBox[category] ?? []);
    const found = allEntries.some((entry) => stableStringify(entry).includes(term));
    if (!found) failures.push(`Compatibility Box missing legacy identity term: ${term}.`);
  }
  if (compatibilityBox.runtimeIdentityPolicy !== "forbidden_from_active_authority") {
    failures.push("compatibilityBox.runtimeIdentityPolicy must be forbidden_from_active_authority.");
  }
  return { status: failures.length === 0 ? "PASS" : "NO_GO", failures };
}

export function validateNoActiveLegacyIdentity({ registry, ledger, projection } = {}) {
  const failures = [];
  for (const [label, document] of [
    ["registry", stripHistorical(registry)],
    ["ledger", stripHistorical(ledger)],
    ["projection", stripHistorical(projection)]
  ]) {
    const text = stableStringify(document ?? {});
    for (const term of forbiddenActiveLegacyTerms) {
      if (text.includes(term)) failures.push(`${label} active authority contains legacy identity term: ${term}.`);
    }
  }
  return { status: failures.length === 0 ? "PASS" : "NO_GO", failures };
}

export function validateNoStageNumberAuthorityLeak({ registry, ledger, projection } = {}) {
  const failures = [];
  for (const [label, document] of [
    ["registry", stripHistorical(registry)],
    ["ledger", stripHistorical(ledger)],
    ["projection", stripHistorical(projection)]
  ]) {
    const text = stableStringify(document ?? {});
    if (stageAuthorityPattern.test(text)) failures.push(`${label} active authority contains stage-number authority term.`);
  }
  return { status: failures.length === 0 ? "PASS" : "NO_GO", failures };
}

export function generatedBundleDigest(root = process.cwd()) {
  return generatedBundleAuthority(root).generatedBundleDigest;
}

export function eventDigest(event) {
  const { eventDigest: _eventDigest, ...rest } = event ?? {};
  return digestObject(rest);
}

export function digestObject(value) {
  return `sha256:${crypto.createHash("sha256").update(stableStringify(normalizeForDigest(value))).digest("hex")}`;
}

export function fileDigest(file, root = process.cwd()) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex")}`;
}

export function commonForbiddenInterpretations() {
  return [
    "Evidence Root PASS is not capability delivery GO",
    "CI PASS is not capability delivery GO",
    "artifact exists is not capability delivery GO",
    "browser audit PASS is not production confirmation",
    "runtime test admission is not business landing",
    "generated bundle acceptance is not release authority",
    "capability projection is not production confirmation",
    "current files are projections, not active authority identity"
  ];
}

function validateActiveAuthority(value, label, failures) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    failures.push(`${label} must be an object.`);
    return;
  }
  const keys = Object.keys(value).sort();
  const expected = [...activeAuthorityFields].sort();
  if (!sameJson(keys, expected)) failures.push(`${label} fields must be exactly ${expected.join(", ")}.`);
  requireEqual(value.capabilityId, CAPABILITY_ID, `${label}.capabilityId`, failures);
  for (const field of activeAuthorityFields.filter((item) => item !== "capabilityId")) {
    if (value[field] !== null) requireDigest(value[field], `${label}.${field}`, failures);
  }
}

function removeAchievedState(achieved, state) {
  let index = achieved.lastIndexOf(state);
  while (index !== -1) {
    achieved.splice(index, 1);
    index = achieved.lastIndexOf(state);
  }
}

function admitState(achieved, state) {
  removeAchievedState(achieved, state);
  achieved.push(state);
}

function revokeFromState(achieved, state) {
  const index = lifecycleStates.indexOf(state);
  if (index === -1) return;
  for (const revoked of lifecycleStates.slice(index)) {
    removeAchievedState(achieved, revoked);
  }
}

function lastEventOfType(events = [], type) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index]?.eventType === type) return events[index];
  }
  return null;
}

function acceptedGeneratedBundleAuthority(root) {
  try {
    const acceptance = JSON.parse(fs.readFileSync(path.join(root, "docs/oam/generated-candidate-acceptance.current.json"), "utf8"));
    if (acceptance?.decisionStatus === "ACCEPTED_BY_00" &&
      digestPattern.test(String(acceptance.acceptedGeneratedBundleDigest ?? ""))) {
      return {
        generatedBundleDigest: acceptance.acceptedGeneratedBundleDigest,
        files: Array.isArray(acceptance.acceptedGeneratedFiles) ? acceptance.acceptedGeneratedFiles : null,
        subject: acceptance.generatedCandidateSubject ?? null
      };
    }
  } catch {
    return null;
  }
  return null;
}

function generatedBundleFileEntries(root) {
  return generatedBundleAuthority(root).generatedFileDigests;
}

function generatedBundleAuthority(root) {
  const accepted = acceptedGeneratedBundleAuthority(root);
  if (accepted?.subject) {
    return buildGeneratedContractBundle({
      root,
      subject: accepted.subject,
      bundleRole: "accepted_generated_contract_bundle"
    });
  }
  return buildGeneratedContractBundle({
    root,
    bundleRole: "current_generated_contract_bundle"
  });
}

function requireDigestMap(value, label, failures) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    failures.push(`${label} must be an object.`);
    return;
  }
  for (const [key, digest] of Object.entries(value)) {
    if (digest !== null) requireDigest(digest, `${label}.${key}`, failures);
  }
}

function requireDigest(value, label, failures) {
  if (!digestPattern.test(String(value ?? ""))) failures.push(`${label} must be a sha256 digest.`);
}

function requireEqual(actual, expected, label, failures) {
  if (actual !== expected) failures.push(`${label} must be ${format(expected)}, actual ${format(actual)}.`);
}

function requireArrayExact(actual, expected, label, failures) {
  if (!Array.isArray(actual)) {
    failures.push(`${label} must be an array.`);
    return;
  }
  if (!sameJson(actual, expected)) failures.push(`${label} must equal ${format(expected)}, actual ${format(actual)}.`);
}

function stripHistorical(value) {
  if (Array.isArray(value)) return value.map(stripHistorical);
  if (value && typeof value === "object") {
    const normalized = {};
    for (const [key, child] of Object.entries(value)) {
      if (["historicalAppendix", "compatibilityBox", "compatibilityBoxRef", "deprecatedAliasReferences"].includes(key)) continue;
      normalized[key] = stripHistorical(child);
    }
    return normalized;
  }
  return value;
}

function normalizeForDigest(value) {
  if (Array.isArray(value)) return value.map(normalizeForDigest);
  if (value && typeof value === "object") {
    const normalized = {};
    for (const [key, child] of Object.entries(value)) {
      if (["checkedAtUtc", "generatedAtUtc", "recordedAtUtc"].includes(key)) continue;
      normalized[key] = normalizeForDigest(child);
    }
    return normalized;
  }
  return value;
}

function normalizeForStableResultWrite(value) {
  if (Array.isArray(value)) return value.map(normalizeForStableResultWrite);
  if (value && typeof value === "object") {
    const normalized = {};
    for (const [key, child] of Object.entries(value)) {
      if (key === "checkedAtUtc") continue;
      normalized[key] = normalizeForStableResultWrite(child);
    }
    return normalized;
  }
  return value;
}

function sameJson(left, right) {
  return stableStringify(left) === stableStringify(right);
}

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function format(value) {
  return JSON.stringify(value);
}
