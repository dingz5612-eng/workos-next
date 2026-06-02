import { failIfNeeded, sha256, stableJson, writeBaselineReport, writeJson } from "./baseline-lib.mjs";
import { buildReleaseEvidenceBaseline } from "./check-release-evidence-baseline.mjs";
import { buildArtifactBaseline } from "./check-artifact-baseline.mjs";
import { buildRuntimeSemanticBaseline } from "./check-runtime-semantic-baseline.mjs";
import { buildSurfaceUxBaseline } from "./check-surface-ux-baseline.mjs";
import { buildSeedDataBaseline } from "./check-seed-data-baseline.mjs";
import { buildPortfolioBoundaryBaseline } from "./check-portfolio-boundary-baseline.mjs";

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
