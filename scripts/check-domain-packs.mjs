import {
  assertSelfTest,
  failIfViolations,
  listDocuments,
  loadTruthRegistry,
  negativeFixtureRoot,
  parseArgs,
  positiveFixtureRoot,
  readDocument,
  validateRequiredObject,
  violation,
  writeReport
} from "./btos-compiler-lib.mjs";

const cli = parseArgs(process.argv.slice(2));
const checkName = "check-domain-packs";
const out = cli.value("out", ".tmp/rt2/domain-pack-report.json");

function main() {
  if (cli.has("self-test")) {
    runSelfTest();
    return;
  }

  const files = [
    "docs/business/domains/_template/domain-pack.yml",
    ...listDocuments("docs/business/domains/dormitory"),
    ...listDocuments(`${positiveFixtureRoot}/domain-packs`)
  ];
  const violations = validateDomainPackFiles(files);
  writeReport(out, checkName, violations, files);
  failIfViolations("Domain pack check", violations);
  console.log(`Domain pack check: PASS (${files.length} files)`);
}

function validateDomainPackFiles(files) {
  const { centerTruthFacts } = loadTruthRegistry();
  const violations = [];
  for (const file of files) {
    const pack = readDocument(file);
    violations.push(...validateRequiredObject(pack, [
      "version",
      "packId",
      "domainId",
      "owner",
      "domainOwner",
      "ownedFacts",
      "requestedFacts",
      "events",
      "workitems",
      "evidence",
      "finance",
      "invariants",
      "certification",
      "goNoGo",
      "allowedCapabilities",
      "forbiddenCapabilities",
      "receiptPolicy",
      "managementCockpitBoundary"
    ], file));

    for (const fact of pack.ownedFacts ?? []) {
      if (centerTruthFacts.has(fact)) {
        violations.push(violation("domain_pack.owns_center_truth", file, `Domain Pack ${pack.packId} must not own center truth fact ${fact}.`, { fact }));
      }
      if (fact === "MoneyBasis" && !["FinanceTruthPack", "MoneyKernelPack"].includes(pack.owner)) {
        violations.push(violation("domain_pack.owns_money_basis", file, `MoneyBasis must enter FinanceTruthPack or MoneyKernelPack, not ${pack.owner}.`, { fact }));
      }
    }
    if (pack.allowedCapabilities?.includes("ownCenterTruth")) {
      violations.push(violation("domain_pack.own_center_truth_capability", file, `Domain Pack ${pack.packId} must not allow ownCenterTruth.`));
    }
    if (!Array.isArray(pack.events) || pack.events.length === 0) {
      violations.push(violation("domain_pack.events_missing", file, `Domain Pack ${pack.packId} must declare events.`));
    }
    if (!Array.isArray(pack.workitems) || pack.workitems.length === 0) {
      violations.push(violation("domain_pack.workitems_missing", file, `Domain Pack ${pack.packId} must declare workitems.`));
    }
    if (!pack.evidence || pack.evidence.policy !== "referenceOnly") {
      violations.push(violation("domain_pack.evidence_policy", file, `Domain Pack ${pack.packId} must declare referenceOnly evidence policy.`));
    }
    if (pack.finance?.moneyBasisPolicy !== "routeToFinanceTruthPack" || pack.finance?.ledgerPolicy !== "noDirectLedgerCommit") {
      violations.push(violation("domain_pack.finance_policy", file, `Domain Pack ${pack.packId} must route money basis and forbid direct ledger commit.`));
    }
    if (!Array.isArray(pack.invariants) || pack.invariants.length === 0) {
      violations.push(violation("domain_pack.invariants_missing", file, `Domain Pack ${pack.packId} must declare invariants.`));
    }
    if (!pack.certification || !Array.isArray(pack.certification.requiredScenarios) || pack.certification.requiredScenarios.length === 0) {
      violations.push(violation("domain_pack.certification_missing", file, `Domain Pack ${pack.packId} must declare certification scenarios.`));
    }
    if (pack.goNoGo?.productionAllowedDefault !== false) {
      violations.push(violation("domain_pack.go_no_go", file, `Domain Pack ${pack.packId} must default productionAllowed to false.`));
    }
    if (pack.receiptPolicy !== "referenceOnly") {
      violations.push(violation("domain_pack.receipt_policy", file, `Domain Pack ${pack.packId} must keep receipts referenceOnly.`));
    }
    if (pack.managementCockpitBoundary !== "observeAndRouteOnly") {
      violations.push(violation("domain_pack.management_boundary", file, `Domain Pack ${pack.packId} must keep ManagementCockpit observeAndRouteOnly.`));
    }
  }
  return violations;
}

function runSelfTest() {
  const good = validateDomainPackFiles(listDocuments(`${positiveFixtureRoot}/domain-packs`));
  assertSelfTest(good.length === 0, `positive domain packs must pass: ${good.map((item) => item.message).join("; ")}`);
  const bad = validateDomainPackFiles(listDocuments(`${negativeFixtureRoot}/domain-packs`));
  assertSelfTest(bad.some((item) => item.id === "domain_pack.owns_center_truth" && item.fact === "PaymentFact"), "Domain Pack owning PaymentFact must fail.");
  assertSelfTest(bad.some((item) => item.id === "domain_pack.owns_center_truth" && item.fact === "Subject"), "Domain Pack owning Subject must fail.");
  assertSelfTest(bad.some((item) => item.id === "domain_pack.owns_center_truth" && item.fact === "Vehicle"), "Domain Pack owning Vehicle must fail.");
  console.log("Domain pack self-test: PASS");
}

main();
