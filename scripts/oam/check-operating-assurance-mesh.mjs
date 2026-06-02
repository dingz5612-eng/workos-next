import { assertNoProduction, assertNoTmp, failIfNeeded, readJson, repositoryHead, writeJson, writeText } from "./clean-baseline-lib.mjs";

const generatedAtUtc = new Date().toISOString();
const repoHead = repositoryHead();
const requiredResults = [
  "artifacts/release-state/post-merge-attestation.json",
  "artifacts/release-state/artifact-git-binding-result.json",
  "artifacts/operations/dormitory/observation-gate-day-01.json",
  "artifacts/business/dormitory/scenario-attempt-semantics-result.json",
  "artifacts/go-live/dormitory/internal-pilot-run-semantics-result.json",
  "artifacts/go-live/dormitory/internal-pilot-ledger-semantics-result.json"
];
const failures = [];
const results = requiredResults.map((ref) => {
  try {
    const value = readJson(ref);
    if (value.status !== "passed") failures.push(`${ref} 必须 passed。`);
    assertNoTmp(value, failures, ref);
    assertNoProduction(value, failures, ref);
    return { ref, status: value.status, noGoItems: value.noGoItems ?? [] };
  } catch (error) {
    failures.push(`缺少或无法读取 ${ref}: ${error.message}`);
    return { ref, status: "missing" };
  }
});

const currentState = readJson("artifacts/release-state/current-state.json");
const goNoGo = readJson("artifacts/go-live/dormitory/internal-pilot-go-no-go.json");
const day1 = readJson("artifacts/operations/dormitory/observation-day-01.json");
const maturity = readJson("artifacts/portfolio/business-line-maturity-result.json");
const governance = readJson("artifacts/portfolio/production-governance-result.json");

if (currentState.currentMain?.headSha !== repoHead) failures.push("current-state 必须绑定当前 repositoryHead。");
if (goNoGo.latestMain?.commitSha !== repoHead) failures.push("internal-pilot-go-no-go 必须绑定当前 repositoryHead。");
if (day1.allowDay2 !== true || day1.p0StopCount !== 0 || day1.p1HoldCount !== 0) failures.push("Day-1 必须允许 Day-2 且没有 P0/P1。");
if (currentState.authoritativeState?.businessProduction !== "BLOCKED") failures.push("Business Production 必须 blocked。");
if (currentState.authoritativeState?.dormitoryL2 !== "BLOCKED") failures.push("Dormitory L2 必须 blocked。");
if (governance.businessProductionAllowed !== false || governance.portfolioDecision !== "blocked") failures.push("portfolio governance 必须保持 production blocked。");
if (maturity.repair?.productionAllowed || maturity.parts?.productionAllowed || maturity.hr?.productionAllowed) failures.push("Repair / Parts / HR 不得 production allowed。");

const result = {
  generatedAtUtc,
  generatedBy: "check-operating-assurance-mesh",
  stage: "OAM-ACCEPTANCE-CLOSURE-A4",
  status: failures.length === 0 ? "passed" : "failed",
  repositoryHead: repoHead,
  verifiedMainHead: currentState.currentMain?.headSha,
  postMergeAttestationStatus: results.find((item) => item.ref.includes("post-merge-attestation"))?.status,
  artifactGitBindingStatus: results.find((item) => item.ref.includes("artifact-git-binding"))?.status,
  observationSequenceStatus: results.find((item) => item.ref.includes("observation-gate-day-01"))?.status,
  semanticResults: results,
  currentStateSummary: {
    dormitory: "L1_INTERNAL_PILOT_OBSERVATION",
    businessProduction: "BLOCKED",
    dormitoryL2: "BLOCKED",
    repairPartsHr: "L0 Contract Preview"
  },
  noGoItems: failures,
  productionAllowed: false,
  dormitoryL2ProductionAllowed: false,
  businessProduction: "blocked",
  repairPartsHrStatus: "L0 Contract Preview",
  evidenceRefs: requiredResults
};

writeJson("artifacts/oam/operating-assurance-mesh-result.json", result);
writeText("docs/oam/operating-assurance-mesh-acceptance-report.md", renderReport(result));
failIfNeeded(failures, "operating assurance mesh check");
console.log("operating assurance mesh check: PASS");

function renderReport(result) {
  return `# 业务运行保证网格验收报告\n\n` +
    `生成时间：${result.generatedAtUtc}\n\n` +
    `状态：${result.status}\n\n` +
    `## 中文结论\n\n` +
    (result.status === "passed"
      ? "OAM 阶段 A 的 post-merge attestation、artifact binding、observation sequence、语义检查均通过。宿舍仍只允许 L1 内测观察。"
      : "OAM 阶段 A 仍存在 blocker，不得进入阶段 B / C / Day-2。") +
    `\n\n## 边界\n\n- Dormitory L2 Production = false\n- Business Production = blocked\n- Repair / Parts / HR = L0 Contract Preview\n\n` +
    `## No-Go\n\n${result.noGoItems.length ? result.noGoItems.map((item) => `- ${item}`).join("\n") : "- 无 P0 No-Go。"}\n`;
}

