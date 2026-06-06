import fs from "node:fs";
import path from "node:path";
import {
  failIfViolations,
  readDocument,
  validateRequiredObject,
  violation,
  writeReport
} from "./btos-compiler-lib.mjs";

const checkName = "check-ledger-semantic-rules";
const files = [
  "docs/business/finance/ledger-semantic-rules.yml",
  "schemas/finance/ledger-semantic-rules.schema.json",
  "tests/WorkOS.UnitTests/LedgerSemanticRulesTests.cs",
  "tests/WorkOS.RuntimeIntegrationTests/DormitoryFinanceRuntimeSemanticTests.cs"
];
const rules = readDocument("docs/business/finance/ledger-semantic-rules.yml");
const schema = readDocument("schemas/finance/ledger-semantic-rules.schema.json");
const violations = [
  ...validateRequiredObject(rules, ["version", "owner", "productionAllowed", "businessProduction", "basisSemanticRules", "globalFailures", "runtimeBindings", "testRefs", "artifactRefs"], files[0]),
  ...validateRequiredObject(schema, ["$schema", "$id", "title", "type", "required", "properties"], files[1]),
  ...validateRules(),
  ...validateRefs()
];

writeReport("artifacts/oam/checks/ledger-semantic-result.json", checkName, violations, files);
failIfViolations("Ledger semantic rules check", violations);
console.log("Ledger semantic rules check: PASS");

function validateRules() {
  const violations = [];
  const byBasis = new Map((rules.basisSemanticRules ?? []).map((item) => [item.basisType, item]));
  for (const [basisType, expected] of Object.entries({
    deposit_receipt: ["asset", "liability"],
    payment_receipt: ["asset", "receivable"],
    refund_deposit: ["liability", "asset"],
    deposit_deduction: ["liability", "receivable"],
    ledger_correction_apply: ["correction", "correction"]
  })) {
    const rule = byBasis.get(basisType);
    if (!rule) {
      violations.push(violation("oam.finance.semantic_rule_missing", files[0], `缺少 ${basisType} 语义规则。`, { basisType }));
      continue;
    }
    if (rule.debitAccountType !== expected[0] || rule.creditAccountType !== expected[1]) {
      violations.push(violation("oam.finance.semantic_account_mismatch", files[0], `${basisType} 的借贷 accountType 不符合合同。`, { basisType, expected }));
    }
    if (!rule.failureCode?.startsWith("finance_semantic_")) {
      violations.push(violation("oam.finance.failure_code_missing", files[0], `${basisType} 必须有 finance_semantic_* failureCode。`, { basisType }));
    }
  }

  for (const failure of [
    "balanced but wrong accountType must fail",
    "currency mismatch must fail",
    "UnclearMoneyCase cannot commit ledger before resolution",
    "old LedgerEntry update/delete must fail",
    "FinanceCase must carry owner, evidence, and trace"
  ]) {
    if (!(rules.globalFailures ?? []).includes(failure)) {
      violations.push(violation("oam.finance.global_failure_missing", files[0], `缺少全局失败规则: ${failure}.`, { failure }));
    }
  }
  if (rules.productionAllowed !== false || rules.businessProduction !== "BLOCKED") {
    violations.push(violation("oam.finance.production_drift", files[0], "OAM finance-gate 必须保持 Business Production blocked。"));
  }
  return violations;
}

function validateRefs() {
  const violations = [];
  for (const ref of rules.testRefs ?? []) {
    if (!fs.existsSync(path.join(process.cwd(), ref))) {
      violations.push(violation("oam.finance.ref_missing", files[0], `引用不存在: ${ref}.`, { ref }));
    }
  }
  for (const ref of rules.artifactRefs ?? []) {
    if (!ref.startsWith("artifacts/") || ref.includes(".tmp/")) {
      violations.push(violation("oam.finance.artifact_ref_not_persistent", files[0], `artifact 引用必须是持久路径且不能包含 .tmp: ${ref}.`, { ref }));
    }
  }
  return violations;
}
