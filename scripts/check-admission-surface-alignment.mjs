import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const admissionRoot = path.join(root, "docs/business/admission");
const surfacePath = path.join(root, "docs/contracts/runtime-surface-policy.json");

const surface = JSON.parse(fs.readFileSync(surfacePath, "utf8"));
const policies = surface.policies ?? [];
const policyBySlice = new Map(policies.map((policy) => [policy.sliceId, policy]));
const admissionFiles = fs
  .readdirSync(admissionRoot)
  .filter((file) => file.endsWith("-l0-admission.yml"))
  .sort();

const violations = [];

for (const file of admissionFiles) {
  const admission = readAdmission(file);
  const isL0 =
    admission.level === "L0 Contract Preview" ||
    admission.admissionLevel === "L0 Contract Preview" ||
    admission.productionAllowed === false ||
    admission.answers?.productionForbidden === true;

  if (!isL0) {
    continue;
  }

  assertArrayEmpty(admission.productionWriteRoutes, file, "productionWriteRoutes");
  assertArrayEmpty(admission.pageSpecificWriteApis, file, "pageSpecificWriteApis");
  assertArrayEmpty(admission.productionWorkItems, file, "productionWorkItems");

  for (const scope of admission.domainScopes ?? []) {
    const policy = policyBySlice.get(scope);
    if (!policy) {
      continue;
    }

    requirePreviewSurface(file, scope, policy);
  }
}

if (violations.length > 0) {
  for (const violation of violations) {
    console.error(`Admission surface alignment violation: ${violation}`);
  }
  process.exit(1);
}

console.log("Admission surface alignment check: PASS");

function readAdmission(file) {
  return JSON.parse(fs.readFileSync(path.join(admissionRoot, file), "utf8"));
}

function assertArrayEmpty(value, file, field) {
  if (!Array.isArray(value) || value.length !== 0) {
    violations.push(`${file} must keep ${field} empty while L0 Contract Preview`);
  }
}

function requirePreviewSurface(file, scope, policy) {
  const homeSection = policy.home?.section ?? "";
  const queueRule = policy.workbench?.queueRule ?? "";
  const intentTags = policy.search?.intentTags ?? [];
  const learningSection = policy.learning?.section ?? "";

  if (homeSection !== "contract-preview") {
    violations.push(`${file}:${scope} home.section must be contract-preview, got ${homeSection || "<missing>"}`);
  }

  if (queueRule !== "prepare_only") {
    violations.push(`${file}:${scope} workbench.queueRule must be prepare_only, got ${queueRule || "<missing>"}`);
  }

  if (queueRule === "ready_or_blocked_cards") {
    violations.push(`${file}:${scope} must not enter ready_or_blocked_cards while L0 Contract Preview`);
  }

  if (!intentTags.includes("contract_preview")) {
    violations.push(`${file}:${scope} search.intentTags must include contract_preview`);
  }

  if (!learningSection.startsWith("Contract Preview")) {
    violations.push(`${file}:${scope} learning.section must start with Contract Preview`);
  }

  if (homeSection === "production" || homeSection === "operations" || homeSection.endsWith("-operations")) {
    violations.push(`${file}:${scope} must not use production-like home.section ${homeSection}`);
  }

  for (const card of policy.cards ?? []) {
    const cardTags = card.intentTags ?? [];
    const cardLearning = card.learningSection ?? "";
    if (!cardTags.includes("contract_preview")) {
      violations.push(`${file}:${scope}:${card.cardId ?? "<card>"} card.intentTags must include contract_preview`);
    }

    if (!cardLearning.startsWith("Contract Preview")) {
      violations.push(`${file}:${scope}:${card.cardId ?? "<card>"} card.learningSection must start with Contract Preview`);
    }
  }
}
