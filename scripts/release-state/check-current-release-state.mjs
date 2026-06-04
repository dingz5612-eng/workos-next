import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = process.cwd();

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function fail(message, details = []) {
  for (const detail of details) console.error(detail);
  throw new Error(message);
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

function assert(condition, message, details = []) {
  if (!condition) fail(message, details);
}

function noTmpRefs(refs, label) {
  const bad = refs.filter((ref) => ref.startsWith(".tmp") || ref.includes("/.tmp/") || ref.includes("\\.tmp\\"));
  assert(bad.length === 0, `${label} must not contain .tmp evidence refs.`, bad);
}

const current = readJson("artifacts/release-state/current-state.json");
const transitionLog = readJson("artifacts/release-state/state-transition-log.json");
const mainHead = currentMainHead();
const allowPendingMainRebind = process.env.OAM_ALLOW_PENDING_MAIN_REBIND === "true";
const ciMatchesCurrentMain = current.currentMain?.ci?.headSha === mainHead;
const ciMayBePendingSelfReference = allowPendingMainRebind && ciMatchesCurrentMain;

assert(current.version === "release-state.authority.v1", "current-state version mismatch.");
assert(current.generatedBy === "build-current-release-state", "current-state generatedBy mismatch.");
assert(current.currentMain?.repository === "dingz5612-eng/workos-next", "current-state repository mismatch.");
assert(current.currentMain?.branch === "main", "current-state branch mismatch.");
assert(current.currentMain?.headSha === mainHead, "current-state main head must match origin/main.", [
  `current-state=${current.currentMain?.headSha}`,
  `origin/main=${mainHead}`
]);
assert(
  current.currentMain?.ci?.status === "completed" || ciMayBePendingSelfReference,
  "current-state CI must be completed."
);
assert(
  current.currentMain?.ci?.conclusion === "success" ||
    ciMayBePendingSelfReference,
  "current-state CI must be green."
);
assert(current.currentMain?.ci?.headSha === mainHead, "current-state CI headSha must match origin/main.");
assert(current.currentMain?.v54ControlPlaneGuards?.status === "completed", "current-state V5.4 Guards must be completed.");
assert(current.currentMain?.v54ControlPlaneGuards?.conclusion === "success", "current-state V5.4 Guards must be green.");
assert(current.currentMain?.v54ControlPlaneGuards?.headSha === mainHead, "current-state V5.4 Guards headSha must match origin/main.");

assert(current.authoritativeState?.dormInt === "DORM_INT_PASSED", "DORM-INT state must be DORM_INT_PASSED.");
assert(current.authoritativeState?.dormitory === "L1_INTERNAL_PILOT_OBSERVATION", "Dormitory must stay in L1 observation.");
assert(current.authoritativeState?.dormitoryL2 === "BLOCKED", "Dormitory L2 must stay blocked.");
assert(current.authoritativeState?.businessProduction === "BLOCKED", "Business Production must stay blocked.");
assert(current.authoritativeState?.repair === "L0 Contract Preview", "Repair must stay L0.");
assert(current.authoritativeState?.parts === "L0 Contract Preview", "Parts must stay L0.");
assert(current.authoritativeState?.hr === "L0 Contract Preview", "HR must stay L0.");
assert(current.authoritativeState?.finalSystemGate === "blocked", "Final System Gate must remain blocked.");
assert(current.authoritativeState?.bStageGate === "passed", "BStageGate must be passed for L1 observation.");

assert(current.prohibitedStates?.dormitoryL2ProductionAllowed === false, "Dormitory L2 production flag must be false.");
assert(current.prohibitedStates?.businessProductionAllowed === false, "Business Production flag must be false.");
assert(current.prohibitedStates?.repairPartsHrProductionAllowed === false, "Repair / Parts / HR production flag must be false.");
assert(Array.isArray(current.noGoItems), "noGoItems must be an array.");
assert(current.noGoItems.length === 0, "current-state noGoItems must be empty for OAM-01 local pass.", current.noGoItems);
assert(Array.isArray(current.evidenceRefs) && current.evidenceRefs.length > 0, "current-state evidenceRefs must be present.");
noTmpRefs(current.evidenceRefs, "current-state evidenceRefs");

assert(transitionLog.version === "release-state.transition-log.v1", "state transition log version mismatch.");
assert(transitionLog.currentMainHead === mainHead, "state transition log must bind origin/main.");
assert(Array.isArray(transitionLog.transitions) && transitionLog.transitions.length >= 4, "state transition log must include required transitions.");

console.log("current release state check: PASS");
