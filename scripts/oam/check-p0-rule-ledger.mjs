import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const ledgerPath = "docs/system/oam-p0-rule-ledger.json";
const markdownLedgerPath = "docs/system/oam-p0-rule-ledger.md";
const gateMapPath = "docs/system/oam-rule-to-gate-map.md";
const controlPlanePath = "scripts/oam/run-control-plane-checks.ps1";
const ciPath = ".github/workflows/ci.yml";
const evidenceArtifactPrefix = "artifacts/oam/evidence/";
const allowedStatuses = new Set(["passed", "failed", "blocked", "missing"]);
const requiredFields = [
  "ruleId",
  "ruleNameZh",
  "authorityFile",
  "structuredContract",
  "runtimeExecutionPoint",
  "primaryGate",
  "auxiliaryGates",
  "evidenceArtifact",
  "status",
  "riskLevel",
  "blocksRelease",
  "riskDescriptionZh"
];

if (process.argv.includes("--self-test")) {
  runSelfTest();
} else {
  const failures = validateRepositoryLedger();
  if (failures.length > 0) {
    console.error("P0 release kernel check: FAIL");
    for (const failure of failures) {
      console.error(`- ${failure.id}: ${failure.message}`);
    }
    process.exit(1);
  }

  console.log("P0 release kernel check: PASS");
}

function validateRepositoryLedger() {
  const failures = [];
  const ledger = readJson(ledgerPath, failures);
  if (!ledger) return failures;

  validateLedgerShape(ledger, failures, { checkFiles: true });
  validateMarkdownConsistency(ledger, failures);
  validateGateMapConsistency(ledger, failures);
  validateGateCoverage(ledger, failures);
  return failures;
}

function validateLedgerShape(ledger, failures, options = {}) {
  if (ledger.status !== "authoritative") {
    failures.push(f("ledger_not_authoritative", "P0 机器账本必须声明为 authoritative。"));
  }
  if (ledger.humanReadableLedger !== markdownLedgerPath) {
    failures.push(f("markdown_ledger_not_bound", `P0 机器账本必须绑定 ${markdownLedgerPath}。`));
  }
  if (ledger.releaseKernelGate !== "scripts/oam/check-p0-rule-ledger.mjs") {
    failures.push(f("release_kernel_gate_not_bound", "P0 机器账本必须绑定 scripts/oam/check-p0-rule-ledger.mjs。"));
  }
  if (!Array.isArray(ledger.rules) || ledger.rules.length < 14) {
    failures.push(f("p0_rule_count_invalid", "P0 机器账本必须至少覆盖 P0-01 到 P0-14。"));
    return;
  }

  const seen = new Set();
  ledger.rules.forEach((rule, index) => {
    const expectedId = `P0-${String(index + 1).padStart(2, "0")}`;
    if (rule.ruleId !== expectedId) {
      failures.push(f("p0_rule_id_not_continuous", `第 ${index + 1} 条规则应为 ${expectedId}，实际为 ${rule.ruleId || "空"}。`));
    }
    if (seen.has(rule.ruleId)) {
      failures.push(f("p0_rule_id_duplicate", `${rule.ruleId} 重复。`));
    }
    seen.add(rule.ruleId);

    for (const field of requiredFields) {
      const value = rule[field];
      if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
        failures.push(f("p0_rule_field_missing", `${rule.ruleId || expectedId} 缺少字段 ${field}。`));
      }
    }

    if (!allowedStatuses.has(rule.status)) {
      failures.push(f("p0_status_invalid", `${rule.ruleId} 状态 ${rule.status} 不合法。`));
    } else if (rule.status !== "passed") {
      failures.push(f("p0_status_not_passed", `${rule.ruleId} 状态为 ${rule.status}，P0 发布内核必须失败。`));
    }

    if (rule.riskLevel !== "P0") {
      failures.push(f("p0_risk_level_invalid", `${rule.ruleId} 风险等级必须为 P0。`));
    }
    if (rule.blocksRelease !== true) {
      failures.push(f("p0_must_block_release", `${rule.ruleId} 必须声明 blocksRelease=true。`));
    }

    if (options.checkFiles) {
      requirePath(rule.authorityFile, `${rule.ruleId} 权威文件`, failures);
      requirePath(rule.structuredContract, `${rule.ruleId} 结构化合同`, failures);
      requirePath(rule.primaryGate, `${rule.ruleId} 主门禁`, failures);
      if (!rule.evidenceArtifact.startsWith(evidenceArtifactPrefix)) {
        failures.push({ id: rule.ruleId, message: `证据产物必须位于 ${evidenceArtifactPrefix}: ${rule.evidenceArtifact}` });
      }
      if (!isGeneratedEvidenceArtifact(rule.evidenceArtifact)) {
        requirePath(rule.evidenceArtifact, `${rule.ruleId} 证据产物`, failures);
      }
      for (const gate of rule.auxiliaryGates ?? []) {
        if (looksLikeRepoPath(gate)) {
          requirePath(gate, `${rule.ruleId} 辅助门禁`, failures);
        }
      }
    }
  });
}

function validateMarkdownConsistency(ledger, failures) {
  const rows = parseMarkdownTable(markdownLedgerPath, failures);
  if (rows.size === 0) return;
  for (const rule of ledger.rules) {
    const row = rows.get(rule.ruleId);
    if (!row) {
      failures.push(f("markdown_rule_missing", `${markdownLedgerPath} 缺少 ${rule.ruleId}。`));
      continue;
    }
    compare(rule.ruleId, "规则中文名", row.ruleNameZh, rule.ruleNameZh, failures);
    compare(rule.ruleId, "主门禁", row.primaryGate, rule.primaryGate, failures);
    compare(rule.ruleId, "证据产物", row.evidenceArtifact, rule.evidenceArtifact, failures);
    compare(rule.ruleId, "当前状态", row.status, rule.status, failures);
    compare(rule.ruleId, "是否阻断发布", row.blocksRelease, String(rule.blocksRelease), failures);
  }
}

function validateGateMapConsistency(ledger, failures) {
  const rows = parseGateMap(gateMapPath, failures);
  if (rows.size === 0) return;
  for (const rule of ledger.rules) {
    const row = rows.get(rule.ruleId);
    if (!row) {
      failures.push(f("gate_map_rule_missing", `${gateMapPath} 缺少 ${rule.ruleId}。`));
      continue;
    }
    compare(rule.ruleId, "规则到门禁映射主门禁", row.primaryGate, rule.primaryGate, failures);
    compare(rule.ruleId, "规则到门禁映射证据产物", row.evidenceArtifact, rule.evidenceArtifact, failures);
  }
}

function validateGateCoverage(ledger, failures) {
  const controlPlane = readText(controlPlanePath, failures);
  const ci = readText(ciPath, failures);
  if (!controlPlane || !ci) return;

  const p0PrimaryGates = [...new Set(ledger.rules.map((rule) => rule.primaryGate))].sort();
  for (const gate of p0PrimaryGates) {
    if (!textContainsPath(controlPlane, gate)) {
      failures.push(f("primary_gate_missing_from_control_plane", `${gate} 未接入 ${controlPlanePath}。`));
    }
    if (!textContainsPath(ci, gate)) {
      failures.push(f("primary_gate_missing_from_ci", `${gate} 未接入 ${ciPath}。`));
    }
  }

  if (textContainsPath(controlPlane, ledger.releaseKernelGate) && !textContainsPath(ci, ledger.releaseKernelGate)) {
    failures.push(f("release_kernel_missing_from_ci", `${ledger.releaseKernelGate} 已接入本地总门禁，但未接入 CI。`));
  }
}

function parseMarkdownTable(file, failures) {
  const text = readText(file, failures);
  const rows = new Map();
  if (!text) return rows;
  for (const line of text.split(/\r?\n/)) {
    if (!/^\|\s*P0-\d+/.test(line)) continue;
    const cells = line.split("|").map((cell) => strip(cell));
    rows.set(cells[1], {
      ruleNameZh: cells[2],
      primaryGate: cells[6],
      evidenceArtifact: cells[8],
      status: cells[9],
      blocksRelease: cells[11]
    });
  }
  return rows;
}

function parseGateMap(file, failures) {
  const text = readText(file, failures);
  const rows = new Map();
  if (!text) return rows;
  for (const line of text.split(/\r?\n/)) {
    if (!/^\|\s*P0-\d+/.test(line)) continue;
    const cells = line.split("|").map((cell) => strip(cell));
    rows.set(cells[1], {
      primaryGate: cells[3],
      evidenceArtifact: cells[5]
    });
  }
  return rows;
}

function compare(ruleId, label, actual, expected, failures) {
  if (actual !== expected) {
    failures.push(f("p0_ledger_conflict", `${ruleId} ${label} 不一致：Markdown/映射为 ${actual || "空"}，JSON 为 ${expected || "空"}。`));
  }
}

function runSelfTest() {
  const failures = [];
  validateLedgerShape({
    status: "authoritative",
    humanReadableLedger: markdownLedgerPath,
    releaseKernelGate: "scripts/oam/check-p0-rule-ledger.mjs",
    rules: Array.from({ length: 14 }, (_, index) => ({
      ruleId: `P0-${String(index + 1).padStart(2, "0")}`,
      ruleNameZh: `自检规则 ${index + 1}`,
      authorityFile: "docs/oam/current-admission-state.json",
      structuredContract: "docs/contracts/oam.current.json",
      runtimeExecutionPoint: "self-test",
      primaryGate: "scripts/oam/check-current-oam.mjs",
      auxiliaryGates: ["scripts/check-rule-authority.mjs"],
      evidenceArtifact: "artifacts/oam/evidence/evidence-graph.json",
      status: index === 10 ? "missing" : "passed",
      riskLevel: "P0",
      blocksRelease: true,
      riskDescriptionZh: "自检：missing 必须阻断发布。"
    }))
  }, failures);

  if (!failures.some((failure) => failure.id === "p0_status_not_passed")) {
    throw new Error("P0 release kernel self-test must fail when any P0 status is missing.");
  }

  console.log("P0 release kernel self-test: PASS");
}

function requirePath(repoPath, label, failures) {
  if (!looksLikeRepoPath(repoPath)) return;
  if (!fs.existsSync(path.join(root, repoPath))) {
    failures.push(f("p0_referenced_path_missing", `${label} 不存在：${repoPath}。`));
  }
}

function isGeneratedEvidenceArtifact(repoPath) {
  return typeof repoPath === "string" && repoPath.startsWith(evidenceArtifactPrefix);
}

function looksLikeRepoPath(value) {
  return typeof value === "string" &&
    /^(?:\.github|apps|artifacts|docs|infra|modules|packages|schemas|scripts|services|tests|tools)\//.test(value);
}

function textContainsPath(text, repoPath) {
  const normalized = repoPath.replaceAll("\\", "/");
  return text.replaceAll("\\", "/").includes(normalized);
}

function readJson(file, failures) {
  const text = readText(file, failures);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    failures.push(f("json_invalid", `${file} 不是合法 JSON：${error.message}`));
    return null;
  }
}

function readText(file, failures) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) {
    failures.push(f("file_missing", `文件不存在：${file}。`));
    return "";
  }
  return fs.readFileSync(fullPath, "utf8");
}

function strip(value) {
  return (value ?? "").trim().replace(/^`|`$/g, "");
}

function f(id, message) {
  return { id, message };
}
