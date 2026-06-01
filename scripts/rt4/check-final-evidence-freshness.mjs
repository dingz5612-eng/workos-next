import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const mainHead = readCurrentMainHead();
const violations = [];

const goNoGo = readJson("artifacts/go-live/dormitory/internal-pilot-go-no-go.json");
const graph = readJson("artifacts/rt4/evidence-graph.json");
const dashboard = readJson("artifacts/rt4/completion-dashboard.json");
const finalAssurance = readJson("artifacts/rt4/final-completion-assurance-result.json");

eq(goNoGo.latestMain?.commitSha, mainHead, "freshness.go_no_go_main_sha", "DORM-INT final artifact 必须绑定当前 origin/main。");
eq(goNoGo.latestMain?.ci?.headSha, mainHead, "freshness.go_no_go_ci_sha", "DORM-INT final CI evidence 必须绑定当前 origin/main。");
eq(goNoGo.latestMain?.v54ControlPlaneGuards?.headSha, mainHead, "freshness.go_no_go_v54_sha", "DORM-INT final V5.4 evidence 必须绑定当前 origin/main。");
eq(graph.headSha, mainHead, "freshness.graph_head", "Evidence Graph 必须绑定当前 origin/main。");
eq(dashboard.currentMainHead, mainHead, "freshness.dashboard_head", "Completion Dashboard 必须绑定当前 origin/main。");
eq(finalAssurance.currentMainHead, mainHead, "freshness.final_assurance_head", "Final completion assurance 必须绑定当前 origin/main。");
assertNoTmp(goNoGo.evidenceRefs ?? [], "freshness.go_no_go_tmp", "Final go-live evidenceRefs 不允许引用 .tmp。");
assertNoTmp(Object.values(goNoGo.readiness ?? {}).map((item) => item.ref), "freshness.readiness_tmp", "Final readiness refs 不允许引用 .tmp。");
eq(goNoGo.productionAllowed, false, "freshness.production_drift", "DORM-INT GO 不得允许 production。");
eq(goNoGo.dormitoryL2ProductionAllowed, false, "freshness.l2_drift", "DORM-INT GO 不得允许 L2。");
eq(dashboard.businessProduction, "BLOCKED", "freshness.dashboard_business_drift", "Business Production 必须 BLOCKED。");
eq(finalAssurance.businessProductionAllowed, false, "freshness.final_business_drift", "Final assurance 不得允许 Business Production。");

if (violations.length > 0) {
  for (const item of violations) console.error(`${item.severity} ${item.id}: ${item.message}`);
  throw new Error("Final evidence freshness check failed.");
}

console.log("Final evidence freshness check: PASS");

function readCurrentMainHead() {
  const result = spawnSync("git", ["ls-remote", "origin", "refs/heads/main"], { cwd: root, encoding: "utf8", shell: process.platform === "win32" });
  if (result.status !== 0) throw new Error("BLOCKED: cannot confirm current main.");
  const sha = result.stdout.trim().split(/\s+/)[0];
  if (!sha) throw new Error("BLOCKED: cannot confirm current main.");
  return sha;
}

function readJson(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) throw new Error(`Missing file: ${relativePath}`);
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function eq(actual, expected, id, message) {
  if (actual !== expected) violations.push({ severity: "P0", id, message, actual, expected });
}

function assertNoTmp(items, id, message) {
  for (const item of items.filter(Boolean)) {
    if (`${item}`.replace(/\\/g, "/").includes(".tmp/")) violations.push({ severity: "P0", id, message, ref: item });
  }
}
