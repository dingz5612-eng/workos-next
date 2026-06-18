import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { CAPABILITY_ID, readJsonIfExists } from "./capability-delivery-control-plane.mjs";

export { CAPABILITY_ID };

export const FIRST_GOLDEN_CHAIN_TEST_PLAN_PATH =
  "docs/contracts/generated/dormitory/test-plan.generated.json";
export const FIRST_GOLDEN_CHAIN_CAPABILITY_PROJECTION_PATH =
  "apps/mobile/src/generated/oam/capability-projection.generated.json";
export const FIRST_GOLDEN_CHAIN_RUNTIME_PROJECTION_PATH =
  "services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeProjection.generated.json";
export const FIRST_GOLDEN_CHAIN_DB_PROJECTION_POLICY_PATH =
  "docs/contracts/generated/dormitory/db-projection-policy.generated.json";
export const FIRST_GOLDEN_CHAIN_DB_PROJECTION_PROOF_RESULT_PATH =
  "artifacts/oam/checks/dormitory-first-golden-chain-db-projection-proof-result.json";
export const FIRST_GOLDEN_CHAIN_CAPABILITY_DIGEST_CHAIN_PATH =
  "artifacts/oam/evidence/capability-digest-chain.json";
export const FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_DIR =
  "artifacts/oam/evidence/dormitory-first-golden-chain-real-browser";
export const FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_REPORT_PATH =
  `${FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_DIR}/first-golden-chain-real-browser-report.json`;
export const FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_SCREENSHOT_INDEX_PATH =
  `${FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_DIR}/screenshot-index.json`;
export const FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_RESULT_PATH =
  "artifacts/oam/checks/dormitory-first-golden-chain-real-browser-result.json";
export const FIRST_GOLDEN_CHAIN_NEGATIVE_BROWSER_AUDIT_DIR =
  "artifacts/oam/evidence/dormitory-first-golden-chain-negative-browser";
export const FIRST_GOLDEN_CHAIN_NEGATIVE_BROWSER_AUDIT_REPORT_PATH =
  `${FIRST_GOLDEN_CHAIN_NEGATIVE_BROWSER_AUDIT_DIR}/negative-browser-report.json`;
export const FIRST_GOLDEN_CHAIN_NEGATIVE_BROWSER_AUDIT_SCREENSHOT_INDEX_PATH =
  `${FIRST_GOLDEN_CHAIN_NEGATIVE_BROWSER_AUDIT_DIR}/screenshot-index.json`;
export const FIRST_GOLDEN_CHAIN_NEGATIVE_BROWSER_AUDIT_RESULT_PATH =
  "artifacts/oam/checks/dormitory-first-golden-chain-negative-browser-result.json";
export const FIRST_GOLDEN_CHAIN_NO_SIDE_EFFECTS_PROOF_RESULT_PATH =
  "artifacts/oam/checks/dormitory-first-golden-chain-no-side-effects-proof-result.json";
export const FIRST_GOLDEN_CHAIN_ENVIRONMENT_PROFILE_PROOF_RESULT_PATH =
  "artifacts/oam/checks/dormitory-evidence-environment-profile-result.json";
export const FIRST_GOLDEN_CHAIN_SUBJECT_CHAIN_PATH =
  "artifacts/oam/evidence/capability-evidence-subject-chain.json";
export const FIRST_GOLDEN_CHAIN_SUBJECT_CHAIN_RESULT_PATH =
  "artifacts/oam/checks/capability-evidence-subject-chain-complete-result.json";
export const FIRST_GOLDEN_CHAIN_SUBJECT_CHAIN_PROJECTION_RESULT_PATH =
  "artifacts/oam/checks/evidence-projects-capability-subject-chain-only-result.json";
export const FIRST_GOLDEN_CHAIN_BUSINESS_LANDING_REVIEW_ATTESTATION_PATH =
  "docs/oam/evidence-attestation-packages/dormitory-first-golden-chain-business-landing-review.attestation.json";
const OBJECT_IDENTITY_PATH = "docs/contracts/generated/dormitory/object-identity.generated.json";
const BED_CARDINALITY_PATH = "docs/contracts/generated/dormitory/bed-cardinality.generated.json";
const BUSINESS_INVARIANTS_PATH = "docs/contracts/generated/dormitory/business-invariants.generated.json";
const COMMAND_CONTRACTS_PATH = "docs/contracts/generated/dormitory/command-contracts.generated.json";
const FAILURE_SEMANTICS_PATH = "docs/contracts/generated/dormitory/failure-semantics.generated.json";
const RULE_SOURCE_MAP_PATH = "docs/contracts/generated/dormitory/rule-source-map.generated.json";

export const FIRST_GOLDEN_CHAIN_STEPS = currentCapabilitySteps();

export function capabilityDigestChainStableRefDigest() {
  return digestObject({
    version: "oam.capability-digest-chain-stable-ref.v1",
    capabilityId: CAPABILITY_ID,
    ref: FIRST_GOLDEN_CHAIN_CAPABILITY_DIGEST_CHAIN_PATH,
    evidenceScope: "local_test_runtime_evidence",
    productionConfirmAllowed: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO"
  });
}

export function buildProjectionDigestChain(root = process.cwd()) {
  const capability = readJsonIfExists("docs/oam/capabilities/dormitory-first-golden-chain.current.json", root);
  const acceptance = readJsonIfExists("docs/oam/generated-candidate-acceptance.current.json", root);
  const runtimeAdmission = readJsonIfExists("docs/oam/dormitory-runtime-admission.current.json", root);
  const acceptedGeneratedBundleDigest =
    capability?.activeAuthority?.acceptedGeneratedBundleDigest ??
    acceptance?.acceptedGeneratedBundleDigest ??
    runtimeAdmission?.runtimeConsumedBundleDigest ??
    null;
  return {
    capabilityId: CAPABILITY_ID,
    authorityLedgerDigest: fileDigest("docs/oam/capabilities/dormitory-first-golden-chain.authority-ledger.json", root),
    acceptedGeneratedBundleDigest,
    runtimeProjectionDigest: runtimeProjectionDigest(root, acceptedGeneratedBundleDigest),
    surfaceProjectionDigest: surfaceProjectionDigest(root, acceptedGeneratedBundleDigest),
    searchProjectionDigest: searchProjectionDigest(root, acceptedGeneratedBundleDigest),
    dbProjectionPolicyDigest: dbProjectionPolicyDigest(root),
    dbProjectionProofDigest: dbProjectionProofDigest(root),
    environmentProfileDigest: environmentProfileDigest(root),
    positiveBrowserAuditDigest: positiveBrowserAuditDigest(root),
    negativeBrowserAuditDigest: negativeBrowserAuditDigest(root),
    noSideEffectsProofDigest: noSideEffectsProofDigest(root),
    subjectChainDigest: subjectChainDigest(root),
    capabilityDigestChainDigest: capabilityDigestChainStableRefDigest()
  };
}

export function runtimeProjectionDigest(root = process.cwd(), acceptedGeneratedBundleDigest = null) {
  const generated = readJsonIfExists(FIRST_GOLDEN_CHAIN_RUNTIME_PROJECTION_PATH, root);
  if (generated?.acceptedGeneratedBundleDigest === acceptedGeneratedBundleDigest &&
    isSha256Digest(generated.runtimeProjectionDigest)) {
    return generated.runtimeProjectionDigest;
  }
  return digestObject({
    version: "oam.runtime-projection-digest.v1",
    capabilityId: CAPABILITY_ID,
    acceptedGeneratedBundleDigest,
    steps: FIRST_GOLDEN_CHAIN_STEPS.map((item) => item.workItemType),
    sourceFiles: fileDigestEntries([
      "services/core-api/WorkOS.Api/Runtime/AcceptedCapabilityRuntimeProjection.cs",
      "services/core-api/WorkOS.Api/Runtime/SliceRuntimeCapabilityGate.cs",
      "services/core-api/WorkOS.Api/Runtime/ProjectionSeed.cs",
      "services/core-api/WorkOS.Api/Runtime/ProjectionRuntime.cs",
      "services/core-api/WorkOS.Api/Runtime/WorkItemDefinitionRegistryService.cs",
      "services/core-api/WorkOS.Api/Runtime/CanonicalOperationsApiService.cs",
      "services/core-api/WorkOS.Api/Program.cs",
      "docs/contracts/slice-manifest.json",
      "docs/contracts/runtime-surface-policy.json"
    ], root)
  });
}

export function surfaceProjectionDigest(root = process.cwd(), acceptedGeneratedBundleDigest = null) {
  const generated = readJsonIfExists(FIRST_GOLDEN_CHAIN_CAPABILITY_PROJECTION_PATH, root);
  if (generated?.acceptedGeneratedBundleDigest === acceptedGeneratedBundleDigest &&
    isSha256Digest(generated.surfaceProjectionDigest)) {
    return generated.surfaceProjectionDigest;
  }
  return digestObject({
    version: "oam.surface-projection-digest.v1",
    capabilityId: CAPABILITY_ID,
    acceptedGeneratedBundleDigest,
    steps: FIRST_GOLDEN_CHAIN_STEPS.map((item) => item.workItemType),
    sourceFiles: fileDigestEntries([
      "apps/mobile/src/capabilityProjection.js",
      "apps/mobile/src/generated/oam/dormitory-surface-input-model.generated.json",
      "apps/mobile/src/operationFieldKernel.js",
      "apps/mobile/src/fieldSourceRenderer.js",
      "apps/mobile/src/controls/optionSetContract.js",
      "apps/mobile/src/controls/fieldControls.js",
      "apps/mobile/src/systemContextContract.js",
      "apps/mobile/src/views/workspaceView.js",
      "apps/mobile/src/views/experienceComponents.js"
    ], root)
  });
}

export function searchProjectionDigest(root = process.cwd(), acceptedGeneratedBundleDigest = null) {
  const generated = readJsonIfExists(FIRST_GOLDEN_CHAIN_CAPABILITY_PROJECTION_PATH, root);
  if (generated?.acceptedGeneratedBundleDigest === acceptedGeneratedBundleDigest &&
    isSha256Digest(generated.searchProjectionDigest)) {
    return generated.searchProjectionDigest;
  }
  return digestObject({
    version: "oam.search-projection-digest.v1",
    capabilityId: CAPABILITY_ID,
    acceptedGeneratedBundleDigest,
    searchEntry: {
      title: "新增房间",
      workspaceId: CAPABILITY_ID,
      firstCardId: "Dorm.RoomSetupConfirm"
    },
    sourceFiles: fileDigestEntries([
      "services/core-api/WorkOS.Api/Runtime/SearchKernelService.cs",
      "apps/mobile/src/capabilityProjection.js",
      "apps/mobile/src/searchIntentRegistry.js",
      "apps/mobile/src/searchIntentHub.js",
      "apps/mobile/src/views/searchView.js"
    ], root)
  });
}

export function dbProjectionPolicyDigest(root = process.cwd()) {
  return generatedOutputDigest(FIRST_GOLDEN_CHAIN_DB_PROJECTION_POLICY_PATH, root);
}

export function dbProjectionProofDigest(root = process.cwd()) {
  const result = readJsonIfExists(FIRST_GOLDEN_CHAIN_DB_PROJECTION_PROOF_RESULT_PATH, root);
  if (result?.status === "PASS" && result.dbProjectionProofDigest === "null_if_runtime_test_only") {
    return "null_if_runtime_test_only";
  }
  return isSha256Digest(result?.dbProjectionProofDigest) ? result.dbProjectionProofDigest : "missing";
}

export function environmentProfileDigest(root = process.cwd()) {
  const result = readJsonIfExists(FIRST_GOLDEN_CHAIN_ENVIRONMENT_PROFILE_PROOF_RESULT_PATH, root);
  return isSha256Digest(result?.environmentProfileDigest)
    ? result.environmentProfileDigest
    : fileDigest("docs/oam/environment-profiles/current-runtime-evidence.environment-profile.json", root);
}

export function positiveBrowserAuditDigest(root = process.cwd()) {
  const report = readJsonIfExists(FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_REPORT_PATH, root);
  return isSha256Digest(report?.browserAuditDigest) ? report.browserAuditDigest : "missing";
}

export function negativeBrowserAuditDigest(root = process.cwd()) {
  const report = readJsonIfExists(FIRST_GOLDEN_CHAIN_NEGATIVE_BROWSER_AUDIT_REPORT_PATH, root);
  return isSha256Digest(report?.negativeBrowserAuditDigest) ? report.negativeBrowserAuditDigest : "missing";
}

export function noSideEffectsProofDigest(root = process.cwd()) {
  const result = readJsonIfExists(FIRST_GOLDEN_CHAIN_NO_SIDE_EFFECTS_PROOF_RESULT_PATH, root);
  return isSha256Digest(result?.noSideEffectsProofDigest) ? result.noSideEffectsProofDigest : "missing";
}

export function subjectChainDigest(root = process.cwd()) {
  const result = readJsonIfExists(FIRST_GOLDEN_CHAIN_SUBJECT_CHAIN_PATH, root);
  return isSha256Digest(result?.outputContentDigest) ? result.outputContentDigest : "missing";
}

export function buildCapabilityTestPlan(root = process.cwd()) {
  const chain = buildProjectionDigestChain(root);
  const steps = currentCapabilitySteps(root);
  const generatedProjection = readJsonIfExists(FIRST_GOLDEN_CHAIN_CAPABILITY_PROJECTION_PATH, root);
  const capabilityLedger = readJsonIfExists("docs/oam/capabilities/dormitory-first-golden-chain.authority-ledger.json", root);
  const environmentProfile = readJsonIfExists("docs/oam/environment-profiles/current-runtime-evidence.environment-profile.json", root);
  const objectIdentity = readJsonIfExists(OBJECT_IDENTITY_PATH, root) ?? {};
  const bedCardinality = readJsonIfExists(BED_CARDINALITY_PATH, root) ?? {};
  const businessInvariants = readJsonIfExists(BUSINESS_INVARIANTS_PATH, root) ?? {};
  const commandContracts = readJsonIfExists(COMMAND_CONTRACTS_PATH, root) ?? {};
  const failureSemantics = readJsonIfExists(FAILURE_SEMANTICS_PATH, root) ?? {};
  const ruleSourceMap = readJsonIfExists(RULE_SOURCE_MAP_PATH, root) ?? {};
  const core = {
    generated: true,
    doNotEdit: true,
    kind: "dormitory-first-golden-chain-test-plan.generated",
    generatorVersion: "oam.capability-compiler.v1",
    generatedBy: "scripts/oam/compile-current-capability.mjs",
    generatedFrom: generatedProjection?.generatedFrom ?? [
      "docs/oam/capabilities/dormitory-first-golden-chain.authority-ledger.json",
      FIRST_GOLDEN_CHAIN_CAPABILITY_PROJECTION_PATH,
      FIRST_GOLDEN_CHAIN_RUNTIME_PROJECTION_PATH
    ],
    inputDigest: generatedProjection?.inputDigest ?? null,
    inputDigests: generatedProjection?.inputDigests ?? [],
    outputContentDigest: "sha256:pending",
    capabilityId: CAPABILITY_ID,
    acceptedGeneratedBundleDigest: chain.acceptedGeneratedBundleDigest,
    currentFilesMode: generatedProjection?.currentFilesMode,
    capabilityLedgerReplay: generatedProjection?.capabilityLedgerReplay ?? {
      status: "PASS",
      eventCount: capabilityLedger?.events?.length ?? 0
    },
    lifecycleState: generatedProjection?.lifecycleState,
    runtimeAdmissionStatus: generatedProjection?.runtimeAdmissionStatus,
    landingStatus: generatedProjection?.landingStatus,
    environmentProfileId: environmentProfile?.environmentProfileId ?? "local_test_only",
    version: "oam.dormitory-first-golden-chain-test-plan.generated.v1",
    runtimeProjectionDigest: chain.runtimeProjectionDigest,
    surfaceProjectionDigest: chain.surfaceProjectionDigest,
    searchProjectionDigest: chain.searchProjectionDigest,
    dbProjectionPolicyDigest: chain.dbProjectionPolicyDigest,
    capabilityDigestChainDigest: chain.capabilityDigestChainDigest,
    subjectChainRef: FIRST_GOLDEN_CHAIN_SUBJECT_CHAIN_PATH,
    objectIdentityRef: OBJECT_IDENTITY_PATH,
    bedCardinalityRef: BED_CARDINALITY_PATH,
    businessInvariantsRef: BUSINESS_INVARIANTS_PATH,
    commandContractsRef: COMMAND_CONTRACTS_PATH,
    failureSemanticsRef: FAILURE_SEMANTICS_PATH,
    ruleSourceMapRef: RULE_SOURCE_MAP_PATH,
    generatedBusinessRuleRefs: generatedBusinessRuleRefs({
      objectIdentity,
      bedCardinality,
      businessInvariants,
      commandContracts,
      failureSemantics,
      ruleSourceMap
    }),
    mainGatePolicy: {
      currentMainGate: "dormitory_first_golden_chain_capability_only",
      legacyScenarioMainGate: false,
      legacyFullPathAuditMainGate: false,
      legacyBrowserAuditLane: "reference_only_regression"
    },
    scope: {
      includedWorkItems: steps.map((step) => ({
        step: step.step,
        workItemType: step.workItemType,
        cardId: step.cardId,
        title: step.title
      })),
      excludedLegacyWorkItemCategories: ["pricing_setup", "blocking_flow", "release_flow"],
      businessLandingAllowed: false,
      productionConfirmAllowed: false,
      releaseAuthority: false,
      finalGoNoGo: "NO_GO"
    },
    browserAudit: {
      runner: "scripts/surface/run-dormitory-first-golden-chain-real-browser-audit.mjs",
      checker: "scripts/surface/check-dormitory-first-golden-chain-real-browser-audit.mjs",
      evidenceRoot: FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_DIR,
      query: "新增房间",
      account: "dormOperator",
      environment: environmentProfile?.environmentProfileId ?? "local_test_only"
    },
    testCases: steps.map((step, index) => ({
      id: `dormitory.first_golden_chain.${index + 1}.${step.title}`,
      step: step.step,
      workItemType: step.workItemType,
      expectedVisibleStepLabel: step.step,
      requiresBrowserProof: true,
      objectIdentityRules: (objectIdentity.objectRules ?? [])
        .filter((rule) => rule.createdBy === step.workItemType ||
          rule.configuredBy === step.workItemType ||
          rule.createdOrUpdatedBy === step.workItemType)
        .map((rule) => rule.generatedRuleId),
      commandContractRule: (commandContracts.commands ?? [])
        .find((rule) => rule.command === step.workItemType)?.generatedRuleId ?? "",
      failureSemanticsRules: (failureSemantics.failureSemantics ?? [])
        .filter((rule) => Array.isArray(rule.appliesTo) && rule.appliesTo.includes(step.workItemType))
        .map((rule) => rule.generatedRuleId),
      forbiddenVisibleTerms: [
        "价格配置",
        "房间床位阻断",
        "房间床位释放",
        "生产确认",
        "发布确认",
        "Final GO"
      ]
    })),
    forbiddenInterpretations: [
      "browser audit PASS is not business landing",
      "browser audit PASS is not production confirmation",
      "browser audit PASS is not release authority",
      "browser audit PASS is not final GO",
      "legacy browser audits are reference-only regression evidence"
    ]
  };
  const testPlanDigest = digestTestPlan(core);
  const withDigest = { ...core, testPlanDigest };
  return {
    ...withDigest,
    outputContentDigest: digestGeneratedOutput(withDigest)
  };
}

function generatedBusinessRuleRefs({
  objectIdentity,
  bedCardinality,
  businessInvariants,
  commandContracts,
  failureSemantics,
  ruleSourceMap
}) {
  return {
    objectIdentity: generatedRuleRef(OBJECT_IDENTITY_PATH, objectIdentity, objectIdentity.objectRules),
    bedCardinality: generatedRuleRef(BED_CARDINALITY_PATH, bedCardinality, bedCardinality.rules),
    businessInvariants: generatedRuleRef(BUSINESS_INVARIANTS_PATH, businessInvariants, businessInvariants.invariants),
    commandContracts: generatedRuleRef(COMMAND_CONTRACTS_PATH, commandContracts, commandContracts.commands),
    failureSemantics: generatedRuleRef(FAILURE_SEMANTICS_PATH, failureSemantics, failureSemantics.failureSemantics),
    ruleSourceMap: generatedRuleRef(RULE_SOURCE_MAP_PATH, ruleSourceMap, ruleSourceMap.sourceMapEntries)
  };
}

function generatedRuleRef(ref, document, rules) {
  return {
    ref,
    digest: document?.outputContentDigest ?? "missing",
    ruleIds: (rules ?? []).map((rule) => rule.generatedRuleId).filter(Boolean)
  };
}

export function digestTestPlan(plan) {
  return digestObject(canonicalWithoutDigest(plan, ["testPlanDigest", "outputContentDigest", "capabilityDigestChainDigest", "generatedAtUtc", "checkedAtUtc"]));
}

export function digestBrowserAuditReport(report) {
  return digestObject(canonicalWithoutDigest(report, ["browserAuditDigest", "checkedAtUtc"]));
}

export function fileDigestEntries(files, root = process.cwd()) {
  return files.map((file) => ({ path: file, digest: fileDigest(file, root) }));
}

export function fileDigest(file, root = process.cwd()) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) return "missing";
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(full)).digest("hex")}`;
}

export function isSha256Digest(value) {
  return /^sha256:[a-f0-9]{64}$/.test(String(value ?? ""));
}

export function digestObject(value) {
  return `sha256:${crypto.createHash("sha256").update(stableStringify(value)).digest("hex")}`;
}

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function canonicalWithoutDigest(value, excludedKeys) {
  if (Array.isArray(value)) return value.map((item) => canonicalWithoutDigest(item, excludedKeys));
  if (value && typeof value === "object") {
    const normalized = {};
    for (const [key, child] of Object.entries(value)) {
      if (excludedKeys.includes(key)) continue;
      normalized[key] = canonicalWithoutDigest(child, excludedKeys);
    }
    return normalized;
  }
  return value;
}

function currentCapabilitySteps(root = process.cwd()) {
  const projection = readJsonIfExists(FIRST_GOLDEN_CHAIN_CAPABILITY_PROJECTION_PATH, root);
  if (Array.isArray(projection?.steps) && projection.steps.length > 0) {
    return projection.steps.map((step) => ({
      step: step.step,
      workItemType: step.workItemType,
      cardId: step.cardId,
      title: String(step.workItemType ?? "").replace(/^Dorm\./, "")
    }));
  }
  const workitems = readJsonIfExists("docs/contracts/generated/dormitory/workitems.generated.json", root);
  return (workitems?.workItems ?? []).map((item, index, all) => ({
    step: `${index + 1}/${all.length}`,
    workItemType: item.workItemType,
    cardId: item.workItemType,
    title: String(item.workItemType ?? "").replace(/^Dorm\./, "")
  }));
}

function generatedOutputDigest(file, root) {
  const generated = readJsonIfExists(file, root);
  return isSha256Digest(generated?.outputContentDigest) ? generated.outputContentDigest : fileDigest(file, root);
}

function digestGeneratedOutput(value) {
  return digestObject({ ...value, outputContentDigest: "sha256:pending" });
}
