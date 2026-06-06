import {
  assertSelfTest,
  failIfViolations,
  listDocuments,
  parseArgs,
  readDocument,
  validateRequiredObject,
  violation,
  writeReport
} from "./btos-compiler-lib.mjs";

const cli = parseArgs(process.argv.slice(2));
const checkName = "check-shared-governance-boundary";
const out = cli.value("out", "artifacts/oma/checks/shared-governance-boundary-report.json");
const policyPath = "docs/business/shared-governance/subject-vehicle-truth.yml";
const positiveRoot = "tests/fixtures/oma-shared-governance/positive";
const negativeRoot = "tests/fixtures/oma-shared-governance/negative";

function main() {
  if (cli.has("self-test")) {
    runSelfTest();
    return;
  }

  const policy = readDocument(policyPath);
  const files = [policyPath, ...listDocuments(positiveRoot)];
  const violations = [
    ...validatePolicy(policy, policyPath),
    ...validateScenarioFiles(listDocuments(positiveRoot), policy)
  ];
  writeReport(out, checkName, violations, files);
  failIfViolations("Shared governance boundary check", violations);
  console.log(`Shared governance boundary check: PASS (${files.length} files)`);
}

function validatePolicy(policy, file) {
  const violations = validateRequiredObject(policy, [
    "version",
    "packId",
    "ownsCenterTruth",
    "intakeFacts",
    "provisionalFacts",
    "stewardshipWorkItems",
    "receipts",
    "duplicatePolicy",
    "mergePolicy",
    "supersedePolicy",
    "appealPolicy",
    "businessPackRules",
    "conflictRouting",
    "crosswalkPolicy",
    "certification"
  ], file);

  const mustOwn = ["Subject", "Vehicle", "FormalRelationship"];
  for (const fact of mustOwn) {
    if (!policy.ownsCenterTruth?.includes(fact)) {
      violations.push(violation("shared_governance.missing_center_truth_owner", file, `SharedGovernancePack must own ${fact}.`, { fact }));
    }
  }
  for (const fact of ["SubjectIntake", "VehicleIntake"]) {
    if (!policy.intakeFacts?.includes(fact)) {
      violations.push(violation("shared_governance.missing_intake", file, `Shared governance must declare ${fact}.`, { fact }));
    }
  }
  for (const workItem of ["SubjectStewardshipWorkItem", "VehicleStewardshipWorkItem"]) {
    if (!policy.stewardshipWorkItems?.includes(workItem)) {
      violations.push(violation("shared_governance.missing_stewardship_workitem", file, `Shared governance must route conflicts to ${workItem}.`, { workItem }));
    }
  }
  if (!policy.mergePolicy?.requiredOutputs?.includes("MergedReceipt")) {
    violations.push(violation("shared_governance.merge_receipt_missing", file, "Subject merge must produce MergedReceipt."));
  }
  if (policy.conflictRouting?.requiresReviewWorkItem !== true || policy.conflictRouting?.vehicleConflictWorkItem !== "VehicleStewardshipWorkItem") {
    violations.push(violation("shared_governance.vehicle_conflict_review_missing", file, "Vehicle conflict must create a VehicleStewardshipWorkItem review."));
  }
  return violations;
}

function validateScenarioFiles(files, policy) {
  const violations = [];
  for (const file of files) {
    const scenario = readDocument(file);
    violations.push(...validateScenario(scenario, file, policy));
  }
  return violations;
}

function validateScenario(scenario, file, policy) {
  const violations = validateRequiredObject(scenario, [
    "scenarioId",
    "actorPack",
    "intent",
    "createsFacts",
    "consumesFacts",
    "commitMode",
    "usesRefs",
    "outputs",
    "workItem"
  ], file);

  const formalTruth = new Set(policy.businessPackRules?.mustNotCreateFormalTruth ?? ["Subject", "Vehicle", "FormalRelationship"]);
  const provisionalRefs = new Set(policy.businessPackRules?.financeCommitForbiddenRefs ?? ["ProvisionalSubject", "ProvisionalVehicle"]);
  const sharedPack = policy.packId;

  for (const fact of scenario.createsFacts ?? []) {
    if (scenario.actorPack !== sharedPack && formalTruth.has(fact)) {
      violations.push(violation("shared_governance.business_pack_formal_truth", file, `${scenario.actorPack} must not create formal ${fact}.`, { fact }));
    }
  }

  for (const fact of scenario.consumesFacts ?? []) {
    if (scenario.actorPack !== sharedPack && formalTruth.has(fact)) {
      violations.push(violation("shared_governance.business_pack_reads_formal_truth", file, `${scenario.actorPack} must read receipts or summaries, not formal ${fact}.`, { fact }));
    }
  }

  if (scenario.commitMode === "finalFinanceCommit") {
    for (const ref of scenario.usesRefs ?? []) {
      if (provisionalRefs.has(ref)) {
        violations.push(violation("shared_governance.provisional_ref_finance_commit", file, `${ref} must not be used for final finance commit.`, { ref }));
      }
    }
  }

  if (scenario.intent === "subjectMerge" && (!scenario.outputs?.includes("MergedReceipt") || !scenario.outputs?.includes("SubjectReceipt"))) {
    violations.push(violation("shared_governance.subject_merge_receipt_missing", file, "Subject merge must produce MergedReceipt and SubjectReceipt."));
  }

  if (scenario.intent === "vehicleConflict") {
    const hasReviewOutput = scenario.outputs?.includes("ReviewWorkItem") || scenario.outputs?.includes("VehicleStewardshipWorkItem");
    if (scenario.workItem !== "VehicleStewardshipWorkItem" || !hasReviewOutput) {
      violations.push(violation("shared_governance.vehicle_conflict_review_missing", file, "Vehicle conflict must produce a VehicleStewardshipWorkItem review."));
    }
  }

  return violations;
}

function runSelfTest() {
  const policy = readDocument(policyPath);
  const policyViolations = validatePolicy(policy, policyPath);
  assertSelfTest(policyViolations.length === 0, `policy must pass: ${policyViolations.map((item) => item.message).join("; ")}`);

  const good = validateScenarioFiles(listDocuments(positiveRoot), policy);
  assertSelfTest(good.length === 0, `positive shared governance fixtures must pass: ${good.map((item) => item.message).join("; ")}`);

  const bad = validateScenarioFiles(listDocuments(negativeRoot), policy);
  assertSelfTest(bad.some((item) => item.id === "shared_governance.business_pack_formal_truth" && item.fact === "Vehicle"), "RepairDomainPack creating formal Vehicle must fail.");
  assertSelfTest(bad.some((item) => item.id === "shared_governance.business_pack_formal_truth" && item.fact === "Subject"), "DormitoryDomainPack creating formal Subject must fail.");
  assertSelfTest(bad.some((item) => item.id === "shared_governance.provisional_ref_finance_commit" && item.ref === "ProvisionalSubject"), "ProvisionalSubject used for final finance commit must fail.");
  console.log("Shared governance boundary self-test: PASS");
}

main();
