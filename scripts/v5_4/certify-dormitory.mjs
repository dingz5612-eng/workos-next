import { spawnSync } from "node:child_process";

const result = spawnSync(
  "dotnet",
  [
    "run",
    "--project",
    "tools/control-plane/WorkOS.ControlPlaneRunners/WorkOS.ControlPlaneRunners.csproj",
    "-c",
    "Release",
    "--",
    "certify-dormitory",
    ...process.argv.slice(2)
  ],
  {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: process.platform === "win32"
  }
);

process.exit(result.status ?? 1);
