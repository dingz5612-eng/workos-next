import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const registryPath = "docs/contracts/business/oam-workflow-state-registry.json";
const reportPath = "artifacts/oam/checks/workflow-state-registry-result.json";
const violations = [];

const registry = readJson(registryPath);
const definitions = readJson("docs/contracts/definition/workitem-definition-registry.json");
const admission = readJson("docs/contracts/admission/admission-matrix.json");
const objectRegistry = readJson("docs/contracts/business/oam-business-object-field-registry.json");

if (registry.version !== "oam.workflow-state-registry.v1" || registry.status !== "authoritative") {
  fail("registry_identity_invalid", "流程状态总表必须声明 oam.workflow-state-registry.v1 authoritative。");
}

const definitionsById = new Map((definitions.definitions ?? []).map((item) => [item.definitionId, item]));
const admissionIds = new Set((admission.entries ?? []).map((item) => item.id));
const objectIds = new Set((objectRegistry.objects ?? []).map((item) => item.objectId));
const workflowIds = new Set();

for (const workflow of registry.workflows ?? []) {
  for (const field of ["workflowId", "definitionId", "workItemType", "commandType", "initialState", "allowedStates", "forbiddenStates", "actions"]) {
    if (!(field in workflow) || workflow[field] === "") {
      fail("workflow_field_missing", `${workflow.workflowId ?? "<missing>"} 缺少 ${field}。`);
    }
  }
  if ("sourceCardId" in workflow) {
    fail("workflow_source_card_current_identity", `${workflow.workflowId} 不得把 sourceCardId 作为当前 workflow 绑定字段。`);
  }
  if (workflowIds.has(workflow.workflowId)) {
    fail("workflow_duplicate", `流程重复：${workflow.workflowId}`);
  }
  workflowIds.add(workflow.workflowId);
  const definition = definitionsById.get(workflow.definitionId);
  if (!definition) {
    fail("workflow_definition_missing", `${workflow.workflowId} 的 definitionId 不在 Definition Registry：${workflow.definitionId}`);
  } else {
    if (definition.workItemType !== workflow.workItemType) {
      fail("workflow_definition_workitem_mismatch", `${workflow.workflowId} 的 workItemType 与 Definition 不一致。`);
    }
    if (definition.commandType !== workflow.commandType) {
      fail("workflow_definition_command_mismatch", `${workflow.workflowId} 的 commandType 与 Definition 不一致。`);
    }
  }
  requireMigrationRefs(workflow, `${workflow.workflowId}`);
  if (!workflow.allowedStates?.includes(workflow.initialState)) {
    fail("workflow_initial_state_not_allowed", `${workflow.workflowId} 的 initialState 不在 allowedStates。`);
  }
  for (const action of workflow.actions ?? []) {
    for (const field of ["actionId", "from", "to", "preconditions", "admissionMatrixEntry", "evidenceRequired", "visibleRoles", "mobileVisible", "pcGovernanceAction", "revokePath", "correctionPath"]) {
      if (!(field in action) || action[field] === "") {
        fail("workflow_action_field_missing", `${workflow.workflowId}.${action.actionId ?? "<missing>"} 缺少 ${field}。`);
      }
    }
    if (!admissionIds.has(action.admissionMatrixEntry)) {
      fail("workflow_admission_missing", `${workflow.workflowId}.${action.actionId} 引用不存在的准入条目：${action.admissionMatrixEntry}`);
    }
    if (!Array.isArray(action.from) || action.from.length === 0 || !Array.isArray(action.preconditions)) {
      fail("workflow_action_array_invalid", `${workflow.workflowId}.${action.actionId} 的 from/preconditions 必须是数组。`);
    }
    const highRisk = /paymentConfirmation|depositRefund|periodClose|ledgerCorrection/i.test(action.actionId);
    if (highRisk) {
      for (const required of ["trusted_device", "reason_present", "evidence_refs_present"]) {
        if (!action.preconditions.some((item) => item.includes(required))) {
          fail("workflow_high_risk_precondition_missing", `${workflow.workflowId}.${action.actionId} 缺少高风险前置条件：${required}`);
        }
      }
      if (!action.evidenceRequired.some((item) => item.includes("admission_decision_ref"))) {
        fail("workflow_high_risk_evidence_missing", `${workflow.workflowId}.${action.actionId} 缺少 admission decision evidence。`);
      }
    }
  }
}

for (const required of ["Room", "Bed", "Payment", "DepositAccount", "LedgerEntry", "EvidenceObject", "AdmissionDecision"]) {
  if (!objectIds.has(required)) {
    fail("workflow_required_object_missing", `流程闭环需要业务对象总表包含 ${required}。`);
  }
}

writeReport();

if (violations.length) {
  for (const item of violations) console.error(`${item.id}: ${item.message}`);
  process.exit(1);
}

console.log("Workflow state registry check: PASS");

function readJson(file) {
  requirePath(file, file);
  try {
    return JSON.parse(fs.readFileSync(abs(file), "utf8"));
  } catch (error) {
    fail("json_invalid", `${file} 不是合法 JSON：${error.message}`);
    return {};
  }
}

function requirePath(file, label) {
  if (!fs.existsSync(abs(file))) {
    fail("path_missing", `${label} 不存在：${file}`);
  }
}

function writeReport() {
  const full = abs(reportPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, JSON.stringify({
    checkedAt: new Date().toISOString(),
    architecture: "oam.current",
    status: violations.length ? "fail" : "pass",
    violations
  }, null, 2));
}

function fail(id, message) {
  violations.push({ id, severity: "P0", message });
}

function requireMigrationRefs(item, label) {
  const sourceCardRef = (item.migrationRefs ?? []).find((ref) => ref.type === "sourceCardId");
  if (!sourceCardRef) {
    fail("workflow_migration_ref_missing", `${label} 必须把 sourceCardId 放入 migrationRefs。`);
    return;
  }
  for (const [key, expected] of [
    ["readOnly", true],
    ["executable", false],
    ["affectsAdmission", false],
    ["affectsRuntimeConfirm", false],
    ["affectsBusinessIdentity", false],
    ["affectsLedger", false]
  ]) {
    if (sourceCardRef[key] !== expected) {
      fail("workflow_migration_ref_policy_invalid", `${label} migrationRefs.sourceCardId.${key} 必须是 ${expected}。`);
    }
  }
  if (sourceCardRef.deletionProofRef !== "docs/contracts/definition/source-id-migration-fence.json") {
    fail("workflow_migration_ref_deletion_proof_missing", `${label} migrationRefs.sourceCardId 必须绑定删除证明。`);
  }
}

function abs(file) {
  return path.join(root, file);
}
