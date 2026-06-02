import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

export const root = process.cwd();
export const repository = "dingz5612-eng/workos-next";

export function readJson(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) throw new Error(`Missing required file: ${relativePath}`);
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
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

export function git(args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", shell: process.platform === "win32" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `git ${args.join(" ")} failed`);
  return result.stdout.trim();
}

export function currentBranch() {
  return git(["branch", "--show-current"]);
}

export function repositoryHead() {
  return git(["rev-parse", "origin/main"]);
}

export function localHead() {
  return git(["rev-parse", "HEAD"]);
}

export async function githubJson(url) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "workosnext-oam-clean-baseline"
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`GitHub API request failed: HTTP ${response.status} ${url}`);
  return response.json();
}

export async function workflowRunsForHead(headSha) {
  const payload = await githubJson(`https://api.github.com/repos/${repository}/actions/runs?head_sha=${headSha}&per_page=50`);
  return payload.workflow_runs ?? [];
}

export function pickWorkflowRun(runs, name) {
  return runs
    .filter((run) => run.name === name)
    .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))[0] ?? null;
}

export function normalizeRun(run) {
  if (!run) return null;
  return {
    id: run.id,
    name: run.name,
    event: run.event,
    status: run.status,
    conclusion: run.conclusion,
    headSha: run.head_sha,
    htmlUrl: run.html_url,
    createdAt: run.created_at,
    updatedAt: run.updated_at
  };
}

export function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function stableJson(value) {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, nested]) => [key, sortKeys(nested)]));
}

export function fileHash(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) return null;
  return sha256(fs.readFileSync(fullPath));
}

export function findTmpRefs(value, refs = []) {
  if (Array.isArray(value)) {
    for (const item of value) findTmpRefs(item, refs);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) findTmpRefs(item, refs);
  } else if (typeof value === "string" && value.replace(/\\/g, "/").includes(".tmp/")) {
    refs.push(value);
  }
  return refs;
}

export function hasProductionAllowed(value) {
  const text = JSON.stringify(value);
  return /DORMITORY_L2_PRODUCTION_ALLOWED|BUSINESS_PRODUCTION_GO|REPAIR_PARTS_HR_PRODUCTION_ALLOWED/.test(text) ||
    /"productionAllowed"\s*:\s*true/.test(text) ||
    /"businessProductionAllowed"\s*:\s*true/.test(text) ||
    /"dormitoryL2ProductionAllowed"\s*:\s*true/.test(text) ||
    /"repairPartsHrProductionAllowed"\s*:\s*true/.test(text);
}

export function assertNoProduction(value, failures, scope) {
  if (hasProductionAllowed(value)) failures.push(`${scope} 不得声明 production / L2 / Repair Parts HR production allowed。`);
}

export function assertNoTmp(value, failures, scope) {
  const refs = findTmpRefs(value);
  if (refs.length > 0) failures.push(`${scope} 不得包含 .tmp final refs: ${refs.join(", ")}`);
}

export function runCommand(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", shell: process.platform === "win32" });
  return {
    commandLine: [command, ...args].join(" "),
    status: result.status === 0 ? "passed" : "failed",
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

export function failIfNeeded(failures, label) {
  if (failures.length === 0) return;
  for (const failure of failures) console.error(`P0 ${failure}`);
  throw new Error(`${label} failed.`);
}

export function artifactStatus(value) {
  return value.status ?? value.finalStatus ?? value.decision ?? value.observationWindowStatus ?? "unknown";
}

export function evidenceEntry({ evidenceId, stage, sourceMode, repositoryHeadSha, verifiedMainHead, prNumber = 71, mergeCommit, ciRunId, v54RunId, inputRefs = [], outputRefs = [], actor = "codex", generatedBy }) {
  const generatedAtUtc = new Date().toISOString();
  const inputHash = sha256(stableJson(inputRefs.map((ref) => ({ ref, hash: fileHash(ref) }))));
  const resultHash = sha256(stableJson(outputRefs.map((ref) => ({ ref, hash: fileHash(ref) }))));
  return {
    evidenceId,
    stage,
    sourceMode,
    repositoryHead: repositoryHeadSha,
    verifiedMainHead,
    prNumber,
    mergeCommit,
    ciRunId,
    v54RunId,
    generatedBy,
    generatedAtUtc,
    actor,
    inputRefs,
    outputRefs,
    inputHash,
    resultHash
  };
}

export function appendHashChain(entries) {
  let previousHash = "GENESIS";
  return entries.map((entry) => {
    const base = { ...entry, previousHash };
    const entryHash = sha256(stableJson(base));
    previousHash = entryHash;
    return { ...base, entryHash };
  });
}

