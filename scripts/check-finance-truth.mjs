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
import fs from "node:fs";

const cli = parseArgs(process.argv.slice(2));
const checkName = "check-finance-truth";
const out = cli.value("out", "artifacts/oam/checks/finance-truth-report.json");
const positiveRoot = "tests/fixtures/oam-finance-truth/positive";
const negativeRoot = "tests/fixtures/oam-finance-truth/negative";

function main() {
  if (cli.has("self-test")) {
    runSelfTest();
    return;
  }

  const files = [
    "docs/business/finance/finance-truth-pipeline.yml",
    "docs/business/finance/money-kernel-rules.yml",
    "docs/business/finance/ledger-transaction-contract.yml",
    "docs/business/finance/unclear-money-policy.yml",
    "docs/business/finance/correction-policy.yml",
    "schemas/finance-truth-pipeline.schema.json",
    ...listDocuments(positiveRoot)
  ];
  const violations = [
    ...validateContracts(),
    ...validateScenarioFiles(listDocuments(positiveRoot), false),
    ...validateSourceBindings()
  ];
  writeReport(out, checkName, violations, files);
  failIfViolations("Finance truth check", violations);
  console.log(`Finance truth check: PASS (${files.length} files)`);
}

function validateContracts() {
  const violations = [];
  const pipeline = readDocument("docs/business/finance/finance-truth-pipeline.yml");
  violations.push(...validateRequiredObject(pipeline, [
    "version",
    "packId",
    "moneyKernelPack",
    "acceptedInputs",
    "forbiddenDirectFacts",
    "pipeline",
    "runtimeServices",
    "truthRules",
    "unclearMoneyPolicy",
    "certification",
    "goNoGo"
  ], "docs/business/finance/finance-truth-pipeline.yml"));

  if (pipeline.packId !== "FinanceTruthPack" || pipeline.moneyKernelPack !== "MoneyKernelPack") {
    violations.push(violation("finance_truth.owner_mismatch", "docs/business/finance/finance-truth-pipeline.yml", "FinanceTruthPack and MoneyKernelPack ownership must be explicit."));
  }
  for (const fact of ["PaymentFact", "DepositFact", "LedgerEntry"]) {
    if (!pipeline.forbiddenDirectFacts?.includes(fact)) {
      violations.push(violation("finance_truth.missing_forbidden_direct_fact", "docs/business/finance/finance-truth-pipeline.yml", `${fact} must be forbidden as direct business-domain output.`, { fact }));
    }
  }
  for (const service of ["FinanceTruthPipeline", "DepositAccountService", "PaymentAllocationService", "LedgerProjectionRebuilder", "DepositRefundService"]) {
    if (!pipeline.runtimeServices?.includes(service)) {
      violations.push(violation("finance_truth.missing_runtime_service", "docs/business/finance/finance-truth-pipeline.yml", `${service} must be declared.`, { service }));
    }
  }
  if (pipeline.truthRules?.bankImportDirectPaymentConfirmedAllowed !== false) {
    violations.push(violation("finance_truth.bank_import_direct_payment", "docs/business/finance/finance-truth-pipeline.yml", "Bank import must not directly create PaymentConfirmed."));
  }
  if (pipeline.goNoGo?.productionAllowed !== false) {
    violations.push(violation("finance_truth.production_claim", "docs/business/finance/finance-truth-pipeline.yml", "OAM finance-gate must not declare production allowed."));
  }

  const kernel = readDocument("docs/business/finance/money-kernel-rules.yml");
  const requiredMoneyKernelRules = [
    "money-kernel-003",
    "money-kernel-004",
    "money-kernel-006"
  ];
  const moneyKernelRuleIds = new Set((kernel.rules ?? []).map((item) => item.id));
  for (const required of requiredMoneyKernelRules) {
    if (!moneyKernelRuleIds.has(required)) {
      violations.push(violation("finance_truth.money_kernel_rule_missing", "docs/business/finance/money-kernel-rules.yml", `缺少 Money Kernel 规则: ${required}.`, { required }));
    }
  }
  if (kernel.accountMappings?.deposit_receipt?.credit !== "liability.deposit") {
    violations.push(violation("finance_truth.deposit_liability_mapping_missing", "docs/business/finance/money-kernel-rules.yml", "押金收取必须贷记 liability.deposit。"));
  }
  if (kernel.accountMappings?.refund_deposit?.debit !== "liability.deposit") {
    violations.push(violation("finance_truth.refund_liability_mapping_missing", "docs/business/finance/money-kernel-rules.yml", "押金退款必须借记 liability.deposit。"));
  }
  if (kernel.accountMappings?.ledger_correction_apply?.debit !== "correction.reversal" || kernel.accountMappings?.ledger_correction_apply?.credit !== "correction.offset") {
    violations.push(violation("finance_truth.correction_mapping_missing", "docs/business/finance/money-kernel-rules.yml", "财务纠错必须使用 reversal 与 compensation 映射。"));
  }

  const ledger = readDocument("docs/business/finance/ledger-transaction-contract.yml");
  if (ledger.mutationPolicy?.updateLedgerEntryAllowed !== false || ledger.mutationPolicy?.deleteLedgerEntryAllowed !== false) {
    violations.push(violation("finance_truth.ledger_mutation_allowed", "docs/business/finance/ledger-transaction-contract.yml", "LedgerEntry update/delete must be forbidden."));
  }

  const unclear = readDocument("docs/business/finance/unclear-money-policy.yml");
  if (unclear.routing?.caseType !== "UnclearMoneyCase" || unclear.routing?.ledgerTransactionAllowedBeforeResolution !== false) {
    violations.push(violation("finance_truth.unclear_money_not_blocking_ledger", "docs/business/finance/unclear-money-policy.yml", "Unclear money must route to UnclearMoneyCase before ledger commit."));
  }

  const correction = readDocument("docs/business/finance/correction-policy.yml");
  if (!correction.allowedModes?.includes("reversal") || !correction.allowedModes?.includes("compensation")) {
    violations.push(violation("finance_truth.correction_modes_missing", "docs/business/finance/correction-policy.yml", "Correction policy must allow reversal and compensation only."));
  }
  return violations;
}

function validateScenarioFiles(files, expectNegative) {
  const violations = [];
  for (const file of files) {
    const scenario = readDocument(file);
    violations.push(...validateRequiredObject(scenario, [
      "scenarioId",
      "sourcePack",
      "inputFact",
      "basisType",
      "targetFact",
      "amount",
      "currency"
    ], file));
    violations.push(...validateScenario(scenario, file, expectNegative));
  }
  return violations;
}

function validateScenario(scenario, file, expectNegative) {
  const violations = [];
  const directFacts = new Set(["PaymentFact", "DepositFact", "LedgerEntry"]);
  if (directFacts.has(scenario.inputFact) || directFacts.has(scenario.targetFact)) {
    violations.push(violation("finance_truth.direct_fact_commit", file, "Business/adapter path must not commit PaymentFact, DepositFact, or LedgerEntry directly.", { fact: scenario.targetFact }));
  }
  if (scenario.inputFact === "PaymentConfirmed" || scenario.basisType === "bank_import_payment_confirmed") {
    violations.push(violation("finance_truth.bank_import_direct_payment_confirmed", file, "Bank import must create FinanceIntake or MoneyBasis, not PaymentConfirmed."));
  }
  if (scenario.basisType === "deposit_receipt" && scenario.expectedLedger?.creditAccount?.includes("revenue")) {
    violations.push(violation("finance_truth.deposit_as_revenue", file, "Deposit receipt must credit liability, not revenue."));
  }
  if (scenario.basisType === "refund_deposit" && !scenario.depositAccountId) {
    violations.push(violation("finance_truth.missing_deposit_account_ref", file, "RefundDeposit must reference original deposit account."));
  }
  if (scenario.basisType === "refund_deposit" && Number(scenario.amount) > Number(scenario.availableLiability ?? scenario.amount)) {
    violations.push(violation("finance_truth.refund_exceeds_liability", file, "Refund/deduction cannot exceed available liability."));
  }
  if (scenario.expectedLedger?.balanced === false) {
    violations.push(violation("finance_truth.unbalanced_transaction", file, "LedgerTransaction must balance."));
  }
  if (scenario.basisType === "payment_receipt" && scenario.expectedLedger?.forbiddenAccountIds?.includes("liability.deposit")) {
    // This is a positive assertion, not a violation.
  }
  if (!expectNegative && scenario.expectedLedger?.balanced !== true) {
    violations.push(violation("finance_truth.positive_fixture_not_balanced", file, "Positive money fixture must expect a balanced ledger transaction."));
  }
  return violations;
}

function validateSourceBindings() {
  const violations = [];
  const source = readText("services/core-api/WorkOS.Api/Runtime/FinanceTruthKernel.cs");
  for (const token of [
    "MoneyBasis",
    "FinanceIntake",
    "FinanceCase",
    "FinanceReviewWorkItem",
    "FinanceCommit",
    "FinanceReceipt",
    "UnclearMoneyCase",
    "DepositAccountService",
    "PaymentAllocationService",
    "LedgerProjectionRebuilder",
    "DepositRefundService",
    "finance_truth_blocks_bank_import_direct_payment_confirmed",
    "finance_truth_requires_original_deposit_account",
    "deposit_refund_or_deduction_exceeds_available_liability"
  ]) {
    if (!source.includes(token)) {
      violations.push(violation("finance_truth.runtime_binding_missing", "services/core-api/WorkOS.Api/Runtime/FinanceTruthKernel.cs", `Missing runtime token ${token}.`, { token }));
    }
  }
  if (!readText("services/core-api/WorkOS.Api/Runtime/BalancedMoneyKernel.cs").includes("FinanceTruthPipeline.Commit")) {
    violations.push(violation("finance_truth.balanced_kernel_not_routed", "services/core-api/WorkOS.Api/Runtime/BalancedMoneyKernel.cs", "BalancedMoneyKernel must route money facts through FinanceTruthPipeline."));
  }
  for (const testFile of [
    "tests/WorkOS.UnitTests/MoneyAllocationPropertyTests.cs",
    "tests/WorkOS.UnitTests/DepositRefundBoundaryTests.cs",
    "tests/WorkOS.UnitTests/LedgerMutationKillTests.cs"
  ]) {
    if (!exists(testFile)) {
      violations.push(violation("finance_truth.test_missing", testFile, `${testFile} must exist.`));
    }
  }
  if (!readText(".github/workflows/ci.yml").includes("check-finance-truth.mjs")) {
    violations.push(violation("finance_truth.ci_missing", ".github/workflows/ci.yml", "CI must run check-finance-truth.mjs."));
  }
  return violations;
}

function runSelfTest() {
  const positive = validateScenarioFiles(listDocuments(positiveRoot), false);
  assertSelfTest(positive.length === 0, `positive finance truth fixtures must pass: ${positive.map((item) => item.message).join("; ")}`);
  const negative = validateScenarioFiles(listDocuments(negativeRoot), true);
  assertSelfTest(negative.some((item) => item.id === "finance_truth.deposit_as_revenue"), "deposit-as-revenue fixture must fail.");
  assertSelfTest(negative.some((item) => item.id === "finance_truth.direct_fact_commit"), "business-domain direct LedgerEntry fixture must fail.");
  assertSelfTest(negative.some((item) => item.id === "finance_truth.unbalanced_transaction"), "unbalanced transaction fixture must fail.");
  assertSelfTest(negative.some((item) => item.id === "finance_truth.refund_exceeds_liability"), "refund over liability fixture must fail.");
  assertSelfTest(negative.some((item) => item.id === "finance_truth.bank_import_direct_payment_confirmed"), "bank import direct PaymentConfirmed fixture must fail.");
  console.log("Finance truth self-test: PASS");
}

function exists(file) {
  return fs.existsSync(new URL(`../${file}`, import.meta.url));
}

function readText(file) {
  const url = new URL(`../${file}`, import.meta.url);
  if (!fs.existsSync(url)) {
    return "";
  }
  return fs.readFileSync(url, "utf8");
}

main();
