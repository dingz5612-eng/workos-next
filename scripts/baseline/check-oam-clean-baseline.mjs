import {
  currentHead,
  exists,
  failIfNeeded,
  readJson,
  sha256,
  stableJson,
  writeBaselineReport,
  writeJson
} from "./baseline-lib.mjs";
import { buildReleaseEvidenceBaseline } from "./check-release-evidence-baseline.mjs";
import { buildArtifactBaseline } from "./check-artifact-baseline.mjs";
import { buildRuntimeSemanticBaseline } from "./check-runtime-semantic-baseline.mjs";
import { buildSurfaceUxBaseline } from "./check-surface-ux-baseline.mjs";
import { buildSeedDataBaseline } from "./check-seed-data-baseline.mjs";
import { buildPortfolioBoundaryBaseline } from "./check-portfolio-boundary-baseline.mjs";

if (process.argv.includes("--check")) {
  checkExistingBaseline();
} else {
  buildBaseline();
}

function buildBaseline() {
  const baselines = {
    releaseEvidence: buildReleaseEvidenceBaseline(),
    artifact: buildArtifactBaseline(),
    runtimeSemantic: buildRuntimeSemanticBaseline(),
    surfaceUx: buildSurfaceUxBaseline(),
    seedData: buildSeedDataBaseline(),
    portfolioBoundary: buildPortfolioBoundaryBaseline()
  };
  const noGoItems = Object.values(baselines).flatMap((item) => item.noGoItems ?? []);
  const result = {
    generatedAtUtc: new Date().toISOString(),
    generatedBy: "check-oam-clean-baseline",
    stage: "OAM-CLEAN-BASELINE-FINAL-GATE",
    status: noGoItems.length ? "failed" : "OAM_CLEAN_BASELINE_ALIGNED",
    headSha: currentHead(),
    baselines: Object.fromEntries(Object.entries(baselines).map(([key, value]) => [key, {
      status: value.status,
      resultHash: value.resultHash,
      noGoCount: value.noGoItems?.length ?? 0
    }])),
    inputHash: sha256(stableJson(baselines)),
    resultHash: "",
    noGoItems,
    day2AllowedAfterPostMergeAttestation: noGoItems.length === 0,
    productionAllowed: false,
    dormitoryL2ProductionAllowed: false,
    businessProduction: "blocked",
    repairPartsHrStatus: "L0 Contract Preview"
  };
  result.resultHash = sha256(stableJson({ ...result, resultHash: "" }));
  writeJson("artifacts/baseline/oam-clean-baseline-result.json", result);
  writeBaselineReport(result);
  failIfNeeded(noGoItems, "oam clean baseline check");
  console.log("oam clean baseline check: PASS");
}

function checkExistingBaseline() {
  const failures = [];
  if (!exists("artifacts/baseline/oam-clean-baseline-result.json")) {
    failures.push("缺少 artifacts/baseline/oam-clean-baseline-result.json。");
  }
  if (!exists("artifacts/project/project-hygiene-result.json")) {
    failures.push("缺少 artifacts/project/project-hygiene-result.json。");
  }
  if (failures.length) failIfNeeded(failures, "oam clean baseline check");

  const result = readJson("artifacts/baseline/oam-clean-baseline-result.json");
  const projectHygiene = readJson("artifacts/project/project-hygiene-result.json");
  if (result.status !== "OAM_CLEAN_BASELINE_ALIGNED") {
    failures.push(`OAM clean baseline status 必须为 OAM_CLEAN_BASELINE_ALIGNED，当前为 ${result.status}。`);
  }
  if (result.headSha && result.headSha !== currentHead()) {
    failures.push(`OAM clean baseline headSha 必须为当前提交 ${currentHead()}，当前为 ${result.headSha}。`);
  }
  if (projectHygiene.status !== "PROJECT_HYGIENE_CLEANUP_LOCAL_PASSED") {
    failures.push(`project hygiene 必须先通过，当前为 ${projectHygiene.status}。`);
  }
  if (projectHygiene.headSha && projectHygiene.headSha !== currentHead()) {
    failures.push(`project hygiene headSha 必须为当前提交 ${currentHead()}，当前为 ${projectHygiene.headSha}。`);
  }
  for (const [key, baseline] of Object.entries(result.baselines ?? {})) {
    if (baseline.status !== "passed") failures.push(`${key} baseline 必须 passed，当前为 ${baseline.status}。`);
    if ((baseline.noGoCount ?? 0) !== 0) failures.push(`${key} baseline noGoCount 必须为 0，当前为 ${baseline.noGoCount}。`);
  }
  if ((result.noGoItems ?? []).length > 0) {
    failures.push(`OAM clean baseline 仍存在 noGoItems：${result.noGoItems.join("；")}`);
  }
  failIfNeeded(failures, "oam clean baseline check");
  console.log("oam clean baseline check: PASS");
}
