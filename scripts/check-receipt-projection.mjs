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
const checkName = "check-receipt-projection";
const out = cli.value("out", "artifacts/oma/checks/receipt-projection-report.json");

function main() {
  if (cli.has("self-test")) {
    runSelfTest();
    return;
  }

  const files = ["docs/business/receipt-types.yml", ...listDocuments(`${positiveFixtureRoot}/receipts`)];
  const violations = [
    ...validateReceiptTypes("docs/business/receipt-types.yml"),
    ...validateReceiptFiles(listDocuments(`${positiveFixtureRoot}/receipts`))
  ];
  writeReport(out, checkName, violations, files);
  failIfViolations("Receipt projection check", violations);
  console.log(`Receipt projection check: PASS (${files.length} files)`);
}

function validateReceiptTypes(file) {
  const doc = readDocument(file);
  const violations = validateRequiredObject(doc, ["version", "receiptTypes"], file);
  for (const receiptType of doc.receiptTypes ?? []) {
    if (receiptType.projectionPolicy !== "referenceOnly") {
      violations.push(violation("receipt_type.not_reference_only", file, `${receiptType.id} must be referenceOnly.`));
    }
    for (const field of ["truthCopies", "centerTruthSnapshot", "ownerCommittedCopy"]) {
      if (!receiptType.forbiddenFields?.includes(field)) {
        violations.push(violation("receipt_type.forbidden_field_missing", file, `${receiptType.id} must forbid ${field}.`));
      }
    }
  }
  return violations;
}

function validateReceiptFiles(files) {
  const { centerTruthFacts } = loadTruthRegistry();
  const violations = [];
  for (const file of files) {
    const receipt = readDocument(file);
    violations.push(...validateRequiredObject(receipt, ["version", "receiptId", "receiptType", "sourceTruthFacts", "projectionPolicy"], file));
    if (receipt.projectionPolicy !== "referenceOnly") {
      violations.push(violation("receipt.not_reference_only", file, `${receipt.receiptId} must be referenceOnly.`));
    }
    const copied = [
      ...(receipt.truthCopies ?? []),
      ...(receipt.centerTruthSnapshot ? ["centerTruthSnapshot"] : []),
      ...(receipt.ownerCommittedCopy ? ["ownerCommittedCopy"] : [])
    ];
    if (copied.length > 0 && (receipt.sourceTruthFacts ?? []).some((fact) => centerTruthFacts.has(fact))) {
      violations.push(violation("receipt.copies_center_truth", file, `Receipt ${receipt.receiptId} must not copy center truth fields.`, { copiedFields: copied }));
    }
  }
  return violations;
}

function runSelfTest() {
  const good = validateReceiptFiles(listDocuments(`${positiveFixtureRoot}/receipts`));
  assertSelfTest(good.length === 0, `positive receipts must pass: ${good.map((item) => item.message).join("; ")}`);
  const bad = validateReceiptFiles(listDocuments(`${negativeFixtureRoot}/receipts`));
  assertSelfTest(bad.some((item) => item.id === "receipt.copies_center_truth"), "Receipt copying center truth must fail.");
  console.log("Receipt projection self-test: PASS");
}

main();
