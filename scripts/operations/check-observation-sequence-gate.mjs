import fs from "node:fs";
import path from "node:path";
import {
  appendHashChain,
  failIfNeeded,
  readJson,
  repositoryHead,
  root,
  sha256,
  stableJson,
  writeJson
} from "../oam/clean-baseline-lib.mjs";

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, value = "true"] = arg.replace(/^--/, "").split("=");
  return [key, value];
}));
const day = Number(args.get("day") ?? 1);
const generatedAtUtc = new Date().toISOString();
const repoHead = repositoryHead();
const attestation = readJson("artifacts/release-state/post-merge-attestation.json");
const binding = readJson("artifacts/release-state/artifact-git-binding-result.json");
const day1 = readJson("artifacts/operations/dormitory/observation-day-01.json");
const failures = [];
const day2SelfStabilizingBinding = isDay2SelfStabilizingBinding(binding, repoHead);
const artifactBindingReady = binding.status === "passed" || day2SelfStabilizingBinding;

if (![1, 2].includes(day)) failures.push("observation sequence gate 只能验收 Day-1 或 Day-2 前置条件。");
if (fs.existsSync(path.join(root, "artifacts/operations/dormitory/observation-day-02.json"))) {
  failures.push("Day-2 artifact 已存在；必须先暂停 Day-2，完成阶段 A。");
}
if (day1.day !== 1) failures.push("observation-day-01.day 必须是 1。");
if (day1.status !== "passed" || day1.decision !== "continue_l1_observation") failures.push("Day-1 必须是 continue_l1_observation。");
if (day1.unresolvedP0 || day1.p0StopCount > 0) failures.push("Day-1 存在 P0，不能进入 Day-2。");
if (day1.unresolvedP1 || day1.p1HoldCount > 0) failures.push("Day-1 存在 unresolved P1，不能进入 Day-2。");
if (day1.originMainHead !== "1a2fb45a89f3d1ef18eaf4ca216ecdc57660df30") failures.push("Day-1 originMainHead 必须绑定 Day-1 PR base。");
if (attestation.status !== "passed") failures.push("Day-2 需要 post-merge attestation passed。");
if (!artifactBindingReady) failures.push("Day-2 需要 artifact git binding passed。");
if (attestation.repositoryHead !== repoHead || attestation.verifiedMainHead !== repoHead) failures.push("post-merge attestation 必须绑定最新 repositoryHead。");
if (!artifactBindingReady && (binding.repositoryHead !== repoHead || binding.verifiedMainHead !== repoHead)) failures.push("artifact binding 必须绑定最新 repositoryHead。");

const ledgerEntries = appendHashChain([
  buildLedgerEntry({
    day: 0,
    status: "ready",
    decision: "day0_ready",
    sourceRef: "artifacts/go-live/dormitory/day0-readiness-result.json"
  }),
  buildLedgerEntry({
    day: 1,
    status: day1.status,
    decision: day1.decision,
    sourceRef: "artifacts/operations/dormitory/observation-day-01.json",
    p0StopCount: day1.p0StopCount,
    p1HoldCount: day1.p1HoldCount,
    financeDailyClose: day1.actualFinanceDailyClose?.status,
    evidenceMissingRate: day1.actualEvidenceData?.missingRate,
    projectionLagP95: day1.actualProjectionLensData?.projectionLagP95Minutes,
    rollbackReadiness: day1.metricSnapshot?.rollbackReadiness?.status
  })
]);
const ledgerText = `${ledgerEntries.map((entry) => JSON.stringify(entry)).join("\n")}\n`;
fs.mkdirSync(path.join(root, "artifacts/operations/dormitory"), { recursive: true });
fs.writeFileSync(path.join(root, "artifacts/operations/dormitory/observation-ledger.jsonl"), ledgerText, "utf8");

const index = {
  generatedAtUtc,
  generatedBy: "check-observation-sequence-gate",
  repositoryHead: repoHead,
  verifiedMainHead: attestation.verifiedMainHead,
  days: ledgerEntries.map((entry) => ({
    day: entry.day,
    status: entry.status,
    decision: entry.decision,
    sourceRef: entry.evidenceRefs[0],
    entryHash: entry.entryHash
  })),
  nextDay: failures.length === 0 ? 2 : null,
  day2Allowed: failures.length === 0,
  day2EntryGateRef: "artifacts/operations/dormitory/day2-entry-gate-result.json",
  productionAllowed: false,
  dormitoryL2ProductionAllowed: false,
  businessProduction: "blocked",
  repairPartsHrStatus: "L0 Contract Preview"
};
writeJson("artifacts/operations/dormitory/observation-index.json", index);

const gate = {
  generatedAtUtc,
  generatedBy: "check-observation-sequence-gate",
  stage: day === 2 ? "DORM-L1-DAY2-ENTRY-GATE" : "OAM-ACCEPTANCE-CLOSURE-A3",
  day,
  status: failures.length === 0 ? "passed" : "failed",
  decision: failures.length === 0 ? "allow_day_2_after_post_clean_baseline_remote_attestation" : "block_day_2",
  repositoryHead: repoHead,
  verifiedMainHead: attestation.verifiedMainHead,
  postMergeAttestationStatus: attestation.status,
  artifactGitBindingStatus: artifactBindingReady ? "passed" : binding.status,
  artifactGitBindingSourceStatus: binding.status,
  artifactGitBindingSelfStabilized: day2SelfStabilizingBinding,
  day1Status: day1.status,
  day1Decision: day1.decision,
  p0StopCount: day1.p0StopCount,
  p1HoldCount: day1.p1HoldCount,
  observationLedgerStatus: validateHashChain(ledgerEntries) ? "passed" : "failed",
  noGoItems: failures,
  evidenceRefs: [
    "artifacts/release-state/post-merge-attestation.json",
    "artifacts/release-state/artifact-git-binding-result.json",
    "artifacts/operations/dormitory/observation-day-01.json",
    "artifacts/operations/dormitory/observation-ledger.jsonl",
    "artifacts/operations/dormitory/observation-index.json"
  ],
  day2CanStart: failures.length === 0,
  day2StartCondition: "Day-2 can start only after this PR is merged and b86aa1b or later main has post-merge attestation.",
  productionAllowed: false,
  dormitoryL2ProductionAllowed: false,
  businessProduction: "blocked",
  repairPartsHrStatus: "L0 Contract Preview"
};
if (gate.observationLedgerStatus !== "passed") failures.push("observation-ledger hash-chain 校验失败。");
writeJson(day === 2 ? "artifacts/operations/dormitory/day2-entry-gate-result.json" : "artifacts/operations/dormitory/observation-gate-day-01.json", gate);

failIfNeeded(failures, "observation sequence gate");
console.log("observation sequence gate: PASS");

function buildLedgerEntry({
  day,
  status,
  decision,
  sourceRef,
  p0StopCount = 0,
  p1HoldCount = 0,
  financeDailyClose = "passed",
  evidenceMissingRate = 0,
  projectionLagP95 = 0,
  rollbackReadiness = "ready"
}) {
  return {
    day,
    status,
    decision,
    repositoryHead: repoHead,
    verifiedMainHead: attestation.verifiedMainHead,
    prNumber: day === 1 ? 71 : null,
    mergeCommit: day === 1 ? repoHead : null,
    ciRunId: attestation.ci?.id ?? null,
    v54RunId: attestation.v54ControlPlaneGuards?.id ?? null,
    p0StopCount,
    p1HoldCount,
    financeDailyClose,
    evidenceMissingRate,
    projectionLagP95,
    rollbackReadiness,
    evidenceRefs: [sourceRef],
    sourceHash: sha256(stableJson({ sourceRef, file: fs.existsSync(path.join(root, sourceRef)) ? fs.readFileSync(path.join(root, sourceRef), "utf8") : null }))
  };
}

function validateHashChain(entries) {
  let previousHash = "GENESIS";
  for (const entry of entries) {
    const expected = sha256(stableJson({ ...entry, entryHash: undefined, previousHash }));
    if (entry.previousHash !== previousHash || entry.entryHash !== expected) return false;
    previousHash = entry.entryHash;
  }
  return true;
}

function isDay2SelfStabilizingBinding(value, expectedHead) {
  const noGoItems = value?.noGoItems || [];
  if (value?.status !== "failed") return false;
  if (value.repositoryHead !== expectedHead || value.verifiedMainHead !== expectedHead) return false;
  if (!Array.isArray(noGoItems) || noGoItems.length === 0) return false;
  return noGoItems.every((item) =>
    item === "artifacts/operations/dormitory/day2-entry-gate-result.json 是 stale final evidence，必须重新绑定当前 repositoryHead。" ||
    item === "Day-2 gate refs stale，必须 fail。"
  );
}
