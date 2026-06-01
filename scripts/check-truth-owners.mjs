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
const out = cli.value("out", ".tmp/rt2/truth-owner-report.json");

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
    ["PaymentFact", "FinanceTruthPack"],
    ["DepositFact", "FinanceTruthPack"],
    ["LedgerTransaction", "MoneyKernelPack"],
    ["EvidenceObject", "EvidenceTrustPack"],
    ["MoneyBasis", "FinanceTruthPack"],
    ["StayFact", "accommodation.stay"]
  ]);

  for (const [required, owner] of requiredOwners) {
    if (!seen.has(required)) {
      violations.push(violation("truth_owner.required_fact_missing", file, `Missing required RT-2 truth fact: ${required}.`));
      continue;
    }
    const entry = doc.truthOwners.find((item) => item.factId === required);
    if (entry?.owner !== owner) {
      violations.push(violation("truth_owner.required_owner_mismatch", file, `${required} must be owned by ${owner}.`));
    }
  }

  return violations;
}

function runSelfTest() {
  const { ownersByFact, centerTruthFacts } = loadTruthRegistry();
  assertSelfTest(ownersByFact.get("Subject")?.owner === "SharedGovernancePack", "Subject owner must be SharedGovernancePack.");
  assertSelfTest(ownersByFact.get("Vehicle")?.owner === "SharedGovernancePack", "Vehicle owner must be SharedGovernancePack.");
  assertSelfTest(ownersByFact.get("PaymentFact")?.owner === "FinanceTruthPack", "PaymentFact owner must be FinanceTruthPack.");
  assertSelfTest(ownersByFact.get("DepositFact")?.owner === "FinanceTruthPack", "DepositFact owner must be FinanceTruthPack.");
  assertSelfTest(ownersByFact.get("LedgerTransaction")?.owner === "MoneyKernelPack", "LedgerTransaction owner must be MoneyKernelPack.");
  assertSelfTest(ownersByFact.get("EvidenceObject")?.owner === "EvidenceTrustPack", "EvidenceObject owner must be EvidenceTrustPack.");
  assertSelfTest(centerTruthFacts.has("PaymentFact"), "PaymentFact must be center truth.");
  assertSelfTest(validateTruthOwners("docs/business/truth-owner-registry.yml").length === 0, "registry fixture must pass.");
  console.log("Truth owner registry self-test: PASS");
}

main();
