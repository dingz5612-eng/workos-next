import { spawnSync } from "node:child_process";
import { currentHead, exists, failIfNeeded, readJson, requiredChecks } from "./project-hygiene-lib.mjs";

const checkOnly = process.argv.includes("--check");
const checkScripts = [
  "scripts/project/check-stale-evidence-refs.mjs",
  "scripts/project/check-route-surface-hygiene.mjs",
  "scripts/project/check-auxiliary-reference-hygiene.mjs",
  "scripts/check-company-kernel-alignment.mjs",
  "scripts/project/check-migration-sequence-hygiene.mjs",
  "scripts/project/check-seed-data-isolation.mjs",
  "scripts/project/check-screenshot-baseline.mjs",
  "scripts/project/check-artifact-hygiene.mjs"
];

if (checkOnly) {
  checkExistingProjectHygiene();
} else {
  runProjectHygiene();
}

function runProjectHygiene() {
  for (const script of checkScripts) {
    const result = spawnSync(process.execPath, [script], {
      cwd: process.cwd(),
      encoding: "utf8",
      shell: process.platform === "win32",
      stdio: "inherit"
    });
    if (result.status !== 0) {
      throw new Error(`project hygiene subcheck failed: ${script}`);
    }
  }
  checkExistingProjectHygiene();
}

function checkExistingProjectHygiene() {
  const failures = [];
  if (!exists("artifacts/project/project-hygiene-result.json")) {
    failures.push("缺少 artifacts/project/project-hygiene-result.json。");
    failIfNeeded(failures, "project hygiene check");
  }

  const result = readJson("artifacts/project/project-hygiene-result.json");
  if (result.status !== "PROJECT_HYGIENE_CLEANUP_LOCAL_PASSED") {
    failures.push(`project hygiene status 必须为 PROJECT_HYGIENE_CLEANUP_LOCAL_PASSED，当前为 ${result.status}。`);
  }
  if (result.headSha && result.headSha !== currentHead()) {
    failures.push(`project hygiene headSha 必须为当前提交 ${currentHead()}，当前为 ${result.headSha}。`);
  }
  for (const check of requiredChecks) {
    const item = result.checks?.[check];
    if (!item) failures.push(`project hygiene 缺少检查项：${check}。`);
    if (item && item.status !== "passed") failures.push(`project hygiene 检查项 ${check} 必须 passed，当前为 ${item.status}。`);
  }
  if ((result.noGoItems ?? []).length > 0) {
    failures.push(`project hygiene 仍存在 noGoItems：${result.noGoItems.join("；")}`);
  }
  failIfNeeded(failures, "project hygiene check");
  console.log("project hygiene check: PASS");
}
