import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const archiveFile = "docs/architecture/archive-candidates.yml";

if (!exists(archiveFile)) {
  failures.push(`缺少归档候选文件：${archiveFile}`);
} else {
  checkArchiveCandidates();
}

checkHistoricalAuthorityNotes();

if (failures.length) {
  for (const failure of failures) console.error(`P0 ${failure}`);
  throw new Error("archive cleanliness check failed.");
}

console.log("archive cleanliness check: PASS");

function checkArchiveCandidates() {
  const text = read(archiveFile);
  const blocks = text.split(/\n\s*-\s+id:\s+/).slice(1).map((block) => `id: ${block}`);
  for (const block of blocks) {
    const id = field(block, "id");
    const candidatePath = field(block, "path");
    const requiredGate = field(block, "requiredGate");
    if (!candidatePath) failures.push(`${id || "archive candidate"} 缺少 path。`);
    if (candidatePath && !exists(candidatePath)) failures.push(`${id} 指向不存在的归档候选：${candidatePath}`);
    if (requiredGate && !exists(requiredGate)) failures.push(`${id} requiredGate 不存在：${requiredGate}`);
    for (const requiredField of ["status", "owner", "reason", "allowed_usage", "forbidden_usage", "archiveStage", "requiredGate"]) {
      if (!field(block, requiredField)) failures.push(`${id || "archive candidate"} 缺少 ${requiredField}。`);
    }
  }
}

function checkHistoricalAuthorityNotes() {
  const phasePlan = "docs/architecture/PHASE_PLAN.md";
  if (!exists(phasePlan)) return;
  const text = read(phasePlan);
  for (const term of [
    "Status: historical phase plan",
    "not current architecture authority",
    "OAM-ACF v8",
    "Operations Runtime",
    "Workspace/Card is a projection/display compatibility",
    "model only"
  ]) {
    if (!text.includes(term)) failures.push(`${phasePlan} 缺少历史非权威声明：${term}`);
  }
}

function field(block, name) {
  const match = block.match(new RegExp(`(^|\\n)\\s*${escapeRegex(name)}:\\s*(.+)`));
  return match?.[2]?.trim() ?? "";
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
