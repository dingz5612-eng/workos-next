import { failIfNeeded, readJson, writeJson } from "../oam/clean-baseline-lib.mjs";

const generatedAtUtc = new Date().toISOString();
const failures = [];
const replay = readJson("artifacts/go-live/dormitory/live-api-db-replay-result.json");
const dailyClose = readJson("artifacts/go-live/dormitory/finance-daily-close-result.json");
const ledgerContract = readJson("docs/business/dormitory/ledger-posting-contract.yml");

const scenarios = new Map((replay.scenarios ?? []).map((scenario) => [scenario.scenarioId, scenario]));
checkDepositReceipt(scenarios.get("dorm-live-002"));
checkOrdinaryPayment(scenarios.get("dorm-live-003"));
checkRefundDeposit(scenarios.get("dorm-live-005"));
checkCorrection(scenarios.get("dorm-live-006"));

if (dailyClose.status !== "passed") failures.push("Finance Daily Close 必须 passed。");
if (dailyClose.depositAsRevenueCount > 0 || dailyClose.depositAsRevenue > 0) failures.push("Finance Daily Close 不得出现 deposit as revenue。");
if (dailyClose.unbalancedTransactionCount > 0 || dailyClose.unbalancedLedgerTransaction > 0) failures.push("Finance Daily Close 不得出现 unbalanced transaction。");
if (dailyClose.refundOverLiabilityCount > 0 || dailyClose.refundOverLiability > 0) failures.push("Finance Daily Close 不得出现 refund over liability。");

const postingBasisTypes = new Set((ledgerContract.postings ?? []).map((item) => item.basisType));
for (const basisType of ["deposit_receipt", "payment_receipt", "refund_deposit", "ledger_correction_apply"]) {
  if (!postingBasisTypes.has(basisType)) failures.push(`ledger-posting-contract 缺少 ${basisType} posting。`);
}

const result = {
  generatedAtUtc,
  generatedBy: "check-internal-pilot-ledger-semantics",
  stage: "OAM-ACCEPTANCE-CLOSURE-A4",
  status: failures.length === 0 ? "passed" : "failed",
  checkedScenarios: ["dorm-live-002", "dorm-live-003", "dorm-live-005", "dorm-live-006"],
  noGoItems: failures,
  productionAllowed: false,
  dormitoryL2ProductionAllowed: false,
  businessProduction: "blocked",
  repairPartsHrStatus: "L0 Contract Preview",
  evidenceRefs: [
    "artifacts/go-live/dormitory/live-api-db-replay-result.json",
    "artifacts/go-live/dormitory/finance-daily-close-result.json",
    "docs/business/dormitory/ledger-posting-contract.yml"
  ]
};
writeJson("artifacts/go-live/dormitory/internal-pilot-ledger-semantics-result.json", result);
failIfNeeded(failures, "internal pilot ledger semantics check");
console.log("internal pilot ledger semantics check: PASS");

function checkDepositReceipt(scenario) {
  if (!scenario) return failures.push("缺少 dorm-live-002 押金收取场景。");
  const entries = scenario.ledgerEntries ?? [];
  if ((scenario.ledgerTransactions ?? []).length === 0) failures.push("押金收取必须产生 LedgerTransaction。");
  if (!hasAccount(entries, "asset", "debit")) failures.push("deposit_receipt 必须 debit cash/bank asset。");
  if (!hasAccount(entries, "liability", "credit")) failures.push("deposit_receipt 必须 credit deposit liability。");
  if (hasAccount(entries, "revenue", "credit") || hasAccount(entries, "revenue", "debit")) failures.push("deposit_receipt 不得进入 revenue。");
}

function checkOrdinaryPayment(scenario) {
  if (!scenario) return failures.push("缺少 dorm-live-003 普通收款场景。");
  const entries = scenario.ledgerEntries ?? [];
  if ((scenario.ledgerTransactions ?? []).length === 0) failures.push("普通收款必须产生 LedgerTransaction。");
  if (hasAccount(entries, "deposit_liability", "credit") || hasAccount(entries, "liability", "credit", "deposit")) {
    failures.push("ordinary_payment 不得混入 deposit liability。");
  }
}

function checkRefundDeposit(scenario) {
  if (!scenario) return failures.push("缺少 dorm-live-005 退住退款场景。");
  const entries = scenario.ledgerEntries ?? [];
  if ((scenario.ledgerTransactions ?? []).length === 0) failures.push("refund_deposit 必须产生 LedgerTransaction。");
  if (!hasAccount(entries, "liability", "debit")) failures.push("refund_deposit 必须 debit deposit liability。");
  if (!hasAccount(entries, "asset", "credit")) failures.push("refund_deposit 必须 credit cash/bank asset。");
  const text = JSON.stringify(scenario);
  if (!/depositAccount|deposit_account|deposit-account|原 deposit/i.test(text)) failures.push("refund_deposit 必须引用原 deposit account。");
}

function checkCorrection(scenario) {
  if (!scenario) return failures.push("缺少 dorm-live-006 对账修正场景。");
  const text = JSON.stringify(scenario);
  if (!/reversal|compensation|correction|FinanceCase|UnclearMoneyCase/i.test(text)) failures.push("correction 必须体现 reversal / compensation / FinanceCase / UnclearMoneyCase 语义。");
}

function hasAccount(entries, accountType, side, contains = null) {
  return entries.some((entry) => {
    const text = JSON.stringify(entry).toLowerCase();
    return text.includes(accountType.toLowerCase()) &&
      text.includes(side.toLowerCase()) &&
      (!contains || text.includes(contains.toLowerCase()));
  });
}
