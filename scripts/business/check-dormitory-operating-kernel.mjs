import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const kernelPath = "docs/business/domains/dormitory/dormitory-operating-kernel.json";
const definitionPath = "docs/contracts/definition/workitem-definition-registry.json";
const fieldPath = "docs/contracts/business/oam-business-object-field-registry.json";
const statePath = "docs/contracts/business/oam-workflow-state-registry.json";
const reportPath = "artifacts/oam/checks/dormitory-operating-kernel-result.json";

const requiredWorkItems = [
  "Dorm.RoomSetupConfirm",
  "Dorm.BedSetupConfirm",
  "Dorm.RatePlanConfirm",
  "Dorm.ResourceReadinessConfirm",
  "Dorm.OperationResourceSelect",
  "Dorm.OperationInspectionConfirm",
  "Dorm.OperationStatusDraft",
  "Dorm.OperationStatusChangeConfirm",
  "Dorm.OperationBlockerUpdate",
  "Dorm.OperationRestoreConfirm",
  "Dorm.LeadCapture",
  "Dorm.ReservationConfirm",
  "Dorm.CheckinConfirm",
  "Dorm.PaymentConfirm",
  "Dorm.DepositConfirm",
  "Dorm.ServiceTaskCreate",
  "Dorm.ServiceTaskAssign",
  "Dorm.ServiceTaskComplete",
  "Dorm.ServiceTaskVerify",
  "Finance.ExpenseRecord",
  "Finance.ExpenseApprove",
  "Finance.ExpenseLink",
  "Dorm.RoomInspectionConfirm",
  "Dorm.CheckoutSettlementApprove",
  "Dorm.StayExtendApprove",
  "Dorm.BedTransferApprove",
  "Dorm.ReservationCancelClose",
  "Dorm.ReservationNoShowClose",
  "Finance.ChargeAdjustmentApprove",
  "Finance.DebtFollowUp",
  "Dorm.AccessCredentialIssue",
  "Dorm.AccessCredentialRevoke",
  "Dorm.IncidentRecord",
  "Dorm.PeriodReview",
  "Dorm.PeriodActionPlanExecute",
  "Dorm.ExceptionResolve",
  "Finance.CorrectionApply"
];
const requiredObjects = [
  "Room",
  "Bed",
  "RatePlan",
  "Lead",
  "Reservation",
  "Resident",
  "Stay",
  "Payment",
  "DepositAccount",
  "ServiceTask",
  "Expense",
  "ExpenseLink",
  "CheckoutCase",
  "RoomInspection",
  "PeriodSnapshot",
  "ActionPlan",
  "ExceptionCase"
];
const allowedRoles = new Set(["宿舍经办人", "宿舍负责人"]);
const p0GeneratedCandidates = new Set([
  "Dorm.RoomSetupConfirm",
  "Dorm.BedSetupConfirm",
  "Dorm.ResourceReadinessConfirm"
]);
const requiredFieldClassifications = [
  "clientSubmitted",
  "selectedStableRef",
  "contextReadonly",
  "systemGenerated",
  "derived",
  "forbidden"
];
const violations = [];

const kernel = readJson(kernelPath);
const registry = readJson(definitionPath);
const fields = readJson(fieldPath);
const states = readJson(statePath);
const fieldsByObject = new Map((fields.objects ?? []).map((item) => [item.objectId, item]));
const workflowsByType = new Map((states.workflows ?? []).map((item) => [item.workItemType, item]));
const workItems = kernel.workItems ?? [];
const workItemsByType = new Map(workItems.map((item) => [item.workItemType, item]));
const definitionsByType = canonicalDefinitionsByType(registry.definitions ?? [], workItemsByType);

requireValue(kernel.version === "oam.domain-operating-kernel.dormitory.v2", "kernel.version", "宿舍内核必须升级为 v2。");
requireValue(kernel.status === "authoritative", "kernel.status", "宿舍内核必须是 authoritative。");
requireValue(kernel.uniqueSourcePolicy?.sourcePath === kernelPath, "kernel.unique_source", "宿舍内核必须声明唯一源路径。");
requireValue(JSON.stringify((kernel.humanRoles ?? []).map((item) => item.nameZh).sort()) === JSON.stringify([...allowedRoles].sort()), "kernel.roles", "宿舍业务角色只能是宿舍经办人和宿舍负责人。");
requireValue(workItems.length === requiredWorkItems.length, "kernel.workitem_count", `宿舍当前 WorkItem 必须是 ${requiredWorkItems.length} 个。`);
requireValue(
  JSON.stringify((kernel.p0GeneratedCandidates ?? []).map((item) => item.workItemType).sort()) === JSON.stringify([...p0GeneratedCandidates].sort()),
  "kernel.p0_generated_candidates_invalid",
  "第一轮 P0 active generated candidates 只能是 RoomSetupConfirm / BedSetupConfirm / ResourceReadinessConfirm。");
requireValue(
  JSON.stringify(kernel.fieldClassificationEnum ?? []) === JSON.stringify(requiredFieldClassifications),
  "kernel.field_classification_enum_invalid",
  "字段分类必须是 clientSubmitted / selectedStableRef / contextReadonly / systemGenerated / derived / forbidden。");
requireValue(
  JSON.stringify(kernel.ledgerEffectModel?.modeEnum ?? []) === JSON.stringify(["none", "basis_only", "finance_kernel"]),
  "kernel.ledger_effect_mode_invalid",
  "ledgerEffect.mode 必须使用 none / basis_only / finance_kernel。");

for (const workItemType of requiredWorkItems) {
  const item = workItemsByType.get(workItemType);
  requireValue(Boolean(item), "kernel.workitem_missing", `宿舍内核缺少 ${workItemType}。`, { workItemType });
  if (!item) continue;
  for (const field of ["definitionId", "commandType", "ownerRole", "canonicalOwner", "allowedFacts", "forbiddenFacts", "requiredEvidence", "ledgerPolicyRef", "admissionPolicyRef", "downstreamWorkItems", "operationZh", "migrationRefs"]) {
    const present = field === "requiredEvidence"
      ? Array.isArray(item[field])
      : hasValue(item[field]);
    requireValue(present, "kernel.workitem_field_missing", `${workItemType} 缺少 ${field}。`, { workItemType, field });
  }
  requireValue(!("sourceCardId" in item), "kernel.source_card_current_identity", `${workItemType} 不得把 sourceCardId 作为当前 Source 身份字段。`, { workItemType });
  requireMigrationRefs(item, `${workItemType}`);
  requireValue(allowedRoles.has(item.ownerRole), "kernel.role_invalid", `${workItemType} 使用了第三套角色：${item.ownerRole}`, { workItemType });
  requireValue(Array.isArray(item.allowedHumanRoles) && item.allowedHumanRoles.every((role) => allowedRoles.has(role)), "kernel.allowed_roles_invalid", `${workItemType} allowedHumanRoles 只能使用两角色。`, { workItemType });
  for (const classification of requiredFieldClassifications) {
    requireValue(Array.isArray(item.fieldClassification?.[classification]), "kernel.field_classification_missing", `${workItemType} 缺少 fieldClassification.${classification}。`, { workItemType, classification });
  }
  if (p0GeneratedCandidates.has(workItemType)) {
    requireValue(item.p0GeneratedCandidate === true, "kernel.p0_candidate_flag_missing", `${workItemType} 必须是 P0 active generated candidate。`, { workItemType });
    requireValue(item.generatedStage === "P0_ACTIVE", "kernel.p0_stage_invalid", `${workItemType} generatedStage 必须是 P0_ACTIVE。`, { workItemType });
    requireValue(item.ledgerEffect?.mode === "none", "kernel.p0_ledger_mode_invalid", `${workItemType} ledgerEffect.mode 必须为 none。`, { workItemType });
    requireValue(item.ledgerEffect?.financeKernelEffectType === null, "kernel.p0_finance_effect_invalid", `${workItemType} financeKernelEffectType 必须为 null。`, { workItemType });
  }
  if (/RatePlan|Lead|Checkin|Payment|Deposit|Expense/i.test(workItemType)) {
    requireValue(item.generatedStage === "P1_BLOCKED", "kernel.p1_blocked_stage_missing", `${workItemType} 必须标记为 P1_BLOCKED，不得进入第一轮 P0 generated contracts。`, { workItemType });
    requireValue(item.p0GeneratedCandidate === false, "kernel.p1_blocked_p0_flag_invalid", `${workItemType} 不得是 P0 generated candidate。`, { workItemType });
  }
  if (/Payment|Deposit|Refund|Expense/i.test(workItemType)) {
    requireValue(item.ledgerEffect?.mode === "finance_kernel", "kernel.finance_effect_owner_invalid", `${workItemType} 必须通过 Finance / Ledger Kernel 表达账务 effect。`, { workItemType });
  }
  if (workItemType.startsWith("Finance.")) {
    requireValue(item.canonicalOwner === "finance-gate", "kernel.finance_owner_invalid", `${workItemType} canonicalOwner 必须是 finance-gate。`, { workItemType });
    requireValue(["Room", "Bed", "Stay", "RoomInspection", "ServiceTask"].some((fact) => item.forbiddenFacts?.includes(fact)), "kernel.finance_bypass_not_blocked", `${workItemType} 必须禁止写住宿业务事实。`, { workItemType });
  }
  if (item.ledgerPolicyRef !== "ledger.none.v1") {
    requireValue(String(item.systemOwner).includes("finance-gate") || item.ledgerPolicyRef === "ledger.readonly.v1", "kernel.ledger_owner_invalid", `${workItemType} 有账务策略但未归 finance-gate。`, { workItemType });
  }
  const definition = definitionsByType.get(workItemType);
  requireValue(Boolean(definition), "definition.missing", `${workItemType} 缺少 Definition。`, { workItemType });
  if (definition) {
    requireValue(definition.definitionId === item.definitionId, "definition.id_mismatch", `${workItemType} definitionId 不一致。`, { workItemType });
    requireValue(definition.commandType === item.commandType, "definition.command_mismatch", `${workItemType} commandType 不一致。`, { workItemType });
    requireValue(!("sourceCardId" in definition), "definition.source_card_current_identity", `${workItemType} Definition 不得把 sourceCardId 作为当前身份字段。`, { workItemType });
    requireMigrationRefs(definition, `${workItemType} Definition`);
    requireValue(definition.definitionMode === "oam-certification-current", "definition.mode_invalid", `${workItemType} 必须是当前 OAM Definition。`, { workItemType });
    requireValue(definition.productionConfirmAllowed === false, "definition.production_allowed", `${workItemType} 不得允许 production confirm。`, { workItemType });
  }
  const workflow = workflowsByType.get(workItemType);
  requireValue(Boolean(workflow), "workflow.missing", `${workItemType} 缺少状态机。`, { workItemType });
  if (workflow) {
    const roles = workflow.actions?.flatMap((action) => action.visibleRoles ?? []) ?? [];
    requireValue(roles.length > 0 && roles.every((role) => allowedRoles.has(role)), "workflow.roles_invalid", `${workItemType} 状态机只能暴露两角色。`, { workItemType });
    requireValue(workflow.definitionId === item.definitionId && workflow.commandType === item.commandType, "workflow.identity_mismatch", `${workItemType} 状态机必须绑定 definitionId/workItemType/commandType。`, { workItemType });
    requireValue(JSON.stringify(workflow).includes("definition_resolved"), "workflow.definition_gate_missing", `${workItemType} 状态机必须要求 definition_resolved。`, { workItemType });
    requireValue(!("sourceCardId" in workflow), "workflow.source_card_current_identity", `${workItemType} 状态机不得把 sourceCardId 当当前业务身份。`, { workItemType });
    requireMigrationRefs(workflow, `${workItemType} Workflow`);
  }
}

for (const objectId of requiredObjects) {
  const object = fieldsByObject.get(objectId);
  requireValue(Boolean(object), "field.object_missing", `字段注册缺少对象 ${objectId}。`, { objectId });
  if (!object) continue;
  for (const field of object.fields ?? []) {
    for (const required of ["fieldId", "nameZh", "owner", "source", "editableWhen", "visibleScope", "auditRequired", "searchable", "ledgerRelevant"]) {
      requireValue(required in field, "field.property_missing", `${objectId}.${field.fieldId ?? "<missing>"} 缺少 ${required}。`, { objectId, fieldId: field.fieldId, required });
    }
  }
}

for (const alias of kernel.aliases ?? []) {
  requireValue(alias.keepInDormitoryCatalog === false, "alias.catalog_invalid", `${alias.workItemType} alias 不得进入当前 catalog。`, { workItemType: alias.workItemType });
  requireValue(Boolean(workItemsByType.get(alias.canonicalWorkItemType)), "alias.target_missing", `${alias.workItemType} alias 目标不存在。`, { workItemType: alias.workItemType });
}

writeReport();
if (violations.length) {
  for (const item of violations) console.error(`${item.id}: ${item.message}`);
  process.exit(1);
}
console.log(`Dormitory operating kernel check: PASS (${workItems.length} workItems)`);

function requireValue(condition, id, message, extra = {}) {
  if (!condition) violations.push({ id, severity: "P0", message, ...extra });
}

function hasValue(value) {
  return value !== undefined && value !== null && value !== "" && (!Array.isArray(value) || value.length > 0);
}

function canonicalDefinitionsByType(definitions, kernelWorkItemsByType) {
  const byType = new Map();
  for (const definition of definitions) {
    const kernelWorkItem = kernelWorkItemsByType.get(definition.workItemType);
    const current = byType.get(definition.workItemType);
    if (!current || definition.definitionId === kernelWorkItem?.definitionId) {
      byType.set(definition.workItemType, definition);
    }
  }
  return byType;
}

function requireMigrationRefs(item, label) {
  const sourceCardRef = (item.migrationRefs ?? []).find((ref) => ref.type === "sourceCardId");
  requireValue(Boolean(sourceCardRef), "migration_ref_missing", `${label} 必须把 sourceCardId 放入 migrationRefs。`, { label });
  if (!sourceCardRef) return;
  for (const [key, expected] of [
    ["readOnly", true],
    ["executable", false],
    ["affectsAdmission", false],
    ["affectsRuntimeConfirm", false],
    ["affectsBusinessIdentity", false],
    ["affectsLedger", false]
  ]) {
    requireValue(sourceCardRef[key] === expected, "migration_ref_policy_invalid", `${label} migrationRefs.sourceCardId.${key} 必须是 ${expected}。`, { label, key });
  }
  requireValue(sourceCardRef.deletionProofRef === "docs/contracts/definition/source-id-migration-fence.json", "migration_ref_deletion_proof_missing", `${label} migrationRefs.sourceCardId 必须绑定删除证明。`, { label });
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
  } catch (error) {
    violations.push({ id: "json_invalid", severity: "P0", message: `${file} 不是合法 JSON：${error.message}` });
    return {};
  }
}

function writeReport() {
  const full = path.join(root, reportPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify({
    version: "oam.dormitory-operating-kernel-check.v1",
    checkedAtUtc: new Date().toISOString(),
    status: violations.length ? "failed" : "passed",
    workItemCount: workItems.length,
    violations
  }, null, 2)}\n`);
}
