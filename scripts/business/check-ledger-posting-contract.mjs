import {
  failIfViolations,
  indexBy,
  readJson,
  requireValue,
  validateSchemaFile,
  violation
} from "./lib/oam-business-semantic-lib.mjs";

const checkId = "ledger-posting-contract";
const scannedFiles = [
  "docs/business/dormitory/ledger-posting-contract.yml",
  "docs/business/finance/money-kernel-rules.yml",
  "docs/business/dormitory/scenario-field-contract.yml",
  "docs/scenarios/dormitory/golden-pilot.yml",
  "docs/business/dormitory/workitem-decision-table.json",
  "schemas/business/ledger-posting-contract.schema.json"
];
const contract = readJson(scannedFiles[0]);
const moneyKernel = readJson(scannedFiles[1]);
const fieldSets = indexBy(readJson(scannedFiles[2]).fieldSets ?? [], "scenarioId");
const scenarios = readJson(scannedFiles[3]).scenarios ?? [];
const decisions = indexBy(readJson(scannedFiles[4]).decisions ?? [], "workItemType");
const postings = indexBy(contract.postings ?? [], "basisType");
const violations = [
  ...validateSchemaFile(scannedFiles[5], ["$schema", "$id", "required", "properties"])
];

requireValue(contract.productionAllowed === false, violations, "ledger.production_allowed", "分录合同不得允许 production。");

for (const [basisType, expected] of Object.entries(moneyKernel.accountMappings ?? {})) {
  const posting = postings.get(basisType);
  requireValue(Boolean(posting), violations, "ledger.posting_missing", `${basisType} 缺少分录合同。`, { basisType });
  if (!posting) continue;
  requireValue(posting.debit?.accountType === expected.debit, violations, "ledger.debit_semantic_mismatch", `${basisType} debit accountType 与 MoneyKernel 不一致。`, { basisType });
  requireValue(posting.credit?.accountType === expected.credit, violations, "ledger.credit_semantic_mismatch", `${basisType} credit accountType 与 MoneyKernel 不一致。`, { basisType });
  requireValue((posting.requiredRefs ?? []).includes("commandSubmissionId"), violations, "ledger.submission_ref_missing", `${basisType} 必须引用 commandSubmissionId。`, { basisType });
}

const depositPosting = postings.get("deposit_receipt");
requireValue((depositPosting?.forbiddenAccountTypes ?? []).some((item) => item.includes("revenue")), violations, "ledger.deposit_revenue_not_forbidden", "deposit_receipt 必须显式禁止 revenue account。");

const refundPosting = postings.get("refund_deposit");
requireValue((refundPosting?.requiredRefs ?? []).includes("originalDepositAccountId"), violations, "ledger.refund_original_account_missing", "refund_deposit 必须引用原 deposit account。");
requireValue((refundPosting?.amountRules ?? []).includes("refundAmount <= availableLiability"), violations, "ledger.refund_liability_rule_missing", "refund_deposit 必须限制 refundAmount <= availableLiability。");
requireValue((refundPosting?.forbiddenAccountTypes ?? []).includes("expense.refund"), violations, "ledger.refund_expense_not_forbidden", "refund_deposit 必须禁止 expense.refund。");

const correctionPosting = postings.get("ledger_correction_apply");
requireValue(correctionPosting?.appendOnly === true, violations, "ledger.correction_not_append_only", "ledger_correction_apply 必须 append-only。");
for (const mutation of ["update LedgerEntry", "delete LedgerEntry"]) {
  requireValue((correctionPosting?.forbiddenMutations ?? []).includes(mutation), violations, "ledger.correction_mutation_not_forbidden", `ledger_correction_apply 必须禁止 ${mutation}。`, { mutation });
}

for (const scenario of scenarios.filter((item) => item.moneyCommand && item.scenarioType === "committed_scenario")) {
  const fieldSet = fieldSets.get(scenario.scenarioId);
  requireValue((fieldSet?.ledgerFields ?? []).includes("ledgerTransactionId"), violations, "ledger.scenario_missing_transaction_field", `${scenario.scenarioId} 金额 committed 场景缺少 ledgerTransactionId 字段合同。`, { scenarioId: scenario.scenarioId });
}

const failureIds = (contract.semanticFailureCases ?? []).map((item) => item.id);
for (const expected of ["balanced_wrong_account_type", "refund_wrong_deposit_account", "unclear_money_posted_early"]) {
  requireValue(failureIds.includes(expected), violations, "ledger.failure_case_missing", `缺少分录语义失败用例 ${expected}。`, { expected });
}

for (const posting of contract.postings ?? []) {
  for (const workItemType of posting.workItemTypes ?? []) {
    const decision = decisions.get(workItemType);
    requireValue(Boolean(decision), violations, "ledger.posting_workitem_decision_missing", `${posting.basisType} 引用未裁决动作 ${workItemType}。`, { basisType: posting.basisType, workItemType });
    requireValue(decision?.keepInDormitoryCatalog === true || decision?.decision === "externalFinanceGovernance", violations, "ledger.posting_non_current_workitem", `${posting.basisType} 不得引用非当前动作 ${workItemType}。`, { basisType: posting.basisType, workItemType });
  }
}

failIfViolations(checkId, violations, scannedFiles);
