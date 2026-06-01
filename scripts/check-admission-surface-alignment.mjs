import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const admissionRoot = path.join(root, "docs/business/admission");
const surfacePath = path.join(root, "docs/contracts/runtime-surface-policy.json");

if (process.argv.includes("--self-test")) {
  const violations = l0SurfaceViolations(
    [
      {
        businessLineId: "repair",
        displayName: "Repair",
        level: "L0 Contract Preview",
        productionAllowed: false,
        productionWriteRoutes: [],
        pageSpecificWriteApis: [],
        productionWorkItems: []
      }
    ],
    [
      {
        sliceId: "Repair.Request",
        domainGroup: "Repair",
        home: { section: "repair-operations" },
        workbench: { queueRule: "ready_or_blocked_cards" },
        search: { intentTags: ["repair_request"] },
        learning: { section: "Repair / Request" },
        cards: []
      }
    ]
  );
  assert(violations.length >= 4, "self-test must detect L0 production-like surface violations");
  console.log("Admission surface alignment self-test: PASS");
  process.exit(0);
}

const admissions = fs.readdirSync(admissionRoot)
  .filter(file => file.endsWith("-l0-admission.yml"))
  .map(file => ({ file, ...readJson(path.join(admissionRoot, file)) }));
const surface = readJson(surfacePath);
const violations = l0SurfaceViolations(admissions, surface.policies ?? []);

if (violations.length > 0) {
  for (const violation of violations) {
    console.error(violation);
  }
  throw new Error(`Admission surface alignment failed: ${violations.length} violation(s)`);
}

console.log(`Admission surface alignment check: PASS (${admissions.length} L0 admissions)`);

function l0SurfaceViolations(admissions, policies) {
  const result = [];
  for (const admission of admissions) {
    if (admission.level !== "L0 Contract Preview" || admission.productionAllowed !== false) {
      result.push(`${admission.file ?? admission.businessLineId}: L0 admission must keep productionAllowed=false`);
    }
    for (const field of ["productionWriteRoutes", "pageSpecificWriteApis", "productionWorkItems"]) {
      if ((admission[field] ?? []).length > 0) {
        result.push(`${admission.file ?? admission.businessLineId}: ${field} must be empty for L0`);
      }
    }

    const displayName = admission.displayName ?? admission.businessLineId;
    const linePolicies = policies.filter(policy =>
      equals(policy.domainGroup, displayName) ||
      (policy.sliceId ?? "").toLowerCase().startsWith(`${displayName}`.toLowerCase() + "."));
    for (const policy of linePolicies) {
      const prefix = `${admission.businessLineId}:${policy.sliceId}`;
      if (policy.home?.section !== "contract-preview") {
        result.push(`${prefix}: L0 home.section must be contract-preview`);
      }
      if (policy.workbench?.queueRule !== "prepare_only") {
        result.push(`${prefix}: L0 workbench.queueRule must be prepare_only`);
      }
      if (!(policy.search?.intentTags ?? []).includes("contract_preview")) {
        result.push(`${prefix}: L0 search.intentTags must include contract_preview`);
      }
      if (!(policy.learning?.section ?? "").startsWith("Contract Preview")) {
        result.push(`${prefix}: L0 learning.section must start with Contract Preview`);
      }
      for (const card of policy.cards ?? []) {
        if (!(card.intentTags ?? []).includes("contract_preview")) {
          result.push(`${prefix}/${card.cardId}: L0 card intentTags must include contract_preview`);
        }
        if (!(card.learningSection ?? "").startsWith("Contract Preview")) {
          result.push(`${prefix}/${card.cardId}: L0 card learningSection must start with Contract Preview`);
        }
      }
    }
  }
  return result;
}

function readJson(file) {
  assert(fs.existsSync(file), `Missing file: ${file}`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function equals(left, right) {
  return `${left ?? ""}`.localeCompare(`${right ?? ""}`, undefined, { sensitivity: "accent" }) === 0;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
