import {
  assertSelfTest,
  failIfViolations,
  loadTruthRegistry,
  parseArgs,
  readDocument,
  validateRequiredObject,
  violation,
  writeReport
} from "./btos-compiler-lib.mjs";

const cli = parseArgs(process.argv.slice(2));
const checkName = "check-truth-owners";
const out = cli.value("out", "artifacts/oam/checks/truth-owner-report.json");

function main() {
  if (cli.has("self-test")) {
    runSelfTest();
    return;
  }

  const violations = validateTruthOwners("docs/business/truth-owner-registry.yml");
  writeReport(out, checkName, violations, ["docs/business/truth-owner-registry.yml"]);
  failIfViolations("Truth owner registry check", violations);
  console.log("Truth owner registry check: PASS");
}

function validateTruthOwners(file) {
  const doc = readDocument(file);
  const violations = validateRequiredObject(doc, ["version", "registryId", "defaultPolicy", "truthOwners"], file);
  const seen = new Set();

  if (!Array.isArray(doc.truthOwners) || doc.truthOwners.length === 0) {
    violations.push(violation("truth_owner.empty", file, "truthOwners must contain at least one owner."));
    return violations;
  }

  for (const entry of doc.truthOwners) {
    for (const field of ["factId", "owner", "truthLevel", "allowedCommitters", "forbiddenOwners", "receiptProjection", "provisionalRefPolicy"]) {
      if (!(field in entry)) {
        violations.push(violation("truth_owner.missing_field", file, `${entry.factId ?? "unknown"} missing ${field}.`));
      }
    }
    if (seen.has(entry.factId)) {
      violations.push(violation("truth_owner.duplicate_fact", file, `Duplicate truth owner for ${entry.factId}.`));
    }
    seen.add(entry.factId);
    if (entry.truthLevel === "centerTruth" && !entry.forbiddenOwners?.includes("domain-pack")) {
      violations.push(violation("truth_owner.domain_pack_not_forbidden", file, `${entry.factId} must forbid domain-pack ownership.`));
    }
    if (entry.truthLevel === "centerTruth" && entry.receiptProjection !== "referenceOnly") {
      violations.push(violation("truth_owner.receipt_not_reference_only", file, `${entry.factId} receipts must be referenceOnly.`));
    }
    if (entry.factId?.endsWith("Fact") && !entry.allowedCommitters?.includes(entry.owner)) {
      violations.push(violation("truth_owner.owner_not_committer", file, `${entry.factId} owner must be an allowed committer.`));
    }
  }

  const requiredOwners = new Map([
    ["Subject", "SharedGovernancePack"],
    ["Vehicle", "SharedGovernancePack"],
    ["SubjectRelationship", "SharedGovernancePack"],
    ["SubjectVehicleRelationship", "SharedGovernancePack"],
    ["Room", "accommodation.resource"],
    ["Bed", "accommodation.resource"],
    ["AccommodationOrder", "accommodation.lifecycle"],
    ["AmountBasis", "FinanceTruthPack"],
    ["PaymentFact", "FinanceTruthPack"],
    ["DepositFact", "FinanceTruthPack"],
    ["FinancialFact", "FinanceTruthPack"],
    ["LedgerTransaction", "MoneyKernelPack"],
    ["LedgerEntry", "MoneyKernelPack"],
    ["EvidenceObject", "EvidenceTrustPack"],
    ["MoneyBasis", "FinanceTruthPack"],
    ["StayFact", "accommodation.stay"],
    ["ExceptionCase", "operations-runtime"],
    ["DecisionIntent", "control-plane-command"],
    ["SharedReceipt", "SharedGovernancePack"],
    ["DashboardSummary", "projection-kernel"],
    ["Profile", "SharedGovernancePack"]
  ]);

  for (const [required, owner] of requiredOwners) {
    if (!seen.has(required)) {
      violations.push(violation("truth_owner.required_fact_missing", file, `Missing required current OAM truth fact: ${required}.`));
      continue;
    }
    const entry = doc.truthOwners.find((item) => item.factId === required);
    if (entry?.owner !== owner) {
      violations.push(violation("truth_owner.required_owner_mismatch", file, `${required} must be owned by ${owner}.`));
    }
  }

  violations.push(...validateBusinessOperatingObjects(doc, seen, file));

  return violations;
}

function validateBusinessOperatingObjects(doc, truthFactIds, file) {
  const violations = [];
  const requiredObjects = [
    "Subject",
    "Vehicle",
    "SubjectRelationship",
    "SubjectVehicleRelationship",
    "Room",
    "Bed",
    "Stay/AccommodationOrder",
    "AmountBasis",
    "FinancialFact",
    "LedgerEntry",
    "EvidenceObject",
    "ExceptionCase",
    "DecisionIntent",
    "SharedReceipt",
    "DashboardSummary",
    "Profile"
  ];
  const objects = doc.businessOperatingObjects ?? [];
  if (!Array.isArray(objects) || objects.length === 0) {
    violations.push(violation("business_object.empty", file, "businessOperatingObjects must define current OAM operating objects."));
    return violations;
  }

  const seenObjects = new Set();
  for (const object of objects) {
    for (const field of [
      "objectId",
      "chineseName",
      "ownerDomain",
      "sourceOfTruth",
      "writable",
      "writePath",
      "readonly",
      "readOnlyUsage",
      "searchable",
      "metrics",
      "forbiddenUse",
      "maturityScope"
    ]) {
      if (!(field in object)) {
        violations.push(violation("business_object.missing_field", file, `${object.objectId ?? "unknown"} missing ${field}.`));
      }
    }
    if (seenObjects.has(object.objectId)) {
      violations.push(violation("business_object.duplicate", file, `Duplicate business operating object ${object.objectId}.`));
    }
    seenObjects.add(object.objectId);

    const linkedFacts = String(object.objectId ?? "").split("/");
    if (!linkedFacts.some((fact) => truthFactIds.has(fact) || (fact === "Stay" && truthFactIds.has("StayFact")))) {
      violations.push(violation("business_object.truth_owner_missing", file, `${object.objectId} must map to a truth owner fact.`));
    }
    if (object.writable === true && !object.writePath) {
      violations.push(violation("business_object.write_path_missing", file, `${object.objectId} is writable and must declare writePath.`));
    }
    if (object.readonly === true && object.writable !== false) {
      violations.push(violation("business_object.readonly_writable", file, `${object.objectId} cannot be readonly and writable.`));
    }
    if (object.readonly === true && object.writePath !== null) {
      violations.push(violation("business_object.readonly_write_path", file, `${object.objectId} is readonly and must not declare writePath.`));
    }
    if (!Array.isArray(object.readOnlyUsage) || object.readOnlyUsage.length === 0) {
      violations.push(violation("business_object.read_usage_missing", file, `${object.objectId} must declare readOnlyUsage.`));
    }
    if (!Array.isArray(object.forbiddenUse) || object.forbiddenUse.length === 0) {
      violations.push(violation("business_object.forbidden_use_missing", file, `${object.objectId} must declare forbiddenUse.`));
    }
  }

  for (const objectId of requiredObjects) {
    if (!seenObjects.has(objectId)) {
      violations.push(violation("business_object.required_missing", file, `Missing required current OAM operating object: ${objectId}.`));
    }
  }
  return violations;
}

function runSelfTest() {
  const { ownersByFact, centerTruthFacts } = loadTruthRegistry();
  assertSelfTest(ownersByFact.get("Subject")?.owner === "SharedGovernancePack", "Subject owner must be SharedGovernancePack.");
  assertSelfTest(ownersByFact.get("Vehicle")?.owner === "SharedGovernancePack", "Vehicle owner must be SharedGovernancePack.");
  assertSelfTest(ownersByFact.get("SubjectRelationship")?.owner === "SharedGovernancePack", "SubjectRelationship owner must be SharedGovernancePack.");
  assertSelfTest(ownersByFact.get("SubjectVehicleRelationship")?.owner === "SharedGovernancePack", "SubjectVehicleRelationship owner must be SharedGovernancePack.");
  assertSelfTest(ownersByFact.get("Room")?.owner === "accommodation.resource", "Room owner must be accommodation.resource.");
  assertSelfTest(ownersByFact.get("Bed")?.owner === "accommodation.resource", "Bed owner must be accommodation.resource.");
  assertSelfTest(ownersByFact.get("AccommodationOrder")?.owner === "accommodation.lifecycle", "AccommodationOrder owner must be accommodation.lifecycle.");
  assertSelfTest(ownersByFact.get("AmountBasis")?.owner === "FinanceTruthPack", "AmountBasis owner must be FinanceTruthPack.");
  assertSelfTest(ownersByFact.get("PaymentFact")?.owner === "FinanceTruthPack", "PaymentFact owner must be FinanceTruthPack.");
  assertSelfTest(ownersByFact.get("DepositFact")?.owner === "FinanceTruthPack", "DepositFact owner must be FinanceTruthPack.");
  assertSelfTest(ownersByFact.get("FinancialFact")?.owner === "FinanceTruthPack", "FinancialFact owner must be FinanceTruthPack.");
  assertSelfTest(ownersByFact.get("LedgerTransaction")?.owner === "MoneyKernelPack", "LedgerTransaction owner must be MoneyKernelPack.");
  assertSelfTest(ownersByFact.get("LedgerEntry")?.owner === "MoneyKernelPack", "LedgerEntry owner must be MoneyKernelPack.");
  assertSelfTest(ownersByFact.get("EvidenceObject")?.owner === "EvidenceTrustPack", "EvidenceObject owner must be EvidenceTrustPack.");
  assertSelfTest(centerTruthFacts.has("PaymentFact"), "PaymentFact must be center truth.");
  assertSelfTest(validateTruthOwners("docs/business/truth-owner-registry.yml").length === 0, "registry fixture must pass.");
  console.log("Truth owner registry self-test: PASS");
}

main();
