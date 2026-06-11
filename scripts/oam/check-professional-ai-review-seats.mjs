import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const seatsPath = "docs/oam/professional-ai-review-seats.json";
const resultPath = "artifacts/oam/checks/professional-ai-review-seats-result.json";
const requiredLabels = [
  "01｜产品业务",
  "02｜架构运行时",
  "03｜体验语言",
  "04｜搜索数据",
  "05｜安全发布",
  "06｜质量证据"
];
const violations = [];
const document = readJson(seatsPath);
const seats = document.seats ?? [];
const labels = new Set(seats.map((seat) => seat.label));

if (document.version !== "oam.professional-ai-review-seats.v1" || document.status !== "authoritative") {
  fail("review_seats_identity", "Professional AI review seats must be authoritative oam.professional-ai-review-seats.v1.");
}
if (document.accountable !== "00-OAM-Total-Control") {
  fail("review_seats_accountable", "Professional AI review seats must be accountable to 00-OAM-Total-Control.");
}
for (const label of requiredLabels) {
  if (!labels.has(label)) fail("review_seat_missing", `Missing professional AI review seat: ${label}.`);
}
for (const seat of seats) {
  if (seat.role !== "review-only") {
    fail("review_seat_not_review_only", `${seat.label ?? seat.id} must be review-only.`);
  }
  if (seat.finalInstructionToCodexAllowed !== false) {
    fail("review_seat_codex_instruction_allowed", `${seat.label ?? seat.id} must not directly give Codex final execution instruction.`);
  }
}
const rules = document.rules ?? {};
if (rules.seat01To06OnlyGiveReviewOpinions !== true || rules.reviewOnly !== true) {
  fail("review_only_rule_missing", "01-06 must only give review opinions.");
}
if (rules.seat05ResponsibleForReleaseEvidenceMechanics !== true) {
  fail("seat05_release_evidence_mechanics", "05 must be responsible for release evidence mechanics.");
}
if (rules.seat06ResponsibleForEvidenceValidity !== true) {
  fail("seat06_evidence_validity", "06 must be responsible for evidence validity.");
}
if (rules.seat05Seat06ConflictAdjudicator !== "00-OAM-Total-Control") {
  fail("seat05_06_conflict_adjudicator", "05 / 06 conflict must be adjudicated by 00.");
}
if (rules.seat01To06MayNotDirectlyGiveCodexFinalExecutionInstruction !== true) {
  fail("seat_codex_final_instruction_rule", "01-06 must not directly give Codex final execution instructions.");
}

writeResult();

if (violations.length > 0) {
  for (const violation of violations) console.error(`${violation.id}: ${violation.message}`);
  process.exit(1);
}

console.log(`Professional AI review seats check: PASS (${seats.length} seats)`);

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(abs(file), "utf8"));
  } catch (error) {
    fail("json_invalid", `${file} is not valid JSON: ${error.message}`);
    return {};
  }
}

function writeResult() {
  const full = abs(resultPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify({
    version: "oam.professional-ai-review-seats-check.v1",
    checkedAtUtc: new Date().toISOString(),
    architecture: "oam.current",
    status: violations.length ? "failed" : "passed",
    seatCount: seats.length,
    violationCount: violations.length,
    violations
  }, null, 2)}\n`, "utf8");
}

function fail(id, message) {
  violations.push({ id, severity: "P0", message });
}

function abs(file) {
  return path.join(root, file);
}
