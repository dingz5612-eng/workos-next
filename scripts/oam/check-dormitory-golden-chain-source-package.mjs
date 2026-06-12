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
checkFinanceLedgerNoneBoundary();
checkFieldAndStableRefBoundary();
checkLanguageBoundary();
checkReadSideEnvelope();
checkPriorIdentityDeletionChain();
checkAdmissionTrustBoundary();
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
  sourceScenarioPackageReviewStatus: status === "PASS" ? "READY_FOR_00_FINAL_REVIEW" : "CONDITIONAL_NO_PASS",
  compilePreparationDecision: "PENDING_00_DECISION",
  compilePreparationAllowed: "false_until_00_approval",
  businessFeatureDevelopmentAllowed: false,
  businessProductionGoNoGo: "NO_GO",
  dormitoryL2GoNoGo: "NO_GO",
  productionConfirmAllowed: false,
  mutation10AStatus: mutationCases.every((item) => item.status === "PASS") ? "PASS" : "FAIL",
  mutationCases,
  generatedContractStatus10B: "PENDING_GENERATED_CONTRACT",
  noSideEffectsStatus: verifiedControls.includes("source-level-no-side-effects") ? "PASS" : "FAIL",
  verifiedControls,
  evidenceGraphNodeContract: {
    nodeId: gateId,
    proofType: "source_package_review",
    scope: "compile_preparation_review",
    releaseAuthority: false,
    businessGoAuthority: false,
    decisionState: status === "PASS" ? "READY_FOR_GENERATOR" : "BLOCKED_BY_SOURCE_P0",
    goNoGoImpact: ["finalGoNoGo"],
    dependsOn: [
      sourcePath,
      matrixPath,
      kernelPath,
      resultPath,
      noSideEffectsProofPath
    ],
    requiredDigests: [
      "sourceDigest",
      "checkerResultDigest",
      "mutationResultDigest",
      "sourceToGeneratedProvenancePlanDigest"
    ]
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
      expectedGeneratedStatus: "PENDING_GENERATED_CONTRACT"
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
  mutationCases
});

writeStableJson(resultPath, report);

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
  for (const gap of ["buildingId", "roomType", "readinessEvidenceRefs", "readinessNote", "blockedReason", "notSaleableReason", "serviceVerificationRef"]) {
    requireCondition(gaps.includes(`- ${gap}`), "fields.source_gap_missing", `sourceFieldGaps missing ${gap}.`, { gap });
  }
  requireCondition(gaps.includes("pending00Decision: true") && gaps.includes("compilePreparationAllowed: false_until_00_approval"), "fields.source_gap_decision_missing", "sourceFieldGaps must remain pending 00 decision.");

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
  for (const match of sourceText.matchAll(/(?:CopyKey:\s*|-\s+)(dormitory\.resourceSaleability\.[A-Za-z0-9_.-]+|explain\.[A-Za-z0-9_.-]+)/g)) {
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
    "scope: L1_OBSERVATION",
    "notProductionKpi: true"
  ]) {
    requireCondition(readSide.includes(required), "readside.envelope_missing", `readSideAcceptance missing ${required}.`, { required });
  }
  for (const forbidden of ["- confirm", "- writeBusinessFact", "- productionConfirm", "- UI field", "- DashboardSummary", "- page state"]) {
    requireCondition(readSide.includes(forbidden), "readside.forbidden_action_or_input_missing", `readSideAcceptance missing ${forbidden}.`, { forbidden });
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
  if (currentPollution.length) {
    p1Residuals.push({
      id: "derived.current_canonical_map_pending_regeneration",
      owner: "06-quality-evidence + 00-oam-control",
      blockingScope: "derived canonical-scenario-map current file",
      deferredReason: "Generator has been prepared, but this round does not perform formal generated contract compilation.",
      status: "PENDING_GENERATED_CONTRACT",
      examples: currentPollution.slice(0, 8)
    });
  }
  if (scenarioFieldContract.sourceScenarioFile === "docs/scenarios/dormitory/golden-pilot.yml") {
    p1Residuals.push({
      id: "derived.scenario_field_contract_pending_regeneration",
      owner: "06-quality-evidence + 00-oam-control",
      blockingScope: "derived scenario-field-contract current file",
      deferredReason: "Source package review prepares generator input only; derived contract regeneration is deferred to compiler-preparation decision.",
      status: "PENDING_GENERATED_CONTRACT"
    });
  }
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
