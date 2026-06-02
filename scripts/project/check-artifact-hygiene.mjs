import {
  currentHead,
  finalArtifactRefs,
  inspectArtifact,
  originMainHead,
  readJson,
  trackedFiles,
  updateProjectHygiene,
  writeJson,
  failIfNeeded
} from "./project-hygiene-lib.mjs";

const generatedAtUtc = new Date().toISOString();
const headSha = currentHead();
const originMain = originMainHead();
const currentState = readJson("artifacts/release-state/current-state.json");
const currentStateRefs = new Set((currentState.evidenceRefs ?? []).map((ref) => String(ref).replace(/\\/g, "/")));
const finalRefs = new Set([...finalArtifactRefs, ...currentStateRefs]);
const trackedArtifactFiles = trackedFiles("artifacts").filter((file) => /\.(json|jsonl|md|yml|yaml)$/i.test(file));
const inventory = trackedArtifactFiles.map((artifactPath) => inspectArtifact(artifactPath, finalRefs));
const finalArtifacts = finalArtifactRefs.map((artifactPath) => inspectArtifact(artifactPath, finalRefs));
const noGoItems = [];

for (const item of finalArtifacts) {
  if (!item.exists) noGoItems.push(`缺少 final artifact：${item.artifactPath}`);
  if (!item.generatedBy || item.generatedBy === "unknown") noGoItems.push(`${item.artifactPath} 缺少 generatedBy。`);
  if (!item.generatedAtUtc) noGoItems.push(`${item.artifactPath} 缺少 generatedAtUtc。`);
  if (!item.stage || item.stage === "unknown") noGoItems.push(`${item.artifactPath} 缺少 stage。`);
  if (!item.sourceMode) noGoItems.push(`${item.artifactPath} 缺少 sourceMode。`);
  if (!item.resultHash) noGoItems.push(`${item.artifactPath} 缺少 resultHash。`);
  if (item.forbiddenRefs.length) noGoItems.push(`${item.artifactPath} 包含禁止 final refs：${item.forbiddenRefs.join(", ")}`);
  if (!item.productionBoundaryOk) noGoItems.push(`${item.artifactPath} 出现 production / L2 / Repair Parts HR 放开信号。`);
}

if (currentState.currentMain?.headSha !== originMain) {
  noGoItems.push("current-state.currentMain.headSha 必须绑定 origin/main。");
}
if (currentState.authoritativeState?.businessProduction !== "BLOCKED") {
  noGoItems.push("Business Production 必须保持 BLOCKED。");
}
if (currentState.authoritativeState?.dormitoryL2 !== "BLOCKED") {
  noGoItems.push("Dormitory L2 必须保持 BLOCKED。");
}

const result = {
  generatedAtUtc,
  generatedBy: "check-artifact-hygiene",
  stage: "PROJECT-HYGIENE-CLEANUP",
  status: noGoItems.length ? "failed" : "passed",
  headSha,
  originMain,
  trackedArtifactCount: inventory.length,
  finalArtifactCount: finalArtifacts.length,
  finalArtifacts,
  noGoItems,
  productionAllowed: false,
  dormitoryL2ProductionAllowed: false,
  businessProduction: "blocked",
  repairPartsHrStatus: "L0 Contract Preview"
};

writeJson("artifacts/project/artifact-inventory.json", {
  generatedAtUtc,
  generatedBy: "check-artifact-hygiene",
  stage: "PROJECT-HYGIENE-CLEANUP",
  headSha,
  originMain,
  finalArtifactRefs,
  artifacts: inventory
});
updateProjectHygiene("artifact_hygiene", result);
failIfNeeded(noGoItems, "artifact hygiene check");
console.log("artifact hygiene check: PASS");
