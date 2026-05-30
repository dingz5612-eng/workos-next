import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const defaultOut = path.join(".tmp", "v5_4", "control-plane-schema-verify.json");
const args = process.argv.slice(2);
const hasOut = args.some((arg) => arg === "--out" || arg.startsWith("--out="));
const runnerArgs = hasOut ? args : [`--out=${defaultOut}`, ...args];

fs.mkdirSync(path.join(repoRoot, ".tmp", "v5_4"), { recursive: true });

const project = path.join(
  "tools",
  "control-plane",
  "WorkOS.ControlPlaneRunners",
  "WorkOS.ControlPlaneRunners.csproj"
);

const result = spawnSync(
  "dotnet",
  ["run", "--configuration", "Release", "--project", project, "--", "schema-verify", ...runnerArgs],
  {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit"
  }
);

if (result.error) {
  console.error(`control-plane-schema-verify: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
