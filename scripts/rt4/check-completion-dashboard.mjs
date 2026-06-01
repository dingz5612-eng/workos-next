import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dashboardJsonPath = path.join(root, "artifacts", "rt4", "completion-dashboard.json");
const dashboardMdPath = path.join(root, "docs", "program", "rt4", "completion-dashboard.md");

function fail(message, details = []) {
  for (const detail of details) console.error(`- ${detail}`);
  throw new Error(message);
}

if (!fs.existsSync(dashboardJsonPath) || !fs.existsSync(dashboardMdPath)) {
  fail("RT4 completion dashboard check failed.", ["Dashboard JSON and Markdown must both exist."]);
}

const dashboard = JSON.parse(fs.readFileSync(dashboardJsonPath, "utf8"));
const markdown = fs.readFileSync(dashboardMdPath, "utf8");
const violations = [];

if (dashboard.businessProduction !== "BLOCKED") violations.push("Business Production must be BLOCKED.");
if (dashboard.dormitoryL2Production !== "BLOCKED") violations.push("Dormitory L2 must be BLOCKED.");
if (dashboard.repairPartsHrStatus !== "L0_OR_BLOCKED") violations.push("Repair / Parts / HR must remain L0_OR_BLOCKED.");
if (dashboard.mode === "STACKED_PRECONSTRUCTION" && dashboard.currentGate === "DORM-INT") {
  violations.push("Dashboard cannot be STACKED_PRECONSTRUCTION after DORM-INT reconciliation.");
}
if (dashboard.mode === "L1_INTERNAL_PILOT_OBSERVATION") {
  if (dashboard.centralMergeTrain !== "CENTRAL_MERGE_COMPLETED") violations.push("Dashboard must show CENTRAL_MERGE_COMPLETED in L1 observation mode.");
  if (dashboard.currentGateStatus !== "GO_FOR_INTERNAL_PILOT") violations.push("Dashboard must show DORM-INT GO_FOR_INTERNAL_PILOT in L1 observation mode.");
  if (dashboard.dormitoryL1Observation !== "L1_INTERNAL_PILOT_OBSERVATION") violations.push("Dashboard must show L1_INTERNAL_PILOT_OBSERVATION.");
}
if ("repairProduction" in dashboard || "partsProduction" in dashboard) {
  violations.push("Dashboard must not use Repair Production or Parts Production status fields.");
}
if (dashboard.coverage?.p0 !== 100) violations.push(`P0 coverage must be 100, got ${dashboard.coverage?.p0}.`);
if ((dashboard.coverage?.p1 ?? 0) < 90) violations.push(`P1 coverage must be >= 90, got ${dashboard.coverage?.p1}.`);
if (dashboard.mode === "STACKED_PRECONSTRUCTION" && !markdown.includes("LOCKED_UNTIL_RT_FINAL_LOCAL_PASSED")) {
  violations.push("Dashboard markdown must show Central Merge Train lock in stacked mode.");
}
if (dashboard.mode === "L1_INTERNAL_PILOT_OBSERVATION" && !markdown.includes("CENTRAL_MERGE_COMPLETED")) {
  violations.push("Dashboard markdown must show Central Merge Train completed in L1 observation mode.");
}

if (violations.length > 0) fail("RT4 completion dashboard check failed.", violations);

console.log("RT4 completion dashboard check: PASS");
