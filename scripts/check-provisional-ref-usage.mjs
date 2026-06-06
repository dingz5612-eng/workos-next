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
const checkName = "check-provisional-ref-usage";
const out = cli.value("out", "artifacts/oam/checks/provisional-ref-report.json");

function main() {
  if (cli.has("self-test")) {
    runSelfTest();
    return;
  }

  const files = listDocuments(`${positiveFixtureRoot}/provisional-ref-usage`);
  const violations = validatePromotionFiles(files);
  writeReport(out, checkName, violations, files);
  failIfViolations("ProvisionalRef usage check", violations);
  console.log(`ProvisionalRef usage check: PASS (${files.length} files)`);
}

function validatePromotionFiles(files) {
  const { ownersByFact } = loadTruthRegistry();
  const violations = [];
  for (const file of files) {
    const promotion = readDocument(file);
    violations.push(...validateRequiredObject(promotion, ["version", "promotionId", "fromLevel", "toLevel", "committer", "sourceRefType", "targetFact", "operation"], file));
    const owner = ownersByFact.get(promotion.targetFact);
    const usesProvisionalRef = promotion.sourceRefType === "ProvisionalRef" || promotion.fromLevel === "provisionalRef";
    const commitsLedger = promotion.operation === "ledgerCommit" || promotion.toLevel === "ownerCommitted";
    if (usesProvisionalRef && commitsLedger) {
      violations.push(violation("provisional_ref.ledger_commit", file, `ProvisionalRef must not be used for ledger commit into ${promotion.targetFact}.`, { targetFact: promotion.targetFact }));
    }
    if (commitsLedger && owner && !owner.allowedCommitters.includes(promotion.committer)) {
      violations.push(violation("truth_owner.non_owner_commit", file, `${promotion.committer} is not allowed to commit ${promotion.targetFact}.`));
    }
  }
  return violations;
}

function runSelfTest() {
  const good = validatePromotionFiles(listDocuments(`${positiveFixtureRoot}/provisional-ref-usage`));
  assertSelfTest(good.length === 0, `positive ProvisionalRef usage must pass: ${good.map((item) => item.message).join("; ")}`);
  const bad = validatePromotionFiles(listDocuments(`${negativeFixtureRoot}/provisional-ref-usage`));
  assertSelfTest(bad.some((item) => item.id === "provisional_ref.ledger_commit" && item.targetFact === "PaymentFact"), "ProvisionalRef used for ledger commit must fail.");
  console.log("ProvisionalRef usage self-test: PASS");
}

main();
