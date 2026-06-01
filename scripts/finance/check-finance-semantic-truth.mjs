import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  failIfViolations,
  readDocument,
  validateRequiredObject,
  violation,
  writeReport
} from "../btos-compiler-lib.mjs";

const checkName = "check-finance-semantic-truth";
const files = [
  "docs/finance/finance-semantic-truth-kernel.yml",
  "docs/finance/ledger-basis-type-contract.yml",
  "docs/finance/deposit-liability-semantic-contract.yml",
  "docs/business/finance/ledger-semantic-rules.yml",
  "schemas/finance/ledger-semantic-rules.schema.json",
  "scripts/finance/check-ledger-basis-semantics.mjs",
  "scripts/check-ledger-semantic-rules.mjs",
  "services/core-api/WorkOS.Api/Runtime/LedgerSemanticRules.cs"
];
const kernel = readDocument("docs/finance/finance-semantic-truth-kernel.yml");
const violations = [
  ...validateRequiredObject(kernel, ["version", "kernelId", "owner", "productionAllowed", "purpose", "sourceContracts", "runtimeGuards", "semanticRules", "artifacts", "tests", "noGo"], files[0]),
  ...runChecker("scripts/finance/check-ledger-basis-semantics.mjs"),
  ...runChecker("scripts/check-ledger-semantic-rules.mjs"),
  ...validateKernel(),
  ...validateTestsAndCi()
];

writeReport("artifacts/finance/finance-semantic-truth-result.json", checkName, violations, files);
failIfViolations("Finance semantic truth check", violations);
console.log("Finance semantic truth check: PASS");

function runChecker(script) {
  const result = spawnSync("node", [script], { cwd: process.cwd(), encoding: "utf8", shell: isWindows() });
  if (result.status === 0) return [];
  return [violation("oam05.subchecker_failed", script, `${script} failed.`, {
    stdout: result.stdout,
    stderr: result.stderr
  })];
}

function validateKernel() {
  const violations = [];
  if (kernel.productionAllowed !== false || kernel.businessProduction !== "BLOCKED" || kernel.dormitoryL2ProductionAllowed !== false) {
    violations.push(violation("oam05.production_boundary_drift", files[0], "OAM-05 不允许声明业务生产或宿舍 L2。"));
  }
  if (kernel.repairPartsHrStatus !== "L0 Contract Preview") {
    violations.push(violation("oam05.downstream_line_drift", files[0], "Repair / Parts / HR 必须保持 L0 Contract Preview。"));
  }
  for (const guard of ["LedgerSemanticRules.Validate", "FinanceTruthPipeline.ValidateBalanced", "OperationsUnitOfWork.ValidateLedgerBoundary"]) {
    if (!(kernel.runtimeGuards ?? []).includes(guard)) {
      violations.push(violation("oam05.runtime_guard_missing", files[0], `缺少 runtime guard: ${guard}.`, { guard }));
    }
  }
  for (const [key, expected] of Object.entries({
    depositAsRevenueAllowed: false,
    refundOverLiabilityAllowed: false,
    directLedgerEntryMutationAllowed: false,
    balancedWrongAccountTypeAllowed: false,
    businessProductionAllowed: false
  })) {
    if (kernel.noGo?.[key] !== expected) {
      violations.push(violation("oam05.no_go_boundary_wrong", files[0], `noGo.${key} 必须是 false。`, { key }));
    }
  }
  return violations;
}

function validateTestsAndCi() {
  const violations = [];
  for (const testFile of [
    "tests/WorkOS.UnitTests/LedgerSemanticRulesTests.cs",
    "tests/WorkOS.RuntimeIntegrationTests/DormitoryFinanceRuntimeSemanticTests.cs"
  ]) {
    if (!fs.existsSync(path.join(process.cwd(), testFile))) {
      violations.push(violation("oam05.test_missing", testFile, `${testFile} 必须存在。`));
    }
  }
  const ci = fs.readFileSync(path.join(process.cwd(), ".github/workflows/ci.yml"), "utf8");
  if (!ci.includes("scripts/finance/check-finance-semantic-truth.mjs") || !ci.includes("scripts/check-ledger-semantic-rules.mjs")) {
    violations.push(violation("oam05.ci_missing", ".github/workflows/ci.yml", "CI 必须接入 OAM-05 finance semantic checker。"));
  }
  return violations;
}

function isWindows() {
  return process.platform === "win32";
}
