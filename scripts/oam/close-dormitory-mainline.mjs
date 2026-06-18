import { execFileSync, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/dormitory-mainline-close-result.json";
const passes = [];
const failures = [];

const commands = [
  gate("generate.13-scenario-contracts", "node", ["scripts/business/generate-dormitory-13-scenario-control-contracts.mjs"], "generator"),
  gate("formal.generated-compile-execution", "node", ["scripts/oam/check-generated-compile-execution.mjs"], "formal-compile"),
  gate("dormitory.field-authority-model", "node", ["scripts/business/check-dormitory-field-authority-model.mjs"], "dormitory-field-authority"),
  gate("candidate.acceptance-authority", "node", ["scripts/oam/generate-generated-candidate-acceptance.mjs", "--accept-current-by-00"], "generated-acceptance"),
  gate("candidate.acceptance-check", "node", ["scripts/oam/check-generated-candidate-acceptance.mjs"], "generated-acceptance"),
  gate("bundle.content-addressed", "node", ["scripts/oam/check-generated-bundle-content-addressed.mjs"], "generated-bundle"),
  gate("runtime.refresh-admission", "node", ["scripts/oam/refresh-dormitory-runtime-admission.mjs", "--approved-test-only", "--write-proof"], "runtime-admission"),
  gate("runtime.admission-check", "node", ["scripts/oam/check-dormitory-runtime-admission.mjs", "--write-proof"], "runtime-admission"),
  gate("capability.ledger-replay", "node", ["scripts/oam/replay-capability-ledger-projection.mjs"], "capability-ledger"),
  gate("capability.ledger-append-only", "node", ["scripts/oam/check-authority-ledger-append-only.mjs"], "capability-ledger"),
  gate("capability.projection-from-ledger", "node", ["scripts/oam/check-current-projection-from-ledger.mjs"], "capability-ledger"),
  gate("compile.current-capability", "node", ["scripts/oam/compile-current-capability.mjs"], "compiler"),
  gate("check.generated-not-manual", "node", ["scripts/oam/check-generated-files-not-manually-edited.mjs"], "generated"),
  gate("evidence.generate-root", "node", ["scripts/oam/generate-current-evidence-root.mjs"], "evidence-root"),
  gate("evidence.check-root", "node", ["scripts/oam/check-current-evidence-root.mjs"], "evidence-root"),
  gate("evidence.projection-only", "node", ["scripts/oam/check-evidence-is-projection-only.mjs"], "evidence-root"),
  gate("release.final-go-source", "node", ["scripts/oam/check-release-authority-is-only-final-go-source.mjs"], "release-authority"),
  gate("candidate.acceptance-after-evidence", "node", ["scripts/oam/generate-generated-candidate-acceptance.mjs", "--accept-current-by-00"], "generated-acceptance"),
  gate("candidate.acceptance-check-after-evidence", "node", ["scripts/oam/check-generated-candidate-acceptance.mjs"], "generated-acceptance"),
  gate("bundle.content-addressed-after-evidence", "node", ["scripts/oam/check-generated-bundle-content-addressed.mjs"], "generated-bundle"),
  gate("evidence.chain-separation", "node", ["scripts/oam/check-dormitory-evidence-chain-separation.mjs"], "evidence-root"),
  gate("generated.contract-consistency", "node", ["scripts/oam/check-generated-contract-consistency.mjs"], "generated"),
  gate("generated.field-binding-closure", "node", ["scripts/oam/check-generated-field-binding-closure.mjs"], "generated"),
  gate("generated.rule-source-map", "node", ["scripts/oam/check-generated-rule-source-map.mjs"], "generated"),
  gate("runtime.consumes-accepted-bundle", "node", ["scripts/oam/check-runtime-consumes-accepted-bundle.mjs"], "runtime"),
  gate("runtime.consumes-accepted-capability-bundle", "node", ["scripts/oam/check-runtime-consumes-accepted-capability-bundle.mjs"], "runtime"),
  gate("runtime.consumes-generated-invariants", "node", ["scripts/oam/check-runtime-consumes-generated-invariants.mjs"], "runtime"),
  gate("runtime.consumes-generated-failure-semantics", "node", ["scripts/oam/check-runtime-consumes-generated-failure-semantics.mjs"], "runtime"),
  gate("entry.admission-contract", "node", ["scripts/oam/check-dormitory-entry-admission-contract.mjs"], "entry-admission"),
  gate("surface.consumes-generated-surface-model", "node", ["scripts/oam/check-surface-consumes-generated-surface-model.mjs"], "surface"),
  gate("surface.consumes-generated-invariants", "node", ["scripts/oam/check-surface-consumes-generated-invariants.mjs"], "surface"),
  gate("surface.consumes-generated-failure-semantics", "node", ["scripts/oam/check-surface-consumes-generated-failure-semantics.mjs"], "surface"),
  gate("search.consumes-capability-projection", "node", ["scripts/oam/check-search-consumes-capability-projection.mjs"], "search"),
  gate("copy.visible-business-contract", "node", ["scripts/oam/check-visible-business-copy-contract.mjs"], "language"),
  gate("copy.no-technical-leak", "node", ["scripts/oam/check-business-ui-copy-no-technical-leak.mjs"], "language"),
  gate("language.kernel", "node", ["scripts/check-language-kernel.mjs"], "language"),
  gate("mainline.manifest", "node", ["scripts/oam/check-dormitory-mainline-manifest.mjs"], "mainline"),
  gate("legacy.retirement-ledger", "node", ["scripts/oam/check-legacy-retirement-ledger.mjs"], "legacy"),
  gate("legacy.no-old-active-entry", "node", ["scripts/oam/check-no-old-active-entry.mjs"], "legacy"),
  gate("legacy.no-active-path-identity", "node", ["scripts/oam/check-no-active-path-legacy-identity.mjs"], "legacy"),
  gate("legacy.no-active-authority", "node", ["scripts/oam/check-no-active-legacy-authority.mjs"], "legacy"),
  gate("legacy.no-current-capability-seed", "node", ["scripts/oam/check-no-current-capability-uses-legacy-seed.mjs"], "legacy"),
  gate("dormitory.13-scenario-generated", "node", ["scripts/business/check-dormitory-13-scenario-generated-contracts.mjs"], "dormitory-13-scenario"),
  gate("dormitory.13-scenario-consumption", "node", ["scripts/business/check-dormitory-13-scenario-consumption-boundary.mjs"], "dormitory-13-scenario"),
  gate("dormitory.13-scenario-integration", "node", ["scripts/business/check-dormitory-13-scenario-integration-chain.mjs"], "dormitory-13-scenario")
];

const startedAtUtc = new Date().toISOString();
const initialSnapshot = workspaceSnapshot();

try {
  const pass1 = runPass(1);
  passes.push(pass1);
  const pass1Snapshot = workspaceSnapshot();
  const pass2 = runPass(2);
  passes.push(pass2);
  const pass2Snapshot = workspaceSnapshot();
  const secondPassDrift = diffSnapshots(pass1Snapshot, pass2Snapshot);
  const forbiddenSecondPassDrift = secondPassDrift.filter((item) => !isAllowedSecondPassDrift(item.path));

  if (forbiddenSecondPassDrift.length > 0) {
    failures.push(
      `second pass introduced non-evidence drift: ${forbiddenSecondPassDrift.map((item) => item.path).join(", ")}`
    );
  }

  finish({
    status: failures.length === 0 ? "PASS" : "NO_GO",
    initialSnapshot,
    pass1Snapshot,
    pass2Snapshot,
    secondPassDrift,
    forbiddenSecondPassDrift
  });
} catch (error) {
  failures.push(error.message);
  finish({
    status: "NO_GO",
    initialSnapshot,
    pass1Snapshot: null,
    pass2Snapshot: null,
    secondPassDrift: [],
    forbiddenSecondPassDrift: []
  });
}

function runPass(pass) {
  const results = [];
  for (const command of commands) {
    const started = new Date();
    const result = spawnSync(command.command, command.args, {
      cwd: root,
      stdio: "inherit",
      env: {
        ...process.env,
        ALLOW_GENERATED_COMPILE_CANDIDATE: "true",
        OAM_WRITE_PROOF: "1"
      }
    });
    const ended = new Date();
    const entry = {
      ...command,
      pass,
      exitCode: result.status,
      signal: result.signal,
      durationMs: ended.getTime() - started.getTime(),
      status: result.status === 0 ? "PASS" : "NO_GO"
    };
    results.push(entry);
    if (result.status !== 0) {
      throw new Error(`pass ${pass} failed at ${command.id}: exit=${result.status ?? "signal"}${result.signal ? ` signal=${result.signal}` : ""}`);
    }
  }
  return {
    pass,
    status: "PASS",
    commandCount: results.length,
    commands: results
  };
}

function workspaceSnapshot() {
  const files = new Set([
    ...gitList(["diff", "--name-only"]),
    ...gitList(["diff", "--name-only", "--cached"]),
    ...gitList(["ls-files", "--others", "--exclude-standard"])
  ]);
  const entries = [...files].sort().map((file) => {
    const normalized = slash(file);
    const full = path.join(root, normalized);
    return {
      path: normalized,
      state: fs.existsSync(full) ? "present" : "deleted",
      digest: fs.existsSync(full) && fs.statSync(full).isFile()
        ? fileDigest(full)
        : "missing"
    };
  });
  return {
    recordedAtUtc: new Date().toISOString(),
    branch: gitText(["branch", "--show-current"]),
    head: gitText(["rev-parse", "HEAD"]),
    changedFileCount: entries.length,
    files: entries
  };
}

function diffSnapshots(before, after) {
  const left = new Map((before?.files ?? []).map((item) => [item.path, item]));
  const right = new Map((after?.files ?? []).map((item) => [item.path, item]));
  const paths = [...new Set([...left.keys(), ...right.keys()])].sort();
  return paths
    .map((itemPath) => {
      const previous = left.get(itemPath);
      const current = right.get(itemPath);
      if (stableStringify(previous) === stableStringify(current)) return null;
      return {
        path: itemPath,
        before: previous ?? null,
        after: current ?? null
      };
    })
    .filter(Boolean);
}

function isAllowedSecondPassDrift(file) {
  const normalized = slash(file);
  return normalized === resultPath ||
    normalized === "artifacts/oam/final-report.json" ||
    normalized.startsWith("artifacts/oam/checks/") ||
    normalized.startsWith("artifacts/oam/evidence/") ||
    normalized.startsWith("artifacts/oam/test-results/");
}

function finish(details) {
  const output = {
    version: "oam.dormitory-mainline-close-result.v1",
    checkedAtUtc: new Date().toISOString(),
    startedAtUtc,
    finishedAtUtc: new Date().toISOString(),
    status: details.status,
    branch: gitText(["branch", "--show-current"]),
    head: gitText(["rev-parse", "HEAD"]),
    commandCount: commands.length,
    passes,
    driftPolicy: {
      secondPassMustIntroduceNoNonEvidenceDrift: true,
      allowedSecondPassPathPrefixes: [
        "artifacts/oam/checks/",
        "artifacts/oam/evidence/",
        "artifacts/oam/test-results/"
      ],
      allowedSecondPassFiles: [
        "artifacts/oam/final-report.json",
        resultPath
      ]
    },
    ...details,
    productionConfirmAllowed: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO",
    failures
  };
  fs.mkdirSync(path.dirname(path.join(root, resultPath)), { recursive: true });
  fs.writeFileSync(path.join(root, resultPath), `${JSON.stringify(output, null, 2)}\n`, "utf8");
  if (output.status !== "PASS") {
    console.error("Dormitory mainline close: FAIL");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log(`Dormitory mainline close: PASS (${commands.length} commands x 2 passes, finalGoNoGo=NO_GO)`);
}

function gate(id, command, args, layer) {
  return {
    id,
    command,
    args,
    commandLine: `${command} ${args.join(" ")}`,
    responsibilityLayer: layer
  };
}

function gitText(args) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function gitList(args) {
  return gitText(args)
    .split(/\r?\n/)
    .map((item) => slash(item.trim()))
    .filter(Boolean);
}

function fileDigest(fullPath) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(fullPath)).digest("hex")}`;
}

function slash(value) {
  return String(value).replaceAll("\\", "/");
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
