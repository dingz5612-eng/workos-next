import {
  currentHead,
  failIfNeeded,
  noTmpRefs,
  originMainHead,
  productionLeaks,
  readJson,
  requireNoGoEmpty,
  requirePassed,
  sha256,
  stableJson,
  writeJson
} from "./baseline-lib.mjs";
import { isDirectRun } from "./baseline-lib.mjs";

export function buildReleaseEvidenceBaseline() {
  const failures = [];
  const pendingRebindItems = [];
  const allowPendingMainRebind = process.env.OAM_ALLOW_PENDING_MAIN_REBIND === "true";
  const repositoryHead = originMainHead();
  const prHead = currentHead();
  const attestation = readJson("artifacts/release-state/post-merge-attestation.json");
  const currentState = readJson("artifacts/release-state/current-state.json");
  const goNoGo = readJson("artifacts/go-live/dormitory/internal-pilot-go-no-go.json");
  const graph = readJson("artifacts/rt4/evidence-graph.json");
  const dashboard = readJson("artifacts/rt4/completion-dashboard.json");
  const binding = readJson("artifacts/release-state/artifact-git-binding-result.json");
  const evidenceLedger = readJson("artifacts/evidence/evidence-ledger-check-result.json");

  requirePassed(attestation, "post-merge attestation", failures);
  requirePassed(binding, "artifact git binding", failures);
  requirePassed(evidenceLedger, "evidence ledger append-only", failures);
  requireNoGoEmpty(attestation, "post-merge attestation", failures);
  requireNoGoEmpty(binding, "artifact git binding", failures);
  requireFreshMain(attestation.repositoryHead, repositoryHead, "post-merge attestation.repositoryHead 必须等于 origin/main。", "post_merge_attestation_repository_head");
  requireFreshMain(attestation.verifiedMainHead, repositoryHead, "verifiedMainHead 必须等于 origin/main。", "post_merge_attestation_verified_main_head");
  requireFreshMain(currentState.currentMain?.headSha, repositoryHead, "current-state.currentMain.headSha 必须等于 origin/main。", "current_state_main_head");
  requireFreshMain(goNoGo.latestMain?.commitSha, repositoryHead, "internal-pilot-go-no-go.latestMain.commitSha 必须等于 origin/main。", "internal_pilot_go_no_go_latest_main");
  requireFreshMain(graph.headSha, repositoryHead, "Evidence Graph headSha 必须等于 origin/main。", "evidence_graph_head");
  requireFreshMain(dashboard.currentMainHead, repositoryHead, "Completion Dashboard currentMainHead 必须等于 origin/main。", "completion_dashboard_head");
  for (const [label, value] of Object.entries({ currentState, goNoGo, graph, dashboard, binding })) {
    const tmpRefs = noTmpRefs(value);
    if (tmpRefs.length) failures.push(`${label} final evidence refs 不得包含 .tmp：${tmpRefs.join(", ")}`);
    const leaks = productionLeaks(value);
    if (leaks.length) failures.push(`${label} 出现 production / L2 放开信号：${leaks.join(", ")}`);
  }

  const result = {
    generatedAtUtc: new Date().toISOString(),
    generatedBy: "check-release-evidence-baseline",
    stage: "OAM-CLEAN-BASELINE-D1",
    status: failures.length ? "failed" : "passed",
    repositoryHead,
    prHead,
    verifiedMainHead: attestation.verifiedMainHead,
    ci: attestation.ci,
    v54ControlPlaneGuards: attestation.v54ControlPlaneGuards,
    refs: {
      postMergeAttestation: "artifacts/release-state/post-merge-attestation.json",
      currentState: "artifacts/release-state/current-state.json",
      internalPilotGoNoGo: "artifacts/go-live/dormitory/internal-pilot-go-no-go.json",
      evidenceGraph: "artifacts/rt4/evidence-graph.json",
      completionDashboard: "artifacts/rt4/completion-dashboard.json",
      artifactGitBinding: "artifacts/release-state/artifact-git-binding-result.json"
    },
    inputHash: sha256(stableJson([attestation, currentState, goNoGo, graph, dashboard, binding, evidenceLedger])),
    resultHash: "",
    noGoItems: failures,
    pendingRebindItems,
    productionAllowed: false,
    dormitoryL2ProductionAllowed: false,
    businessProduction: "blocked",
    repairPartsHrStatus: "L0 Contract Preview"
  };
  result.resultHash = sha256(stableJson({ ...result, resultHash: "" }));
  writeJson("artifacts/baseline/release-evidence-baseline.json", result);
  return result;

  function requireFreshMain(actual, expected, message, id) {
    if (actual === expected) return;
    if (allowPendingMainRebind) {
      pendingRebindItems.push({
        id,
        message,
        actual,
        expected,
        status: "pending_rebind_after_main_green"
      });
      return;
    }
    failures.push(message);
  }
}

if (isDirectRun(import.meta.url)) {
  const result = buildReleaseEvidenceBaseline();
  failIfNeeded(result.noGoItems, "release evidence baseline check");
  console.log("release evidence baseline check: PASS");
}
