import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { CAPABILITY_ID, readJsonIfExists } from "./capability-delivery-control-plane.mjs";

export { CAPABILITY_ID };

export const FIRST_GOLDEN_CHAIN_TEST_PLAN_PATH =
  "docs/contracts/generated/dormitory/test-plan.generated.json";
export const FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_DIR =
  "artifacts/oam/evidence/dormitory-first-golden-chain-real-browser";
export const FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_REPORT_PATH =
  `${FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_DIR}/first-golden-chain-real-browser-report.json`;
export const FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_SCREENSHOT_INDEX_PATH =
  `${FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_DIR}/screenshot-index.json`;
export const FIRST_GOLDEN_CHAIN_BROWSER_AUDIT_RESULT_PATH =
  "artifacts/oam/checks/dormitory-first-golden-chain-real-browser-result.json";

export const FIRST_GOLDEN_CHAIN_STEPS = [
  {
    step: "1/3",
    workItemType: "Dorm.RoomSetupConfirm",
    cardId: "Dorm.RoomSetupConfirm",
    title: "RoomSetupConfirm"
  },
  {
    step: "2/3",
    workItemType: "Dorm.BedSetupConfirm",
    cardId: "Dorm.BedSetupConfirm",
    title: "BedSetupConfirm"
  },
  {
    step: "3/3",
    workItemType: "Dorm.ResourceReadinessConfirm",
    cardId: "Dorm.ResourceReadinessConfirm",
    title: "ResourceReadinessConfirm"
  }
];

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
    acceptedGeneratedBundleDigest,
    runtimeProjectionDigest: runtimeProjectionDigest(root, acceptedGeneratedBundleDigest),
    surfaceProjectionDigest: surfaceProjectionDigest(root, acceptedGeneratedBundleDigest),
    searchProjectionDigest: searchProjectionDigest(root, acceptedGeneratedBundleDigest)
  };
}

export function runtimeProjectionDigest(root = process.cwd(), acceptedGeneratedBundleDigest = null) {
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

export function buildCapabilityTestPlan(root = process.cwd()) {
  const chain = buildProjectionDigestChain(root);
  const core = {
    version: "oam.dormitory-first-golden-chain-test-plan.generated.v1",
    generatedBy: "scripts/oam/generate-dormitory-first-golden-chain-test-plan.mjs",
    capabilityId: CAPABILITY_ID,
    acceptedGeneratedBundleDigest: chain.acceptedGeneratedBundleDigest,
    runtimeProjectionDigest: chain.runtimeProjectionDigest,
    surfaceProjectionDigest: chain.surfaceProjectionDigest,
    searchProjectionDigest: chain.searchProjectionDigest,
    mainGatePolicy: {
      currentMainGate: "dormitory_first_golden_chain_capability_only",
      legacyScenarioMainGate: false,
      legacyFullPathAuditMainGate: false,
      legacyBrowserAuditLane: "reference_only_regression"
    },
    scope: {
      includedWorkItems: FIRST_GOLDEN_CHAIN_STEPS,
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
      environment: "local_test_only"
    },
    testCases: FIRST_GOLDEN_CHAIN_STEPS.map((step, index) => ({
      id: `dormitory.first_golden_chain.${index + 1}.${step.title}`,
      step: step.step,
      workItemType: step.workItemType,
      expectedVisibleStepLabel: step.step,
      requiresBrowserProof: true,
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
  return {
    ...core,
    testPlanDigest: digestTestPlan(core)
  };
}

export function digestTestPlan(plan) {
  return digestObject(canonicalWithoutDigest(plan, ["testPlanDigest", "generatedAtUtc", "checkedAtUtc"]));
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
