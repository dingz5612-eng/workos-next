import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

export const root = process.cwd();
export const requiredChecks = [
  "artifact_hygiene",
  "stale_evidence_refs",
  "route_surface_hygiene",
  "seed_data_isolation",
  "screenshot_baseline"
];

export const finalArtifactRefs = [
  "artifacts/release-state/current-state.json",
  "artifacts/oam/oam-final-acceptance-result.json",
  "artifacts/oam/operating-assurance-mesh-result.json",
  "artifacts/go-live/dormitory/internal-pilot-go-no-go.json",
  "artifacts/go-live/dormitory/day0-readiness-result.json",
  "artifacts/operations/dormitory/observation-day-01.json",
  "artifacts/operations/dormitory/l1-to-l2-readiness.json",
  "artifacts/rt4/evidence-graph.json",
  "artifacts/rt4/completion-dashboard.json",
  "artifacts/portfolio/business-line-maturity-result.json",
  "artifacts/portfolio/production-governance-result.json",
  "artifacts/business/dormitory/business-semantic-contract-result.json",
  "artifacts/proof/runtime-proof-result.json",
  "artifacts/go-live/dormitory/runtime-proof-result.json",
  "artifacts/surface/oam-04-surface-twin-plane-result.json",
  "artifacts/finance/finance-semantic-truth-result.json",
  "artifacts/trust/trust-boundary-result.json",
  "artifacts/operations/dormitory/slo-result.json",
  "artifacts/golden-domain/dormitory/golden-pack-result.json"
];

export function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

export function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

export function writeJson(relativePath, value) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function writeText(relativePath, value) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, value, "utf8");
}

export function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

export function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function stableJson(value) {
  return JSON.stringify(sortKeys(value));
}

export function fileHash(relativePath) {
  return exists(relativePath) ? sha256(fs.readFileSync(path.join(root, relativePath))) : null;
}

export function git(args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", shell: process.platform === "win32" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `git ${args.join(" ")} failed`);
  return result.stdout.trim();
}

export function currentHead() {
  return git(["rev-parse", "HEAD"]);
}

export function originMainHead() {
  return git(["rev-parse", "origin/main"]);
}

export function trackedFiles(prefix) {
  return git(["ls-files", prefix]).split(/\r?\n/).filter(Boolean).map(normalizePath);
}

export function normalizePath(value) {
  return String(value || "").replace(/\\/g, "/");
}

export function collectStringRefs(value, refs = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectStringRefs(item, refs);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectStringRefs(item, refs);
  } else if (typeof value === "string") {
    refs.push(normalizePath(value));
  }
  return refs;
}

export function evidenceRefsFrom(value) {
  const refs = new Set();
  collectEvidenceRefs(value, refs);
  return Array.from(refs).sort();
}

export function collectEvidenceRefs(value, refs) {
  if (Array.isArray(value)) {
    for (const item of value) collectEvidenceRefs(item, refs);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (/evidenceRefs?|inputRefs?|outputRefs?|refs?/i.test(key)) {
      for (const ref of collectStringRefs(nested)) {
        if (looksLikeRepoRef(ref)) refs.add(ref);
      }
    }
    collectEvidenceRefs(nested, refs);
  }
}

export function looksLikeRepoRef(ref) {
  return /^(artifacts|docs|scripts|apps|tests|services|infra)\//.test(normalizePath(ref));
}

export function hasForbiddenFinalRef(ref) {
  const normalized = normalizePath(ref);
  return normalized.includes(".tmp/") ||
    /(^|\/)not[_-]?run(\.|\/|$)/i.test(normalized) ||
    /(^|\/)local-only(\.|\/|$)/i.test(normalized) ||
    /(^|\/)local-pass(\.|\/|$)/i.test(normalized);
}

export function hasProductionLeak(value) {
  const text = JSON.stringify(value);
  return /DORMITORY_L2_PRODUCTION_ALLOWED|BUSINESS_PRODUCTION_GO|REPAIR_PARTS_HR_PRODUCTION_ALLOWED|PRODUCTION_READY/.test(text) ||
    /"productionAllowed"\s*:\s*true/.test(text) ||
    /"businessProductionAllowed"\s*:\s*true/.test(text) ||
    /"dormitoryL2ProductionAllowed"\s*:\s*true/.test(text) ||
    /"repairPartsHrProductionAllowed"\s*:\s*true/.test(text);
}

export function artifactStatus(value) {
  return value?.status ?? value?.finalStatus ?? value?.decision ?? value?.observationWindowStatus ?? "unknown";
}

export function inspectArtifact(artifactPath, finalEvidenceRefs = new Set()) {
  const value = exists(artifactPath) ? readArtifactValue(artifactPath) : null;
  const refs = value ? evidenceRefsFrom(value) : [];
  const stage = value?.stage ?? inferStage(artifactPath);
  const generatedBy = value?.generatedBy ?? value?.generated_by ?? inferGeneratedBy(artifactPath);
  const generatedAtUtc = value?.generatedAtUtc ?? value?.generated_at_utc ?? null;
  const sourceMode = value?.sourceMode ?? value?.source_mode ?? inferSourceMode(artifactPath, value);
  const resultHash = value?.resultHash ?? value?.result_hash ?? sha256(stableJson(value ?? {}));
  const status = value ? artifactStatus(value) : "missing";
  return {
    artifactPath,
    exists: Boolean(value),
    tracked: trackedFiles("artifacts").includes(normalizePath(artifactPath)),
    finalEvidence: finalEvidenceRefs.has(normalizePath(artifactPath)),
    stage,
    generatedBy,
    generatedAtUtc,
    sourceMode,
    status,
    evidenceRefs: refs,
    forbiddenRefs: refs.filter(hasForbiddenFinalRef),
    missingRefs: refs.filter((ref) => looksLikeRepoRef(ref) && !exists(ref)),
    productionBoundaryOk: value ? !hasProductionLeak(value) : false,
    resultHash,
    fileHash: value ? fileHash(artifactPath) : null,
    headSha: artifactHead(value, artifactPath)
  };
}

function readArtifactValue(artifactPath) {
  if (!artifactPath.endsWith(".jsonl")) return readJson(artifactPath);
  const lines = readText(artifactPath).split(/\r?\n/).filter(Boolean);
  const entries = lines.map((line) => JSON.parse(line));
  const last = entries.at(-1) ?? {};
  return {
    generatedAtUtc: last.generatedAtUtc,
    generatedBy: last.generatedBy ?? "jsonl-ledger",
    stage: last.stage ?? inferStage(artifactPath),
    sourceMode: last.sourceMode ?? "append_only_jsonl",
    status: "passed",
    evidenceRefs: entries.flatMap((entry) => [...(entry.inputRefs ?? []), ...(entry.outputRefs ?? [])]),
    entryCount: entries.length,
    lastEntryHash: last.entryHash,
    entries
  };
}

export function updateProjectHygiene(checkName, payload) {
  const pathName = "artifacts/project/project-hygiene-result.json";
  const current = exists(pathName) ? readJson(pathName) : {
    generatedAtUtc: new Date().toISOString(),
    generatedBy: "project-hygiene-checkers",
    stage: "PROJECT-HYGIENE-CLEANUP",
    status: "in_progress",
    checks: {},
    noGoItems: [],
    productionAllowed: false,
    dormitoryL2ProductionAllowed: false,
    businessProduction: "blocked",
    repairPartsHrStatus: "L0 Contract Preview"
  };
  current.generatedAtUtc = new Date().toISOString();
  current.checks[checkName] = payload;
  current.noGoItems = Object.values(current.checks).flatMap((item) => item.noGoItems ?? []);
  const allPresent = requiredChecks.every((check) => current.checks[check]);
  const allPassed = allPresent && requiredChecks.every((check) => current.checks[check]?.status === "passed");
  current.status = allPassed ? "PROJECT_HYGIENE_CLEANUP_LOCAL_PASSED" : (current.noGoItems.length ? "failed" : "in_progress");
  writeJson(pathName, current);
  writeProjectReport(current);
}

export function failIfNeeded(failures, label) {
  if (!failures.length) return;
  for (const failure of failures) console.error(`P0 ${failure}`);
  throw new Error(`${label} failed.`);
}

export function writeProjectReport(result) {
  const lines = [
    "# 项目卫生清理报告",
    "",
    `生成时间：${result.generatedAtUtc}`,
    "",
    "## 当前结论",
    "",
    `- 阶段状态：${result.status}`,
    "- 宿舍仍仅限 L1 Internal Pilot Observation。",
    "- Business Production 保持 blocked。",
    "- Dormitory L2 Production = false。",
    "- Repair / Parts / HR 保持 L0 Contract Preview。",
    "",
    "## 检查项",
    "",
    ...requiredChecks.map((check) => `- ${check}: ${result.checks?.[check]?.status ?? "not_run"}`),
    "",
    "## 阻断项",
    "",
    ...(result.noGoItems?.length ? result.noGoItems.map((item) => `- ${item}`) : ["- 无 P0 阻断项。"])
  ];
  writeText("docs/project/project-cleanup-report.md", `${lines.join("\n")}\n`);
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, nested]) => [key, sortKeys(nested)]));
}

function inferStage(artifactPath) {
  if (artifactPath.includes("release-state")) return "release-state";
  if (artifactPath.includes("go-live/dormitory")) return "DORM-INT";
  if (artifactPath.includes("operations/dormitory")) return "DORM-L1-OBS";
  if (artifactPath.includes("surface")) return "SURFACE";
  if (artifactPath.includes("oam")) return "OAM";
  if (artifactPath.includes("portfolio")) return "PORTFOLIO";
  if (artifactPath.includes("business")) return "BUSINESS-SEMANTIC";
  if (artifactPath.includes("finance")) return "FINANCE-SEMANTIC";
  if (artifactPath.includes("trust")) return "TRUST";
  if (artifactPath.includes("golden-domain")) return "GOLDEN-DOMAIN";
  if (artifactPath.includes("proof")) return "RUNTIME-PROOF";
  if (artifactPath.includes("rt4")) return "RT4";
  return "unknown";
}

function inferGeneratedBy(artifactPath) {
  const normalized = normalizePath(artifactPath);
  if (normalized.includes("completion-dashboard")) return "build-completion-dashboard";
  if (normalized.includes("trust-boundary")) return "check-trust-boundary-kernel";
  if (normalized.includes("oam-final-acceptance")) return "check-oam-final-acceptance";
  if (normalized.includes("operating-assurance-mesh")) return "check-operating-assurance-mesh";
  return "unknown";
}

function inferSourceMode(artifactPath, value) {
  if (value?.sourceMode || value?.source_mode) return value.sourceMode ?? value.source_mode;
  if (artifactPath.includes("internal-pilot-run-result")) return "real";
  if (artifactPath.includes("runtime-proof")) return "live_api_db";
  if (artifactPath.includes("observation")) return "actual";
  return "machine_checked";
}

function artifactHead(value, artifactPath) {
  if (!value) return null;
  if (artifactPath.includes("current-state")) return value.currentMain?.headSha ?? null;
  if (artifactPath.includes("internal-pilot-go-no-go")) return value.latestMain?.commitSha ?? null;
  if (artifactPath.includes("completion-dashboard")) return value.currentMainHead ?? null;
  return value.currentMainHead ?? value.repositoryHead ?? value.headSha ?? value.latestMain?.commitSha ?? value.verifiedMainHead ?? null;
}
