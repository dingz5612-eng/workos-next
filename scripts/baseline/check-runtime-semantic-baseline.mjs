import { failIfNeeded, isDirectRun, readJson, requireNoGoEmpty, requirePassed, sha256, stableJson, writeJson } from "./baseline-lib.mjs";

export function buildRuntimeSemanticBaseline() {
  const failures = [];
  const scenarioAttempt = readJson("artifacts/business/dormitory/scenario-attempt-semantics-result.json");
  const runSemantics = readJson("artifacts/go-live/dormitory/internal-pilot-run-semantics-result.json");
  const ledgerSemantics = readJson("artifacts/go-live/dormitory/internal-pilot-ledger-semantics-result.json");
  const runtimeProof = readJson("artifacts/proof/runtime-proof-result.json");
  const oam = readJson("artifacts/oam/operating-assurance-mesh-result.json");
  requirePassed(scenarioAttempt, "scenario attempt semantics", failures);
  requirePassed(runSemantics, "internal pilot run semantics", failures);
  requirePassed(ledgerSemantics, "internal pilot ledger semantics", failures);
  requirePassed(runtimeProof, "runtime proof", failures);
  requirePassed(oam, "operating assurance mesh", failures);
  requireNoGoEmpty(scenarioAttempt, "scenario attempt semantics", failures);
  requireNoGoEmpty(runSemantics, "internal pilot run semantics", failures);
  requireNoGoEmpty(ledgerSemantics, "internal pilot ledger semantics", failures);
  if (runtimeProof.sourceMode !== "live_api_db") failures.push("Runtime Proof sourceMode 必须是 live_api_db。");
  const result = {
    generatedAtUtc: new Date().toISOString(),
    generatedBy: "check-runtime-semantic-baseline",
    stage: "OAM-CLEAN-BASELINE-D3",
    status: failures.length ? "failed" : "passed",
    semanticRefs: [
      "artifacts/business/dormitory/scenario-attempt-semantics-result.json",
      "artifacts/go-live/dormitory/internal-pilot-run-semantics-result.json",
      "artifacts/go-live/dormitory/internal-pilot-ledger-semantics-result.json",
      "artifacts/proof/runtime-proof-result.json",
      "artifacts/oam/operating-assurance-mesh-result.json"
    ],
    sourceModes: {
      runtimeProof: runtimeProof.sourceMode,
      oam: oam.status
    },
    inputHash: sha256(stableJson([scenarioAttempt, runSemantics, ledgerSemantics, runtimeProof, oam])),
    resultHash: "",
    noGoItems: failures,
    productionAllowed: false,
    dormitoryL2ProductionAllowed: false,
    businessProduction: "blocked",
    repairPartsHrStatus: "L0 Contract Preview"
  };
  result.resultHash = sha256(stableJson({ ...result, resultHash: "" }));
  writeJson("artifacts/baseline/runtime-semantic-baseline.json", result);
  return result;
}

if (isDirectRun(import.meta.url)) {
  const result = buildRuntimeSemanticBaseline();
  failIfNeeded(result.noGoItems, "runtime semantic baseline check");
  console.log("runtime semantic baseline check: PASS");
}
