import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scenarioRoot = path.join(root, "docs", "scenarios");
const requiredDomains = ["dormitory", "finance", "repair-l0", "parts-l0", "mobile-reliability"];
const allowedTypes = new Set(["committed_scenario", "rejected_command_scenario", "gate_only_blocked_scenario"]);

function fail(message) {
  console.error(`check-executable-scenarios: FAIL ${message}`);
  process.exit(1);
}

function parseJsonLike(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`${path.relative(root, file)} must be JSON-compatible scenario YAML: ${error.message}`);
  }
}

function scenarioFiles() {
  if (!fs.existsSync(scenarioRoot)) {
    return [];
  }

  const files = [];
  for (const domain of fs.readdirSync(scenarioRoot)) {
    const dir = path.join(scenarioRoot, domain);
    if (!fs.statSync(dir).isDirectory() || domain === "_schema") {
      continue;
    }
    for (const file of fs.readdirSync(dir)) {
      if (file.endsWith(".yml") || file.endsWith(".json")) {
        files.push(path.join(dir, file));
      }
    }
  }
  return files.sort();
}

function required(value, message, errors) {
  if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
    errors.push(message);
  }
}

function requiredRef(outputs, key, scenario, errors) {
  if (outputs?.[key]?.required !== true) {
    errors.push(`${scenario.scenarioId} must require ${key}`);
  }
}

function minRef(outputs, key, min, scenario, errors) {
  const actual = outputs?.[key]?.min ?? outputs?.[key]?.refs?.length ?? 0;
  if (actual < min) {
    errors.push(`${scenario.scenarioId} must require ${key} min >= ${min}`);
  }
}

function forbidBusinessFacts(outputs, scenario, errors) {
  const eventPolicy = outputs?.domainEvents ?? {};
  const ledgerPolicy = outputs?.ledgerTransactions ?? {};
  if (eventPolicy.allowed !== false || (eventPolicy.max ?? 0) !== 0) {
    errors.push(`${scenario.scenarioId} must forbid business DomainEvent output`);
  }
  if (ledgerPolicy.allowed !== false || (ledgerPolicy.max ?? 0) !== 0) {
    errors.push(`${scenario.scenarioId} must forbid LedgerTransaction output`);
  }
}

function validateScenario(scenario, file, errors) {
  required(scenario.scenarioId, `${path.relative(root, file)} scenario missing scenarioId`, errors);
  required(scenario.name, `${scenario.scenarioId ?? path.relative(root, file)} missing name`, errors);
  required(scenario.expectedOutcome, `${scenario.scenarioId} missing expectedOutcome`, errors);
  required(scenario.workItemType, `${scenario.scenarioId} missing workItemType`, errors);
  if (!allowedTypes.has(scenario.scenarioType)) {
    errors.push(`${scenario.scenarioId} has unsupported scenarioType ${scenario.scenarioType}`);
    return;
  }

  const outputs = scenario.outputs ?? {};
  requiredRef(outputs, "workItem", scenario, errors);

  if (scenario.scenarioType === "committed_scenario") {
    requiredRef(outputs, "commandSubmission", scenario, errors);
    requiredRef(outputs, "factTrace", scenario, errors);
    requiredRef(outputs, "evidenceTrace", scenario, errors);
    minRef(outputs, "domainEvents", 1, scenario, errors);
    minRef(outputs, "lensOutputs", 1, scenario, errors);
    if (scenario.moneyCommand === true) {
      minRef(outputs, "ledgerTransactions", 1, scenario, errors);
      minRef(outputs, "ledgerEntries", 2, scenario, errors);
    }
    if (outputs.rejectedCommandSubmission?.required === true || outputs.rejectionTrace?.required === true) {
      errors.push(`${scenario.scenarioId} committed scenario cannot require rejected submission artifacts`);
    }
  }

  if (scenario.scenarioType === "rejected_command_scenario") {
    requiredRef(outputs, "rejectedCommandSubmission", scenario, errors);
    requiredRef(outputs, "rejectionTrace", scenario, errors);
    requiredRef(outputs, "factTrace", scenario, errors);
    minRef(outputs, "auditEvidence", 1, scenario, errors);
    forbidBusinessFacts(outputs, scenario, errors);
    if (scenario.expectedOutcome === "idempotency_conflict_409") {
      requiredRef(outputs, "noDuplicateSideEffect", scenario, errors);
    }
  }

  if (scenario.scenarioType === "gate_only_blocked_scenario") {
    requiredRef(outputs, "gateResult", scenario, errors);
    requiredRef(outputs, "rollbackBlocker", scenario, errors);
    forbidBusinessFacts(outputs, scenario, errors);
    const hasInvariant = (outputs.invariantChecks?.min ?? outputs.invariantChecks?.refs?.length ?? 0) > 0;
    const hasShadow = (outputs.shadowCompareReports?.min ?? outputs.shadowCompareReports?.refs?.length ?? 0) > 0;
    if (!hasInvariant && !hasShadow) {
      errors.push(`${scenario.scenarioId} gate-only blocked scenario needs invariantChecks or shadowCompareReports`);
    }
    if (outputs.commandSubmission?.required === true || outputs.rejectedCommandSubmission?.required === true) {
      errors.push(`${scenario.scenarioId} gate-only blocked scenario cannot require command submission artifacts`);
    }
  }
}

function validatePacks(packs) {
  const errors = [];
  const domains = new Set();
  const scenarioIds = new Set();
  const all = [];

  for (const { file, pack } of packs) {
    required(pack.version, `${path.relative(root, file)} missing version`, errors);
    required(pack.domain, `${path.relative(root, file)} missing domain`, errors);
    if (!Array.isArray(pack.scenarios) || pack.scenarios.length === 0) {
      errors.push(`${path.relative(root, file)} must contain scenarios`);
      continue;
    }
    domains.add(pack.domain);
    for (const scenario of pack.scenarios) {
      if (scenarioIds.has(scenario.scenarioId)) {
        errors.push(`${scenario.scenarioId} is duplicated`);
      }
      scenarioIds.add(scenario.scenarioId);
      validateScenario(scenario, file, errors);
      all.push(scenario);
    }
  }

  for (const domain of requiredDomains) {
    if (!domains.has(domain)) {
      errors.push(`missing scenario domain ${domain}`);
    }
  }

  for (const requiredScenario of ["dorm-cert-008", "dorm-cert-010"]) {
    const scenario = all.find((item) => item.scenarioId === requiredScenario);
    if (!scenario || scenario.scenarioType !== "rejected_command_scenario") {
      errors.push(`${requiredScenario} must be a rejected_command_scenario`);
    }
  }

  if (!all.some((item) => item.expectedOutcome === "idempotency_conflict_409" && item.scenarioType === "rejected_command_scenario")) {
    errors.push("missing idempotency_conflict_409 rejected command scenario");
  }
  if (!all.some((item) => item.expectedOutcome === "semantic_shadow_red_blocked" && item.scenarioType === "gate_only_blocked_scenario")) {
    errors.push("missing semantic_shadow_red_blocked gate-only scenario");
  }
  if (!all.some((item) => item.expectedOutcome === "missing_rollback_blocked" && item.scenarioType === "gate_only_blocked_scenario")) {
    errors.push("missing missing_rollback_blocked gate-only scenario");
  }

  return { errors, scenarioCount: all.length, domains: [...domains].sort() };
}

function selfTest() {
  const positive = [{
    file: "self-test-positive",
    pack: {
      version: "self-test",
      domain: "dormitory",
      scenarios: [
        {
          scenarioId: "dorm-cert-008",
          name: "permission denied",
          scenarioType: "rejected_command_scenario",
          expectedOutcome: "permission_denied_403",
          workItemType: "Dorm.ExceptionResolve",
          outputs: {
            workItem: { required: true },
            rejectedCommandSubmission: { required: true },
            rejectionTrace: { required: true },
            factTrace: { required: true },
            auditEvidence: { min: 1 },
            domainEvents: { allowed: false, max: 0 },
            ledgerTransactions: { allowed: false, max: 0 }
          }
        },
        {
          scenarioId: "dorm-cert-010",
          name: "missing evidence",
          scenarioType: "rejected_command_scenario",
          expectedOutcome: "business_blocked_422",
          workItemType: "Dorm.DepositConfirm",
          outputs: {
            workItem: { required: true },
            rejectedCommandSubmission: { required: true },
            rejectionTrace: { required: true },
            factTrace: { required: true },
            auditEvidence: { min: 1 },
            domainEvents: { allowed: false, max: 0 },
            ledgerTransactions: { allowed: false, max: 0 }
          }
        },
        {
          scenarioId: "self-committed",
          name: "commit",
          scenarioType: "committed_scenario",
          expectedOutcome: "committed_projected",
          workItemType: "Dorm.CheckinConfirm",
          outputs: {
            workItem: { required: true },
            commandSubmission: { required: true },
            factTrace: { required: true },
            evidenceTrace: { required: true },
            domainEvents: { min: 1 },
            lensOutputs: { min: 1 }
          }
        },
        {
          scenarioId: "self-conflict",
          name: "conflict",
          scenarioType: "rejected_command_scenario",
          expectedOutcome: "idempotency_conflict_409",
          workItemType: "Dorm.PaymentConfirm",
          outputs: {
            workItem: { required: true },
            rejectedCommandSubmission: { required: true },
            rejectionTrace: { required: true },
            factTrace: { required: true },
            auditEvidence: { min: 1 },
            domainEvents: { allowed: false, max: 0 },
            ledgerTransactions: { allowed: false, max: 0 },
            noDuplicateSideEffect: { required: true }
          }
        },
        {
          scenarioId: "self-shadow",
          name: "red shadow",
          scenarioType: "gate_only_blocked_scenario",
          expectedOutcome: "semantic_shadow_red_blocked",
          workItemType: "Gate.ShadowReview",
          outputs: {
            workItem: { required: true },
            gateResult: { required: true },
            shadowCompareReports: { min: 1 },
            rollbackBlocker: { required: true },
            domainEvents: { allowed: false, max: 0 },
            ledgerTransactions: { allowed: false, max: 0 }
          }
        },
        {
          scenarioId: "self-rollback",
          name: "missing rollback",
          scenarioType: "gate_only_blocked_scenario",
          expectedOutcome: "missing_rollback_blocked",
          workItemType: "Gate.RollbackReview",
          outputs: {
            workItem: { required: true },
            gateResult: { required: true },
            invariantChecks: { min: 1 },
            rollbackBlocker: { required: true },
            domainEvents: { allowed: false, max: 0 },
            ledgerTransactions: { allowed: false, max: 0 }
          }
        }
      ]
    }
  }];

  const negative = structuredClone(positive);
  negative[0].pack.scenarios[0].outputs.domainEvents = { min: 1 };
  const domainPacks = requiredDomains.filter((domain) => domain !== "dormitory").map((domain) => ({
    file: `self-${domain}`,
    pack: {
      version: "self",
      domain,
      scenarios: [{
        ...positive[0].pack.scenarios[2],
        scenarioId: `self-${domain}-committed`,
        workItemType: `${domain}.WorkItem`
      }]
    }
  }));
  const positiveResult = validatePacks([...positive, ...domainPacks]);
  const negativeResult = validatePacks([...negative, ...domainPacks]);

  if (positiveResult.errors.length > 0) {
    fail(`self-test positive fixture failed: ${positiveResult.errors.join("; ")}`);
  }
  if (!negativeResult.errors.some((item) => item.includes("forbid business DomainEvent"))) {
    fail("self-test negative fixture did not catch rejected scenario DomainEvent");
  }
  console.log("check-executable-scenarios self-test: PASS");
}

if (process.argv.includes("--self-test")) {
  selfTest();
  process.exit(0);
}

const files = scenarioFiles();
if (files.length === 0) {
  fail("no executable scenario files found");
}

const packs = files.map((file) => ({ file, pack: parseJsonLike(file) }));
const result = validatePacks(packs);
if (result.errors.length > 0) {
  fail(result.errors.join("; "));
}

console.log(`check-executable-scenarios: PASS files=${files.length} scenarios=${result.scenarioCount} domains=${result.domains.join(",")}`);
