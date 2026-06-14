import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  FIELD_BINDING_CLOSURE_RESULT_PATH,
  FIELD_BINDINGS_GENERATED_PATH,
  REQUIRED_GENERATED_FIELD_BINDINGS,
  buildDormitoryGeneratedFieldBindingClosure,
  digestObject,
  readGeneratedFieldBindingContract,
  writeJson
} from "./lib/dormitory-generated-field-binding-closure.mjs";

const root = process.cwd();
const failures = [];
const warnings = [];
const closure = buildDormitoryGeneratedFieldBindingClosure({ root });
const contract = readGeneratedFieldBindingContract({ root });
const fieldsGenerated = readJsonIfExists("docs/contracts/generated/dormitory/fields.generated.json");

failures.push(...closure.failures);
if (closure.status !== "PASS") {
  failures.push(`Generated field binding closure source model must be PASS, actual ${closure.status}.`);
}

validateGeneratedContract(contract);
validateFieldsGeneratedBoundary(fieldsGenerated, contract);
validateGeneratorReproducibility(contract);

const result = {
  version: "oam.generated-field-binding-closure-check.v1",
  status: failures.length === 0 ? "PASS" : "FAIL",
  generatedFieldBindingClosureRequired: true,
  generatedFieldBindingClosureStatus: failures.length === 0 ? "PASS" : "FAIL",
  fieldBindingContractPath: FIELD_BINDINGS_GENERATED_PATH,
  requiredFieldIds: REQUIRED_GENERATED_FIELD_BINDINGS.map((item) => item.fieldId),
  closureDigest: closure.closureDigest,
  generatedFieldBindingClosureDigest: closure.closureDigest,
  sourceFieldGapsDecisionDigest: closure.sourceFieldGapsDecisionDigest,
  sourceFieldGapsDecisionStatus: closure.sourceFieldGapsDecisionStatus,
  generatedFieldBindingContractDigest: contract ? digestObject(contract) : null,
  fieldCount: Array.isArray(contract?.fieldBindings) ? contract.fieldBindings.length : 0,
  runtimeConsumptionReady: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  warnings,
  failures
};

writeJson(FIELD_BINDING_CLOSURE_RESULT_PATH, result, root);

if (result.status !== "PASS") {
  console.error("Generated field binding closure check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Generated field binding closure check: PASS (fields=${result.fieldCount}, closureDigest=${result.closureDigest})`
);

function validateGeneratedContract(document) {
  if (!document || typeof document !== "object") {
    failures.push(`${FIELD_BINDINGS_GENERATED_PATH} is missing or invalid.`);
    return;
  }
  requireEqual(document.generated, true, "field-bindings.generated.generated");
  requireEqual(document.doNotEdit, true, "field-bindings.generated.doNotEdit");
  requireEqual(document.kind, "field-bindings.generated", "field-bindings.generated.kind");
  requireEqual(document.generatedFieldBindingClosureRequired, true, "generatedFieldBindingClosureRequired");
  requireEqual(document.generatedFieldBindingClosureStatus, "PASS", "generatedFieldBindingClosureStatus");
  requireEqual(document.sourceFieldGapsDecisionStatus, "DECIDED_AND_BOUND", "sourceFieldGapsDecisionStatus");
  requireEqual(document.sourceFieldGapsDecisionDigest, closure.sourceFieldGapsDecisionDigest, "sourceFieldGapsDecisionDigest");
  requireEqual(document.closureDigest, closure.closureDigest, "closureDigest");
  requireEqual(document.semanticRules?.runtimeConsumptionReady, false, "semanticRules.runtimeConsumptionReady");
  requireEqual(document.semanticRules?.releaseAuthority, false, "semanticRules.releaseAuthority");
  requireEqual(document.semanticRules?.finalGoNoGo, "NO_GO", "semanticRules.finalGoNoGo");

  const bindings = Array.isArray(document.fieldBindings) ? document.fieldBindings : [];
  const byId = new Map(bindings.map((item) => [item.fieldId, item]));
  for (const spec of REQUIRED_GENERATED_FIELD_BINDINGS) {
    const binding = byId.get(spec.fieldId);
    if (!binding) {
      failures.push(`field-bindings.generated missing ${spec.fieldId}.`);
      continue;
    }
    requireEqual(binding.sourceGapId, spec.sourceGapId, `${spec.fieldId}.sourceGapId`);
    requireEqual(binding.decision, spec.expectedDecision, `${spec.fieldId}.decision`);
    requireEqual(binding.compilerInputImpact, spec.expectedCompilerInputImpact, `${spec.fieldId}.compilerInputImpact`);
    requireEqual(binding.classification, spec.classification, `${spec.fieldId}.classification`);
    requireEqual(binding.bindingType, spec.bindingType, `${spec.fieldId}.bindingType`);
    requireEqual(binding.userEditable, false, `${spec.fieldId}.userEditable`);
    requireEqual(binding.rawManualInputAllowed, false, `${spec.fieldId}.rawManualInputAllowed`);
    requireEqual(binding.runtimeConsumptionReady, false, `${spec.fieldId}.runtimeConsumptionReady`);
    requireEqual(binding.releaseAuthority, false, `${spec.fieldId}.releaseAuthority`);
    requireEqual(binding.finalGoNoGo, "NO_GO", `${spec.fieldId}.finalGoNoGo`);
    for (const forbiddenSource of spec.requiredForbiddenSources) {
      if (!(binding.forbiddenSources ?? []).includes(forbiddenSource)) {
        failures.push(`${spec.fieldId}.forbiddenSources missing ${forbiddenSource}.`);
      }
    }
    if (spec.fieldId === "buildingContextRef") {
      requireEqual(binding.classification, "contextReadonly", "buildingContextRef.classification");
      requireEqual(binding.source, "Source Layer context", "buildingContextRef.source");
    }
    if (spec.fieldId === "readinessEvidenceRefs") {
      requireEqual(binding.bindingType, "EvidenceEnvelope", "readinessEvidenceRefs.bindingType");
      requireEqual(binding.source, "Evidence Kernel", "readinessEvidenceRefs.source");
    }
    if (spec.fieldId === "serviceVerificationRef") {
      requireEqual(binding.bindingType, "EvidenceObject stableRef", "serviceVerificationRef.bindingType");
      requireEqual(binding.source, "Evidence Kernel", "serviceVerificationRef.source");
    }
    if (["blockedReason", "notSaleableReason"].includes(spec.fieldId)) {
      requireEqual(binding.classification, "branch-output", `${spec.fieldId}.classification`);
      requireEqual(binding.branchOutputOnly, true, `${spec.fieldId}.branchOutputOnly`);
    }
  }
}

function validateFieldsGeneratedBoundary(fieldsDocument, fieldBindingDocument) {
  if (!fieldsDocument || typeof fieldsDocument !== "object") {
    failures.push("docs/contracts/generated/dormitory/fields.generated.json is missing or invalid.");
    return;
  }
  const generatedBindingIds = new Set((fieldBindingDocument?.fieldBindings ?? []).map((item) => item.fieldId));
  for (const item of fieldsDocument.workItemFields ?? []) {
    for (const [classification, fieldIds] of Object.entries(item.fieldClassification ?? {})) {
      for (const fieldId of fieldIds ?? []) {
        if (generatedBindingIds.has(fieldId) && classification !== "contextReadonly") {
          failures.push(`fields.generated.json conflicts with field-bindings.generated.json for ${fieldId}: ${classification}.`);
        }
        if (["readinessEvidenceRefs", "serviceVerificationRef", "blockedReason", "notSaleableReason"].includes(fieldId)) {
          failures.push(`fields.generated.json must not expose semantic closure-only field as executable classification: ${fieldId}.`);
        }
      }
    }
  }
}

function validateGeneratorReproducibility(document) {
  if (!document) return;
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "workosnext-field-bindings-"));
  try {
    execFileSync("node", ["scripts/oam/compile-current-kernel-graph.mjs"], {
      cwd: root,
      env: { ...process.env, WORKOS_KERNEL_COMPILE_OUTPUT_ROOT: tempRoot },
      stdio: "pipe"
    });
    const regeneratedPath = path.join(tempRoot, FIELD_BINDINGS_GENERATED_PATH);
    if (!fs.existsSync(regeneratedPath)) {
      failures.push("Generator did not emit field-bindings.generated.json in reproducibility check.");
      return;
    }
    const regenerated = JSON.parse(fs.readFileSync(regeneratedPath, "utf8"));
    if (stableStringify(regenerated) !== stableStringify(document)) {
      failures.push("field-bindings.generated.json must match current generator output.");
    }
  } catch (error) {
    failures.push(`Unable to run generator reproducibility check: ${error.message}`);
  } finally {
    if (tempRoot.startsWith(os.tmpdir())) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }
}

function readJsonIfExists(file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, "utf8").replace(/^\uFEFF/, ""));
}

function requireEqual(actual, expected, label) {
  if (actual !== expected) {
    failures.push(`${label} must be ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}.`);
  }
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
