import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const out = readArg("--out=", "artifacts/oam/checks/dormitory-golden-domain-report.json");
const requiredScenarioIds = Array.from({ length: 10 }, (_, index) => `dorm-cert-${String(index + 1).padStart(3, "0")}`);
const requiredCoverage = [
  "Subject",
  "Room",
  "Bed",
  "Stay",
  "BedOccupancyInterval",
  "StayChargeBasis",
  "DepositRequest",
  "PaymentBasis",
  "EvidenceRequirement",
  "CheckoutCase",
  "CleaningTask",
  "DamageAssessment",
  "DepositReceipt",
  "PaymentReceipt",
  "RefundDeposit",
  "StayBalanceLens",
  "DepositLiabilityLens",
  "DormitoryRiskSummary",
  "FinanceReceipt"
];
const forbiddenOwnedFacts = ["Subject", "Vehicle", "PaymentFact", "DepositFact", "LedgerTransaction", "EvidenceObject"];

if (process.argv.includes("--self-test")) {
  const invalid = validatePack({
    packId: "bad",
    ownedFacts: ["PaymentFact"],
    requestedFacts: [],
    certification: { requiredScenarios: [] },
    finance: { moneyBasisPolicy: "direct", ledgerPolicy: "direct" },
    goNoGo: { productionAllowedDefault: true }
  });
  assert(invalid.some((item) => item.id === "dormitory.domain_pack_owns_center_truth"), "self-test must catch PaymentFact ownership");
  assert(invalid.some((item) => item.id === "dormitory.domain_pack_missing_coverage"), "self-test must catch missing coverage");
  assert(invalid.some((item) => item.id === "dormitory.production_allowed"), "self-test must catch production default");
  console.log("Dormitory golden domain self-test: PASS");
  process.exit(0);
}

const scannedFiles = [
  "docs/business/domains/dormitory/domain-pack.yml",
  "docs/scenarios/dormitory/golden-pilot.yml",
  "docs/business/dormitory/certification-scenarios.json",
  "docs/business/dormitory/evidence-policy.yml",
  "docs/business/dormitory/finance-control-rules.yml",
  "docs/business/business-line-registry.json"
];
const violations = [];
const pack = readJson(scannedFiles[0]);
violations.push(...validatePack(pack));
violations.push(...validateScenarioPack(readJson(scannedFiles[1])));
violations.push(...validateCertificationFile(readJson(scannedFiles[2])));
violations.push(...validateEvidencePolicy(readJson(scannedFiles[3])));
violations.push(...validateFinanceRules(readJson(scannedFiles[4])));
violations.push(...validateBusinessLineRegistry(readJson(scannedFiles[5])));

writeReport(violations, scannedFiles);
if (violations.length > 0) {
  for (const item of violations) {
    console.error(`${item.severity} ${item.id}: ${item.message}`);
  }
  throw new Error("Dormitory golden domain check failed.");
}

console.log("Dormitory golden domain check: PASS");

function validatePack(pack) {
  const violations = [];
  for (const fact of pack.ownedFacts ?? []) {
    if (forbiddenOwnedFacts.includes(fact)) {
      violations.push(violation("dormitory.domain_pack_owns_center_truth", `DormitoryDomainPack must not own center truth ${fact}.`, { fact }));
    }
  }

  const declaredFacts = new Set([...(pack.ownedFacts ?? []), ...(pack.requestedFacts ?? [])]);
  for (const fact of requiredCoverage) {
    if (!declaredFacts.has(fact)) {
      violations.push(violation("dormitory.domain_pack_missing_coverage", `DormitoryDomainPack missing required coverage fact ${fact}.`, { fact }));
    }
  }

  for (const scenarioId of requiredScenarioIds) {
    if (!(pack.certification?.requiredScenarios ?? []).includes(scenarioId)) {
      violations.push(violation("dormitory.domain_pack_missing_scenario", `DormitoryDomainPack missing certification scenario ${scenarioId}.`, { scenarioId }));
    }
  }

  if (pack.finance?.moneyBasisPolicy !== "routeToFinanceTruthPack" || pack.finance?.ledgerPolicy !== "noDirectLedgerCommit") {
    violations.push(violation("dormitory.finance_truth_boundary", "DormitoryDomainPack must route MoneyBasis to FinanceTruthPack and forbid direct ledger commit."));
  }
  if (pack.goNoGo?.productionAllowedDefault !== false) {
    violations.push(violation("dormitory.production_allowed", "DormitoryDomainPack must default productionAllowed to false."));
  }
  if (pack.receiptPolicy !== "referenceOnly") {
    violations.push(violation("dormitory.receipt_boundary", "Dormitory receipts must remain referenceOnly Projection/Lens consumption."));
  }
  if (pack.managementCockpitBoundary !== "observeAndRouteOnly") {
    violations.push(violation("dormitory.management_cockpit_boundary", "ManagementCockpit must observe and route only."));
  }

  return violations;
}

function validateScenarioPack(document) {
  const violations = [];
  const scenarios = document.scenarios ?? [];
  const ids = scenarios.map((scenario) => scenario.scenarioId);
  for (const scenarioId of requiredScenarioIds) {
    if (!ids.includes(scenarioId)) {
      violations.push(violation("dormitory.scenario_missing", `Golden scenario document missing ${scenarioId}.`, { scenarioId }));
    }
  }

  for (const scenario of scenarios.filter((item) => requiredScenarioIds.includes(item.scenarioId))) {
    const outputs = scenario.outputs ?? {};
    if (scenario.scenarioType === "committed_scenario") {
      requireOutput(outputs.commandSubmission?.required === true, "dormitory.committed_missing_submission", scenario.scenarioId, violations);
      requireOutput((outputs.domainEvents?.min ?? 0) >= 1, "dormitory.committed_missing_domain_event", scenario.scenarioId, violations);
      requireOutput(outputs.factTrace?.required === true, "dormitory.committed_missing_fact_trace", scenario.scenarioId, violations);
      if (scenario.moneyCommand) {
        requireOutput((outputs.ledgerTransactions?.min ?? 0) >= 1, "dormitory.money_missing_ledger_transaction", scenario.scenarioId, violations);
      }
    }
    if (scenario.scenarioType === "rejected_command_scenario") {
      requireOutput(outputs.rejectedCommandSubmission?.required === true, "dormitory.rejected_missing_submission", scenario.scenarioId, violations);
      requireOutput(outputs.rejectionTrace?.required === true, "dormitory.rejected_missing_trace", scenario.scenarioId, violations);
      requireOutput(outputs.domainEvents?.allowed === false && outputs.ledgerTransactions?.allowed === false, "dormitory.rejected_allows_business_fact", scenario.scenarioId, violations);
    }
  }
  return violations;
}

function validateCertificationFile(document) {
  const violations = [];
  const scenarios = document.scenarios ?? [];
  const ids = scenarios.map((scenario) => scenario.scenarioId ?? scenario.scenario_id);
  for (const scenarioId of requiredScenarioIds) {
    if (!ids.includes(scenarioId)) {
      violations.push(violation("dormitory.certification_missing_scenario", `Certification file missing ${scenarioId}.`, { scenarioId }));
    }
  }
  for (const scenario of scenarios) {
    const scenarioId = scenario.scenarioId ?? scenario.scenario_id;
    if (!Array.isArray(scenario.requires) || scenario.requires.length === 0) {
      violations.push(violation("dormitory.certification_missing_requires", `Scenario ${scenarioId} missing requires.`, { scenarioId }));
    }
  }
  if (document.productionAllowed !== false) {
    violations.push(violation("dormitory.certification_production_allowed", "Dormitory certification file must keep productionAllowed=false."));
  }
  return violations;
}

function validateEvidencePolicy(policy) {
  const violations = [];
  if (policy.runtimeBinding?.loader !== "DormitoryEvidencePolicyLoader" || policy.runtimeBinding?.evaluator !== "EvidencePolicyEvaluator") {
    violations.push(violation("dormitory.evidence_policy_not_runtime_bound", "Evidence policy must bind DormitoryEvidencePolicyLoader and EvidencePolicyEvaluator."));
  }
  for (const flag of ["missingEvidenceBlocksConfirm", "rejectedEvidenceBlocksConfirm", "wrongScopeEvidenceBlocksConfirm"]) {
    if (policy[flag] !== true) {
      violations.push(violation("dormitory.evidence_policy_flag_missing", `Evidence policy must set ${flag}=true.`, { flag }));
    }
  }
  return violations;
}

function validateFinanceRules(finance) {
  const text = JSON.stringify(finance).toLowerCase();
  const violations = [];
  if (!text.includes("deposit is liability") || text.includes("deposit is revenue")) {
    violations.push(violation("dormitory.deposit_revenue_boundary", "Dormitory finance rules must keep deposit as liability, never revenue."));
  }
  if (!text.includes("balanced") || !text.includes("financetruthpack") || !text.includes("moneykernelpack")) {
    violations.push(violation("dormitory.finance_truth_pipeline_missing", "Dormitory money commands must route through FinanceTruthPack/MoneyKernelPack with balanced ledger."));
  }
  return violations;
}

function validateBusinessLineRegistry(registry) {
  const violations = [];
  for (const line of registry.businessLines ?? []) {
    if (line.businessLineId === "dormitory" && (line.productionAllowed || line.productionConfirmAllowed)) {
      violations.push(violation("dormitory.production_enabled", "Dormitory must remain L1 pilot only, not production-enabled."));
    }
    if (["repair", "parts", "hr"].includes(line.businessLineId) && line.level !== "L0 Contract Preview") {
      violations.push(violation("dormitory.downstream_line_not_l0", `${line.businessLineId} must remain L0 Contract Preview.`, { businessLineId: line.businessLineId }));
    }
  }
  return violations;
}

function requireOutput(condition, id, scenarioId, violations) {
  if (!condition) {
    violations.push(violation(id, `Scenario ${scenarioId} does not satisfy required output contract.`, { scenarioId }));
  }
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function writeReport(violations, scannedFiles) {
  const reportPath = path.join(root, out);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify({
    generated_at_utc: new Date().toISOString(),
    generated_by: "check-dormitory-golden-domain",
    status: violations.length === 0 ? "passed" : "failed",
    scanned_files: scannedFiles.filter((file) => fs.existsSync(path.join(root, file))),
    violation_count: violations.length,
    violations
  }, null, 2)}\n`, "utf8");
}

function violation(id, message, extra = {}) {
  return { severity: "P0", id, message, ...extra };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readArg(prefix, fallback) {
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}
