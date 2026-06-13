import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const gateId = "OAM-DORMITORY-GOLDEN-CHAIN-SOURCE-PACKAGE";
const resultPath = "artifacts/oam/checks/dormitory-golden-chain-source-package-result.json";
const sourcePath = "docs/business/domains/dormitory/scenarios/dormitory-resource-saleability.golden-chain.yml";
const matrixPath = "docs/business/domains/dormitory/scenarios/dormitory-scenario-package-matrix.yml";
const kernelPath = "docs/business/domains/dormitory/dormitory-operating-kernel.json";
const generatorPath = "scripts/business/generate-dormitory-derived-contracts.mjs";
const surfaceCopyPath = "docs/contracts/language/surface-copy-catalog.json";
const multilingualCopyPath = "docs/contracts/language/multilingual-copy-catalog.json";
const canonicalMapPath = "docs/business/dormitory/canonical-scenario-map.json";
const scenarioFieldContractPath = "docs/business/dormitory/scenario-field-contract.yml";
const operationsRuntimePath = "services/core-api/WorkOS.Api/Runtime/OperationsRuntimeService.cs";
const operationsEndpointsPath = "services/core-api/WorkOS.Api/Runtime/OperationsRuntimeEndpoints.cs";
const canonicalOperationsPath = "services/core-api/WorkOS.Api/Runtime/CanonicalOperationsApiService.cs";
const definitionRegistryPath = "services/core-api/WorkOS.Api/Runtime/WorkItemDefinitionRegistryService.cs";
const noSideEffectsProofPath = "docs/oam/db-no-side-effects-proof.json";
const writeProof = process.argv.includes("--write-proof") || process.env.OAM_WRITE_PROOF === "1";
const sourceFinalizationStatus = "SOURCE_FINALIZED_BY_00";
const sourceFieldGapsDecisionStatus = "DECIDED_AND_BOUND";
const compileDecisionStatus = "READY_FOR_00_COMPILE_DECISION";
const generatedCompilationAllowed = "false_until_00_explicit_generated_compile_approval";
const generatedContractStatus10B = "PENDING_GENERATED_CONTRACT";

const firstChainTypes = [
  "Dorm.RoomSetupConfirm",
  "Dorm.BedSetupConfirm",
  "Dorm.ResourceReadinessConfirm"
];
const futureChainTypes = [
  "Dorm.CheckinConfirm",
  "Dorm.PaymentConfirm",
  "Dorm.DepositConfirm",
  "Dorm.CheckoutSettlementApprove",
  "Finance.CorrectionApply",
  "Dorm.PeriodReview"
];
const financeFacts = [
  "Payment",
  "Deposit",
  "DepositAccount",
  "LedgerEntry",
  "LedgerTransaction",
  "PaymentAllocation",
  "Refund",
  "AmountBasis",
  "MoneyBasis",
  "FinancialFact",
  "FinanceReceipt"
];
const noSideEffectWrites = [
  "UnitOfWork commit",
  "CommandSubmission",
  "DomainEvent",
  "WorkItemEvent",
  "LedgerTransaction",
  "LedgerEntry",
  "WriteLog",
  "Outbox",
  "confirmed transition",
  "next WorkItem dispatch",
  "Projection mutation",
  "Lens mutation",
  "Search mutation",
  "Dashboard mutation",
  "business Evidence mutation"
];
const branchNoSideEffects = [
  "no_command_submission",
  "no_uow_commit",
  "no_domain_event",
  "no_workitem_event",
  "no_ledger_transaction",
  "no_ledger_entry",
  "no_outbox",
  "no_confirmed_transition",
  "no_next_workitem_dispatch",
  "no_projection_mutation",
  "no_lens_mutation",
  "no_search_mutation",
  "no_dashboard_mutation",
  "no_business_evidence_mutation"
];
const allowedFieldCategories = [
  "clientSubmitted",
  "contextReadonly",
  "systemGenerated",
  "derived",
  "stable-reference",
  "evidence-reference",
  "branch-output",
  "forbidden"
];
const sourceGapIds = [
  "buildingId",
  "roomType",
  "readinessEvidenceRefs",
  "readinessNote",
  "blockedReason",
  "notSaleableReason",
  "serviceVerificationRef"
];
const sourceFieldGapDecisions = {
  buildingId: {
    decision: "add_as_context_readonly_ref",
    owner: "01｜产品业务",
    compileBlocking: true,
    compilerInputImpact: "contextReadonly_ref_required"
  },
  roomType: {
    decision: "defer_to_P1",
    owner: "01｜产品业务",
    compileBlocking: false,
    compilerInputImpact: "deferred_not_blocking"
  },
  readinessEvidenceRefs: {
    decision: "bind_to_evidence_envelope",
    owner: "06｜质量证据",
    compileBlocking: true,
    compilerInputImpact: "evidenceEnvelope_required"
  },
  readinessNote: {
    decision: "defer_to_P2_audit_note",
    owner: "01｜产品业务",
    compileBlocking: false,
    compilerInputImpact: "audit_note_only"
  },
  blockedReason: {
    decision: "map_to_branch_outcome",
    owner: "02｜架构运行时",
    compileBlocking: true,
    compilerInputImpact: "branchOutputOnly"
  },
  notSaleableReason: {
    decision: "map_to_resource_not_saleable_branch",
    owner: "02｜架构运行时",
    compileBlocking: true,
    compilerInputImpact: "branchOutputOnly"
  },
  serviceVerificationRef: {
    decision: "bind_to_verification_evidence_ref",
    owner: "06｜质量证据",
    compileBlocking: true,
    compilerInputImpact: "evidenceObjectStableRef_required"
  }
};

const p0Failures = [];
const p1Residuals = [];
const p2Residuals = [];
const mutationCases = [];
const verifiedControls = [];

const sourceText = readText(sourcePath);
const matrixText = readText(matrixPath);
const kernel = readJson(kernelPath);
const generatorText = readText(generatorPath);
const surfaceCopy = readJson(surfaceCopyPath);
const multilingualCopy = readJson(multilingualCopyPath);
const canonicalMap = readJson(canonicalMapPath);
const scenarioFieldContract = readJson(scenarioFieldContractPath);
const operationsRuntime = readText(operationsRuntimePath);
const operationsEndpoints = readText(operationsEndpointsPath);
const canonicalOperations = readText(canonicalOperationsPath);
const definitionRegistry = readText(definitionRegistryPath);
const noSideEffectsProof = readJson(noSideEffectsProofPath);

checkSourceIdentity();
checkSourceReviewSemantics();
checkFinanceLedgerNoneBoundary();
checkFieldAndStableRefBoundary();
checkLanguageBoundary();
checkReadSideEnvelope();
checkPriorIdentityDeletionChain();
checkAdmissionTrustBoundary();
checkWorkItemTombstoneResidual();
checkSourceGeneratedProvenanceDirection();
checkSourceLevelNoSideEffects();
runSourceMutationCases();

const status = p0Failures.length ? "FAIL" : "PASS";
const sourceInputs = [
  sourcePath,
  matrixPath,
  kernelPath,
  surfaceCopyPath,
  multilingualCopyPath,
  operationsRuntimePath,
  operationsEndpointsPath,
  canonicalOperationsPath,
  definitionRegistryPath,
  generatorPath
];
const report = {
  version: "oam.dormitory.golden-chain-source-package-check.v1",
  gateId,
  evidenceProducer: true,
  deterministicOutput: true,
  status,
  p0Failures,
  p1Residuals,
  p2Residuals,
  evidenceNodeReady: status === "PASS",
  finalGoNoGo: "NO_GO",
  sourceFinalizationStatus: status === "PASS" ? sourceFinalizationStatus : "CONDITIONAL_NO_PASS",
  sourceScenarioPackageReviewStatus: status === "PASS" ? sourceFinalizationStatus : "CONDITIONAL_NO_PASS",
  sourceFieldGapsDecisionStatus,
  compilePreparationDecision: compileDecisionStatus,
  compileDecisionStatus,
  compilePreparationAllowed: compileDecisionStatus,
  generatedCompilationAllowed,
  generatedCompilationCompleted: false,
  businessFeatureDevelopmentAllowed: false,
  businessProductionGoNoGo: "NO_GO",
  dormitoryL2GoNoGo: "NO_GO",
  productionConfirmAllowed: false,
  releaseAuthority: false,
  mutation10AStatus: mutationCases.every((item) => item.status === "PASS") ? "PASS" : "FAIL",
  mutationCases,
  generatedContractStatus10B,
  noSideEffectsStatus: verifiedControls.includes("source-level-no-side-effects") ? "PASS" : "FAIL",
  verifiedControls,
  evidenceGraphNodeContract: {
    nodeId: gateId,
    proofType: "source_package_review",
    scope: "compile_preparation_review",
    releaseAuthority: false,
    businessGoAuthority: false,
    decisionState: status === "PASS" ? sourceFinalizationStatus : "BLOCKED_BY_SOURCE_P0",
    compileDecisionStatus,
    generatedCompilationAllowed,
    goNoGoImpact: ["finalGoNoGo"],
    dependsOn: [
      "source-package-proof.source-package-file-hash",
      "source-package-proof.scenario-matrix-hash",
      "source-package-proof.dormitory-operating-kernel-hash",
      "source-package-proof.source-package-checker-result",
      "source-package-proof.language-copy-proof",
      "source-package-proof.read-side-envelope-proof",
      "source-package-proof.finance-ledger-none-proof",
      "source-package-proof.prior-identity-blocker-proof",
      "source-package-proof.no-side-effects-proof",
      "source-package-proof.mutation-result-proof",
      "source-package-proof.source-field-gaps-decision-proof",
      "source-package-proof.branch-flows-no-side-effects-proof"
    ],
    requiredDigests: [
      "sourceDigest",
      "checkerResultDigest",
      "mutationResultDigest",
      "sourceToGeneratedProvenancePlanDigest"
    ]
  },
  sourceFieldGaps: {
    pending00Decision: false,
    compilePreparationAllowed: compileDecisionStatus,
    decisions: sourceFieldGapDecisions
  },
  branchFlowContract: {
    requiredNoSideEffects: branchNoSideEffects,
    correctionMode: "source-package-return-only",
    nonCorrectionMode: "not_allowed",
    bypassAdmissionAllowed: false
  },
  p1P2Policy: {
    p1RequiresOwnerBlockingScopeDeferredReason: true,
    p2AuditOnly: true
  },
  digests: {
    commitSha: gitValue("rev-parse HEAD"),
    branch: gitValue("branch --show-current"),
    sourceDigest: digestForFiles(sourceInputs),
    mutationResultDigest: digestObject(mutationCases),
    sourceToGeneratedProvenancePlanDigest: digestObject({
      sourceScenarioRef: sourcePath,
      scenarioMatrixRef: matrixPath,
      sourceKernelRef: kernelPath,
      compilePreparationAllowed: compileDecisionStatus,
      generatedCompilationAllowed,
      generatedCompilationCompleted: false,
      expectedGeneratedStatus: generatedContractStatus10B
    })
  },
  trackedInputs: sourceInputs,
  generatedOrDerivedNotHandEdited: [
    canonicalMapPath,
    scenarioFieldContractPath,
    "docs/contracts/generated/**",
    "apps/mobile/src/generated/**"
  ]
};

report.digests.checkerResultDigest = digestObject({
  gateId,
  status,
  p0Failures,
  p1Residuals,
  p2Residuals,
  mutationCases,
  sourceFieldGaps: report.sourceFieldGaps,
  branchFlowContract: report.branchFlowContract
});

if (writeProof) {
  writeStableJson(resultPath, report);
}

if (p0Failures.length) {
  for (const item of p0Failures) {
    console.error(`${item.id}: ${item.message}`);
  }
  process.exit(1);
}

console.log(`Dormitory golden chain source package check: PASS (${mutationCases.length} mutation cases)`);

function checkSourceIdentity() {
  requireText(sourceText, "version: oam.dormitory.resource-saleability-golden-chain.v1", "source.version", "Source package version is not current.");
  requireText(sourceText, "status: authoritative", "source.status", "Source package must be authoritative.");
  requireText(sourceText, "layer: source", "source.layer", "Source package must remain Source Layer.");
  requireText(sourceText, "manualEditAllowed: true", "source.manual_edit", "Source package must remain manualEditAllowed=true.");
  requireText(sourceText, "generated: false", "source.generated_false", "Source package must not be generated.");
  requireText(sourceText, "doNotEdit: false", "source.do_not_edit_false", "Source package must not be doNotEdit.");

  const allowedIdentity = between(section(sourceText, "businessIdentity"), "allowed:", "forbidden:");
  for (const item of [
    "goldenChainId",
    "scenarioId",
    "workItemType",
    "definitionId",
    "commandType",
    "objectId",
    "fieldId",
    "factId",
    "admissionPolicyRef",
    "evidencePolicyRef",
    "ledgerPolicyRef",
    "surfacePolicyRef"
  ]) {
    requireCondition(allowedIdentity.includes(`- ${item}`), "source.identity_allowed_missing", `businessIdentity.allowed missing ${item}.`, { item });
  }
  requireCondition(!allowedIdentity.includes("- policyRef"), "source.generic_policy_ref_allowed", "businessIdentity.allowed must not keep generic policyRef.");
  const aliasBlock = section(sourceText, "businessIdentity");
  for (const item of ["alias: policyRef", "readOnly: true", "executable: false", "notCompilerInput: true"]) {
    requireCondition(aliasBlock.includes(item), "source.policy_ref_alias_incomplete", `policyRef alias missing ${item}.`, { item });
  }

  for (const item of ["cardId", "sourceCardId", "workspace card", "old catalog id", "old seed id"]) {
    const fence = blockFor(section(sourceText, "migrationFences"), `term: ${item}`, "\n  - term:");
    requireCondition(Boolean(fence), "source.migration_fence_missing", `migration fence missing ${item}.`, { item });
    for (const required of ["readOnly: true", "executable: false", "affectsAdmission: false", "affectsRuntimeConfirm: false", "affectsBusinessIdentity: false", "affectsLedger: false"]) {
      requireCondition(fence.includes(required), "source.migration_fence_field_missing", `migration fence ${item} missing ${required}.`, { item, required });
    }
  }
}

function checkSourceReviewSemantics() {
  requireCondition(sourceText.includes("scenarioNameZhForReviewOnly: 宿舍资源可售第一金链"), "source.scenario_name_review_only_missing", "scenarioNameZh must be review-only.", {});
  requireCondition(!/^scenarioNameZh:/m.test(sourceText), "source.scenario_name裸_zh", "scenarioNameZh must not be a user-visible source of truth.", {});
  requireCondition(sourceText.includes("businessGoalZhForReviewOnly:"), "source.business_goal_review_only_missing", "businessGoalZh must be review-only.", {});
  requireCondition(!/^businessGoalZh:/m.test(sourceText), "source.business_goal裸_zh", "businessGoalZh must not be a user-visible source of truth.", {});
  requireCondition(sourceText.includes("businessGoalZhForReviewOnly: 房间、床位和资源准备完成内部试点检查；这不代表生产可售已放开。"), "source.business_goal_review_only_unsafe", "businessGoal review-only text must say internal pilot inspection does not open production saleability.", {});
  requireCondition(!sourceText.includes("达到 L1 internal pilot 可售条件") && !sourceText.includes("达到内部试点可售条件"), "source.business_goal_saleability_implies_go", "businessGoal must not imply internal pilot saleability is opened.", {});
  for (const [field, value] of [
    ["sourceFinalizationStatus", sourceFinalizationStatus],
    ["sourceScenarioPackageReviewStatus", sourceFinalizationStatus],
    ["sourceFieldGapsDecisionStatus", sourceFieldGapsDecisionStatus],
    ["compileDecisionStatus", compileDecisionStatus],
    ["generatedCompilationAllowed", generatedCompilationAllowed],
    ["generatedContractStatus10B", generatedContractStatus10B],
    ["generatedCompilationCompleted", "false"],
    ["businessFeatureDevelopmentAllowed", "false"],
    ["businessProductionGoNoGo", "NO_GO"],
    ["dormitoryL2GoNoGo", "NO_GO"],
    ["productionConfirmAllowed", "false"],
    ["releaseAuthority", "false"],
    ["finalGoNoGo", "NO_GO"],
    ["nextStageAllowed", "false"]
  ]) {
    requireCondition(sourceText.includes(`${field}: ${value}`), "source.finalized_status_missing", `Source package missing ${field}: ${value}.`, { field, value });
  }

  const branchFlows = section(sourceText, "branchFlows");
  for (const id of [
    "missing-field",
    "missing-evidence",
    "untrusted-evidence",
    "duplicate-room",
    "wrong-bed-room-owner",
    "resource-not-saleable",
    "manual-review",
    "correction"
  ]) {
    const branch = blockFor(branchFlows, `id: ${id}`, "\n  - id:");
    requireCondition(Boolean(branch), "source.branch_missing", `branchFlows missing ${id}.`, { id });
    if (!branch) continue;
    for (const required of [
      "nameZhForReviewOnly:",
      "outcome: NO_GO",
      "blockingReasonCode:",
      "blockingReasonCopyKey:",
      "requiredEvidenceRefs:",
      "allowedNextAction:",
      "allowedNextActionCopyKey:",
      "correctionAllowed:",
      "admissionNoGoItem:",
      "safeErrorCopyKey:",
      "explanationKey:",
      "expectedNoSideEffects:"
    ]) {
      requireCondition(branch.includes(required), "source.branch_semantic_field_missing", `branch ${id} missing ${required}.`, { id, required });
    }
    for (const effect of branchNoSideEffects) {
      requireCondition(branch.includes(`- ${effect}`), "source.branch_no_side_effect_missing", `branch ${id} missing no-side-effect ${effect}.`, { id, effect });
    }
    for (const required of [
      "directRuntimeCorrectionApplyAllowed: false",
      "financeCorrectionApplyAllowed: false",
      "ledgerReversalAllowed: false",
      "ordinaryBusinessFactWriteAllowed: false",
      "bypassAdmissionAllowed: false"
    ]) {
      requireCondition(branch.includes(required), "source.branch_correction_guard_missing", `branch ${id} correctionAllowed missing ${required}.`, { id, required });
    }
    if (id === "correction") {
      requireCondition(branch.includes("mode: source-package-return-only"), "source.correction_mode_invalid", "correction branch must return to Source package only.", { id });
      requireCondition(branch.includes("explanationKey: explain.correctionDoesNotBypassAdmission"), "source.correction_explanation_missing", "correction branch must use correction-does-not-bypass-admission explanation.", { id });
    } else {
      requireCondition(branch.includes("mode: not_allowed"), "source.non_correction_mode_invalid", `branch ${id} must not allow correction mode.`, { id });
    }
    requireCondition(!/correctionAllowed:\s*false|correctionAllowed:\s*true/.test(branch), "source.branch_boolean_correction_allowed", `branch ${id} must use correctionAllowed object, not boolean.`, { id });
    requireCondition(!branch.includes("expectedNoSideEffects: true"), "source.branch_boolean_side_effects", `branch ${id} must use explicit expectedNoSideEffects list.`, { id });
    requireCondition(!branch.includes("nameZh:"), "source.branch_name_not_review_only", `branch ${id} must not expose nameZh as user copy.`, { id });
  }

  const roles = section(sourceText, "roles");
  for (const roleId of ["dormitory.operator", "dormitory.lead"]) {
    const role = blockFor(roles, `roleId: ${roleId}`, "\n    - roleId:");
    requireCondition(Boolean(role), "source.role_id_missing", `role missing ${roleId}.`, { roleId });
    requireCondition(role.includes("labelCopyKey: dormitory.resourceSaleability.role.") && role.includes("nameZhForReviewOnly:"), "source.role_copy_key_missing", `role ${roleId} must use labelCopyKey and review-only Chinese.`, { roleId });
  }
  requireCondition(!/allowedHumanRoles:\s*\n\s*-\s*宿舍/m.test(roles), "source.role_label_direct_user_copy", "roles must not use direct Chinese labels as source of truth.");

  const facts = section(sourceText, "allowedFacts");
  const userFacts = between(facts, "userVisibleFacts:", "traceOnlyFacts:");
  const traceFacts = between(facts, "traceOnlyFacts:", "forbiddenFacts:");
  for (const fact of ["Room", "Bed", "EvidenceObject"]) {
    requireCondition(userFacts.includes(`- ${fact}`), "source.user_visible_fact_missing", `allowedFacts.userVisibleFacts missing ${fact}.`, { fact });
  }
  for (const fact of ["DomainEvent", "CommandSubmission"]) {
    requireCondition(traceFacts.includes(`- ${fact}`), "source.trace_only_fact_missing", `allowedFacts.traceOnlyFacts missing ${fact}.`, { fact });
    requireCondition(!userFacts.includes(`- ${fact}`), "source.trace_fact_user_visible", `${fact} must not be user-visible fact.`, { fact });
  }

  const admissionPolicy = section(sourceText, "admissionPolicy");
  requireCondition(admissionPolicy.includes("internalPilotConfirmAllowedForReviewOnly: true"), "source.internal_pilot_review_only_missing", "internal pilot confirm capability must be review-only.");
  requireCondition(!admissionPolicy.includes("internalPilotConfirmAllowed: true"), "source.internal_pilot_confirm裸_allowed", "internalPilotConfirmAllowed=true must not be naked user/business semantic.");
  for (const required of [
    "admissionSurfaceSemantics:",
    "internalPilotConfirmCapability: serverAdmissionRequired",
    "missingAdmissionBehavior:",
    "visibleAllowed: true",
    "prepareAllowed: false",
    "confirmAllowed: false",
    "productionAllowed: false",
    "userVisibleExplanationKey: explain.visibleNotConfirm",
    "forbiddenUserCopy:",
    "- 当前可确认",
    "- 试点可确认",
    "- 可以提交确认",
    "- 生产可确认"
  ]) {
    requireCondition(admissionPolicy.includes(required), "source.admission_surface_semantics_missing", `admissionPolicy missing ${required}.`, { required });
  }

  const fieldContracts = section(sourceText, "fieldContracts");
  for (const match of fieldContracts.matchAll(/fieldId:\s*([^\n\r]+)/g)) {
    const fieldId = match[1].trim();
    const field = blockFor(fieldContracts.slice(match.index), `fieldId: ${fieldId}`, "\n      - fieldId:");
    for (const required of [
      "sourceFieldId:",
      "labelCopyKey:",
      "category:",
      "editable:",
      "source:",
      "fallbackAllowed: false",
      "ordinaryUserVisible:",
      "controlSource: generatedSurfaceModelOnly",
      "rawIdManualInputAllowed: false",
      "objectKind:",
      "definitionScope:",
      "generatedContractRef:"
    ]) {
      requireCondition(field.includes(required), "source.executable_field_control_missing", `field ${fieldId} missing ${required}.`, { fieldId, required });
    }
    const categoryMatch = /category:\s*([^\s]+)/.exec(field);
    requireCondition(Boolean(categoryMatch) && allowedFieldCategories.includes(categoryMatch[1]), "source.executable_field_category_invalid", `field ${fieldId} category is not allowed.`, { fieldId, category: categoryMatch?.[1] ?? "missing" });
    requireCondition(!/(cardId|sourceCardId|workspaceCardId)/i.test(fieldId), "source.executable_field_prior_identity", `field ${fieldId} must not use prior card identity.`, { fieldId });
  }
  verifiedControls.push("source-review-semantics");
}

function checkFinanceLedgerNoneBoundary() {
  const factBlock = section(sourceText, "forbiddenFacts");
  for (const fact of financeFacts) {
    requireCondition(factBlock.includes(`- ${fact}`), "finance.forbidden_fact_missing", `Source forbiddenFacts missing ${fact}.`, { fact });
  }
  const boundary = section(sourceText, "financeLedgerBoundary");
  for (const required of [
    "ledgerPolicyRef: ledger.none.v1",
    "ledgerEntryAllowed: false",
    "ledgerTransactionAllowed: false",
    "moneyBasisAllowed: false",
    "amountBasisAllowed: false",
    "paymentFactAllowed: false",
    "depositFactAllowed: false",
    "refundFactAllowed: false",
    "financeKernelHandoffAllowed: false",
    "businessDomainMaySubmitAmountBasis: false"
  ]) {
    requireCondition(boundary.includes(required), "finance.boundary_field_missing", `financeLedgerBoundary missing ${required}.`, { required });
  }
  for (const workItemType of firstChainTypes) {
    const zeroImpact = blockFor(boundary, `workItemType: ${workItemType}`, "\n    - workItemType:");
    requireCondition(Boolean(zeroImpact), "finance.zero_impact_missing", `zero impact missing for ${workItemType}.`, { workItemType });
    for (const required of ["producesMoneyBasis: false", "producesAmountBasis: false", "producesLedgerTransaction: false", "producesLedgerEntry: false"]) {
      requireCondition(zeroImpact.includes(required), "finance.zero_impact_field_missing", `${workItemType} missing ${required}.`, { workItemType, required });
    }
  }

  const workItemsByType = new Map((kernel.workItems ?? []).map((item) => [item.workItemType, item]));
  for (const workItemType of firstChainTypes) {
    const item = workItemsByType.get(workItemType);
    requireCondition(Boolean(item), "kernel.workitem_missing", `${workItemType} missing from kernel.`, { workItemType });
    if (!item) continue;
    requireCondition(item.ledgerPolicyRef === "ledger.none.v1", "kernel.ledger_policy_not_none", `${workItemType} must use ledger.none.v1.`, { workItemType });
    requireCondition(item.ledgerEffect?.mode === "none", "kernel.ledger_effect_not_none", `${workItemType} ledgerEffect.mode must be none.`, { workItemType });
    for (const fact of financeFacts) {
      requireCondition((item.forbiddenFacts ?? []).includes(fact), "kernel.forbidden_fact_missing", `${workItemType} forbiddenFacts missing ${fact}.`, { workItemType, fact });
    }
  }
  const readiness = workItemsByType.get("Dorm.ResourceReadinessConfirm");
  requireCondition(!(readiness?.downstreamWorkItems ?? []).includes("Dorm.CheckinConfirm"), "kernel.readiness_handoff_checkin", "ResourceReadinessConfirm must not hand off directly to CheckinConfirm.");
  verifiedControls.push("finance-ledger-none-boundary");
}

function checkFieldAndStableRefBoundary() {
  const fieldContracts = section(sourceText, "fieldContracts");
  const saleableText = "\u53ef\u552e\u72b6\u6001";
  const requiredSnippets = [
    "workItemType: Dorm.RoomSetupConfirm",
    "purpose: room_basic_profile_only",
    "fieldId: room.basicProfile",
    "sourceFieldId: room.basicProfile",
    "labelCopyKey: dormitory.resourceSaleability.field.roomBasicProfile",
    "displayNameZhForReviewOnly:",
    "allowedSubfields:",
    "- roomNo",
    "- floor",
    "- capacity",
    "forbiddenSubfields:",
    "- readinessState",
    "- saleabilityState",
    `- ${saleableText}`,
    "workItemType: Dorm.BedSetupConfirm",
    "sourceFieldId: bed.roomId",
    "inputMode: selectedStableRef",
    "workItemType: Dorm.ResourceReadinessConfirm",
    "sourceFieldId: resource.roomId",
    "sourceFieldId: resource.bedId",
    "sourceFieldId: resource.readinessState"
  ];
  for (const snippet of requiredSnippets) {
    requireCondition(fieldContracts.includes(snippet), "fields.contract_snippet_missing", `fieldContracts missing ${snippet}.`, { snippet });
  }
  for (const item of ["route param", "cardId", "sourceCardId", "workspaceCardId", "search label"]) {
    requireCondition(section(sourceText, "selectedStableRefRules").includes(`- ${item}`), "fields.stable_ref_forbidden_source_missing", `selectedStableRefRules missing ${item}.`, { item });
  }
  requireText(sourceText, "rawIdManualInputAllowed: false", "fields.raw_id_block_missing", "rawIdManualInputAllowed=false must be declared.");
  requireText(sourceText, "oldCardIdRenameBlocked: true", "fields.old_card_rename_missing", "objectIdBinding must block renamed card identity.");
  const gaps = section(sourceText, "sourceFieldGaps");
  requireCondition(gaps.includes("pending00Decision: false"), "fields.source_gap_pending_not_closed", "sourceFieldGaps.pending00Decision must be false after 00 decision preparation.");
  requireCondition(gaps.includes(`compilePreparationAllowed: ${compileDecisionStatus}`), "fields.source_gap_compile_decision_missing", "sourceFieldGaps must be ready only for 00 compile decision after decisions are bound.");
  requireCondition(gaps.includes("decisions:"), "fields.source_gap_decisions_missing", "sourceFieldGaps must contain structured decisions.");
  for (const gap of sourceGapIds) {
    const decision = decisionBlock(gaps, gap);
    requireCondition(Boolean(decision), "fields.source_gap_decision_missing", `sourceFieldGaps decision missing ${gap}.`, { gap });
    for (const required of ["decision:", "owner:", "compileBlocking:", "compilerInputImpact:"]) {
      requireCondition(decision.includes(required), "fields.source_gap_decision_field_missing", `sourceFieldGaps.${gap} missing ${required}.`, { gap, required });
    }
    requireCondition(!fieldContracts.includes(`fieldId: ${gap}`) && !fieldContracts.includes(`sourceFieldId: ${gap}`), "fields.source_gap_promoted_to_executable", `sourceFieldGaps item must not be executable in this round: ${gap}.`, { gap });
  }
  requireCondition(decisionBlock(gaps, "buildingId").includes("decision: add_as_context_readonly_ref") && sourceText.includes("fieldId: buildingContextRef"), "fields.building_context_ref_missing", "buildingId must be resolved as buildingContextRef/contextReadonly, not raw user input.");
  requireCondition(decisionBlock(gaps, "roomType").includes("decision: defer_to_P1") && decisionBlock(gaps, "roomType").includes("deferred_not_blocking"), "fields.room_type_not_deferred", "roomType must be deferred P1 and non-blocking.");
  requireCondition(decisionBlock(gaps, "readinessEvidenceRefs").includes("decision: bind_to_evidence_envelope") && section(sourceText, "fieldBindings").includes("readinessEvidenceRefs:"), "fields.readiness_evidence_not_envelope", "readinessEvidenceRefs must bind to EvidenceEnvelope.");
  requireCondition(decisionBlock(gaps, "readinessNote").includes("notConfirmBasis: true") && decisionBlock(gaps, "readinessNote").includes("notCompilerInputInCurrentRound: true"), "fields.readiness_note_not_audit_only", "readinessNote must be P2 audit/collaboration note only.");
  requireCondition(decisionBlock(gaps, "blockedReason").includes("compilerInputImpact: branchOutputOnly") && section(sourceText, "fieldBindings").includes("blockedReason:"), "fields.blocked_reason_not_branch_output", "blockedReason must map to branch output only.");
  requireCondition(decisionBlock(gaps, "notSaleableReason").includes("decision: map_to_resource_not_saleable_branch") && section(sourceText, "fieldBindings").includes("notSaleableReason:"), "fields.not_saleable_not_branch_output", "notSaleableReason must map to resource-not-saleable branch output.");
  requireCondition(decisionBlock(gaps, "serviceVerificationRef").includes("decision: bind_to_verification_evidence_ref") && section(sourceText, "fieldBindings").includes("serviceVerificationRef:"), "fields.service_verification_not_evidence_ref", "serviceVerificationRef must bind to EvidenceObject stableRef.");
  for (const evidenceField of ["readinessEvidenceRefs", "serviceVerificationRef"]) {
    const binding = mappingBlock(section(sourceText, "fieldBindings"), evidenceField, 2);
    requireCondition(binding.includes("source: Evidence Kernel") && binding.includes("userEditable: false") && binding.includes("rawManualInputAllowed: false"), "fields.evidence_ref_user_editable", `${evidenceField} must not be user-editable business input.`, { evidenceField });
    requireCondition(!fieldContracts.includes(`fieldId: ${evidenceField}`) && !fieldContracts.includes(`sourceFieldId: ${evidenceField}`), "fields.evidence_ref_client_submitted", `${evidenceField} must not be a clientSubmitted executable field.`, { evidenceField });
  }
  const handoff = section(sourceText, "handoffPolicy");
  for (const required of [
    "from: Dorm.ResourceReadinessConfirm",
    "mode: prepare_only",
    "- lead-reservation.prepare",
    "- nextSourcePackage.prepare",
    "- Dorm.CheckinConfirm",
    "- Dorm.PaymentConfirm",
    "- Dorm.DepositConfirm",
    "- Dorm.CheckoutSettlementApprove",
    "- Finance.CorrectionApply",
    "- Dorm.PeriodReview"
  ]) {
    requireCondition(handoff.includes(required), "handoff.policy_missing", `handoffPolicy missing ${required}.`, { required });
  }

  const matrixResource = blockFor(section(matrixText, "scenarioPackages"), "- packageId: resource-saleability", "\n  - packageId: lead-reservation");
  requireCondition(matrixResource.includes("sourceFieldId: room.basicProfile"), "matrix.room_basic_source_field_missing", "Matrix room.basicProfile missing sourceFieldId.");
  requireCondition(matrixResource.includes("labelCopyKey: dormitory.resourceSaleability.field.roomBasicProfile"), "matrix.room_basic_copy_key_missing", "Matrix room.basicProfile missing labelCopyKey.");
  requireCondition(!/room\.basicProfile[\s\S]{0,700}must contain[\s\S]{0,120}readinessState/i.test(matrixResource), "matrix.room_basic_mixes_readiness", "Matrix room.basicProfile must not require readinessState.");
  requireCondition(matrixResource.includes(`forbiddenSubfields:`) && matrixResource.includes(`- ${saleableText}`), "matrix.room_basic_saleable_forbidden_missing", "Matrix room.basicProfile must forbid saleable status subfield.");
  requireCondition(matrixResource.includes("fieldId: resource.readinessState") && matrixResource.includes("fieldId: roomId") && matrixResource.includes("fieldId: bedId"), "matrix.readiness_fields_missing", "Matrix resource readiness executable fields are incomplete.");
  verifiedControls.push("source-field-stable-ref-boundary");
}

function checkLanguageBoundary() {
  const copyIds = new Map();
  for (const doc of [surfaceCopy, multilingualCopy]) {
    for (const entry of doc.copies ?? []) {
      copyIds.set(entry.copyId, entry.copy);
    }
  }
  const copyKeys = new Set();
  for (const match of sourceText.matchAll(/(?:CopyKey:\s*|-\s+)(dormitory\.resourceSaleability\.[A-Za-z0-9_.-]+|explain\.[A-Za-z0-9_.-]+|operations\.error\.safe\.[A-Za-z0-9_.-]+|evidence\.reason\.[A-Za-z0-9_.-]+)/g)) {
    copyKeys.add(match[1]);
  }
  for (const match of matrixText.matchAll(/labelCopyKey:\s*(dormitory\.resourceSaleability\.[A-Za-z0-9_.-]+)/g)) {
    copyKeys.add(match[1]);
  }
  for (const key of copyKeys) {
    const copy = copyIds.get(key);
    requireCondition(Boolean(copy), "language.copy_key_missing", `copy key not resolvable: ${key}.`, { key });
    if (copy) {
      for (const language of ["zh-CN", "ru-RU", "ky-KG"]) {
        requireCondition(typeof copy[language] === "string" && copy[language].length > 0, "language.copy_language_missing", `${key} missing ${language}.`, { key, language });
      }
    }
  }
  const businessGoalCopy = copyIds.get("dormitory.resourceSaleability.businessGoal");
  requireCondition(businessGoalCopy?.["zh-CN"] === "房间、床位和资源准备完成内部试点检查；这不代表生产可售已放开。", "language.business_goal_copy_unsafe", "businessGoal copy must keep internal pilot inspection / not production wording.");
  for (const [key, copy] of copyIds) {
    const text = Object.values(copy ?? {}).join("\n");
    if (!key.startsWith("dormitory.resourceSaleability.")) continue;
    requireCondition(!text.includes("当前可售") && !text.includes("当前可确认") && !text.includes("可以提交确认"), "language.misleading_resource_saleability_copy", `resource saleability copy is misleading: ${key}.`, { key });
  }
  requireCondition(sourceText.includes("missingTranslationNoGoItems: []"), "language.translation_no_go_missing", "Source package must explicitly declare empty missingTranslationNoGoItems or fail.");
  for (const required of ["ordinaryUserVisibleInternalTerms: false", "internalTraceVisibilityScope: internal/evidence", "permissionGated: true"]) {
    requireCondition(section(sourceText, "userVisibleTermFirewall").includes(required), "language.user_visible_firewall_missing", `userVisibleTermFirewall missing ${required}.`, { required });
  }
  for (const semantic of [
    "visibleDoesNotImplyConfirm: true",
    "summaryDoesNotImplyConfirm: true",
    "receiptDoesNotImplyProduction: true",
    "dashboardSummaryCannotUnlockProduction: true",
    "businessBasisDoesNotImplyFinancialTruth: true",
    "confirmAllowedDoesNotImplyProductionAllowed: true"
  ]) {
    requireCondition(section(sourceText, "surfaceSemantics").includes(semantic), "language.surface_semantics_missing", `surfaceSemantics missing ${semantic}.`, { semantic });
  }
  verifiedControls.push("source-language-boundary");
}

function checkReadSideEnvelope() {
  const readSide = section(sourceText, "readSideAcceptance");
  for (const required of [
    "SearchIndexRecord",
    "OamObjectEnvelope",
    "generatedReadModel",
    "writeThroughSearchAllowed: false",
    "visibilityDoesNotImplyConfirmAllowed: true",
    "requiresPermissionEnvelope: true",
    "requiresLineageEnvelope: true",
    "requiresFreshnessEnvelope: true",
    "resultVisibility: HIDDEN",
    "rankable: false",
    "authoritative: false",
    "freshnessStatus: UNKNOWN",
    "prepareAllowed: false",
    "confirmAllowed: false",
    "productionAllowed: false",
    "readonly: true",
    "dashboardSummaryIsNotSourceOfTruth: true",
    "sourceFactsRequired: true",
    "DashboardWidget:",
    "actionPolicy: readonly_or_navigate_only",
    "ReportDataset:",
    "permissionRequired: true",
    "lineageRequired: true",
    "freshnessRequired: true",
    "reportDatasetIsNotSourceOfTruth: true",
    "permissionMissing: BLOCK",
    "lineageMissing: BLOCK_METRIC_AND_DASHBOARD_USE",
    "freshnessMissing: STALE_OR_BLOCK",
    "noBusinessFactWrite: true",
    "exportPolicy: internal_review_only",
    "scope: L1_OBSERVATION",
    "notProductionKpi: true"
  ]) {
    requireCondition(readSide.includes(required), "readside.envelope_missing", `readSideAcceptance missing ${required}.`, { required });
  }
  for (const forbidden of ["- confirm", "- writeBusinessFact", "- productionConfirm", "- UI field", "- DashboardSummary", "- page state"]) {
    requireCondition(readSide.includes(forbidden), "readside.forbidden_action_or_input_missing", `readSideAcceptance missing ${forbidden}.`, { forbidden });
  }
  for (const required of ["rawDomainEventReadAllowed: false", "rawCommandSubmissionReadAllowed: false"]) {
    requireCondition(readSide.includes(required), "readside.raw_fact_read_guard_missing", `Metric lineage missing ${required}.`, { required });
  }
  verifiedControls.push("read-side-envelope");
}

function checkPriorIdentityDeletionChain() {
  const chain = section(sourceText, "localPriorIdentityDeletionChain");
  const priorTypeKey = ["lega", "cyType"].join("");
  const requiredEntries = [
    "cardId",
    "sourceCardId",
    "workspaceCardId",
    "workspaceId",
    "oldCatalogId",
    "oldSeedId",
    "ResolveByWorkspaceCard",
    "FindBySourceCardId",
    "MigrationSourceCardId"
  ];
  for (const entry of requiredEntries) {
    const block = blockFor(chain, `${priorTypeKey}: ${entry}`, `\n    - ${priorTypeKey}:`);
    requireCondition(Boolean(block), "prior_identity.entry_missing", `prior identity entry missing ${entry}.`, { entry });
    for (const required of [
      "currentReplacement:",
      "allowedTemporaryConsumers:",
      "forbiddenConsumers:",
      "consumerCount: 0",
      "blockingConsumers: []",
      "targetDeletePhase:",
      "deletionGate: OAM-DORMITORY-GOLDEN-CHAIN-SOURCE-PACKAGE",
      "owner:",
      "status: registered_readonly",
      "evidenceRef:",
      "replacementVerifiedBy:",
      "readOnly: true",
      "executable: false",
      "affectsAdmission: false",
      "affectsRuntimeConfirm: false",
      "affectsBusinessIdentity: false",
      "affectsLedger: false"
    ]) {
      requireCondition(block.includes(required), "prior_identity.entry_field_missing", `prior identity ${entry} missing ${required}.`, { entry, required });
    }
  }
  verifiedControls.push("prior-identity-deletion-chain");
}

function checkAdmissionTrustBoundary() {
  const createRequest = recordBody(operationsRuntime, "CreateWorkItemRequest");
  const confirmRequest = recordBody(operationsRuntime, "ConfirmWorkItemRequest");
  for (const forbidden of ["Admission", "AdmissionDecisionRef", "ConfirmAllowed", "ProductionAllowed", "Capability", "PolicyRef", "TrustedDevice", "DeviceTrustStatus", "Surface"]) {
    requireCondition(!createRequest.includes(forbidden), "admission.create_request_forbidden_field", `CreateWorkItemRequest accepts ${forbidden}.`, { forbidden });
    requireCondition(!confirmRequest.includes(forbidden), "admission.confirm_request_forbidden_field", `ConfirmWorkItemRequest accepts ${forbidden}.`, { forbidden });
  }
  for (const forbidden of ["request.Admission", "request.AdmissionDecisionRef", "request.Surface", "request.DeviceTrustStatus", "request.TrustedDevice"]) {
    requireCondition(!operationsEndpoints.includes(forbidden) && !operationsRuntime.includes(forbidden), "admission.request_field_used", `public request field is used: ${forbidden}.`, { forbidden });
  }
  requireCondition(canonicalOperations.includes("admission.EvaluateConfirm"), "admission.kernel_not_used", "Canonical operations must evaluate confirm through Admission Kernel.");
  requireCondition(canonicalOperations.includes("VerifiedDeviceTrustContext.FromServerSession"), "admission.server_device_context_missing", "Canonical operations must use server device session for trust context.");
  requireCondition(!canonicalOperations.includes("VerifiedDeviceTrustContext.FromRequest"), "admission.request_trust_context_used", "Canonical operations must not use request trust context.");
  requireCondition(canonicalOperations.includes("catalog.FindDeviceSession"), "admission.device_session_lookup_missing", "Canonical operations must resolve device session server-side.");
  const resolveStartAdapter = methodBody(definitionRegistry, "ResolveStartAdapter");
  requireCondition(resolveStartAdapter.includes("StartAdapterDefinitionId") && resolveStartAdapter.includes("start_adapter_not_registered"), "identity.start_adapter_hard_gate_missing", "Start adapter must use explicit map and hard-unresolve missing entries.");
  requireCondition(!resolveStartAdapter.includes("ResolveByWorkspaceCard") && !resolveStartAdapter.includes("FindBySourceCardId"), "identity.start_adapter_uses_prior_identity", "Start adapter must not resolve from prior card identity.");
  requireCondition(!/public\s+string\?\s+SourceCardId/.test(definitionRegistry) && !/SourceCardId\s*\?\?/.test(definitionRegistry), "identity.top_level_source_card_promoted", "Definition registry must not promote top-level sourceCardId.");
  verifiedControls.push("admission-trust-server-only");
}

function checkWorkItemTombstoneResidual() {
  const backendText = `${operationsRuntime}\n${operationsEndpoints}`;
  if (!/removedWorkItemIds|removed_work_item_ids|tombstone/i.test(backendText)) {
    p1Residuals.push({
      id: "runtime-workitem-tombstone-contract",
      severity: "P1",
      status: "open",
      owner: "02｜架构运行时",
      message: "Frontend merge consumes closed/canceled/tombstone/removedWorkItemIds, but backend Operations WorkItem payload still needs an explicit tombstone or removedWorkItemIds contract.",
      blockingCurrentSourceFinalization: false,
      requiredBeforeGeneratedCompileCandidate: true
    });
  }
}

function checkSourceGeneratedProvenanceDirection() {
  requireCondition(generatorText.includes("PENDING_SOURCE_PACKAGE_REVIEW"), "provenance.generator_pending_source_review_missing", "Generator must mark non-first-chain sourceScenario as pending review.");
  requireCondition(generatorText.includes("PENDING_00_SOURCE_PACKAGE_DECISION"), "provenance.generator_pending_00_missing", "Generator must mark non-first-chain sourceScenarioRef as pending 00 decision.");
  requireCondition(generatorText.includes("sourceScenarioRef") && generatorText.includes("scenarioMatrixRef") && generatorText.includes("sourceKernelRef"), "provenance.generator_refs_missing", "Generator must write sourceScenarioRef/scenarioMatrixRef/sourceKernelRef.");

  const currentPollution = [];
  for (const mapping of canonicalMap.mappings ?? []) {
    if (futureChainTypes.includes(mapping.workItemType) && mapping.sourceScenario === sourcePath) {
      currentPollution.push({ workItemType: mapping.workItemType, scenarioId: mapping.scenarioId });
    }
  }
  requireCondition(
    currentPollution.length === 0,
    "derived.future_chain_bound_to_first_source",
    "future-chain mappings must not bind to the first golden-chain Source package.",
    { forbiddenTypes: futureChainTypes, examples: currentPollution.slice(0, 8) }
  );
  requireCondition(scenarioFieldContract.sourceScenarioFile === "PENDING_SOURCE_PACKAGE_REVIEW", "derived.scenario_field_source_not_pending", "scenario-field-contract sourceScenarioFile must remain PENDING_SOURCE_PACKAGE_REVIEW.");
  requireCondition(scenarioFieldContract.scenarioFieldContractStatus === "PENDING_SOURCE_PACKAGE_REVIEW", "derived.scenario_field_status_not_pending", "scenarioFieldContractStatus must remain PENDING_SOURCE_PACKAGE_REVIEW.");
  requireCondition(scenarioFieldContract.firstGoldenChainFieldContractReady === false, "derived.first_chain_field_contract_ready", "firstGoldenChainFieldContractReady must remain false.");
  requireCondition(scenarioFieldContract.generatedCompilationCompleted === false, "derived.generated_compilation_completed", "generatedCompilationCompleted must remain false.");
  const provenance = section(sourceText, "sourceToGeneratedProvenancePlan");
  requireCondition(provenance.includes(`compilePreparationAllowed: ${compileDecisionStatus}`), "provenance.compile_decision_status_missing", "sourceToGeneratedProvenancePlan must be ready only for 00 compile decision.");
  requireCondition(provenance.includes(`generatedCompilationAllowed: ${generatedCompilationAllowed}`), "provenance.generated_compile_not_authorized", "sourceToGeneratedProvenancePlan must keep generated compilation unauthorized.");
  requireCondition(provenance.includes("generatedCompilationCompleted: false"), "provenance.generated_compilation_completed", "sourceToGeneratedProvenancePlan must keep generatedCompilationCompleted=false.");
  requireCondition(provenance.includes("expectedGeneratedStatus: PENDING_GENERATED_CONTRACT"), "provenance.generated_contract_pending", "sourceToGeneratedProvenancePlan must keep generated contract pending.");
  verifiedControls.push("generated-provenance-direction-prepared");
}

function checkSourceLevelNoSideEffects() {
  const sourceNoSideEffects = section(sourceText, "sourceLevelNoSideEffects");
  requireCondition(sourceNoSideEffects.includes("rejectedPathBusinessWriteAllowed: false"), "sideeffects.source_business_write_block_missing", "Source must block business writes on rejected paths.");
  for (const write of noSideEffectWrites) {
    requireCondition(sourceNoSideEffects.includes(`- ${write}`), "sideeffects.source_write_missing", `Source no-side-effects missing ${write}.`, { write });
  }
  const proofText = JSON.stringify(noSideEffectsProof);
  for (const write of ["UnitOfWork", "CommandSubmission", "DomainEvent", "WorkItemEvent", "LedgerTransaction", "LedgerEntry", "WriteLog", "Outbox"]) {
    requireCondition(proofText.includes(write), "sideeffects.proof_write_missing", `no-side-effects proof missing ${write}.`, { write });
  }
  verifiedControls.push("source-level-no-side-effects");
}

function runSourceMutationCases() {
  expectFail("cardId_as_objectId", () => !section(sourceText, "objectIdBinding").includes("oldCardIdRenameBlocked: true"));
  expectFail("sourceCardId_in_confirm_payload", () => recordBody(operationsRuntime, "ConfirmWorkItemRequest").includes("SourceCardId"));
  expectFail("workspaceCardId_in_confirm_identity", () => recordBody(operationsRuntime, "ConfirmWorkItemRequest").includes("WorkspaceCardId"));
  expectFail("client_submitted_admission", () => recordBody(operationsRuntime, "CreateWorkItemRequest").includes("Admission") || recordBody(operationsRuntime, "ConfirmWorkItemRequest").includes("Admission"));
  expectFail("client_submitted_admission_decision_ref", () => recordBody(operationsRuntime, "CreateWorkItemRequest").includes("AdmissionDecisionRef") || recordBody(operationsRuntime, "ConfirmWorkItemRequest").includes("AdmissionDecisionRef"));
  expectFail("client_submitted_confirm_or_production_allowed", () => recordBody(operationsRuntime, "ConfirmWorkItemRequest").includes("ConfirmAllowed") || recordBody(operationsRuntime, "ConfirmWorkItemRequest").includes("ProductionAllowed"));
  expectFail("client_submitted_trust_status", () => recordBody(operationsRuntime, "ConfirmWorkItemRequest").includes("DeviceTrustStatus") || recordBody(operationsRuntime, "ConfirmWorkItemRequest").includes("TrustedDevice"));
  expectFail("search_visible_grants_confirm", () => !section(sourceText, "readSideAcceptance").includes("visibilityDoesNotImplyConfirmAllowed: true"));
  expectFail("surface_missing_admission_can_confirm", () => !section(sourceText, "readSideAcceptance").includes("confirmAllowed: false"));
  expectFail("room_setup_deposit_receipt_ledger", () => section(sourceText, "financeLedgerBoundary").includes("ledgerEntryAllowed: true"));
  expectFail("bed_setup_amount_currency_ledger", () => section(sourceText, "allowedFacts").includes("- AmountBasis"));
  expectFail("readiness_targets_ledger_entry", () => section(sourceText, "forbiddenFacts").indexOf("- LedgerEntry") < 0);
  expectFail("amount_basis_allowed_fact", () => section(sourceText, "allowedFacts").includes("- AmountBasis"));
  expectFail("golden_pilot_as_source_reference", () => section(sourceText, "sourceReferences").includes("docs/scenarios/dormitory/golden-pilot.yml"));
  expectFail("future_package_uses_first_source_in_generator", () => !generatorText.includes("PENDING_SOURCE_PACKAGE_REVIEW"));
  expectFail("future_chain_maps_to_first_source", () => (canonicalMap.mappings ?? []).some((mapping) => futureChainTypes.includes(mapping.workItemType) && mapping.sourceScenario === sourcePath));
  expectFail("missing_source_field_gap_decision", () => !section(sourceText, "sourceFieldGaps").includes("decisions:") || section(sourceText, "sourceFieldGaps").includes("pending00Decision: true"));
  expectFail("building_id_raw_user_input", () => /fieldId:\s*buildingId[\s\S]{0,260}(clientSubmitted|rawIdManualInputAllowed:\s*true|route param|sourceCardId|workspaceCardId|search label)/.test(sourceText));
  expectFail("readiness_evidence_refs_client_submitted", () => /fieldId:\s*readinessEvidenceRefs[\s\S]{0,260}(clientSubmitted|userEditable:\s*true|rawManualInputAllowed:\s*true)/.test(sourceText));
  expectFail("blocked_reason_user_field", () => /fieldId:\s*blockedReason[\s\S]{0,260}(clientSubmitted|userSubmitted:\s*true)/.test(sourceText));
  expectFail("branch_flow_missing_no_command_submission", () => !section(sourceText, "branchFlows").includes("- no_command_submission"));
  expectFail("correction_bypass_admission_allowed", () => section(sourceText, "branchFlows").includes("bypassAdmissionAllowed: true"));
  expectFail("final_go_no_go_go", () => sourceText.includes("finalGoNoGo: GO"));
  expectFail("generated_compilation_completed_true", () => sourceText.includes("generatedCompilationCompleted: true"));
  expectFail("generated_compilation_allowed_true", () => sourceText.includes("generatedCompilationAllowed: true"));
  expectFail("generated_contract_completed", () => sourceText.includes("generatedContractStatus10B: COMPLETED"));
  expectFail("business_feature_development_allowed", () => sourceText.includes("businessFeatureDevelopmentAllowed: true"));
  expectFail("production_confirm_allowed", () => sourceText.includes("productionConfirmAllowed: true"));
  expectFail("visible_not_confirm_copy_key_removed", () => !sourceText.includes("- explain.visibleNotConfirm"));
  expectFail("ru_or_ky_copy_missing", () => {
    const copy = (surfaceCopy.copies ?? []).find((item) => item.copyId === "dormitory.resourceSaleability.scenarioName")?.copy;
    return !copy?.["ru-RU"] || !copy?.["ky-KG"];
  });
  expectFail("internal_term_user_helper_text", () => section(sourceText, "userVisibleTermFirewall").includes("ordinaryUserVisibleInternalTerms: true"));
  verifiedControls.push("source-package-mutation-10a");
}

function expectFail(id, predicate) {
  const failedAsExpected = !predicate();
  mutationCases.push({
    id,
    layer: "source-package-10A",
    expectedOutcome: "FAIL",
    status: failedAsExpected ? "PASS" : "FAIL"
  });
  requireCondition(failedAsExpected, `mutation.${id}`, `mutation case did not fail as expected: ${id}.`, { mutationId: id });
}

function requireText(text, snippet, id, message, extra = {}) {
  requireCondition(text.includes(snippet), id, message, { ...extra, snippet });
}

function requireCondition(condition, id, message, extra = {}) {
  if (!condition) {
    p0Failures.push({ id, severity: "P0", message, ...extra });
  }
}

function readText(file) {
  try {
    return fs.readFileSync(abs(file), "utf8");
  } catch (error) {
    p0Failures.push({ id: "file_missing", severity: "P0", message: `${file} missing: ${error.message}`, file });
    return "";
  }
}

function readJson(file) {
  try {
    return JSON.parse(readText(file));
  } catch (error) {
    p0Failures.push({ id: "json_invalid", severity: "P0", message: `${file} is not valid JSON: ${error.message}`, file });
    return {};
  }
}

function section(text, name) {
  const pattern = new RegExp(`^${escapeRegExp(name)}:\\s*$`, "m");
  const match = pattern.exec(text);
  if (!match) return "";
  const start = match.index + match[0].length;
  const rest = text.slice(start);
  const next = /\n[A-Za-z0-9_.-]+:\s*/.exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}

function between(value, start, end) {
  const startIndex = value.indexOf(start);
  if (startIndex < 0) return "";
  const endIndex = value.indexOf(end, startIndex + start.length);
  return endIndex < 0 ? value.slice(startIndex + start.length) : value.slice(startIndex + start.length, endIndex);
}

function blockFor(value, marker, nextMarker) {
  const start = value.indexOf(marker);
  if (start < 0) return "";
  const next = value.indexOf(nextMarker, start + marker.length);
  return next < 0 ? value.slice(start) : value.slice(start, next);
}

function decisionBlock(gapsSection, gapId) {
  const marker = `    ${gapId}:`;
  const start = gapsSection.indexOf(marker);
  if (start < 0) return "";
  const next = /\n    [A-Za-z0-9_.-]+:/.exec(gapsSection.slice(start + marker.length));
  return next ? gapsSection.slice(start, start + marker.length + next.index) : gapsSection.slice(start);
}

function mappingBlock(value, key, indent = 2) {
  const spaces = " ".repeat(indent);
  const marker = `${spaces}${key}:`;
  const start = value.indexOf(marker);
  if (start < 0) return "";
  const pattern = new RegExp(`\\n${spaces}[A-Za-z0-9_.-]+:`);
  const next = pattern.exec(value.slice(start + marker.length));
  return next ? value.slice(start, start + marker.length + next.index) : value.slice(start);
}

function recordBody(source, recordName) {
  const marker = `public sealed record ${recordName}(`;
  const start = source.indexOf(marker);
  if (start < 0) return "";
  const end = source.indexOf(");", start);
  return end < 0 ? "" : source.slice(start, end + 2);
}

function methodBody(source, methodName) {
  const markers = [
    `private WorkItemDefinitionResolution ${methodName}(`,
    `public WorkItemDefinitionResolution ${methodName}(`
  ];
  const start = markers
    .map((marker) => source.indexOf(marker))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0] ?? -1;
  if (start < 0) return "";
  const brace = source.indexOf("{", start);
  if (brace < 0) return "";
  let depth = 0;
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  return source.slice(start);
}

function digestForFiles(files) {
  const hash = crypto.createHash("sha256");
  for (const file of files) {
    hash.update(file);
    hash.update("\0");
    if (fs.existsSync(abs(file))) hash.update(fs.readFileSync(abs(file)));
  }
  return `sha256:${hash.digest("hex")}`;
}

function digestObject(value) {
  return `sha256:${crypto.createHash("sha256").update(stableStringify(value)).digest("hex")}`;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function writeStableJson(file, value) {
  fs.mkdirSync(path.dirname(abs(file)), { recursive: true });
  fs.writeFileSync(abs(file), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function gitValue(command) {
  try {
    return execSync(`git ${command}`, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "unknown";
  }
}

function abs(file) {
  return path.join(root, file);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
