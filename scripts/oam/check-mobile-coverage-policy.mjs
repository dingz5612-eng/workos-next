import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = process.cwd();
const policyPath = "docs/oam/mobile-branch-risk-policy.json";
const ledgerPath = "docs/oam/mobile-branch-risk-ledger.json";
const coveragePath = "artifacts/oam/test-results/mobile/coverage/coverage-summary.json";
const vitestConfigPath = "apps/mobile/vitest.config.js";
const resultPath = "artifacts/oam/checks/mobile-coverage-policy-result.json";
const allowedCoverageExcludes = new Set(["src/generated/**", "src/__tests__/**"]);
const allowedLayers = new Set(["P0 业务保护", "P1 状态决策", "P2 展示组合", "PC 治理或 debug"]);

export function validateMobileCoveragePolicy(input) {
  const violations = [];
  const policy = input.policy;
  const ledger = input.ledger;
  const coverage = input.coverage;
  const vitestConfigText = input.vitestConfigText;
  const sourceTexts = input.sourceTexts || new Map();

  validatePolicyShape(policy, violations);
  validateGlobalBaseline(policy, coverage, violations);
  validateLedgerFreshness(policy, ledger, coverage, violations);
  validatePolicyRules(policy, ledger, violations);
  validateNewSourceFiles(policy, ledger, violations);
  validateCoverageExcludes(vitestConfigText, violations);
  validateCoverageIgnoreMarkers(sourceTexts, violations);

  return violations;
}

function validatePolicyShape(policy, violations) {
  if (policy.version !== "current-oam.mobile-branch-risk-policy.v1") {
    violations.push("coverage_policy_version_invalid");
  }
  if (!Array.isArray(policy.rules) || policy.rules.length === 0) {
    violations.push("coverage_policy_rules_missing");
    return;
  }

  const requiredFields = [
    "filePath",
    "layer",
    "riskLevel",
    "targetBranchCoveragePct",
    "currentStageHardBaselinePct",
    "nextStageTargetPct",
    "affectsBusinessWrite",
    "affectsAdmissionRejection",
    "affectsSearchReadonly",
    "affectsDeviceTrust",
    "affectsOrdinaryMobileUser",
    "testFiles",
    "allowDeferral",
    "deferralReasonZh",
    "nextActionZh",
    "riskDescriptionZh"
  ];

  const seen = new Set();
  for (const rule of policy.rules) {
    for (const field of requiredFields) {
      if (!(field in rule)) {
        violations.push(`coverage_policy_rule_field_missing:${rule.filePath || "<unknown>"}:${field}`);
      }
    }
    if (seen.has(rule.filePath)) {
      violations.push(`coverage_policy_duplicate_rule:${rule.filePath}`);
    }
    seen.add(rule.filePath);
    if (!allowedLayers.has(rule.layer)) {
      violations.push(`coverage_policy_layer_invalid:${rule.filePath}`);
    }
    if (!Array.isArray(rule.testFiles) || rule.testFiles.length === 0) {
      violations.push(`coverage_policy_test_binding_missing:${rule.filePath}`);
    }
    if (rule.allowDeferral && (!hasChinese(rule.deferralReasonZh) || !hasChinese(rule.nextActionZh))) {
      violations.push(`coverage_policy_deferral_reason_missing_zh:${rule.filePath}`);
    }
    if (!hasChinese(rule.riskDescriptionZh)) {
      violations.push(`coverage_policy_risk_description_missing_zh:${rule.filePath}`);
    }
  }
}

function validateGlobalBaseline(policy, coverage, violations) {
  const baseline = policy.stage?.globalHardBaseline || {};
  const total = coverage.total || {};
  for (const [metricName, baselineKey] of [
    ["statements", "statementsPct"],
    ["branches", "branchesPct"],
    ["functions", "functionsPct"],
    ["lines", "linesPct"]
  ]) {
    const actual = Number(total[metricName]?.pct ?? -1);
    const expected = Number(baseline[baselineKey] ?? Number.NaN);
    if (!Number.isFinite(expected)) {
      violations.push(`coverage_global_baseline_missing:${metricName}`);
    } else if (actual < expected) {
      violations.push(`coverage_global_regression:${metricName}:${actual}<${expected}`);
    }
  }
}

function validateLedgerFreshness(policy, ledger, coverage, violations) {
  if (ledger.status !== "generated" || ledger.generatedBy !== "scripts/oam/generate-mobile-branch-risk-ledger.mjs") {
    violations.push("coverage_ledger_not_generated_by_script");
  }
  if (ledger.policyVersion !== policy.version) {
    violations.push("coverage_ledger_policy_version_mismatch");
  }
  if (ledger.coverageSource !== coveragePath) {
    violations.push("coverage_ledger_source_mismatch");
  }
  for (const metricName of ["statements", "branches", "functions", "lines"]) {
    const expected = Number(coverage.total?.[metricName]?.pct ?? -1);
    const actual = Number(ledger.globalCoverage?.[metricName]?.pct ?? -2);
    if (expected !== actual) {
      violations.push(`coverage_ledger_global_stale:${metricName}:${actual}!=${expected}`);
    }
  }

  const ledgerByFile = new Map((ledger.files || []).map((entry) => [entry.filePath, entry]));
  for (const [rawFile, summary] of Object.entries(coverage)) {
    if (rawFile === "total") continue;
    const filePath = normalizeCoveragePath(rawFile);
    const entry = ledgerByFile.get(filePath);
    if (!entry) {
      violations.push(`coverage_ledger_file_missing:${filePath}`);
      continue;
    }
    for (const metricName of ["statements", "branches", "functions", "lines"]) {
      const expected = Number(summary[metricName]?.pct ?? -1);
      const actual = Number(entry.coverage?.[metricName]?.pct ?? -2);
      if (expected !== actual) {
        violations.push(`coverage_ledger_file_stale:${filePath}:${metricName}:${actual}!=${expected}`);
      }
    }
  }
}

function validatePolicyRules(policy, ledger, violations) {
  const ledgerByFile = new Map((ledger.files || []).map((entry) => [entry.filePath, entry]));
  for (const rule of policy.rules || []) {
    const entry = ledgerByFile.get(rule.filePath);
    if (!entry) {
      violations.push(`coverage_policy_rule_not_in_ledger:${rule.filePath}`);
      continue;
    }
    if (rule.layer === "P0 业务保护") {
      const actual = Number(entry.coverage?.branches?.pct ?? -1);
      const baseline = Number(rule.currentStageHardBaselinePct);
      if (actual < baseline) {
        violations.push(`coverage_p0_file_regression:${rule.filePath}:${actual}<${baseline}`);
      }
    }
    if (rule.allowDeferral && (!hasChinese(rule.deferralReasonZh) || !hasChinese(rule.nextActionZh))) {
      violations.push(`coverage_policy_deferral_incomplete:${rule.filePath}`);
    }
  }
}

function validateNewSourceFiles(policy, ledger, violations) {
  const deferrals = policy.sourceFileDeferrals || {};
  const allEntries = [...(ledger.files || []), ...(ledger.missingCoverageSourceFiles || [])];
  for (const entry of allEntries) {
    if (!entry.source?.isNewSourceFile) continue;
    if (entry.policy?.status === "registered") continue;
    const deferral = deferrals[entry.filePath];
    if (!deferral || !deferral.allowDeferral || !hasChinese(deferral.deferralReasonZh) || !hasChinese(deferral.nextActionZh)) {
      violations.push(`coverage_new_mobile_source_unregistered:${entry.filePath}`);
    }
  }
}

function validateCoverageExcludes(vitestConfigText, violations) {
  const excludes = extractCoverageExcludes(vitestConfigText);
  if (excludes.length === 0) {
    violations.push("coverage_exclude_config_missing");
  }
  for (const item of excludes) {
    if (!allowedCoverageExcludes.has(item)) {
      violations.push(`coverage_exclude_not_allowed:${item}`);
    }
  }
}

function validateCoverageIgnoreMarkers(sourceTexts, violations) {
  const forbidden = /(istanbul|c8|v8)\s+ignore|coverage\s+ignore/i;
  for (const [filePath, text] of sourceTexts.entries()) {
    if (forbidden.test(text)) {
      violations.push(`coverage_ignore_marker_forbidden:${filePath}`);
    }
  }
}

function extractCoverageExcludes(text) {
  const match = text.match(/exclude\s*:\s*\[([\s\S]*?)\]/);
  if (!match) return [];
  return [...match[1].matchAll(/["']([^"']+)["']/g)].map((item) => item[1]);
}

function readSourceTexts() {
  const files = [];
  walk(path.join(repoRoot, "apps/mobile/src"), files);
  return new Map(
    files
      .filter((file) => file.endsWith(".js"))
      .filter((file) => !file.replaceAll("\\", "/").includes("/__tests__/"))
      .map((file) => [toRepoPath(file), fs.readFileSync(file, "utf8")])
  );
}

function walk(current, files) {
  if (!fs.existsSync(current)) return;
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
}

function runSelfTest() {
  const basePolicy = {
    version: "current-oam.mobile-branch-risk-policy.v1",
    stage: {
      globalHardBaseline: {
        statementsPct: 78.54,
        branchesPct: 63.38,
        functionsPct: 84.93,
        linesPct: 82.68
      }
    },
    rules: [
      {
        filePath: "apps/mobile/src/operationRuntime.js",
        layer: "P0 业务保护",
        riskLevel: "P0",
        targetBranchCoveragePct: 70,
        currentStageHardBaselinePct: 29.54,
        nextStageTargetPct: 70,
        affectsBusinessWrite: true,
        affectsAdmissionRejection: true,
        affectsSearchReadonly: false,
        affectsDeviceTrust: true,
        affectsOrdinaryMobileUser: true,
        testFiles: ["apps/mobile/src/__tests__/operationRuntime.test.js"],
        allowDeferral: false,
        deferralReasonZh: "不允许暂缓。",
        nextActionZh: "补齐矩阵测试。",
        riskDescriptionZh: "保护运行提交协议。"
      },
      {
        filePath: "apps/mobile/src/navigationController.js",
        layer: "P1 状态决策",
        riskLevel: "P1",
        targetBranchCoveragePct: 65,
        currentStageHardBaselinePct: 30,
        nextStageTargetPct: 65,
        affectsBusinessWrite: false,
        affectsAdmissionRejection: true,
        affectsSearchReadonly: true,
        affectsDeviceTrust: false,
        affectsOrdinaryMobileUser: true,
        testFiles: ["apps/mobile/src/__tests__/OperationRouteIdentityContract.test.js"],
        allowDeferral: true,
        deferralReasonZh: "允许暂缓，因为路由矩阵下一批补齐。",
        nextActionZh: "补齐路由矩阵。",
        riskDescriptionZh: "保护路由状态。"
      }
    ]
  };
  const baseCoverage = {
    total: {
      statements: { total: 100, covered: 80, pct: 80 },
      branches: { total: 100, covered: 64, pct: 64 },
      functions: { total: 100, covered: 86, pct: 86 },
      lines: { total: 100, covered: 83, pct: 83 }
    },
    "apps/mobile/src/operationRuntime.js": {
      statements: { total: 10, covered: 8, pct: 80 },
      branches: { total: 10, covered: 3, pct: 30 },
      functions: { total: 10, covered: 9, pct: 90 },
      lines: { total: 10, covered: 8, pct: 80 }
    }
  };
  const baseLedger = {
    status: "generated",
    generatedBy: "scripts/oam/generate-mobile-branch-risk-ledger.mjs",
    policyVersion: basePolicy.version,
    coverageSource: coveragePath,
    globalCoverage: metricSet(baseCoverage.total),
    files: [
      {
        filePath: "apps/mobile/src/operationRuntime.js",
        coverage: metricSet(baseCoverage["apps/mobile/src/operationRuntime.js"]),
        policy: { status: "registered", layer: "P0 业务保护" },
        source: { isNewSourceFile: false }
      }
    ],
    missingCoverageSourceFiles: []
  };
  const vitestConfigText = 'coverage: { exclude: ["src/generated/**", "src/__tests__/**"] }';

  assertViolation("Branches baseline regression must fail", () => {
    const coverage = structuredClone(baseCoverage);
    coverage.total.branches.pct = 63.37;
    const ledger = structuredClone(baseLedger);
    ledger.globalCoverage.branches.pct = 63.37;
    return validateMobileCoveragePolicy({
      policy: basePolicy,
      ledger,
      coverage,
      vitestConfigText,
      sourceTexts: new Map()
    });
  }, "coverage_global_regression:branches");

  assertViolation("Unregistered new source file must fail", () => {
    const newSourceFile = ["apps", "mobile", "src", "newController.js"].join("/");
    const ledger = structuredClone(baseLedger);
    ledger.files.push({
      filePath: newSourceFile,
      coverage: metricSet(baseCoverage["apps/mobile/src/operationRuntime.js"]),
      policy: { status: "unregistered", layer: "未登记" },
      source: { isNewSourceFile: true }
    });
    return validateMobileCoveragePolicy({
      policy: basePolicy,
      ledger,
      coverage: baseCoverage,
      vitestConfigText,
      sourceTexts: new Map()
    });
  }, "coverage_new_mobile_source_unregistered");

  assertViolation("Deferral without Chinese reason must fail", () => {
    const policy = structuredClone(basePolicy);
    policy.rules[1].deferralReasonZh = "todo";
    return validateMobileCoveragePolicy({
      policy,
      ledger: baseLedger,
      coverage: baseCoverage,
      vitestConfigText,
      sourceTexts: new Map()
    });
  }, "coverage_policy_deferral_reason_missing_zh");

  assertViolation("Arbitrary coverage exclude must fail", () => {
    return validateMobileCoveragePolicy({
      policy: basePolicy,
      ledger: baseLedger,
      coverage: baseCoverage,
      vitestConfigText: 'coverage: { exclude: ["src/generated/**", "src/**"] }',
      sourceTexts: new Map()
    });
  }, "coverage_exclude_not_allowed:src/**");

  console.log("Mobile coverage policy self-test: PASS");
}

function assertViolation(name, run, expectedPrefix) {
  const violations = run();
  if (!violations.some((item) => item.startsWith(expectedPrefix))) {
    throw new Error(`${name}; expected ${expectedPrefix}, got ${violations.join(", ")}`);
  }
}

function runCli() {
  if (process.argv.includes("--self-test")) {
    runSelfTest();
    return;
  }

  const policy = readJson(policyPath);
  const ledger = readJson(ledgerPath);
  const coverage = readJson(coveragePath);
  const violations = validateMobileCoveragePolicy({
    policy,
    ledger,
    coverage,
    vitestConfigText: fs.readFileSync(path.join(repoRoot, vitestConfigPath), "utf8"),
    sourceTexts: readSourceTexts()
  });
  writeJson(resultPath, {
    version: "current-oam.mobile-coverage-policy-result.v1",
    status: violations.length === 0 ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    policyFile: policyPath,
    ledgerFile: ledgerPath,
    coverageSource: coveragePath,
    globalCoverage: ledger.globalCoverage,
    baseline: policy.stage?.globalHardBaseline,
    violations
  });

  if (violations.length > 0) {
    console.error("Mobile coverage policy check: FAIL");
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    process.exit(1);
  }

  console.log("Mobile coverage policy check: PASS");
}

function metricSet(summary) {
  return {
    statements: metric(summary.statements),
    branches: metric(summary.branches),
    functions: metric(summary.functions),
    lines: metric(summary.lines)
  };
}

function metric(value = {}) {
  const total = Number(value.total || 0);
  const covered = Number(value.covered || 0);
  return {
    total,
    covered,
    missing: Math.max(0, total - covered),
    pct: Number(value.pct ?? (total === 0 ? 100 : ((covered / total) * 100).toFixed(2)))
  };
}

function normalizeCoveragePath(file) {
  const normalized = file.replaceAll("\\", "/");
  const marker = "apps/mobile/src/";
  const index = normalized.indexOf(marker);
  return index >= 0 ? normalized.slice(index) : normalized;
}

function hasChinese(value) {
  return /[\u4e00-\u9fff]/.test(String(value || ""));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, file), "utf8"));
}

function writeJson(file, value) {
  const target = path.join(repoRoot, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

function toRepoPath(file) {
  return path.relative(repoRoot, file).replaceAll("\\", "/");
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  runCli();
}
