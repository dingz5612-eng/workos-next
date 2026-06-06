import { spawnSync } from "node:child_process";

const args = [
  "run",
  "--project",
  "tools/control-plane/WorkOS.ControlPlaneRunners/WorkOS.ControlPlaneRunners.csproj",
  "--",
  "certify-runtime",
  ...process.argv.slice(2)
];

const result = spawnSync("dotnet", args, { stdio: "inherit", shell: process.platform === "win32" });
process.exit(result.status ?? 1);
