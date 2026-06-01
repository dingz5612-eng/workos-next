import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = process.cwd();

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function git(args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
}

function currentMainHead() {
  try {
    return git(["rev-parse", "origin/main"]);
  } catch {
    return git(["ls-remote", "origin", "refs/heads/main"]).split(/\s+/)[0];
  }
}

function fail(message, details = []) {
  for (const detail of details) console.error(detail);
  throw new Error(message);
}

function assert(condition, message, details = []) {
  if (!condition) fail(message, details);
}

function businessLine(registry, id) {
  return registry.businessLines.find((line) => line.businessLineId === id);
}

function assertL0(line, label) {
  assert(line?.level === "L0 Contract Preview", `${label} must remain L0 Contract Preview.`);
  assert(line?.productionAllowed === false, `${label} productionAllowed must be false.`);
  assert(line?.productionConfirmAllowed === false, `${label} productionConfirmAllowed must be false.`);
}

const current = readJson("artifacts/release-state/current-state.json");
const dormInt = readJson("artifacts/go-live/dormitory/internal-pilot-go-no-go.json");
const rtFinal = readJson("artifacts/rt4/final-completion-assurance-result.json");
const evidenceGraph = readJson("artifacts/rt4/evidence-graph.json");
const dashboard = readJson("artifacts/rt4/completion-dashboard.json");
const registry = readJson("docs/business/business-line-registry.json");
const bStageGate = readJson("artifacts/go-live/dormitory/b-stage-gate-result.json");
const observation = readJson("artifacts/go-live/dormitory/observation-window-result.json");
const l1ToL2 = readJson("artifacts/go-live/dormitory/l1-to-l2-upgrade-result.json");
const mainHead = currentMainHead();

assert(current.currentMain?.headSha === mainHead, "Authority current main does not match origin/main.");

assert(dormInt.latestMain?.commitSha === mainHead, "DORM-INT artifact must bind current origin/main.");
assert(dormInt.latestMain?.ci?.headSha === mainHead, "DORM-INT CI evidence must bind current origin/main.");
assert(dormInt.latestMain?.v54ControlPlaneGuards?.headSha === mainHead, "DORM-INT V5.4 evidence must bind current origin/main.");
assert(dormInt.status === "GO_FOR_INTERNAL_PILOT", "DORM-INT status must remain GO_FOR_INTERNAL_PILOT.");
assert(dormInt.internalPilotAllowed === true, "DORM-INT must allow only L1 internal pilot.");
assert(dormInt.productionAllowed === false, "DORM-INT productionAllowed must be false.");
assert(dormInt.dormitoryL2ProductionAllowed === false, "DORM-INT L2 flag must be false.");

assert(rtFinal.currentMainHead === mainHead, "RT-FINAL reconciled current main must match origin/main.");
assert(rtFinal.businessProductionAllowed === false, "RT-FINAL must keep business production blocked.");
assert(rtFinal.dormitoryL2ProductionAllowed === false, "RT-FINAL must keep Dormitory L2 blocked.");
assert(rtFinal.repairPartsHrStatus === "L0 Contract Preview", "RT-FINAL must keep Repair / Parts / HR L0.");

assert(evidenceGraph.mode === "L1_INTERNAL_PILOT_OBSERVATION", "Evidence Graph mode must be L1 observation.");
assert(evidenceGraph.releaseStates?.centralMerge === "CENTRAL_MERGE_COMPLETED", "Evidence Graph central merge state mismatch.");
assert(evidenceGraph.releaseStates?.dormInt === "DORM_INT_PASSED", "Evidence Graph DORM-INT state mismatch.");
assert(evidenceGraph.releaseStates?.observation === "L1_INTERNAL_PILOT_OBSERVATION", "Evidence Graph observation state mismatch.");
assert(evidenceGraph.releaseStates?.businessProduction === "BLOCKED", "Evidence Graph business production must be blocked.");
assert(evidenceGraph.releaseStates?.dormitoryL2Production === "BLOCKED", "Evidence Graph Dormitory L2 must be blocked.");

assert(dashboard.mode === "L1_INTERNAL_PILOT_OBSERVATION", "Completion Dashboard mode must be L1 observation.");
assert(dashboard.currentMainHead === mainHead, "Completion Dashboard main head must match origin/main.");
assert(dashboard.businessProduction === "BLOCKED", "Completion Dashboard business production must be blocked.");
assert(dashboard.dormitoryL2Production === "BLOCKED", "Completion Dashboard Dormitory L2 must be blocked.");
assert(dashboard.centralMergeTrain === "CENTRAL_MERGE_COMPLETED", "Completion Dashboard central merge train mismatch.");

const dormitory = businessLine(registry, "dormitory");
assert(dormitory?.level === "L1 Internal Pilot", "Dormitory registry level must be L1 Internal Pilot.");
assert(dormitory?.internalPilotAllowed === true, "Dormitory registry internalPilotAllowed must be true.");
assert(dormitory?.productionAllowed === false, "Dormitory registry productionAllowed must be false.");
assert(dormitory?.productionConfirmAllowed === false, "Dormitory production confirm must be false.");
assertL0(businessLine(registry, "repair"), "Repair");
assertL0(businessLine(registry, "parts"), "Parts");
assertL0(businessLine(registry, "hr"), "HR");

assert(bStageGate.status === "passed", "BStageGate status must be passed.");
assert(bStageGate.source_mode === "real", "BStageGate source mode must be real.");
assert((bStageGate.no_go_items || []).length === 0, "BStageGate no-go items must be empty.");

assert(observation.status === "passed", "Observation window result must be passed.");
assert(observation.observationWindowStatus === "active_l1_observation", "Observation must be active L1 observation.");
assert(observation.productionAllowed === false, "Observation productionAllowed must be false.");
assert(observation.l2ProductionAllowed === false, "Observation L2 flag must be false.");
assert(l1ToL2.eligible === false, "L1-to-L2 must remain not eligible.");
assert(l1ToL2.productionAllowed === false, "L1-to-L2 productionAllowed must be false.");
assert(l1ToL2.l2ProductionAllowed === false, "L1-to-L2 L2 flag must be false.");

assert(current.authoritativeState?.businessLineRegistry === "ALIGNED", "Current authority must mark registry aligned.");
assert(current.authoritativeState?.businessProduction === "BLOCKED", "Authority business production must be blocked.");
assert(current.authoritativeState?.dormitoryL2 === "BLOCKED", "Authority Dormitory L2 must be blocked.");
assert(current.prohibitedStates?.repairPartsHrProductionAllowed === false, "Authority must block Repair / Parts / HR production.");

console.log("current state authority check: PASS");
