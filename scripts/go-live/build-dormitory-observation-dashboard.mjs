import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const observation = readJson("docs/go-live/dormitory/observation-window.yml");
const dayResult = readJson("artifacts/go-live/dormitory/daily-observation-day-01.json");
const upgradeResult = readJson("artifacts/go-live/dormitory/l1-to-l2-upgrade-result.json");

const generatedAt = new Date().toISOString();
const output = {
  generated_at_utc: generatedAt,
  generated_by: "build-dormitory-observation-dashboard",
  stage: "D2",
  status: dayResult.status,
  observationWindowStatus: "active_l1_observation",
  decision: dayResult.decision,
  productionAllowed: false,
  l2ProductionAllowed: false,
  businessProductionAllowed: false,
  dormitoryStatus: "L1 Internal Pilot",
  repairPartsHrStatus: "L0 Contract Preview",
  daysObserved: dayResult.day,
  requiredCleanDaysForL2: observation.minimumCleanDaysForUpgrade,
  p0StopCount: dayResult.p0StopCount,
  p1HoldCount: dayResult.p1HoldCount,
  financeDailyCloseContinuity: dayResult.financeDailyClose?.continuity ?? dayResult.financeDailyClose?.status,
  evidenceMetrics: {
    missingRate: dayResult.evidenceMetrics?.missingRate,
    rejectedRate: dayResult.evidenceMetrics?.rejectedRate,
    uploadFailureRate: dayResult.evidenceMetrics?.uploadFailureRate,
    wrongScopeEvidenceCount: dayResult.evidenceMetrics?.wrongScopeEvidenceCount
  },
  projectionLagP95Minutes: dayResult.projectionLag?.p95Minutes,
  slaOverdueCount: dayResult.slaMetrics?.overdueCount,
  rollbackReadiness: dayResult.rollbackReadiness?.status,
  l1ToL2Decision: upgradeResult.status?.toLowerCase() ?? "not_eligible",
  nextAction: "继续 7 天 L1 Internal Pilot Observation Window；L1 -> L2 必须走单独 stage / PR / gate。",
  evidenceRefs: [
    "docs/go-live/dormitory/observation-window.yml",
    "docs/go-live/dormitory/observation-metric-contract.yml",
    "docs/go-live/dormitory/observation-incident-policy.yml",
    "docs/go-live/dormitory/l1-to-l2-upgrade-gate.yml",
    "artifacts/go-live/dormitory/daily-observation-day-01.json",
    "artifacts/go-live/dormitory/l1-to-l2-upgrade-result.json"
  ]
};

if (output.productionAllowed || output.l2ProductionAllowed || output.businessProductionAllowed) {
  throw new Error("D2 observation dashboard must not allow production or L2.");
}

writeJson("artifacts/go-live/dormitory/observation-window-result.json", output);
writeMarkdown("docs/go-live/dormitory/observation-window-dashboard.md", output, dayResult, upgradeResult);

console.log("Dormitory observation dashboard: PASS");

function readJson(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing required file: ${relativePath}`);
  }
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

function writeJson(relativePath, value) {
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeMarkdown(relativePath, summary, dayResult, upgradeResult) {
  const content = `# 宿舍 L1 内测观察窗口控制塔

生成时间：${summary.generated_at_utc}

## 当前结论

- Observation window status: \`${summary.observationWindowStatus}\`
- Daily decision: \`${summary.decision}\`
- Dormitory status: \`${summary.dormitoryStatus}\`
- Dormitory L2 Production: \`${summary.l2ProductionAllowed}\`
- Business Production GO: \`${summary.businessProductionAllowed}\`
- Repair / Parts / HR: \`${summary.repairPartsHrStatus}\`

## Day ${dayResult.day} 机器判定

| 项目 | 结果 |
| --- | --- |
| P0 stop count | ${dayResult.p0StopCount} |
| P1 hold count | ${dayResult.p1HoldCount} |
| Finance daily close | ${summary.financeDailyCloseContinuity} |
| Evidence missing rate | ${summary.evidenceMetrics.missingRate} |
| Evidence rejected rate | ${summary.evidenceMetrics.rejectedRate} |
| Evidence upload failure rate | ${summary.evidenceMetrics.uploadFailureRate} |
| Wrong-scope evidence count | ${summary.evidenceMetrics.wrongScopeEvidenceCount} |
| Projection lag p95 | ${summary.projectionLagP95Minutes} minutes |
| SLA overdue | ${summary.slaOverdueCount} |
| Rollback readiness | ${summary.rollbackReadiness} |

## P0 Stop / P1 Hold

- P0 stop: ${(dayResult.triggeredP0Stops ?? []).length ? dayResult.triggeredP0Stops.join(", ") : "无"}
- P1 hold: ${(dayResult.triggeredP1Holds ?? []).length ? dayResult.triggeredP1Holds.join(", ") : "无"}

## L1 -> L2 判定

\`${upgradeResult.status}\`

原因：
${(upgradeResult.blockers ?? ["L1 -> L2 必须单独 stage / PR / gate。"]).map((item) => `- ${item}`).join("\n")}

下一步：继续 7 天 L1 Internal Pilot Observation Window，并每天重跑 D2 observation checker。
`;
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content);
}
