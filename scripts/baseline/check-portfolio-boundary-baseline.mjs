import { failIfNeeded, productionLeaks, readJson, requirePassed, sha256, stableJson, writeJson } from "./baseline-lib.mjs";

export function buildPortfolioBoundaryBaseline() {
  const failures = [];
  const currentState = readJson("artifacts/release-state/current-state.json");
  const maturity = readJson("artifacts/portfolio/business-line-maturity-result.json");
  const governance = readJson("artifacts/portfolio/production-governance-result.json");
  const l1ToL2 = readJson("artifacts/operations/dormitory/l1-to-l2-readiness.json");
  requirePassed(maturity, "business-line maturity", failures);
  requirePassed(governance, "production governance", failures);
  if (l1ToL2.status !== "NOT_ELIGIBLE") failures.push("L1 -> L2 readiness 必须默认 NOT_ELIGIBLE。");
  if (currentState.authoritativeState?.businessProduction !== "BLOCKED") failures.push("Business Production 必须 BLOCKED。");
  if (currentState.authoritativeState?.dormitoryL2 !== "BLOCKED") failures.push("Dormitory L2 必须 BLOCKED。");
  for (const line of ["repair", "parts", "hr"]) {
    if (currentState.authoritativeState?.[line] !== "L0 Contract Preview") {
      failures.push("Repair / Parts / HR 必须保持 L0 Contract Preview。");
      break;
    }
  }
  for (const [label, value] of Object.entries({ currentState, maturity, governance, l1ToL2 })) {
    const leaks = productionLeaks(value);
    if (leaks.length) failures.push(`${label} 出现禁止生产状态：${leaks.join(", ")}`);
  }
  const result = {
    generatedAtUtc: new Date().toISOString(),
    generatedBy: "check-portfolio-boundary-baseline",
    stage: "OAM-CLEAN-BASELINE-D6",
    status: failures.length ? "failed" : "passed",
    currentState: currentState.authoritativeState,
    l1ToL2Decision: l1ToL2.status,
    refs: [
      "artifacts/release-state/current-state.json",
      "artifacts/portfolio/business-line-maturity-result.json",
      "artifacts/portfolio/production-governance-result.json",
      "artifacts/operations/dormitory/l1-to-l2-readiness.json"
    ],
    inputHash: sha256(stableJson([currentState, maturity, governance, l1ToL2])),
    resultHash: "",
    noGoItems: failures,
    productionAllowed: false,
    dormitoryL2ProductionAllowed: false,
    businessProduction: "blocked",
    repairPartsHrStatus: "L0 Contract Preview"
  };
  result.resultHash = sha256(stableJson({ ...result, resultHash: "" }));
  writeJson("artifacts/baseline/portfolio-boundary-baseline.json", result);
  return result;
}

const result = buildPortfolioBoundaryBaseline();
failIfNeeded(result.noGoItems, "portfolio boundary baseline check");
console.log("portfolio boundary baseline check: PASS");
