import fs from "node:fs";
import path from "node:path";
import {
  failIfViolations,
  readDocument,
  validateRequiredObject,
  violation,
  writeReport
} from "../btos-compiler-lib.mjs";

const checkName = "check-ledger-basis-semantics";
const scannedFiles = [
  "docs/finance/ledger-basis-type-contract.yml",
  "docs/finance/deposit-liability-semantic-contract.yml",
  "docs/business/finance/ledger-semantic-rules.yml",
  "services/core-api/WorkOS.Api/Runtime/LedgerSemanticRules.cs",
  "services/core-api/WorkOS.Api/Runtime/FinanceTruthKernel.cs",
  "services/core-api/WorkOS.Api/Runtime/OperationsUnitOfWork.cs"
];

const basisContract = readDocument("docs/finance/ledger-basis-type-contract.yml");
const liabilityContract = readDocument("docs/finance/deposit-liability-semantic-contract.yml");
const semanticRules = readDocument("docs/business/finance/ledger-semantic-rules.yml");
const ledgerSource = readText("services/core-api/WorkOS.Api/Runtime/LedgerSemanticRules.cs");
const financeSource = readText("services/core-api/WorkOS.Api/Runtime/FinanceTruthKernel.cs");
const uowSource = readText("services/core-api/WorkOS.Api/Runtime/OperationsUnitOfWork.cs");

const violations = [
  ...validateRequiredObject(basisContract, ["version", "owner", "productionAllowed", "basisTypes", "mustFailCases"], "docs/finance/ledger-basis-type-contract.yml"),
  ...validateRequiredObject(liabilityContract, ["version", "owner", "productionAllowed", "rules", "lens", "failureImpact"], "docs/finance/deposit-liability-semantic-contract.yml"),
  ...validateRequiredObject(semanticRules, ["version", "owner", "basisSemanticRules", "globalFailures", "runtimeBindings"], "docs/business/finance/ledger-semantic-rules.yml"),
  ...validateBasisTypes(),
  ...validateRuntimeBindings(),
  ...validateNoProductionDrift()
];

writeReport("artifacts/go-live/dormitory/ledger-semantic-result.json", checkName, violations, scannedFiles);
failIfViolations("Ledger basis semantics check", violations);
console.log("Ledger basis semantics check: PASS");

function validateBasisTypes() {
  const violations = [];
  const basisTypes = new Map((basisContract.basisTypes ?? []).map((item) => [item.basisType, item]));
  const rulesByBasis = new Map((semanticRules.basisSemanticRules ?? []).map((item) => [item.basisType, item]));
  for (const basisType of ["deposit_receipt", "payment_receipt", "refund_deposit", "deposit_deduction", "ledger_correction_apply"]) {
    const contract = basisTypes.get(basisType);
    const rule = rulesByBasis.get(basisType);
    if (!contract) violations.push(violation("oam05.basis_missing", "docs/finance/ledger-basis-type-contract.yml", `缺少 basisType: ${basisType}.`, { basisType }));
    if (!rule) violations.push(violation("oam05.semantic_rule_missing", "docs/business/finance/ledger-semantic-rules.yml", `缺少语义规则: ${basisType}.`, { basisType }));
    if (!ledgerSource.includes(`case "${basisType}"`)) {
      violations.push(violation("oam05.runtime_basis_missing", "services/core-api/WorkOS.Api/Runtime/LedgerSemanticRules.cs", `LedgerSemanticRules 必须覆盖 ${basisType}.`, { basisType }));
    }
  }

  const deposit = basisTypes.get("deposit_receipt");
  if (deposit?.credit?.accountType !== "liability" || !(deposit?.forbiddenAccountTypes ?? []).includes("revenue")) {
    violations.push(violation("oam05.deposit_semantics_wrong", "docs/finance/ledger-basis-type-contract.yml", "deposit_receipt 必须 credit liability 且禁止 revenue。"));
  }

  const payment = basisTypes.get("payment_receipt");
  if (payment?.credit?.accountType !== "receivable" || !(payment?.forbiddenAccountTypes ?? []).includes("liability.deposit")) {
    violations.push(violation("oam05.payment_semantics_wrong", "docs/finance/ledger-basis-type-contract.yml", "payment_receipt 必须 credit receivable 且禁止 liability.deposit。"));
  }

  const refund = basisTypes.get("refund_deposit");
  if (refund?.debit?.accountId !== "originalDepositAccountId" || !(refund?.amountRules ?? []).includes("refundAmount <= availableLiability")) {
    violations.push(violation("oam05.refund_semantics_wrong", "docs/finance/ledger-basis-type-contract.yml", "refund_deposit 必须引用原押金账户且限制可退负债。"));
  }

  for (const failure of [
    "balanced_wrong_account_type",
    "deposit_as_revenue",
    "refund_without_original_deposit_account",
    "currency_mismatch",
    "unclear_money_posted_before_resolution"
  ]) {
    if (!(basisContract.mustFailCases ?? []).includes(failure)) {
      violations.push(violation("oam05.must_fail_case_missing", "docs/finance/ledger-basis-type-contract.yml", `缺少必须失败用例: ${failure}.`, { failure }));
    }
  }
  return violations;
}

function validateRuntimeBindings() {
  const violations = [];
  for (const token of [
    "LedgerSemanticRules.Validate",
    "finance_semantic_{transactionType}",
    "finance_semantic_refund_requires_original_liability",
    "finance_semantic_currency_mismatch"
  ]) {
    if (!ledgerSource.includes(token) && !financeSource.includes(token) && !uowSource.includes(token)) {
      violations.push(violation("oam05.runtime_token_missing", "services/core-api/WorkOS.Api/Runtime/LedgerSemanticRules.cs", `缺少 runtime token: ${token}.`, { token }));
    }
  }

  if (!financeSource.includes("LedgerSemanticRules.Validate(transaction, entries)")) {
    violations.push(violation("oam05.finance_pipeline_not_semantic", "services/core-api/WorkOS.Api/Runtime/FinanceTruthKernel.cs", "FinanceTruthPipeline.ValidateBalanced 必须调用 LedgerSemanticRules。"));
  }
  if (!uowSource.includes("LedgerSemanticRules.Validate(transaction, entries)")) {
    violations.push(violation("oam05.uow_not_semantic", "services/core-api/WorkOS.Api/Runtime/OperationsUnitOfWork.cs", "OperationsUnitOfWork 必须在提交前调用 LedgerSemanticRules。"));
  }
  if (!financeSource.includes("OwnerRole") || !financeSource.includes("EvidenceRefs") || !financeSource.includes("TraceRef")) {
    violations.push(violation("oam05.finance_case_missing_audit_fields", "services/core-api/WorkOS.Api/Runtime/FinanceTruthKernel.cs", "FinanceCase 必须携带 owner / evidence / trace。"));
  }
  return violations;
}

function validateNoProductionDrift() {
  const violations = [];
  if (basisContract.productionAllowed !== false || liabilityContract.productionAllowed !== false || semanticRules.productionAllowed !== false) {
    violations.push(violation("oam05.production_drift", "docs/finance/finance-semantic-truth-kernel.yml", "OAM-05 不允许声明业务生产。"));
  }
  if (liabilityContract.failureImpact?.dormitoryL2ProductionAllowed !== false) {
    violations.push(violation("oam05.l2_drift", "docs/finance/deposit-liability-semantic-contract.yml", "OAM-05 不允许宿舍 L2。"));
  }
  return violations;
}

function readText(relativePath) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}
