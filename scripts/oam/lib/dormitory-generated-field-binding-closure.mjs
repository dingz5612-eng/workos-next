import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const DORMITORY_SOURCE_SCENARIO_PATH =
  "docs/business/domains/dormitory/scenarios/dormitory-resource-saleability.golden-chain.yml";
export const DORMITORY_KERNEL_PATH = "docs/business/domains/dormitory/dormitory-operating-kernel.json";
export const SOURCE_PACKAGE_RESULT_PATH = "artifacts/oam/checks/dormitory-golden-chain-source-package-result.json";
export const FIELD_BINDINGS_GENERATED_PATH = "docs/contracts/generated/dormitory/field-bindings.generated.json";
export const FIELD_BINDING_CLOSURE_RESULT_PATH =
  "artifacts/oam/checks/generated-field-binding-closure-result.json";

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
  const sourcePackageResult = readJsonIfExists(SOURCE_PACKAGE_RESULT_PATH, root, missingFiles);
  const kernel = readJsonIfExists(DORMITORY_KERNEL_PATH, root, missingFiles);

  const fieldBindingsSection = section(sourceText, "fieldBindings");
  const sourceFieldGapsSection = section(sourceText, "sourceFieldGaps");
  if (!fieldBindingsSection) failures.push("Source scenario must contain fieldBindings.");
  if (!sourceFieldGapsSection) failures.push("Source scenario must contain sourceFieldGaps.");
  if (sourcePackageResult?.status !== "PASS") failures.push("Source package result must be PASS.");
  if (sourcePackageResult?.sourceFieldGapsDecisionStatus !== "DECIDED_AND_BOUND") {
    failures.push("Source field gaps decision status must be DECIDED_AND_BOUND.");
  }
  if (sourcePackageResult?.sourceFieldGaps?.pending00Decision !== false) {
    failures.push("Source field gaps must have pending00Decision=false.");
  }

  const fields = REQUIRED_GENERATED_FIELD_BINDINGS.map((spec) =>
    buildFieldBinding(spec, {
      sourceText,
      fieldBindingsSection,
      sourceFieldGapsSection,
      sourcePackageResult,
      failures
    })
  );

  const sourceFieldGaps = sourcePackageResult?.sourceFieldGaps ?? null;
  const sourceFieldGapsDecisionDigest = digestObject({
    version: "oam.dormitory.source-field-gaps-decision.v1",
    sourceFieldGapsDecisionStatus: sourcePackageResult?.sourceFieldGapsDecisionStatus ?? null,
    sourceFieldGaps
  });
  const sourceScenarioDigest = sourceText ? digestText(sourceText) : null;
  const sourcePackageResultDigest = sourcePackageResult
    ? digestSourcePackageResultForClosure(sourcePackageResult)
    : null;
  const kernelDigest = fileExists(DORMITORY_KERNEL_PATH, root) ? hashFile(DORMITORY_KERNEL_PATH, root) : null;
  const closureCore = {
    version: "oam.dormitory-generated-field-binding-closure.v1",
    closureType: "generated_semantic_field_binding_closure",
    sourceScenarioRef: DORMITORY_SOURCE_SCENARIO_PATH,
    sourceScenarioDigest,
    sourcePackageResultRef: SOURCE_PACKAGE_RESULT_PATH,
    sourcePackageResultDigest,
    sourceFieldGapsDecisionStatus: sourcePackageResult?.sourceFieldGapsDecisionStatus ?? null,
    sourceFieldGapsDecisionDigest,
    kernelRef: DORMITORY_KERNEL_PATH,
    kernelDigest,
    p0GeneratedCandidates: (kernel?.p0GeneratedCandidates ?? []).map((item) => item.workItemType).sort(),
    requiredFieldIds: REQUIRED_GENERATED_FIELD_BINDINGS.map((item) => item.fieldId),
    fields
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
    semanticClosureVersion: closure.version,
    generatedFieldBindingClosureRequired: true,
    generatedFieldBindingClosureStatus: closure.status,
    sourceScenarioRef: closure.sourceScenarioRef,
    sourcePackageResultRef: closure.sourcePackageResultRef,
    sourceFieldGapsDecisionStatus: closure.sourceFieldGapsDecisionStatus,
    sourceFieldGapsDecisionDigest: closure.sourceFieldGapsDecisionDigest,
    closureDigest: closure.closureDigest,
    requiredFieldIds: closure.requiredFieldIds,
    fieldBindings: closure.fields,
    semanticRules: {
      fieldsGeneratedOwnsClassificationOnly: true,
      fieldBindingsGeneratedOwnsSourceEvidenceAndBranchOutputSemantics: true,
      surfaceInputModelMayNotSubstituteBindingAuthority: true,
      runtimeConsumptionReady: false,
      releaseAuthority: false,
      finalGoNoGo: "NO_GO"
    },
    sourceDigests: {
      sourceScenarioDigest: closure.sourceScenarioDigest,
      sourcePackageResultDigest: closure.sourcePackageResultDigest,
      kernelDigest: closure.kernelDigest
    }
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

export function digestSourcePackageResultForClosure(sourcePackageResult) {
  return digestObject({
    version: "oam.dormitory.source-package-result.semantic-closure-input.v1",
    resultVersion: sourcePackageResult?.version ?? null,
    gateId: sourcePackageResult?.gateId ?? null,
    status: sourcePackageResult?.status ?? null,
    sourceFinalizationStatus: sourcePackageResult?.sourceFinalizationStatus ?? null,
    sourceScenarioPackageReviewStatus: sourcePackageResult?.sourceScenarioPackageReviewStatus ?? null,
    sourceFieldGapsDecisionStatus: sourcePackageResult?.sourceFieldGapsDecisionStatus ?? null,
    sourceReadyForCompileDecision: sourcePackageResult?.sourceReadyForCompileDecision ?? null,
    compileDecisionStatus: sourcePackageResult?.compileDecisionStatus ?? null,
    sourceFieldGaps: sourcePackageResult?.sourceFieldGaps ?? null
  });
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
  const resultDecision = context.sourcePackageResult?.sourceFieldGaps?.decisions?.[spec.sourceGapId] ?? null;
  const sourceContractBlock = fieldContractBlock(context.sourceText, spec.fieldId);

  if (!bindingBlock) context.failures.push(`Source fieldBindings.${spec.fieldId} is missing.`);
  if (!decisionBlockText) context.failures.push(`Source sourceFieldGaps.decisions.${spec.sourceGapId} is missing.`);
  if (!resultDecision) context.failures.push(`Source package result sourceFieldGaps.decisions.${spec.sourceGapId} is missing.`);

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

function readTextIfExists(file, root, missingFiles) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    missingFiles.push(file);
    return "";
  }
  return fs.readFileSync(full, "utf8").replace(/^\uFEFF/, "");
}

function fileExists(file, root) {
  return fs.existsSync(path.join(root, file));
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
