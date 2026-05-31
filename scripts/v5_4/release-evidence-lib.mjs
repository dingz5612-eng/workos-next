import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export const repoRoot = process.cwd();
export const expectedMrs = Array.from({ length: 11 }, (_, index) => `MR-${String(index).padStart(2, "0")}`);

export function parseArgs(argv) {
  const flags = new Set();
  const values = new Map();
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const option = arg.slice(2);
    const equals = option.indexOf("=");
    if (equals === -1) {
      flags.add(option);
    } else {
      values.set(option.slice(0, equals), option.slice(equals + 1));
    }
  }

  return {
    has: (name) => flags.has(name),
    value: (name, fallback = undefined) => values.get(name) ?? fallback
  };
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function fail(message, details = []) {
  for (const detail of details) console.error(`- ${detail}`);
  console.error(message);
  process.exit(1);
}

export function gitHead() {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  });
  return result.status === 0 ? result.stdout.trim() : "";
}

export function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function stableHash(value) {
  return sha256(JSON.stringify(value, Object.keys(value).sort()));
}

export function isLocalRunId(value) {
  return typeof value === "string" && /^(LOCAL|local|local-)/.test(value);
}

export function listJsonFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory)
    .filter((name) => name.endsWith(".json"))
    .map((name) => path.join(directory, name));
}

export function collectReleaseEvidence(root = repoRoot) {
  const v54 = path.join(root, "docs", "v5.4");
  const releaseManifestFiles = [
    ...listJsonFiles(path.join(v54, "releases")),
    ...listJsonFiles(v54).filter((file) => /mr-\d{2}-release-manifest\.json$/i.test(path.basename(file)))
  ];
  const gateResultFiles = listJsonFiles(v54).filter((file) => /(?:mr-\d{2}|final-system)-gate-result\.json$/i.test(path.basename(file)));
  const invariantFiles = listJsonFiles(v54).filter((file) => /(?:mr-\d{2}|final-system)-invariant-checks\.json$/i.test(path.basename(file)));
  const shadowFiles = listJsonFiles(v54).filter((file) => /(?:mr-\d{2}|final-system)-shadow-compare(?:-report|-reports)?\.json$/i.test(path.basename(file)));
  const rollbackFiles = [
    ...listJsonFiles(path.join(v54, "rollback")),
    ...listJsonFiles(v54).filter((file) => /mr-\d{2}-rollback-instruction\.json$/i.test(path.basename(file)))
  ];
  const compensationFiles = listJsonFiles(v54).filter((file) => /mr-\d{2}-compensation-instruction\.json$/i.test(path.basename(file)));

  return {
    manifests: indexByMr(releaseManifestFiles),
    gates: indexByMr(gateResultFiles),
    invariants: indexByMr(invariantFiles),
    shadows: indexByMr(shadowFiles),
    rollbacks: indexByMr(rollbackFiles),
    compensations: indexByMr(compensationFiles),
    files: {
      releaseManifestFiles,
      gateResultFiles,
      invariantFiles,
      shadowFiles,
      rollbackFiles,
      compensationFiles
    }
  };
}

export function indexByMr(files) {
  const map = new Map();
  for (const file of files) {
    const data = readJson(file);
    const mrId = data.mr_id ?? matchMrId(file);
    if (!mrId) continue;
    const existing = map.get(mrId) ?? [];
    existing.push({ file, data });
    map.set(mrId, existing);
  }
  return map;
}

export function matchMrId(value) {
  const match = /mr-(\d{2})/i.exec(value);
  return match ? `MR-${match[1]}` : undefined;
}

export function loadFinalGate(root = repoRoot, overridePath = undefined) {
  const gatePath = overridePath
    ? path.resolve(overridePath)
    : path.join(root, "docs", "v5.4", "final-system-gate-result.json");
  return { file: gatePath, data: readJson(gatePath) };
}

export function replayFinalGate(root = repoRoot) {
  const evidence = collectReleaseEvidence(root);
  const finalGate = loadFinalGate(root).data;
  const p0 = [];
  const p1 = [];
  const goItems = [];

  for (const mr of expectedMrs) {
    const hasManifest = evidence.manifests.has(mr);
    const hasGate = evidence.gates.has(mr);
    const hasRollback = evidence.rollbacks.has(mr);
    const hasCompensation = evidence.compensations.has(mr);
    const gates = evidence.gates.get(mr) ?? [];
    const passedOrWarning = gates.some((item) => ["passed", "warning"].includes(String(item.data.status).toLowerCase()));

    if (!hasManifest) p0.push(`${mr}: ReleaseManifest missing`);
    if (!hasGate) p0.push(`${mr}: GateResult missing`);
    if (hasGate && !passedOrWarning) p0.push(`${mr}: GateResult is not passed or approved warning`);
    if (!hasRollback) p0.push(`${mr}: RollbackInstruction missing`);
    if (!hasCompensation && !["MR-00", "MR-01", "MR-02"].includes(mr)) p1.push(`${mr}: CompensationInstruction missing`);
    if (hasManifest && hasGate && passedOrWarning && hasRollback) goItems.push(`${mr}: release evidence package present`);
  }

  if (!Array.isArray(finalGate.business_signoff_refs) || finalGate.business_signoff_refs.length === 0) {
    p1.push("FINAL-SYSTEM: BusinessSignoff missing");
  }

  return {
    status: p0.length > 0 || p1.length > 0 ? "blocked" : "passed",
    severity: p0.length > 0 ? "P0" : p1.length > 0 ? "P1" : "P2",
    noGoItems: [...p0, ...p1],
    goItems,
    missingMrs: expectedMrs.filter((mr) => !evidence.manifests.has(mr) || !evidence.gates.has(mr)),
    evidence
  };
}

export function productionStatuses() {
  return new Set(["active", "locked"]);
}

export function assertFinalGateCannotClaimProduction(finalGate, replay, violations) {
  if (finalGate.status === "passed" && replay.status !== "passed") {
    violations.push("Final GateResult claims passed, but replay recomputes blocked.");
  }
  if (finalGate.status === "passed" && isLocalRunId(finalGate.ci_run_id)) {
    violations.push(`Final GateResult uses local ci_run_id as production evidence: ${finalGate.ci_run_id}`);
  }
  if (finalGate.status === "passed" && Array.isArray(finalGate.no_go_items) && finalGate.no_go_items.length > 0) {
    violations.push("Final GateResult claims passed while no_go_items are present.");
  }
}

export function runSelfTest(cases) {
  for (const testCase of cases) {
    testCase();
  }
}
