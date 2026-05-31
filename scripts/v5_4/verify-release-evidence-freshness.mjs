import fs from "node:fs";
import path from "node:path";
import {
  assertFinalGateCannotClaimProduction,
  collectReleaseEvidence,
  fail,
  gitHead,
  isLocalRunId,
  loadFinalGate,
  parseArgs,
  productionStatuses,
  replayFinalGate,
  repoRoot,
  runSelfTest,
  writeJson
} from "./release-evidence-lib.mjs";

const args = parseArgs(process.argv.slice(2));

if (args.has("self-test")) {
  runSelfTest([
    () => assertFreshnessRejectsActiveStaleManifest(),
    () => assertFreshnessRejectsPassedLocalFinalGate()
  ]);
  console.log("verify-release-evidence-freshness self-test: PASS");
  process.exit(0);
}

const strict = args.has("strict");
const headSha = args.value("headSha", gitHead());
const result = verifyFreshness({ strict, headSha });
writeJson(path.join(repoRoot, ".tmp", "v5_4", "release-evidence-freshness.json"), result);

if (result.violations.length > 0) {
  fail("verify-release-evidence-freshness: FAIL", result.violations);
}

console.log(`verify-release-evidence-freshness: PASS (${result.checked.manifests} manifests, finalGate=${result.finalGate.status})`);

export function verifyFreshness({ strict = false, headSha = gitHead(), root = repoRoot, finalGatePath = undefined } = {}) {
  const evidence = collectReleaseEvidence(root);
  const finalGate = loadFinalGate(root, finalGatePath).data;
  const replay = replayFinalGate(root);
  const violations = [];
  const production = productionStatuses();

  for (const [mr, manifests] of evidence.manifests) {
    for (const { file, data } of manifests) {
      if (production.has(data.status)) {
        if (strict && data.commit_sha !== headSha) {
          violations.push(`${relative(file, root)} production manifest commit_sha ${data.commit_sha} does not match HEAD ${headSha}.`);
        }
        if (isLocalRunId(data.ci_run_id)) {
          violations.push(`${relative(file, root)} production manifest uses local ci_run_id: ${data.ci_run_id}.`);
        }
      }

      if (String(path.basename(file)).toLowerCase().includes(".not_run.")) {
        violations.push(`${relative(file, root)} is a not_run artifact and cannot be release evidence.`);
      }

      if (mr !== data.mr_id) {
        violations.push(`${relative(file, root)} MR id mismatch: key=${mr}, manifest=${data.mr_id}.`);
      }
    }
  }

  assertFinalGateCannotClaimProduction(finalGate, replay, violations);

  const rulesReport = path.join(root, "docs", "v5.5", "final-rules-os-go-no-go.md");
  if (fs.existsSync(rulesReport)) {
    const text = fs.readFileSync(rulesReport, "utf8");
    if (finalGate.status !== "passed" && /Business Production GO:\s*`?(GO|ALLOWED|REQUIRES_BUSINESS_LINE_ADMISSION_GATE)`?/i.test(text)) {
      violations.push("V5.5 final report allows Business Production while Final System Gate is blocked.");
    }
  }

  return {
    status: violations.length === 0 ? "passed" : "blocked",
    strict,
    headSha,
    finalGate: {
      status: finalGate.status,
      severity: finalGate.severity,
      ciRunId: finalGate.ci_run_id
    },
    replay: {
      status: replay.status,
      severity: replay.severity,
      missingMrs: replay.missingMrs
    },
    checked: {
      manifests: [...evidence.manifests.values()].flat().length,
      gateResults: [...evidence.gates.values()].flat().length
    },
    violations
  };
}

function assertFreshnessRejectsActiveStaleManifest() {
  const root = makeTempRoot("stale-manifest");
  writeMinimalEvidence(root, { finalStatus: "blocked" });
  const manifest = path.join(root, "docs", "v5.4", "mr-03-release-manifest.json");
  fs.writeFileSync(manifest, JSON.stringify({
    release_id: "release-mr-03",
    mr_id: "MR-03",
    status: "active",
    commit_sha: "old-sha",
    ci_run_id: "123"
  }, null, 2));
  const result = verifyFreshness({ strict: true, headSha: "new-sha", root });
  assertViolation(result, "does not match HEAD");
}

function assertFreshnessRejectsPassedLocalFinalGate() {
  const root = makeTempRoot("local-final-gate");
  writeMinimalEvidence(root, { finalStatus: "passed", ciRunId: "local-final-system" });
  const result = verifyFreshness({ strict: true, headSha: "sha", root });
  assertViolation(result, "local ci_run_id");
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

function writeMinimalEvidence(root, { finalStatus, ciRunId = "123" }) {
  fs.writeFileSync(path.join(root, "docs", "v5.4", "final-system-gate-result.json"), JSON.stringify({
    gate_result_id: "final_system_gate",
    status: finalStatus,
    severity: finalStatus === "passed" ? "P2" : "P0",
    ci_run_id: ciRunId,
    business_signoff_refs: [],
    no_go_items: finalStatus === "passed" ? [] : ["missing package"],
    go_items: []
  }, null, 2));
  fs.writeFileSync(path.join(root, "docs", "v5.5", "final-rules-os-go-no-go.md"), "Business Production GO: `BLOCKED`\n");
}

function relative(file, root) {
  return path.relative(root, file).replaceAll("\\", "/");
}
