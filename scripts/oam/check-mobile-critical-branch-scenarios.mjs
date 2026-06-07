import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = process.cwd();
const scenarioPath = "docs/oam/mobile-critical-branch-scenarios.json";
const resultPath = "artifacts/oam/checks/mobile-critical-branch-scenarios-result.json";

export function validateCriticalBranchScenarios(ledger) {
  const violations = [];
  if (ledger.version !== "current-oam.mobile-critical-branch-scenarios.v1") {
    violations.push("critical_scenario_version_invalid");
  }
  if (!Array.isArray(ledger.scenarios) || ledger.scenarios.length === 0) {
    violations.push("critical_scenario_list_missing");
    return violations;
  }

  const seen = new Set();
  const requiredFields = [
    "scenarioId",
    "nameZh",
    "riskLevel",
    "affectedFiles",
    "expectedStatus",
    "forbiddenBehaviorZh",
    "testFiles",
    "covered",
    "gapDescriptionZh"
  ];

  for (const scenario of ledger.scenarios) {
    for (const field of requiredFields) {
      if (!(field in scenario)) {
        violations.push(`critical_scenario_field_missing:${scenario.scenarioId || "<unknown>"}:${field}`);
      }
    }
    if (seen.has(scenario.scenarioId)) {
      violations.push(`critical_scenario_duplicate:${scenario.scenarioId}`);
    }
    seen.add(scenario.scenarioId);
    if (!hasChinese(scenario.nameZh) || !hasChinese(scenario.forbiddenBehaviorZh) || !hasChinese(scenario.gapDescriptionZh)) {
      violations.push(`critical_scenario_chinese_missing:${scenario.scenarioId}`);
    }
    if (!Array.isArray(scenario.affectedFiles) || scenario.affectedFiles.length === 0) {
      violations.push(`critical_scenario_affected_files_missing:${scenario.scenarioId}`);
    } else {
      for (const file of scenario.affectedFiles) {
        if (!exists(file)) {
          violations.push(`critical_scenario_affected_file_not_found:${scenario.scenarioId}:${file}`);
        }
      }
    }
    if (["P0", "P1"].includes(scenario.riskLevel)) {
      if (!Array.isArray(scenario.testFiles) || scenario.testFiles.length === 0) {
        violations.push(`critical_scenario_test_binding_missing:${scenario.scenarioId}`);
      }
      for (const file of scenario.testFiles || []) {
        if (!exists(file)) {
          violations.push(`critical_scenario_test_file_not_found:${scenario.scenarioId}:${file}`);
        }
      }
    }
    if (scenario.riskLevel === "P0" && scenario.covered !== true) {
      violations.push(`critical_scenario_p0_uncovered:${scenario.scenarioId}`);
    }
  }

  return violations;
}

function runSelfTest() {
  const fixture = {
    version: "current-oam.mobile-critical-branch-scenarios.v1",
    scenarios: [
      {
        scenarioId: "MBRK-P0-SELF",
        nameZh: "自检场景",
        riskLevel: "P0",
        affectedFiles: ["apps/mobile/src/operationRuntime.js"],
        expectedStatus: "403",
        forbiddenBehaviorZh: "不得放行。",
        testFiles: [],
        covered: false,
        gapDescriptionZh: "用于验证 P0 未覆盖会失败。"
      }
    ]
  };
  const violations = validateCriticalBranchScenarios(fixture);
  if (!violations.includes("critical_scenario_test_binding_missing:MBRK-P0-SELF") ||
    !violations.includes("critical_scenario_p0_uncovered:MBRK-P0-SELF")) {
    throw new Error(`Critical scenario self-test failed: ${violations.join(", ")}`);
  }
  console.log("Mobile critical branch scenarios self-test: PASS");
}

function runCli() {
  if (process.argv.includes("--self-test")) {
    runSelfTest();
    return;
  }

  const ledger = readJson(scenarioPath);
  const violations = validateCriticalBranchScenarios(ledger);
  writeJson(resultPath, {
    version: "current-oam.mobile-critical-branch-scenarios-result.v1",
    status: violations.length === 0 ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    scenarioFile: scenarioPath,
    scenarioCount: ledger.scenarios?.length || 0,
    p0ScenarioCount: (ledger.scenarios || []).filter((scenario) => scenario.riskLevel === "P0").length,
    p1ScenarioCount: (ledger.scenarios || []).filter((scenario) => scenario.riskLevel === "P1").length,
    violations
  });
  if (violations.length > 0) {
    console.error("Mobile critical branch scenarios check: FAIL");
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    process.exit(1);
  }
  console.log("Mobile critical branch scenarios check: PASS");
}

function exists(file) {
  return fs.existsSync(path.join(repoRoot, file));
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

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  runCli();
}
