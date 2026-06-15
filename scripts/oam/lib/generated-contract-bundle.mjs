import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  FIELD_BINDINGS_GENERATED_PATH,
  buildDormitoryGeneratedFieldBindingClosure
} from "./dormitory-generated-field-binding-closure.mjs";

export const CAPABILITY_ID = "Dormitory.FirstGoldenChain";
export const GENERATED_BUNDLE_CONTENT_ADDRESSED_RESULT_PATH =
  "artifacts/oam/checks/generated-bundle-content-addressed-result.json";

export const generatedContractFiles = [
  "docs/oam/system-derived-contracts.json",
  "docs/oam/domain-derived-contracts.json",
  "docs/oam/generated-contracts-manifest.json",
  "docs/contracts/admission/admission-contract.json",
  "docs/oam/kernel/oam-kernel-graph.generated.json",
  "docs/contracts/generated/dormitory/dormitory-kernel.generated.manifest.json",
  "docs/contracts/generated/dormitory/fields.generated.json",
  FIELD_BINDINGS_GENERATED_PATH,
  "docs/contracts/generated/dormitory/workitems.generated.json",
  "docs/contracts/generated/dormitory/surface-input-model.generated.json",
  "docs/contracts/generated/dormitory/read-model.generated.json",
  "apps/mobile/src/generated/oam/dormitory-surface-input-model.generated.json"
];

export const runtimeConsumableGeneratedFiles = [
  "docs/contracts/generated/dormitory/dormitory-kernel.generated.manifest.json",
  "docs/contracts/generated/dormitory/fields.generated.json",
  FIELD_BINDINGS_GENERATED_PATH,
  "docs/contracts/generated/dormitory/workitems.generated.json",
  "docs/contracts/generated/dormitory/surface-input-model.generated.json",
  "docs/contracts/generated/dormitory/read-model.generated.json",
  "apps/mobile/src/generated/oam/dormitory-surface-input-model.generated.json"
];

const digestPattern = /^sha256:[a-f0-9]{64}$/;
const generatedCompileExecutionResultPath = "artifacts/oam/checks/generated-compile-execution-result.json";
const generatedCompileExecutionProofPath = "artifacts/oam/evidence/generated-compile-execution-proof.json";

export function buildGeneratedContractBundle({
  root = process.cwd(),
  subject = null,
  bundleRole = "current_generated_contract_bundle"
} = {}) {
  const fieldClosure = buildDormitoryGeneratedFieldBindingClosure({ root });
  const result = readJsonIfExists(generatedCompileExecutionResultPath, root);
  const proof = readJsonIfExists(generatedCompileExecutionProofPath, root);
  const manifest = readJsonIfExists("docs/oam/generated-contracts-manifest.json", root);
  const generatedFiles = subject
    ? generatedFilesFromAcceptedSubject(subject)
    : generatedContractFiles.map((file) => ({
        path: file,
        digest: fileDigest(file, root)
      }));
  const runtimeConsumableDigests = generatedFiles
    .filter((item) => runtimeConsumableGeneratedFiles.includes(item.path))
    .map((item) => ({ path: item.path, digest: item.digest }));
  const compilerVersion = [
    manifest?.generatorVersion ?? "unknown-generated-contract-compiler",
    "oam.generated-contract-bundle.v1"
  ].join("+");
  const sourceClosureDigest = subject?.generatedFieldBindingClosureDigest ?? fieldClosure.closureDigest;
  const fieldBindingClosureDigest = subject?.generatedFieldBindingClosureDigest ?? fieldClosure.closureDigest;
  const sourceFieldGapsDecisionDigest = subject?.sourceFieldGapsDecisionDigest ?? fieldClosure.sourceFieldGapsDecisionDigest;
  const fieldBindingContractDigest = subject?.fieldBindingContractDigest ?? fileDigest(FIELD_BINDINGS_GENERATED_PATH, root);
  const compilerInputDigest = digestObject({
    version: "oam.generated-contract-bundle-compiler-input.v1",
    capabilityId: CAPABILITY_ID,
    sourceClosureDigest,
    sourceFieldGapsDecisionDigest,
    fieldBindingContractDigest,
    compilerVersion,
    generatedFilePaths: generatedFiles.map((item) => item.path).sort()
  });
  const executionProofDigest = subject?.executionProofDigest ?? digestObject({
    version: "oam.generated-contract-bundle-execution-proof-ref.v1",
    status: result?.status ?? proof?.status ?? "missing",
    reviewedExecutionHead: result?.reviewedExecutionHead ?? proof?.reviewedExecutionHead ?? null,
    generatedOutputDigest: result?.generatedOutputDigest ?? proof?.generatedOutputDigest ?? null,
    manifestDigest: result?.manifestDigest ?? null,
    generatedKernelGraphDigest: result?.generatedKernelGraphDigest ?? null
  });
  const generatedOutputDigest = subject?.generatedOutputDigest ?? result?.generatedOutputDigest ?? digestObject({
    version: "oam.generated-contract-bundle-output-digest.v1",
    generatedFileDigests: generatedFiles.map((item) => item.digest)
  });
  const bundleCore = {
    version: "oam.generated-contract-bundle.v1",
    bundleType: "GeneratedContractBundle",
    bundleRole,
    capabilityId: CAPABILITY_ID,
    sourceClosureDigest,
    compilerInputDigest,
    compilerVersion,
    generatedFiles: generatedFiles.map((item) => item.path),
    generatedFileDigests: generatedFiles,
    fieldBindingClosureDigest,
    executionProofDigest,
    runtimeConsumableDigests,
    generatedOutputDigest
  };
  return {
    ...bundleCore,
    generatedBundleDigest: digestGeneratedContractBundle(bundleCore)
  };
}

export function digestGeneratedContractBundle(bundle) {
  return digestObject(canonicalGeneratedContractBundle(bundle));
}

export function validateGeneratedContractBundle({
  bundle,
  subject = null,
  root = process.cwd()
} = {}) {
  const failures = [];
  if (!bundle || typeof bundle !== "object") {
    return { status: "NO_GO", failures: ["GeneratedContractBundle is missing or invalid."] };
  }
  requireEqual(bundle.version, "oam.generated-contract-bundle.v1", "version", failures);
  requireEqual(bundle.bundleType, "GeneratedContractBundle", "bundleType", failures);
  requireEqual(bundle.capabilityId, CAPABILITY_ID, "capabilityId", failures);
  for (const field of [
    "sourceClosureDigest",
    "compilerInputDigest",
    "fieldBindingClosureDigest",
    "executionProofDigest",
    "generatedOutputDigest",
    "generatedBundleDigest"
  ]) {
    requireDigest(bundle[field], field, failures);
  }
  if (!bundle.compilerVersion || typeof bundle.compilerVersion !== "string") {
    failures.push("compilerVersion is required.");
  }
  requireArray(bundle.generatedFiles, "generatedFiles", failures);
  requireArray(bundle.generatedFileDigests, "generatedFileDigests", failures);
  requireArray(bundle.runtimeConsumableDigests, "runtimeConsumableDigests", failures);
  if ((bundle.generatedFiles ?? []).length !== (bundle.generatedFileDigests ?? []).length) {
    failures.push("generatedFiles and generatedFileDigests must have the same length.");
  }
  for (const item of bundle.generatedFileDigests ?? []) {
    if (!item?.path || !digestPattern.test(String(item.digest ?? ""))) {
      failures.push(`generatedFileDigests entry is invalid: ${format(item)}.`);
    }
  }
  for (const item of bundle.runtimeConsumableDigests ?? []) {
    if (!item?.path || !digestPattern.test(String(item.digest ?? ""))) {
      failures.push(`runtimeConsumableDigests entry is invalid: ${format(item)}.`);
    }
  }
  requireEqual(
    bundle.generatedBundleDigest,
    digestGeneratedContractBundle(bundle),
    "generatedBundleDigest",
    failures
  );
  if (subject) {
    requireEqual(bundle.sourceClosureDigest, subject.generatedFieldBindingClosureDigest, "sourceClosureDigest", failures);
    requireEqual(bundle.fieldBindingClosureDigest, subject.generatedFieldBindingClosureDigest, "fieldBindingClosureDigest", failures);
    requireEqual(bundle.executionProofDigest, subject.executionProofDigest, "executionProofDigest", failures);
    requireEqual(bundle.generatedOutputDigest, subject.generatedOutputDigest, "generatedOutputDigest", failures);
    if (bundle.generatedBundleDigest === subject.subjectDigest) {
      failures.push("generatedBundleDigest must not reuse subjectDigest.");
    }
    if (bundle.generatedBundleDigest === subject.evidenceArtifactDigest) {
      failures.push("generatedBundleDigest must not reuse GitHub artifact digest.");
    }
    if (bundle.generatedBundleDigest === subject.evidenceRootDigest) {
      failures.push("generatedBundleDigest must not reuse Evidence Root digest.");
    }
  } else {
    for (const file of bundle.generatedFiles ?? []) {
      if (!fs.existsSync(path.join(root, file))) failures.push(`generated file missing: ${file}.`);
    }
  }
  return { status: failures.length === 0 ? "PASS" : "NO_GO", failures };
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

export function digestObject(value) {
  return `sha256:${crypto.createHash("sha256").update(stableStringify(value)).digest("hex")}`;
}

export function readJsonIfExists(file, root = process.cwd()) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, "utf8").replace(/^\uFEFF/, ""));
}

function canonicalGeneratedContractBundle(bundle) {
  const normalized = {};
  for (const [key, value] of Object.entries(bundle ?? {})) {
    if (key === "generatedBundleDigest") continue;
    if (key === "subjectDigest") continue;
    if (key === "evidenceArtifactDigest") continue;
    if (key === "evidenceRootDigest") continue;
    if (key === "githubArtifactDigest") continue;
    if (key === "controlPlaneResultDigest") continue;
    normalized[key] = value;
  }
  return normalized;
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

function generatedFilesFromAcceptedSubject(subject) {
  const digestSet = Array.isArray(subject?.requiredGeneratedContractDigestSet)
    ? subject.requiredGeneratedContractDigestSet
    : [];
  return digestSet
    .map((item) => ({
      path: String(item.path ?? "").replace(/\\/g, "/"),
      digest: item.digest
    }))
    .filter((item) => item.path && digestPattern.test(String(item.digest ?? "")))
    .sort((left, right) => left.path.localeCompare(right.path));
}

function fileDigest(file, root) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) return "missing";
  const content = fs.readFileSync(full);
  return `sha256:${crypto.createHash("sha256").update(content).digest("hex")}`;
}

function requireArray(value, label, failures) {
  if (!Array.isArray(value) || value.length === 0) {
    failures.push(`${label} must be a non-empty array.`);
  }
}

function requireDigest(value, label, failures) {
  if (!digestPattern.test(String(value ?? ""))) failures.push(`${label} must be a sha256 digest.`);
}

function requireEqual(actual, expected, label, failures) {
  if (actual !== expected) failures.push(`${label} must be ${format(expected)}, actual ${format(actual)}.`);
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function format(value) {
  return JSON.stringify(value);
}
