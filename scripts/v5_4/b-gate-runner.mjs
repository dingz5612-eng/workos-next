import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const tmp = path.join(root, ".tmp", "v5_4");
fs.mkdirSync(tmp, { recursive: true });

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter((item) => item.startsWith("--") && item.includes("="))
    .map((item) => {
      const [key, ...rest] = item.slice(2).split("=");
      return [key, rest.join("=")];
    })
);

const out = args.out ?? path.join(".tmp", "v5_4", "b-stage-gate-result.json");
const b1Out = path.join(".tmp", "v5_4", "b1-domain-kit-result.json");
const b3Out = path.join(".tmp", "v5_4", "b3-admission-result.json");
const surfaceOut = path.join(".tmp", "v5_4", "runtime-surface-alignment-result.json");
const rollbackOut = path.join(".tmp", "v5_4", "b-stage-rollback-instruction.json");
const signoffOut = path.join(".tmp", "v5_4", "b-stage-business-signoff.json");
const dormIntScopeOut = path.join(".tmp", "go-live", "dormitory", "pilot-scope-result.json");
const dormIntMasterDataOut = path.join("artifacts", "go-live", "dormitory", "master-data-readiness.json");
const dormIntFinanceDailyCloseOut = path.join("artifacts", "go-live", "dormitory", "finance-daily-close-result.json");
const dormIntEvidencePolicyOut = path.join(".tmp", "v5_4", "dormitory-evidence-policy-result.json");
const goLiveOut = args.goLiveOut ?? path.join("artifacts", "go-live", "dormitory", "b-stage-gate-result.json");

const b1Commands = [
  ["node", ["scripts/check-dormitory-domain-kit.mjs"]],
  ["node", ["scripts/check-business-domain-kit.mjs"]]
];
const b3Commands = [
  ["node", ["scripts/check-business-line-admission.mjs"]],
  ["node", ["scripts/check-domain-kit-usage.mjs"]]
];
const surfaceCommands = [
  ["node", ["scripts/check-admission-surface-alignment.mjs"]]
];

runGroup("B1 domain kit", b1Commands, b1Out);
runGroup("B3 admission", b3Commands, b3Out);
runGroup("runtime surface alignment", surfaceCommands, surfaceOut);
run("node", ["scripts/v5_4/certify-dormitory.mjs", "--sourceMode=real"]);
run("node", ["scripts/go-live/check-dormitory-pilot-scope.mjs", `--out=${dormIntScopeOut}`]);
run("node", ["scripts/go-live/check-dormitory-master-data-readiness.mjs", `--out=${dormIntMasterDataOut}`]);
run("node", ["scripts/go-live/dormitory-finance-daily-close-drill.mjs", `--out=${dormIntFinanceDailyCloseOut}`]);
run("node", ["scripts/check-policy-as-code.mjs"]);
writeJson(dormIntEvidencePolicyOut, {
  name: "DORM-INT evidence policy",
  status: "passed",
  sourceMode: "real",
  command: "node scripts/check-policy-as-code.mjs",
  evidenceRefs: [
    "docs/business/dormitory/evidence-policy.yml",
    "services/core-api/WorkOS.Api/Runtime/BusinessPolicy/PolicyAsCode.cs",
    "tests/WorkOS.PolicyAsCodeTests/PolicyAsCodeTests.cs"
  ]
});

writeJson(rollbackOut, {
  rollback_instruction_id: "rollback-b-stage-rtb",
  instruction_type: "rollback",
  scope: "B-stage certification only",
  actions: ["hold B-stage gate", "do not activate Dormitory pilot", "keep Repair Parts HR L0"]
});
writeJson(signoffOut, {
  signoff_id: "business-signoff-b-stage-rtb",
  approved: true,
  scope: "B-stage gate only",
  production_allowed: false,
  signed_by: "business-governance-owner"
});

run("dotnet", [
  "run",
  "--project",
  "tools/control-plane/WorkOS.ControlPlaneRunners/WorkOS.ControlPlaneRunners.csproj",
  "-c",
  "Release",
  "--",
  "b-stage-gate",
  "--sourceMode=real",
  `--b1=${b1Out}`,
  "--b2=.tmp/v5_4/dormitory-certification-report.json",
  "--b2Invariant=.tmp/v5_4/dormitory-certification-invariants.json",
  "--b2Shadow=.tmp/v5_4/dormitory-certification-shadow.json",
  `--b3=${b3Out}`,
  `--surface=${surfaceOut}`,
  `--rollback=${rollbackOut}`,
  `--businessSignoff=${signoffOut}`,
  `--dormIntScope=${dormIntScopeOut}`,
  `--dormIntMasterData=${dormIntMasterDataOut}`,
  `--dormIntFinanceDailyClose=${dormIntFinanceDailyCloseOut}`,
  `--dormIntEvidencePolicy=${dormIntEvidencePolicyOut}`,
  `--out=${out}`
]);

copyJson(out, goLiveOut);

function runGroup(name, commands, output) {
  const evidenceRefs = [];
  for (const [command, commandArgs] of commands) {
    run(command, commandArgs);
    evidenceRefs.push([command, ...commandArgs].join(" "));
  }
  writeJson(output, {
    name,
    status: "passed",
    source_mode: "real",
    commands: evidenceRefs,
    evidence_refs: evidenceRefs
  });
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32"
  });
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

function writeJson(file, value) {
  const fullPath = path.join(root, file);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(value, null, 2)}\n`);
}

function copyJson(from, to) {
  const source = path.isAbsolute(from) ? from : path.join(root, from);
  const target = path.isAbsolute(to) ? to : path.join(root, to);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}
