import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const DORMITORY_SOURCE_SCENARIO_PATH =
  "docs/business/domains/dormitory/scenarios/dormitory-resource-saleability.golden-chain.yml";
export const DORMITORY_KERNEL_PATH = "docs/business/domains/dormitory/dormitory-operating-kernel.json";
export const GENERATED_COMPILE_APPROVAL_PATH = "docs/oam/generated-compile-approval.current.json";
export const GENERATED_COMPILE_CANDIDATE_APPROVAL_PATH = "docs/oam/generated-compile-candidate-approval.current.json";
export const FIELD_BINDINGS_GENERATED_PATH = "docs/contracts/generated/dormitory/field-bindings.generated.json";
export const FIELD_BINDING_CLOSURE_RESULT_PATH =
  "artifacts/oam/checks/generated-field-binding-closure-result.json";
export const CANONICAL_CLOSURE_VERSION = "oam.dormitory-source-semantic-closure.v1";
export const SOURCE_FIELD_GAPS_DECISION_VERSION = "oam.dormitory.source-field-gaps-decision.semantic.v1";

export const REQUIRED_GENERATED_FIELD_BINDINGS = [
  {
    fieldId: "buildingContextRef",
    sourceGapId: "buildingId",
    expectedDecision: "add_as_context_readonly_ref",
    expectedCompilerInputImpact: "contextReadonly_ref_required",
    classification: "contextReadonly",
    bindingType: "contextReadonly",
    source: "Source Layer context",
    stableRef: "dormitorySiteRef",
    semanticRole: "building_context_ref",
    branchOutputOnly: false,
    requiredForbiddenSources: [
      "user raw ID input",
      "route param",
      "cardId",
      "sourceCardId",
      "workspaceCardId",
      "search label"
    ]
  },
  {
    fieldId: "readinessEvidenceRefs",
    sourceGapId: "readinessEvidenceRefs",
    expectedDecision: "bind_to_evidence_envelope",
    expectedCompilerInputImpact: "evidenceEnvelope_required",
    classification: "evidence-reference",
    bindingType: "EvidenceEnvelope",
    source: "Evidence Kernel",
    evidencePolicyRef: "evidence.dormitory.resource-saleability.v1",
    semanticRole: "readiness_evidence_refs",
    branchOutputOnly: false,
    requiredForbiddenSources: [
      "raw manual input",
      "ordinary user input",
      "route param",
      "cardId",
      "sourceCardId",
      "workspaceCardId",
      "search label"
    ]
  },
  {
    fieldId: "serviceVerificationRef",
    sourceGapId: "serviceVerificationRef",
    expectedDecision: "bind_to_verification_evidence_ref",
    expectedCompilerInputImpact: "evidenceObjectStableRef_required",
    classification: "evidence-reference",
    bindingType: "EvidenceObject stableRef",
    source: "Evidence Kernel",
    evidenceObjectKind: "verification-check",
    semanticRole: "service_verification_ref",
    branchOutputOnly: false,
    requiredForbiddenSources: [
      "raw manual input",
      "ordinary user input",
      "route param",
      "cardId",
      "sourceCardId",
      "workspaceCardId",
      "search label"
    ]
  },
  {
    fieldId: "blockedReason",
    sourceGapId: "blockedReason",
    expectedDecision: "map_to_branch_outcome",
    expectedCompilerInputImpact: "branchOutputOnly",
    classification: "branch-output",
    bindingType: "branch-output",
    source: "branchFlows",
    semanticRole: "blocked_reason",
    branchOutputOnly: true,
    branchOutputScope: "all_no_go_branches",
    requiredForbiddenSources: [
      "raw manual input",
      "ordinary user input",
      "route param",
      "cardId",
      "sourceCardId",
      "workspaceCardId",
      "search label"
    ]
  },
  {
    fieldId: "notSaleableReason",
    sourceGapId: "notSaleableReason",
    expectedDecision: "map_to_resource_not_saleable_branch",
    expectedCompilerInputImpact: "branchOutputOnly",
    classification: "branch-output",
    bindingType: "branch-output",
    source: "branchFlows.resource-not-saleable",
    semanticRole: "not_saleable_reason",
    branchOutputOnly: true,
    branchOutputScope: "resource-not-saleable",
    requiredForbiddenSources: [
      "raw manual input",
      "ordinary user input",
      "route param",
      "cardId",
      "sourceCardId",
      "workspaceCardId",
      "search label"
    ]
  }
];

export function buildDormitoryGeneratedFieldBindingClosure({ root = process.cwd() } = {}) {
  const failures = [];
  const missingFiles = [];
  const sourceText = readTextIfExists(DORMITORY_SOURCE_SCENARIO_PATH, root, missingFiles);
  const kernel = readJsonIfExists(DORMITORY_KERNEL_PATH, root, missingFiles);
  const formalApproval = readJsonIfExists(GENERATED_COMPILE_APPROVAL_PATH, root, missingFiles);
  const candidateApproval = readJsonIfExists(GENERATED_COMPILE_CANDIDATE_APPROVAL_PATH, root, missingFiles);

  const fieldBindingsSection = section(sourceText, "fieldBindings");
  const sourceFieldGapsSection = section(sourceText, "sourceFieldGaps");
  if (!fieldBindingsSection) failures.push("Source scenario must contain fieldBindings.");
  if (!sourceFieldGapsSection) failures.push("Source scenario must contain sourceFieldGaps.");

  const sourceFinalizationStatus = readScalar(sourceText, "sourceFinalizationStatus");
  const sourceReadyForCompileDecision = readScalar(sourceText, "sourceReadyForCompileDecision");
  const compileDecisionStatus = readScalar(sourceText, "compileDecisionStatus");
  const sourceFieldGaps = buildSourceFieldGapsModel({
    sourceFieldGapsSection,
    failures
  });
  const sourceFieldGapsDecisionStatus = sourceFieldGaps?.sourceFieldGapsDecisionStatus ?? null;

  requireEqual(sourceFinalizationStatus, "SOURCE_FINALIZED_BY_00", "sourceFinalizationStatus", failures);
  requireEqual(sourceReadyForCompileDecision, true, "sourceReadyForCompileDecision", failures);
  requireEqual(compileDecisionStatus, "READY_FOR_00_COMPILE_DECISION", "compileDecisionStatus", failures);
  if (sourceFieldGaps?.pending00Decision !== false) {
    failures.push("Source field gaps must have pending00Decision=false.");
  }
  requireEqual(
    candidateApproval?.executionHeadDiffPolicy?.sourceFieldGapsDecisionRequired,
    "DECIDED_AND_BOUND",
    "candidateApproval.executionHeadDiffPolicy.sourceFieldGapsDecisionRequired",
    failures
  );
  requireEqual(formalApproval?.sourceFinalizationStatus, sourceFinalizationStatus, "formalApproval.sourceFinalizationStatus", failures);
  requireEqual(formalApproval?.sourceReadyForCompileDecision, sourceReadyForCompileDecision, "formalApproval.sourceReadyForCompileDecision", failures);
  requireEqual(formalApproval?.generatedCandidateAcceptedBy00, false, "formalApproval.generatedCandidateAcceptedBy00", failures);
  requireEqual(formalApproval?.runtimeConsumptionReady, false, "formalApproval.runtimeConsumptionReady", failures);
  requireEqual(formalApproval?.releaseAuthority, false, "formalApproval.releaseAuthority", failures);
  requireEqual(formalApproval?.finalGoNoGo, "NO_GO", "formalApproval.finalGoNoGo", failures);
  requireEqual(candidateApproval?.generatedCandidateAcceptedBy00, false, "candidateApproval.generatedCandidateAcceptedBy00", failures);
  requireEqual(candidateApproval?.runtimeConsumptionReady, false, "candidateApproval.runtimeConsumptionReady", failures);
  requireEqual(candidateApproval?.releaseAuthority, false, "candidateApproval.releaseAuthority", failures);
  requireEqual(candidateApproval?.finalGoNoGo, "NO_GO", "candidateApproval.finalGoNoGo", failures);

  const fields = REQUIRED_GENERATED_FIELD_BINDINGS.map((spec) =>
    buildFieldBinding(spec, {
      sourceText,
      fieldBindingsSection,
      sourceFieldGapsSection,
      sourceFieldGaps,
      failures
    })
  );

  const sourceFieldGapsDecisionDigest = digestObject({
    version: SOURCE_FIELD_GAPS_DECISION_VERSION,
    sourceScenarioRef: DORMITORY_SOURCE_SCENARIO_PATH,
    sourceFinalizationStatus,
    sourceReadyForCompileDecision,
    compileDecisionStatus,
    sourceFieldGapsDecisionStatus,
    sourceFieldGaps
  });
  const sourceScenarioDigest = sourceText ? digestText(sourceText) : null;
  const kernelDigest = kernel ? digestObject(kernel) : null;
  const formalApprovalSemantic = normalizeFormalApprovalForSemanticClosure(formalApproval);
  const candidateApprovalSemantic = normalizeCandidateApprovalForSemanticClosure(candidateApproval);
  const sourceSemanticRefs = [
    {
      id: "dormitorySourceScenario",
      path: DORMITORY_SOURCE_SCENARIO_PATH,
      tracked: true,
      semanticDigest: sourceScenarioDigest
    },
    {
      id: "dormitoryOperatingKernel",
      path: DORMITORY_KERNEL_PATH,
      tracked: true,
      semanticDigest: kernelDigest
    },
    {
      id: "generatedCompileApproval",
      path: GENERATED_COMPILE_APPROVAL_PATH,
      tracked: true,
      semanticDigest: formalApproval ? digestObject(formalApprovalSemantic) : null
    },
    {
      id: "generatedCompileCandidateApproval",
      path: GENERATED_COMPILE_CANDIDATE_APPROVAL_PATH,
      tracked: true,
      semanticDigest: candidateApproval ? digestObject(candidateApprovalSemantic) : null
    }
  ];
  const forbiddenSources = buildForbiddenSources(fields);
  const branchOutputSemantics = buildBranchOutputSemantics(fields, fieldBindingsSection);
  const lineageImpact = {
    sourceFinalizationStatus,
    sourceReadyForCompileDecision,
    compileDecisionStatus,
    generatedCandidateAcceptedBy00: false,
    runtimeConsumptionReady: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO"
  };
  const closureCore = {
    version: CANONICAL_CLOSURE_VERSION,
    canonicalClosureVersion: CANONICAL_CLOSURE_VERSION,
    closureType: "generated_semantic_field_binding_closure",
    sourceSemanticRefs,
    sourceFieldGapsDecisionStatus,
    sourceFieldGapsDecisionDigest,
    p0GeneratedCandidates: (kernel?.p0GeneratedCandidates ?? []).map((item) => item.workItemType).sort(),
    requiredFieldIds: REQUIRED_GENERATED_FIELD_BINDINGS.map((item) => item.fieldId),
    fields,
    forbiddenSources,
    branchOutputSemantics,
    lineageImpact
  };
  const closureDigest = digestObject(closureCore);
  const status = missingFiles.length > 0
    ? "INCOMPLETE"
    : failures.length > 0
      ? "INVALID"
      : "PASS";

  return {
    ...closureCore,
    closureDigest,
    status,
    generatedFieldBindingClosureStatus: status,
    missingFiles: [...new Set(missingFiles)].sort(),
    failures
  };
}

export function buildGeneratedFieldBindingContract({ root = process.cwd(), metadata = {} } = {}) {
  const closure = buildDormitoryGeneratedFieldBindingClosure({ root });
  return {
    ...metadata,
    canonicalClosureVersion: closure.canonicalClosureVersion,
    sourceFieldGapsDecisionDigest: closure.sourceFieldGapsDecisionDigest,
    generatedFieldBindingClosureDigest: closure.closureDigest,
    sourceSemanticRefs: closure.sourceSemanticRefs,
    fieldBindings: closure.fields,
    forbiddenSources: closure.forbiddenSources,
    branchOutputSemantics: closure.branchOutputSemantics,
    lineageImpact: closure.lineageImpact
  };
}

export function readGeneratedFieldBindingContract({ root = process.cwd() } = {}) {
  return readJsonIfExists(FIELD_BINDINGS_GENERATED_PATH, root);
}

export function digestObject(value) {
  return `sha256:${crypto.createHash("sha256").update(stableStringify(value)).digest("hex")}`;
}

export function hashFile(file, root = process.cwd()) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex")}`;
}

export function writeJson(file, data, root = process.cwd()) {
  const full = path.join(root, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function readJsonIfExists(file, root = process.cwd(), missingFiles = null) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    if (missingFiles) missingFiles.push(file);
    return null;
  }
  return JSON.parse(fs.readFileSync(full, "utf8").replace(/^\uFEFF/, ""));
}

function buildFieldBinding(spec, context) {
  const bindingBlock = mappingBlock(context.fieldBindingsSection, spec.fieldId, 2);
  const decisionBlockText = decisionBlock(context.sourceFieldGapsSection, spec.sourceGapId);
  const resultDecision = context.sourceFieldGaps?.decisions?.[spec.sourceGapId] ?? null;
  const sourceContractBlock = fieldContractBlock(context.sourceText, spec.fieldId);

  if (!bindingBlock) context.failures.push(`Source fieldBindings.${spec.fieldId} is missing.`);
  if (!decisionBlockText) context.failures.push(`Source sourceFieldGaps.decisions.${spec.sourceGapId} is missing.`);
  if (!resultDecision) context.failures.push(`Source sourceFieldGaps.decisions.${spec.sourceGapId} semantic decision is missing.`);

  requireEqual(resultDecision?.decision, spec.expectedDecision, `${spec.sourceGapId}.decision`, context.failures);
  requireEqual(
    resultDecision?.compilerInputImpact,
    spec.expectedCompilerInputImpact,
    `${spec.sourceGapId}.compilerInputImpact`,
    context.failures
  );
  if (resultDecision?.compileBlocking !== true) {
    context.failures.push(`${spec.sourceGapId}.compileBlocking must be true for generated semantic closure.`);
  }

  if (!decisionBlockText.includes(`bindingRef: fieldBindings.${spec.fieldId}`)) {
    context.failures.push(`sourceFieldGaps.${spec.sourceGapId} must bind fieldBindings.${spec.fieldId}.`);
  }
  if (readScalar(bindingBlock, "bindingType") !== spec.bindingType) {
    context.failures.push(`fieldBindings.${spec.fieldId}.bindingType must be ${spec.bindingType}.`);
  }

  if (spec.fieldId === "buildingContextRef") {
    requireScalar(bindingBlock, "userEditable", false, spec.fieldId, context.failures);
    requireScalar(bindingBlock, "rawManualInputAllowed", false, spec.fieldId, context.failures);
    requireScalar(sourceContractBlock, "inputMode", "contextReadonly", spec.fieldId, context.failures);
    requireScalar(sourceContractBlock, "category", "contextReadonly", spec.fieldId, context.failures);
    requireListContains(readList(bindingBlock, "forbiddenSources"), spec.requiredForbiddenSources, spec.fieldId, context.failures);
  }
  if (["readinessEvidenceRefs", "serviceVerificationRef"].includes(spec.fieldId)) {
    requireScalar(bindingBlock, "source", "Evidence Kernel", spec.fieldId, context.failures);
    requireScalar(bindingBlock, "userEditable", false, spec.fieldId, context.failures);
    requireScalar(bindingBlock, "rawManualInputAllowed", false, spec.fieldId, context.failures);
  }
  if (["blockedReason", "notSaleableReason"].includes(spec.fieldId)) {
    requireScalar(bindingBlock, "userSubmitted", false, spec.fieldId, context.failures);
    requireScalar(bindingBlock, "compilerInput", "branchOutputOnly", spec.fieldId, context.failures);
  }

  return {
    fieldId: spec.fieldId,
    sourceGapId: spec.sourceGapId,
    decision: spec.expectedDecision,
    compilerInputImpact: spec.expectedCompilerInputImpact,
    compileBlocking: true,
    classification: spec.classification,
    bindingType: spec.bindingType,
    source: spec.source,
    stableRef: spec.stableRef ?? null,
    evidencePolicyRef: spec.evidencePolicyRef ?? null,
    evidenceObjectKind: spec.evidenceObjectKind ?? null,
    semanticRole: spec.semanticRole,
    branchOutputOnly: spec.branchOutputOnly,
    branchOutputScope: spec.branchOutputScope ?? null,
    userEditable: false,
    rawManualInputAllowed: false,
    userSubmitted: false,
    forbiddenSources: [...spec.requiredForbiddenSources],
    sourceBindingRef: `fieldBindings.${spec.fieldId}`,
    sourceDecisionRef: `sourceFieldGaps.decisions.${spec.sourceGapId}`,
    currentAuthority: "docs/contracts/generated/dormitory/field-bindings.generated.json",
    runtimeConsumptionReady: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO"
  };
}

function buildSourceFieldGapsModel({ sourceFieldGapsSection, failures }) {
  if (!sourceFieldGapsSection) return null;
  const decisions = {};
  for (const spec of REQUIRED_GENERATED_FIELD_BINDINGS) {
    const block = decisionBlock(sourceFieldGapsSection, spec.sourceGapId);
    if (!block) {
      failures.push(`sourceFieldGaps.decisions.${spec.sourceGapId} is missing.`);
      continue;
    }
    decisions[spec.sourceGapId] = {
      decision: readScalar(block, "decision"),
      owner: readScalar(block, "owner"),
      compileBlocking: readScalar(block, "compileBlocking"),
      compilerInputImpact: readScalar(block, "compilerInputImpact"),
      bindingRef: readScalar(block, "bindingRef"),
      source: readScalar(block, "source"),
      userEditable: readScalar(block, "userEditable"),
      rawManualInputAllowed: readScalar(block, "rawManualInputAllowed"),
      userSubmitted: readScalar(block, "userSubmitted"),
      forbiddenSources: readList(block, "forbiddenSources")
    };
  }
  return {
    version: SOURCE_FIELD_GAPS_DECISION_VERSION,
    sourceFieldGapsDecisionStatus: "DECIDED_AND_BOUND",
    pending00Decision: readScalar(sourceFieldGapsSection, "pending00Decision"),
    compilePreparationAllowed: readScalar(sourceFieldGapsSection, "compilePreparationAllowed"),
    decisions
  };
}

function normalizeFormalApprovalForSemanticClosure(approval) {
  if (!approval) return null;
  return {
    version: approval.version ?? null,
    approvalStatus: approval.approvalStatus ?? null,
    approvalDecision: approval.approvalDecision ?? null,
    approvalScope: approval.approvalScope ?? null,
    sourceScenarioRef: approval.sourceScenarioRef ?? null,
    sourceHash: approval.sourceHash ?? null,
    sourceFinalizationStatus: approval.sourceFinalizationStatus ?? null,
    sourceReadyForCompileDecision: approval.sourceReadyForCompileDecision ?? null,
    candidateSourceRef: approval.candidateSourceRef ?? null,
    approvedFormalAuthorizationHead: approval.approvedFormalAuthorizationHead ?? null,
    authorizedCandidateExecutionHead: approval.authorizedCandidateExecutionHead ?? null,
    generatedCompileAuthorized: approval.generatedCompileAuthorized ?? null,
    generatedCompilationAllowed: approval.generatedCompilationAllowed ?? null,
    generatedCandidateAcceptedBy00: approval.generatedCandidateAcceptedBy00 ?? null,
    runtimeConsumptionReady: approval.runtimeConsumptionReady ?? null,
    releaseAuthority: approval.releaseAuthority ?? null,
    finalGoNoGo: approval.finalGoNoGo ?? null
  };
}

function normalizeCandidateApprovalForSemanticClosure(approval) {
  if (!approval) return null;
  return {
    version: approval.version ?? null,
    approvalType: approval.approvalType ?? null,
    approvalStatus: approval.approvalStatus ?? null,
    scope: approval.scope ?? null,
    sourceScenarioRef: approval.sourceScenarioRef ?? null,
    sourceHash: approval.sourceHash ?? null,
    authorizedSourceRef: approval.authorizedSourceRef ?? null,
    candidateSourceRef: approval.candidateSourceRef ?? null,
    authorizedCandidateExecutionHead: approval.authorizedCandidateExecutionHead ?? null,
    generatedCompileCandidateAuthorized: approval.generatedCompileCandidateAuthorized ?? null,
    sourceFieldGapsDecisionRequired: approval.executionHeadDiffPolicy?.sourceFieldGapsDecisionRequired ?? null,
    generatedCandidateAcceptedBy00: approval.generatedCandidateAcceptedBy00 ?? null,
    runtimeConsumptionReady: approval.runtimeConsumptionReady ?? null,
    releaseAuthority: approval.releaseAuthority ?? null,
    finalGoNoGo: approval.finalGoNoGo ?? null
  };
}

function buildForbiddenSources(fields) {
  return Object.fromEntries(fields.map((field) => [
    field.fieldId,
    [...new Set(field.forbiddenSources ?? [])].sort()
  ]));
}

function buildBranchOutputSemantics(fields, fieldBindingsSection) {
  return Object.fromEntries(fields
    .filter((field) => field.branchOutputOnly)
    .map((field) => {
      const bindingBlock = mappingBlock(fieldBindingsSection, field.fieldId, 2);
      return [field.fieldId, {
        sourceBindingRef: field.sourceBindingRef,
        sourceDecisionRef: field.sourceDecisionRef,
        branchOutputScope: field.branchOutputScope,
        userSubmitted: false,
        compilerInput: "branchOutputOnly",
        mapsTo: readList(bindingBlock, "mapsTo")
      }];
    }));
}

function readTextIfExists(file, root, missingFiles) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    missingFiles.push(file);
    return "";
  }
  return fs.readFileSync(full, "utf8")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

function digestText(text) {
  return `sha256:${crypto.createHash("sha256").update(text).digest("hex")}`;
}

function requireEqual(actual, expected, label, failures) {
  if (actual !== expected) failures.push(`${label} must be ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}.`);
}

function requireScalar(block, key, expected, fieldId, failures) {
  const actual = readScalar(block, key);
  if (actual !== expected) {
    failures.push(`${fieldId}.${key} must be ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}.`);
  }
}

function requireListContains(actual, expected, fieldId, failures) {
  for (const item of expected) {
    if (!actual.includes(item)) failures.push(`${fieldId}.forbiddenSources missing ${item}.`);
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

function mappingBlock(value, key, indent = 2) {
  const spaces = " ".repeat(indent);
  const marker = `${spaces}${key}:`;
  const start = value.indexOf(marker);
  if (start < 0) return "";
  const pattern = new RegExp(`\\n${spaces}[A-Za-z0-9_.-]+:`);
  const next = pattern.exec(value.slice(start + marker.length));
  return next ? value.slice(start, start + marker.length + next.index) : value.slice(start);
}

function decisionBlock(gapsSection, gapId) {
  const marker = `    ${gapId}:`;
  const start = gapsSection.indexOf(marker);
  if (start < 0) return "";
  const next = /\n    [A-Za-z0-9_.-]+:/.exec(gapsSection.slice(start + marker.length));
  return next ? gapsSection.slice(start, start + marker.length + next.index) : gapsSection.slice(start);
}

function fieldContractBlock(sourceText, fieldId) {
  const marker = `      - fieldId: ${fieldId}`;
  const start = sourceText.indexOf(marker);
  if (start < 0) return "";
  const next = /\n      - fieldId: /.exec(sourceText.slice(start + marker.length));
  return next ? sourceText.slice(start, start + marker.length + next.index) : sourceText.slice(start);
}

function readScalar(block, key) {
  const pattern = new RegExp(`^\\s*${escapeRegExp(key)}:\\s*(.*?)\\s*$`, "m");
  const match = pattern.exec(block);
  if (!match) return undefined;
  const value = match[1].trim();
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  return value.replace(/^["']|["']$/g, "");
}

function readList(block, key) {
  const lines = block.split(/\r?\n/);
  const start = lines.findIndex((line) => new RegExp(`^\\s*${escapeRegExp(key)}:\\s*$`).test(line));
  if (start < 0) return [];
  const baseIndent = indentation(lines[start]);
  const values = [];
  for (const line of lines.slice(start + 1)) {
    if (!line.trim()) continue;
    if (indentation(line) <= baseIndent) break;
    const match = /^\s*-\s*(.*?)\s*$/.exec(line);
    if (match) values.push(match[1].replace(/^["']|["']$/g, ""));
  }
  return values;
}

function indentation(line) {
  return (/^ */.exec(line)?.[0] ?? "").length;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
