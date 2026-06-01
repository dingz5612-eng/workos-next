import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const signoffPath = readArg("--signoff=", "docs/go-live/dormitory/training-signoff.yml");
const outPath = readArg("--out=", "artifacts/go-live/dormitory/training-signoff-result.json");

const requiredRoleTasks = {
  frontdesk: ["checkin", "bed assignment", "payment register"],
  finance: ["deposit confirm", "ordinary payment confirm", "bank mismatch"],
  housekeeping: ["service task", "cleaning complete", "bed release"],
  manager: ["risk assign", "refund approve", "SLA escalation"],
  admin: ["capability change", "device trust", "evidence audit"],
  releaseOwner: ["pause pilot", "rollback pilot", "review BStageGate"]
};

if (process.argv.includes("--self-test")) {
  const invalid = validateTrainingSignoff({
    sourceMode: "real",
    roles: [
      {
        role: "finance",
        signer: "",
        signedAt: "",
        tasks: [{ task: "deposit confirm", scenarioResult: "passed" }],
        blockingIssue: "open",
        approvalDecision: "approved_for_l1_internal_pilot"
      }
    ]
  });
  assert(invalid.some((item) => item.id === "dorm_int_10.role_missing"), "self-test must catch missing roles.");
  assert(invalid.some((item) => item.id === "dorm_int_10.signer_missing"), "self-test must catch missing signer.");
  assert(invalid.some((item) => item.id === "dorm_int_10.blocking_issue_open"), "self-test must catch open blocking issue.");
  console.log("Dormitory training signoff self-test: PASS");
  process.exit(0);
}

const signoff = readJson(signoffPath);
const noGoItems = validateTrainingSignoff(signoff);
const report = {
  generated_at_utc: new Date().toISOString(),
  generated_by: "check-dormitory-training-signoff",
  stage: "DORM-INT-10",
  status: noGoItems.length ? "blocked" : "passed",
  sourceMode: signoff.sourceMode ?? "missing",
  signoffPath,
  roleCount: Array.isArray(signoff.roles) ? signoff.roles.length : 0,
  roles: (signoff.roles ?? []).map((role) => ({
    role: role.role,
    signer: role.signer,
    signedAt: role.signedAt,
    taskCount: Array.isArray(role.tasks) ? role.tasks.length : 0,
    approvalDecision: role.approvalDecision
  })),
  noGoItems,
  nextAction: noGoItems.length
    ? "补齐角色训练签收中的 P0 blocker 后重新运行 training signoff checker。"
    : "DORM-INT-10 passed; DORM-INT-FINAL may evaluate final go/no-go."
};

writeJson(outPath, report);

if (noGoItems.length) {
  for (const item of noGoItems) {
    console.error(`${item.severity} ${item.id}: ${item.message}`);
  }
  throw new Error("Dormitory training signoff: BLOCKED");
}

console.log("Dormitory training signoff: PASS");

export function validateTrainingSignoff(signoff) {
  const violations = [];
  if (signoff.sourceMode !== "real") {
    violations.push(violation("dorm_int_10.source_mode_not_real", "Training signoff sourceMode must be real."));
  }
  const roles = signoff.roles ?? [];
  const byRole = new Map(roles.map((item) => [item.role, item]));
  for (const [role, requiredTasks] of Object.entries(requiredRoleTasks)) {
    const entry = byRole.get(role);
    if (!entry) {
      violations.push(violation("dorm_int_10.role_missing", `Training signoff missing role: ${role}.`, { role }));
      continue;
    }
    if (!entry.signer) {
      violations.push(violation("dorm_int_10.signer_missing", `Role ${role} missing signer.`, { role }));
    }
    if (!entry.signedAt) {
      violations.push(violation("dorm_int_10.signed_at_missing", `Role ${role} missing signedAt.`, { role }));
    }
    if (entry.blockingIssue && !["closed", "no-go-recorded", "none"].includes(entry.blockingIssue)) {
      violations.push(violation("dorm_int_10.blocking_issue_open", `Role ${role} has open blocking issue.`, { role, blockingIssue: entry.blockingIssue }));
    }
    if (entry.approvalDecision !== "approved_for_l1_internal_pilot") {
      violations.push(violation("dorm_int_10.approval_missing", `Role ${role} missing L1 internal pilot approval decision.`, { role }));
    }

    const tasks = entry.tasks ?? [];
    if (tasks.length < 3) {
      violations.push(violation("dorm_int_10.task_count_low", `Role ${role} must complete at least 3 simulated tasks.`, { role, taskCount: tasks.length }));
    }
    const taskNames = new Set(tasks.map((item) => item.task));
    for (const task of requiredTasks) {
      if (!taskNames.has(task)) {
        violations.push(violation("dorm_int_10.task_missing", `Role ${role} missing task: ${task}.`, { role, task }));
      }
    }
    for (const task of tasks) {
      if (task.scenarioResult !== "passed" || !task.trainingEvidence) {
        violations.push(violation("dorm_int_10.task_evidence_missing", `Role ${role} task ${task.task} must have passed result and trainingEvidence.`, { role, task: task.task }));
      }
    }
  }
  return violations;
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function writeJson(relativePath, payload) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function readArg(prefix, fallback) {
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function violation(id, message, extra = {}) {
  return { severity: "P0", id, message, ...extra };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
