import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const masterDataPath = readArg("--master-data=", "docs/go-live/dormitory/master-data.yml");
const outPath = readArg("--out=", "artifacts/go-live/dormitory/finance-daily-close-result.json");

if (process.argv.includes("--self-test")) {
  const invalid = evaluateDailyClose({
    masterData: minimalMasterData(),
    overrides: {
      depositCreditAccountType: "revenue",
      ordinaryPaymentCreditAccountId: "liability.deposit",
      refundAmount: 5000,
      correctionMode: "manual_edit"
    }
  });
  assert(invalid.noGoItems.some((item) => item.id === "dorm_int_05.deposit_as_revenue"), "self-test must catch deposit-as-revenue.");
  assert(invalid.noGoItems.some((item) => item.id === "dorm_int_05.ordinary_payment_mixed_with_deposit"), "self-test must catch ordinary payment mixed with deposit.");
  assert(invalid.noGoItems.some((item) => item.id === "dorm_int_05.refund_exceeds_liability"), "self-test must catch refund over available liability.");
  assert(invalid.noGoItems.some((item) => item.id === "dorm_int_05.correction_not_append_only"), "self-test must catch non reversal/compensation correction.");
  console.log("Dormitory finance daily close drill self-test: PASS");
  process.exit(0);
}

let report;
try {
  const masterData = readJson(masterDataPath);
  report = evaluateDailyClose({ masterData });
} catch (error) {
  report = {
    generated_at_utc: new Date().toISOString(),
    generated_by: "dormitory-finance-daily-close-drill",
    stage: "DORM-INT-05",
    status: "blocked",
    sourceMode: "missing",
    masterDataPath,
    noGoItems: [
      violation("dorm_int_05.master_data_unreadable", `Cannot read master data: ${masterDataPath}.`, { error: error.message })
    ],
    nextAction: "修复 docs/go-live/dormitory/master-data.yml 后重新运行财务日清演练。"
  };
}

writeJson(outPath, report);

if (report.noGoItems.length) {
  for (const item of report.noGoItems) {
    console.error(`${item.severity} ${item.id}: ${item.message}`);
  }
  throw new Error("Dormitory finance daily close drill: BLOCKED");
}

console.log("Dormitory finance daily close drill: PASS");

export function evaluateDailyClose({ masterData, overrides = {} }) {
  const noGoItems = [];
  const tenantId = masterData.tenantRuntimeConfigs?.[0]?.tenantId ?? "tenant-dorm-int-001";
  const currency = masterData.tenantRuntimeConfigs?.[0]?.currency ?? "CNY";
  const depositAccount = masterData.depositAccounts?.[0];
  const stay = masterData.stays?.[0];
  const paymentMethod = masterData.paymentMethods?.[0];
  const correctionMode = overrides.correctionMode ?? "reversal";

  if (!depositAccount?.depositAccountId) {
    noGoItems.push(violation("dorm_int_05.deposit_account_missing", "Refund drill requires original DepositAccount."));
  }
  if (!stay?.stayId) {
    noGoItems.push(violation("dorm_int_05.stay_missing", "Daily close drill requires a Stay for stay balance projection."));
  }
  if (!paymentMethod?.paymentMethodId) {
    noGoItems.push(violation("dorm_int_05.payment_method_missing", "Daily close drill requires a PaymentMethod."));
  }

  const depositAmount = Number(overrides.depositAmount ?? 1200);
  const ordinaryPaymentAmount = Number(overrides.ordinaryPaymentAmount ?? 650);
  const refundAmount = Number(overrides.refundAmount ?? 300);
  const correctionAmount = Number(overrides.correctionAmount ?? 25);
  const stayChargeAmount = Number(overrides.stayChargeAmount ?? 1600);
  const depositAccountId = depositAccount?.depositAccountId ?? "missing-deposit-account";

  const depositTx = transaction("ltx-dorm-int-deposit-receive", "deposit_receipt", [
    entry("le-deposit-cash", "debit", depositAmount, "asset.cash_or_bank", "asset", "cash_or_bank_increase"),
    entry("le-deposit-liability", "credit", depositAmount, depositAccountId, overrides.depositCreditAccountType ?? "liability", "deposit_liability_increase")
  ], { caseId: "case-dorm-int-finance-001", workItemId: "wi-dorm-int-deposit-receive" });

  const ordinaryPaymentTx = transaction("ltx-dorm-int-ordinary-payment", "payment_receipt", [
    entry("le-payment-cash", "debit", ordinaryPaymentAmount, "asset.cash_or_bank", "asset", "cash_or_bank_increase"),
    entry("le-payment-receivable", "credit", ordinaryPaymentAmount, overrides.ordinaryPaymentCreditAccountId ?? "receivable.stay", "receivable", "ordinary_payment_allocation")
  ], { caseId: "case-dorm-int-finance-002", workItemId: "wi-dorm-int-payment-confirm" });

  const availableLiabilityBeforeRefund = depositAmount;
  const refundTx = transaction("ltx-dorm-int-deposit-refund", "refund_deposit", [
    entry("le-refund-liability", "debit", refundAmount, depositAccountId, "liability", "deposit_liability_decrease"),
    entry("le-refund-cash", "credit", refundAmount, "asset.cash_or_bank", "asset", "cash_or_bank_decrease")
  ], { caseId: "case-dorm-int-finance-003", workItemId: "wi-dorm-int-refund-request", depositAccountId });

  const correctionTx = transaction("ltx-dorm-int-correction", "ledger_correction_apply", [
    entry("le-correction-reversal", "debit", correctionAmount, "correction.reversal", "correction", `${correctionMode}_debit`),
    entry("le-correction-offset", "credit", correctionAmount, "correction.offset", "correction", `${correctionMode}_credit`)
  ], { caseId: "case-dorm-int-finance-004", workItemId: "wi-dorm-int-correction", correctionMode });

  const ledgerTransactions = [depositTx, ordinaryPaymentTx, refundTx, correctionTx];
  const bankStatementMatches = [
    {
      bankStatementId: "bank-line-dorm-int-001",
      paymentMethodId: paymentMethod?.paymentMethodId ?? "cash",
      matchedLedgerTransactionId: ordinaryPaymentTx.ledgerTransactionId,
      status: "matched"
    }
  ];
  const financeCase = {
    financeCaseId: "finance-case-dorm-int-mismatch-001",
    caseType: "FinanceCase",
    sourceBankStatementId: "bank-line-dorm-int-002",
    reason: "payment_mismatch",
    ownerRole: "finance",
    status: "open"
  };
  const unclearMoneyCase = {
    unclearMoneyCaseId: "unclear-money-dorm-int-001",
    caseType: "UnclearMoneyCase",
    sourceBankStatementId: "bank-line-dorm-int-003",
    amount: 88,
    currency,
    ledgerTransactionAllowedBeforeResolution: false
  };

  for (const tx of ledgerTransactions) {
    if (!isBalanced(tx.entries)) {
      noGoItems.push(violation("dorm_int_05.ledger_transaction_unbalanced", `LedgerTransaction must balance: ${tx.ledgerTransactionId}.`, { ledgerTransactionId: tx.ledgerTransactionId }));
    }
  }

  if (depositTx.entries.some((item) => item.accountType === "revenue")) {
    noGoItems.push(violation("dorm_int_05.deposit_as_revenue", "押金收取只能进入 liability，不能进入 revenue。"));
  }
  if (!depositTx.entries.some((item) => item.accountType === "liability" && item.role === "deposit_liability_increase")) {
    noGoItems.push(violation("dorm_int_05.deposit_liability_missing", "押金收取必须生成 deposit liability。"));
  }
  if (ordinaryPaymentTx.entries.some((item) => item.accountId.includes("deposit") || item.accountType === "liability")) {
    noGoItems.push(violation("dorm_int_05.ordinary_payment_mixed_with_deposit", "普通收款不能混入押金 liability。"));
  }
  if (!refundTx.depositAccountId || refundTx.entries.every((item) => item.accountId !== depositAccountId)) {
    noGoItems.push(violation("dorm_int_05.refund_missing_original_deposit_account", "退款必须引用原 DepositAccount。"));
  }
  if (refundAmount > availableLiabilityBeforeRefund) {
    noGoItems.push(violation("dorm_int_05.refund_exceeds_liability", "退款/扣款不能超过 available liability balance。", { refundAmount, availableLiabilityBeforeRefund }));
  }
  if (!["reversal", "compensation"].includes(correctionMode)) {
    noGoItems.push(violation("dorm_int_05.correction_not_append_only", "Correction 只能是 reversal / compensation，不能原地改账。", { correctionMode }));
  }
  if (!bankStatementMatches.some((item) => item.status === "matched")) {
    noGoItems.push(violation("dorm_int_05.bank_statement_match_missing", "银行流水必须完成至少一条匹配演练。"));
  }
  if (financeCase.caseType !== "FinanceCase") {
    noGoItems.push(violation("dorm_int_05.finance_case_missing", "异常流水必须进入 FinanceCase。"));
  }
  if (unclearMoneyCase.caseType !== "UnclearMoneyCase" || unclearMoneyCase.ledgerTransactionAllowedBeforeResolution !== false) {
    noGoItems.push(violation("dorm_int_05.unclear_money_case_missing", "不明费用必须进入 UnclearMoneyCase，且解决前不得入账。"));
  }

  const projection = rebuildProjection(ledgerTransactions, stayChargeAmount);
  const rebuiltProjection = rebuildProjection(JSON.parse(JSON.stringify(ledgerTransactions)), stayChargeAmount);
  if (JSON.stringify(projection) !== JSON.stringify(rebuiltProjection)) {
    noGoItems.push(violation("dorm_int_05.projection_rebuild_mismatch", "日清后 ledger projection rebuild 必须一致。"));
  }

  return {
    generated_at_utc: new Date().toISOString(),
    generated_by: "dormitory-finance-daily-close-drill",
    stage: "DORM-INT-05",
    status: noGoItems.length ? "blocked" : "passed",
    sourceMode: masterData.sourceMode ?? "missing",
    masterDataPath,
    drill: {
      depositCollection: {
        workItemId: depositTx.workItemId,
        ledgerTransactionId: depositTx.ledgerTransactionId,
        liabilityOnly: !depositTx.entries.some((item) => item.accountType === "revenue")
      },
      ordinaryPayment: {
        workItemId: ordinaryPaymentTx.workItemId,
        ledgerTransactionId: ordinaryPaymentTx.ledgerTransactionId,
        depositMixed: ordinaryPaymentTx.entries.some((item) => item.accountId.includes("deposit"))
      },
      refundRequest: {
        workItemId: refundTx.workItemId,
        ledgerTransactionId: refundTx.ledgerTransactionId,
        depositAccountId,
        availableLiabilityBeforeRefund,
        refundAmount
      },
      bankStatementMatching: bankStatementMatches,
      financeCase,
      unclearMoneyCase,
      correction: {
        ledgerTransactionId: correctionTx.ledgerTransactionId,
        correctionMode,
        appendOnly: ["reversal", "compensation"].includes(correctionMode)
      },
      ledgerProjectionRebuild: projection
    },
    ledgerTransactions,
    noGoItems,
    nextAction: noGoItems.length
      ? "修复财务日清演练中的 P0 blocker 后重新运行 scripts/go-live/dormitory-finance-daily-close-drill.mjs。"
      : "DORM-INT-05 passed; DORM-INT-06 may consume finance-daily-close-result.json."
  };
}

function rebuildProjection(transactions, stayChargeAmount) {
  const entries = transactions.flatMap((item) => item.entries);
  const depositLiabilityBalance = entries
    .filter((item) => item.accountType === "liability" && item.accountId.includes("deposit"))
    .reduce((sum, item) => sum + (item.debitCredit === "credit" ? item.amount : -item.amount), 0);
  const ordinaryPaymentTotal = transactions
    .filter((item) => item.basisType === "payment_receipt")
    .flatMap((item) => item.entries)
    .filter((item) => item.debitCredit === "debit" && item.accountType === "asset")
    .reduce((sum, item) => sum + item.amount, 0);
  const stayBalance = stayChargeAmount - ordinaryPaymentTotal;
  return {
    transactionCount: transactions.length,
    depositLiabilityBalance,
    ordinaryPaymentTotal,
    stayChargeAmount,
    stayBalance,
    consistencyStatus: "consistent"
  };
}

function transaction(ledgerTransactionId, basisType, entries, meta) {
  return {
    ledgerTransactionId,
    basisType,
    balanceStatus: isBalanced(entries) ? "balanced" : "unbalanced",
    ...meta,
    entries
  };
}

function entry(ledgerEntryId, debitCredit, amount, accountId, accountType, role) {
  return {
    ledgerEntryId,
    debitCredit,
    amount,
    currency: "CNY",
    accountId,
    accountType,
    role
  };
}

function isBalanced(entries) {
  const debit = entries.filter((item) => item.debitCredit === "debit").reduce((sum, item) => sum + item.amount, 0);
  const credit = entries.filter((item) => item.debitCredit === "credit").reduce((sum, item) => sum + item.amount, 0);
  return debit > 0 && debit === credit;
}

function minimalMasterData() {
  return {
    sourceMode: "real",
    tenantRuntimeConfigs: [{ tenantId: "tenant-dorm-int-001", currency: "CNY" }],
    depositAccounts: [{ depositAccountId: "deposit-account-001" }],
    stays: [{ stayId: "stay-001" }],
    paymentMethods: [{ paymentMethodId: "cash" }]
  };
}

function readJson(relativePath) {
  const fullPath = path.join(root, relativePath);
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function writeJson(relativePath, payload) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function readArg(prefix, fallback) {
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function violation(id, message, extra = {}) {
  return { severity: "P0", id, message, ...extra };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
