import { spawnSync } from "node:child_process";

const result = spawnSync("dotnet", [
  "run",
  "--project",
  "tools/control-plane/WorkOS.ControlPlaneRunners/WorkOS.ControlPlaneRunners.csproj",
  "-c",
  "Release",
  "-p:OutputPath=bin/Release/net10.0/v5_4/",
  "-p:IntermediateOutputPath=obj/v5_4/Release/net10.0/",
  "--",
  "backup-restore-smoke",
  ...process.argv.slice(2)
], { stdio: "inherit" });

process.exit(result.status ?? 1);
