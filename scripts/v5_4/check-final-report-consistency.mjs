import fs from "node:fs";
import path from "node:path";
import {
  fail,
  loadFinalGate,
  parseArgs,
  replayFinalGate,
  repoRoot,
  runSelfTest,
  writeJson
} from "./release-evidence-lib.mjs";

const args = parseArgs(process.argv.slice(2));

if (args.has("self-test")) {
  runSelfTest([
    () => assertBusinessProductionCannotBeAllowedWhenFinalGateBlocked(),
    () => assertConsistentBlockedReportsPass()
  ]);
  console.log("check-final-report-consistency self-test: PASS");
  process.exit(0);
}

const result = checkConsistency({ root: repoRoot });
writeJson(path.join(repoRoot, ".tmp", "v5_4", "final-report-consistency.json"), result);

if (result.violations.length > 0) {
  fail("check-final-report-consistency: FAIL", result.violations);
}

console.log(`check-final-report-consistency: PASS (finalGate=${result.finalGate.status}, businessProduction=${result.businessProduction})`);

export function checkConsistency({ root = repoRoot } = {}) {
  const finalGate = loadFinalGate(root).data;
  const replay = replayFinalGate(root);
  const violations = [];
  const summaryPath = path.join(root, "docs", "v5.4", "final-release-manifest-summary.md");
  const finalGoPath = path.join(root, "docs", "v5.4", "final-go-no-go-report.md");
  const rulesPath = path.join(root, "docs", "v5.5", "final-rules-os-go-no-go.md");

  const summary = readText(summaryPath);
  const finalGo = readText(finalGoPath);
  const rules = readText(rulesPath);

  assertMentionsStatus(summary, "final-release-manifest-summary.md", finalGate.status, violations);
  assertMentionsStatus(finalGo, "final-go-no-go-report.md", finalGate.status, violations);
  assertMentionsStatus(rules, "final-rules-os-go-no-go.md", finalGate.status, violations);

  if (finalGate.status !== replay.status) {
    violations.push(`Final report consistency failed because replay=${replay.status} but gate=${finalGate.status}.`);
  }

  const businessProduction = inferBusinessProduction(rules, finalGate.status);
  if (finalGate.status !== "passed" && businessProduction !== "BLOCKED") {
    violations.push(`Business Production must be BLOCKED while Final System Gate is ${finalGate.status}; got ${businessProduction}.`);
  }

  if (/Final decision:\s*\*\*GO\*\*/i.test(finalGo) && finalGate.status !== "passed") {
    violations.push("V5.4 final Go/No-Go report says GO while Final System Gate is not passed.");
  }

  return {
    status: violations.length === 0 ? "passed" : "blocked",
    finalGate: {
      status: finalGate.status,
      severity: finalGate.severity
    },
    replay: {
      status: replay.status,
      missingMrs: replay.missingMrs
    },
    businessProduction,
    reports: [
      path.relative(root, summaryPath).replaceAll("\\", "/"),
      path.relative(root, finalGoPath).replaceAll("\\", "/"),
      path.relative(root, rulesPath).replaceAll("\\", "/")
    ],
    violations
  };
}

function assertMentionsStatus(text, name, status, violations) {
  if (!text) {
    violations.push(`${name} is missing.`);
    return;
  }
  const statusPattern = new RegExp("status[:\\s`*|]+" + escapeRegExp(status), "i");
  if (!statusPattern.test(text) && !text.toLowerCase().includes(`status: \`${status}\``)) {
    violations.push(`${name} does not mention Final Gate status ${status}.`);
  }
}

function inferBusinessProduction(rulesText, finalGateStatus) {
  const match = /Business Production GO:\s*`?([A-Z_]+)`?/i.exec(rulesText);
  if (match) return match[1].toUpperCase();
  return finalGateStatus === "passed" ? "UNKNOWN" : "BLOCKED";
}

function assertBusinessProductionCannotBeAllowedWhenFinalGateBlocked() {
  const root = makeTempRoot("business-allowed");
  writeReports(root, {
    finalStatus: "blocked",
    finalDecision: "NO-GO",
    businessProduction: "GO"
  });
  const result = checkConsistency({ root });
  assertViolation(result, "Business Production must be BLOCKED");
}

function assertConsistentBlockedReportsPass() {
  const root = makeTempRoot("consistent-blocked");
  writeReports(root, {
    finalStatus: "blocked",
    finalDecision: "NO-GO",
    businessProduction: "BLOCKED"
  });
  const result = checkConsistency({ root });
  if (result.violations.length > 0) {
    throw new Error(`Expected consistent blocked reports to pass; got ${JSON.stringify(result.violations)}`);
  }
}

function assertViolation(result, expected) {
  if (!result.violations.some((item) => item.includes(expected))) {
    throw new Error(`Expected violation containing ${expected}; got ${JSON.stringify(result.violations)}`);
  }
}

function makeTempRoot(name) {
  const root = fs.mkdtempSync(path.join(repoRoot, ".tmp", "v5_4", `${name}-`));
  fs.mkdirSync(path.join(root, "docs", "v5.4"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs", "v5.5"), { recursive: true });
  return root;
}

function writeReports(root, { finalStatus, finalDecision, businessProduction }) {
  fs.writeFileSync(path.join(root, "docs", "v5.4", "final-system-gate-result.json"), JSON.stringify({
    gate_result_id: "final_system_gate",
    status: finalStatus,
    severity: finalStatus === "passed" ? "P2" : "P0",
    ci_run_id: "local-final-system",
    business_signoff_refs: [],
    no_go_items: finalStatus === "passed" ? [] : ["missing package"],
    go_items: []
  }, null, 2));
  fs.writeFileSync(path.join(root, "docs", "v5.4", "final-release-manifest-summary.md"), `Status: \`${finalStatus}\`\n`);
  fs.writeFileSync(path.join(root, "docs", "v5.4", "final-go-no-go-report.md"), `Final decision: **${finalDecision}**\n\nStatus: \`${finalStatus}\`\n`);
  fs.writeFileSync(path.join(root, "docs", "v5.5", "final-rules-os-go-no-go.md"), `Final System Gate\n\n- Status: \`${finalStatus}\`\n- Business Production GO: \`${businessProduction}\`\n`);
}

function readText(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
