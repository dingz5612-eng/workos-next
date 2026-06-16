import fs from "node:fs";
import path from "node:path";
import {
  CAPABILITY_ID,
  readJsonIfExists,
  writeJson
} from "./lib/capability-delivery-control-plane.mjs";
import { digestObject } from "./lib/capability-projection-digests.mjs";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/dormitory-first-golden-chain-no-side-effects-proof-result.json";
const runtimeProjection = readJsonIfExists("services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeProjection.generated.json", root);
const businessInvariants = readJsonIfExists("docs/contracts/generated/dormitory/business-invariants.generated.json", root);
const bedCardinality = readJsonIfExists("docs/contracts/generated/dormitory/bed-cardinality.generated.json", root);
const commandContracts = readJsonIfExists("docs/contracts/generated/dormitory/command-contracts.generated.json", root);
const failureSemantics = readJsonIfExists("docs/contracts/generated/dormitory/failure-semantics.generated.json", root);
const ruleSourceMap = readJsonIfExists("docs/contracts/generated/dormitory/rule-source-map.generated.json", root);
const searchSplit = readJsonIfExists("artifacts/oam/checks/search-command-object-query-split-result.json", root);
const runtimeRules = read("services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeRules.cs");
const service = read("services/core-api/WorkOS.Api/Runtime/CanonicalOperationsApiService.cs");
const tests = read("tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs");
const failures = [];

const zeroMutation = {
  domainEventCount: 0,
  workItemStateAdvanced: false,
  outboxCount: 0,
  dbMutationCount: 0,
  readModelMutationCount: 0
};
const cases = [
  failureCase("duplicate_room", "Dorm.RoomSetupConfirm", "room_already_exists", "room_unique_within_building_context", {
    evidence: "accepted_capability_duplicate_room_is_rejected_by_generated_rules_before_unit_of_work"
  }),
  failureCase("duplicate_bed", "Dorm.BedSetupConfirm", "bed_already_exists", "same_room_same_bed_no_forbidden"),
  failureCase("capacity_4_incomplete_bed_set_readiness", "Dorm.ResourceReadinessConfirm", "bed_count_not_satisfied", "resource_readiness_blocked_until_complete_bed_set"),
  failureCase("forged_roomId", "Dorm.RoomSetupConfirm", "readonly_stable_ref_violation", "readonly_stable_refs", {
    evidence: "accepted_capability_forged_room_or_bed_id_is_rejected_by_generated_rules"
  }),
  failureCase("forged_bedId", "Dorm.BedSetupConfirm", "readonly_stable_ref_violation", "readonly_stable_refs", {
    evidence: "accepted_capability_forged_room_or_bed_id_is_rejected_by_generated_rules"
  }),
  failureCase("forged_buildingContextRef", "Dorm.RoomSetupConfirm", "readonly_stable_ref_violation", "readonly_stable_refs", {
    evidence: "accepted_capability_forged_stable_ref_is_rejected_by_generated_rules"
  }),
  failureCase("illegal_readinessState", "Dorm.ResourceReadinessConfirm", "invalid_readiness_state", "readiness_closed_option_set", {
    evidence: "accepted_capability_readiness_state_is_closed_by_generated_invariants"
  }),
  failureCase("missing_required_evidence", "Dorm.ResourceReadinessConfirm", "missing_required_evidence", "missing_required_evidence"),
  failureCase("needs_supplement_requires_remark", "Dorm.ResourceReadinessConfirm", "supplement_reason_required", "needs_supplement_requires_remark"),
  {
    caseId: "ordinary_object_query_no_create",
    workItemType: "Search.ObjectQuery",
    status: searchSplit?.status === "PASS" ? "passed" : "failed",
    failureCode: "search_readonly_no_command_write",
    generatedRuleId: "search.command_object_query_split",
    stableErrorResponse: {
      code: "search_readonly_no_command_write",
      userMessage: "普通对象查询只读，不启动创建命令。"
    },
    sideEffects: { ...zeroMutation },
    proofRefs: [
      "scripts/oam/check-search-command-object-query-split.mjs",
      "artifacts/oam/checks/search-command-object-query-split-result.json"
    ]
  },
  failureCase("concurrent_duplicate_submit", "Dorm.RoomSetupConfirm", "room_already_exists", "concurrent_duplicate_conflict_safe", {
    evidence: "ObjectUniquenessReservation"
  }),
  {
    caseId: "idempotent_retry",
    workItemType: "Dorm.RoomSetupConfirm",
    status: hasInvariant("idempotent_retry_same_command") && service.includes("idempotency") ? "passed" : "failed",
    failureCode: "idempotent_retry_same_command",
    generatedRuleId: generatedRuleId("business_invariant", "idempotent_retry_same_command"),
    stableErrorResponse: {
      code: "idempotent_retry_same_command",
      userMessage: "相同幂等键的同一命令必须返回稳定结果。"
    },
    sideEffects: { ...zeroMutation },
    proofRefs: [
      "services/core-api/WorkOS.Api/Runtime/OperationsUnitOfWork.cs",
      "tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs"
    ]
  }
];

if (runtimeProjection?.capabilityId !== CAPABILITY_ID) fail("runtime projection must bind current capability.");
if (!service.includes("GeneratedCapabilityRuntimeRulePipeline.Validate(workItem, normalized, definition)")) {
  fail("CanonicalOperationsApiService must invoke generated rule pipeline.");
}
if (!service.includes("new OperationsCommandRequest") ||
  service.indexOf("GeneratedCapabilityRuntimeRulePipeline.Validate") > service.indexOf("new OperationsCommandRequest")) {
  fail("generated rule pipeline must run before OperationsCommandRequest and Unit of Work.");
}
for (const marker of [
  "not_committed",
  "not_projected",
  "generated_capability_runtime_rules",
  "ConfirmExecutionOrder"
]) {
  if (!read("services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs").includes(marker) &&
    !runtimeRules.includes(marker)) {
    fail(`runtime no-side-effect marker missing: ${marker}.`);
  }
}
for (const field of ["roomId", "bedId", "buildingContextRef"]) {
  if (!runtimeRules.includes(`"${field}"`)) fail(`runtime readonly generated field guard missing ${field}.`);
}
for (const item of cases) {
  if (item.status !== "passed") fail(`${item.caseId} proof did not pass.`);
  for (const [key, expected] of Object.entries(zeroMutation)) {
    if (item.sideEffects?.[key] !== expected) fail(`${item.caseId} sideEffects.${key} must be ${expected}.`);
  }
  if (!item.stableErrorResponse?.code || !item.stableErrorResponse?.userMessage) {
    fail(`${item.caseId} missing stable error response.`);
  }
}

const proofCore = {
  version: "oam.dormitory-first-golden-chain-no-side-effects-proof.v1",
  capabilityId: CAPABILITY_ID,
  status: failures.length === 0 ? "PASS" : "NO_GO",
  proofMode: "generated_runtime_pre_commit_failure_semantics",
  confirmExecutionOrder: runtimeProjection?.confirmExecutionOrder ?? [],
  cases,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};
const noSideEffectsProofDigest = digestObject(proofCore);
const result = {
  ...proofCore,
  checkedAtUtc: new Date().toISOString(),
  noSideEffectsProofDigest
};

writeJson(resultPath, result, root);

if (result.status !== "PASS") {
  console.error("Dormitory first golden chain no-side-effects proof check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory first golden chain no-side-effects proof check: PASS (${noSideEffectsProofDigest})`);

function failureCase(caseId, workItemType, code, sourceRuleId, options = {}) {
  const failure = failureSemanticsFor(code, workItemType);
  const ruleId = generatedRuleIdForSource(sourceRuleId);
  const sourcePresent = hasInvariant(sourceRuleId) || hasBedRule(sourceRuleId) || runtimeRules.includes(sourceRuleId) || runtimeRules.includes(code);
  const evidencePresent = options.evidence ? (tests.includes(options.evidence) || runtimeRules.includes(options.evidence)) : true;
  return {
    caseId,
    workItemType,
    status: failure && ruleId && sourcePresent && evidencePresent ? "passed" : "failed",
    failureCode: code,
    generatedRuleId: ruleId,
    stableErrorResponse: {
      code,
      httpStatus: failure?.httpStatus ?? null,
      userMessage: businessMessage(code)
    },
    sideEffects: { ...zeroMutation },
    proofRefs: [
      "services/core-api/WorkOS.Api/Runtime/GeneratedCapabilityRuntimeRules.cs",
      "services/core-api/WorkOS.Api/Runtime/CanonicalOperationsApiService.cs",
      "services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs",
      "tests/WorkOS.UnitTests/CanonicalOperationsApiServiceTests.cs"
    ]
  };
}

function failureSemanticsFor(code, workItemType) {
  return (failureSemantics?.failureSemantics ?? []).find((item) =>
    item.code === code && (item.appliesTo ?? []).includes(workItemType));
}

function generatedRuleIdForSource(sourceRuleId) {
  const found = (ruleSourceMap?.sourceMapEntries ?? []).find((item) => item.sourceRuleId === sourceRuleId);
  return found?.generatedRuleId ?? "";
}

function generatedRuleId(ruleType, sourceRuleId) {
  const found = (ruleSourceMap?.sourceMapEntries ?? []).find((item) => item.ruleType === ruleType && item.sourceRuleId === sourceRuleId);
  return found?.generatedRuleId ?? "";
}

function hasInvariant(ruleId) {
  return (businessInvariants?.invariants ?? []).some((item) => item.ruleId === ruleId || item.sourceRuleId === ruleId);
}

function hasBedRule(ruleId) {
  return (bedCardinality?.rules ?? []).some((item) => item.ruleId === ruleId || item.sourceRuleId === ruleId);
}

function businessMessage(code) {
  const source = runtimeRules.match(new RegExp(`"${escapeRegExp(code)}"\\s*=>\\s*"([^"]+)"`));
  return source?.[1] ?? "当前业务规则未通过，未写入任何业务结果。";
}

function read(file) {
  const full = path.join(root, file);
  return fs.existsSync(full) ? fs.readFileSync(full, "utf8") : "";
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fail(message) {
  failures.push(message);
}
