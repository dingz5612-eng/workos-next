import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scenarioPath = "docs/business/domains/dormitory/scenarios/dormitory-resource-saleability.golden-chain.yml";
const kernelPath = "docs/business/domains/dormitory/dormitory-operating-kernel.json";
const authorityIndexPath = "docs/oam/current-authority-index.json";
const reportPath = "artifacts/oam/checks/dormitory-resource-saleability-golden-chain-result.json";

const requiredInScope = [
  "Dorm.RoomSetupConfirm",
  "Dorm.BedSetupConfirm",
  "Dorm.ResourceReadinessConfirm"
];
const requiredOutOfScope = [
  "入住",
  "预订",
  "押金",
  "收款",
  "账务入账",
  "退住",
  "Dashboard 写事实",
  "Search 写事实",
  "Surface 推断事实"
];
const requiredBusinessIdentity = [
  "goldenChainId",
  "scenarioId",
  "workItemType",
  "definitionId",
  "commandType",
  "objectId",
  "fieldId",
  "factId",
  "admissionPolicyRef",
  "evidencePolicyRef",
  "ledgerPolicyRef",
  "surfacePolicyRef"
];
const forbiddenIdentity = [
  "cardId",
  "sourceCardId",
  "workspace card",
  "old catalog id",
  "old seed id"
];
const requiredAllowedFacts = [
  "Room",
  "Bed",
  "EvidenceObject",
  "DomainEvent",
  "CommandSubmission"
];
const requiredForbiddenFacts = [
  "Payment",
  "Deposit",
  "DepositAccount",
  "LedgerEntry",
  "LedgerTransaction",
  "PaymentAllocation",
  "Refund",
  "AmountBasis",
  "MoneyBasis",
  "FinancialFact",
  "FinanceReceipt",
  "DashboardSummary 写入"
];
const requiredBranchFlows = [
  "缺字段",
  "缺证据",
  "证据不可信",
  "重复房间",
  "床位归属错误",
  "资源不可售",
  "人工复核",
  "纠错"
];
const requiredMainFlow = [
  ["Dorm.RoomSetupConfirm", "definition.dormitory.roomSetupConfirm.v1", "RoomSetup.Confirm"],
  ["Dorm.BedSetupConfirm", "definition.dormitory.bedSetupConfirm.v1", "BedSetup.Confirm"],
  ["Dorm.ResourceReadinessConfirm", "definition.dormitory.resourceReadinessConfirm.v1", "ResourceReadiness.Confirm"]
];
const forbiddenSourceRefs = [
  "docs/scenarios/dormitory/golden-pilot.yml",
  "docs/business/dormitory/current-business-journey.md",
  "docs/business/dormitory/canonical-scenario-map.json",
  "docs/business/domains/dormitory/dormitory-pilot-scenario-pack.yml",
  "docs/business/domains/dormitory/domain-pack.yml"
];

const violations = [];
const text = readText(scenarioPath);
const kernel = readJson(kernelPath);
const authorityIndex = readJson(authorityIndexPath);

requireValue(hasLine("version: oam.dormitory.resource-saleability-golden-chain.v1"), "scenario.version", "第一金链场景定稿包 version 不正确。");
requireValue(hasLine("status: authoritative"), "scenario.status", "第一金链场景定稿包必须是 authoritative。");
requireValue(hasLine("layer: source"), "scenario.layer", "第一金链场景定稿包必须声明 layer: source。");
requireValue(hasLine("manualEditAllowed: true"), "scenario.manual_edit", "第一金链场景定稿包必须允许人工维护。");
requireValue(hasLine("generated: false"), "scenario.generated_false", "第一金链场景定稿包不得是 generated。");
requireValue(hasLine("doNotEdit: false"), "scenario.do_not_edit_false", "第一金链场景定稿包不得声明 doNotEdit。");
requireValue(hasLine("scenarioNameZh: 宿舍资源可售第一金链"), "scenario.name", "场景名称必须是宿舍资源可售第一金链。");
requireValue(hasLine("businessGoalZh: 房间、床位、资源准备达到 L1 internal pilot 可售条件。"), "scenario.goal", "业务目标必须绑定 L1 internal pilot 可售条件。");

requireList("inScope", requiredInScope);
requireList("outOfScope", requiredOutOfScope);
requireList("allowedFacts", requiredAllowedFacts);
requireList("forbiddenFacts", requiredForbiddenFacts);
requireList("branchFlows", requiredBranchFlows);
requireList("businessIdentity", requiredBusinessIdentity);
for (const item of forbiddenIdentity) requireValue(section("businessIdentity").includes(`- ${item}`), "scenario.forbidden_identity_missing", `禁止身份缺少 ${item}。`, { item });

const allowedIdentityBlock = between(section("businessIdentity"), "allowed:", "forbidden:");
requireValue(!allowedIdentityBlock.includes("policyRef"), "scenario.policy_ref_generic_in_allowed_identity", "businessIdentity.allowed 不得保留泛称 policyRef。");
const deprecatedAliasesBlock = between(section("businessIdentity"), "deprecatedAliases:", "roles:");
for (const required of ["alias: policyRef", "readOnly: true", "executable: false", "notCompilerInput: true", "admissionPolicyRef", "evidencePolicyRef", "ledgerPolicyRef", "surfacePolicyRef"]) {
  requireValue(deprecatedAliasesBlock.includes(required), "scenario.policy_ref_deprecated_alias_missing", `policyRef deprecatedAlias 缺少 ${required}。`, { required });
}
for (const item of forbiddenIdentity) {
  requireValue(!allowedIdentityBlock.includes(item), "scenario.compat_identity_in_allowed_identity", `${item} 不得进入业务身份 allowed。`, { item });
}
for (const item of forbiddenIdentity) {
  const fence = migrationFenceFor(item);
  requireValue(Boolean(fence), "scenario.migration_fence_missing", `${item} 必须进入 migrationFences。`, { item });
  if (fence) {
    for (const required of ["readOnly: true", "executable: false", "affectsAdmission: false", "affectsRuntimeConfirm: false", "affectsBusinessIdentity: false", "affectsLedger: false", "deletionProofRef: docs/contracts/definition/source-id-migration-fence.json"]) {
      requireValue(fence.includes(required), "scenario.migration_fence_field_missing", `${item} migrationFences 缺少 ${required}。`, { item, required });
    }
  }
}

const financeLedgerBoundary = section("financeLedgerBoundary");
for (const required of [
  "ledgerPolicyRef: ledger.none.v1",
  "ledgerEntryAllowed: false",
  "ledgerTransactionAllowed: false",
  "moneyBasisAllowed: false",
  "amountBasisAllowed: false",
  "paymentFactAllowed: false",
  "depositFactAllowed: false",
  "refundFactAllowed: false",
  "financeKernelHandoffAllowed: false",
  "businessDomainMaySubmitAmountBasis: false"
]) {
  requireValue(financeLedgerBoundary.includes(required), "scenario.finance_ledger_boundary_missing", `financeLedgerBoundary 缺少 ${required}。`, { required });
}
for (const workItemType of requiredInScope) {
  const zeroImpact = blockFor(financeLedgerBoundary, `workItemType: ${workItemType}`, "\n    - workItemType:");
  requireValue(Boolean(zeroImpact), "scenario.finance_zero_impact_missing", `${workItemType} 缺少账务零影响声明。`, { workItemType });
  for (const required of ["producesMoneyBasis: false", "producesAmountBasis: false", "producesLedgerTransaction: false", "producesLedgerEntry: false"]) {
    requireValue(zeroImpact.includes(required), "scenario.finance_zero_impact_field_missing", `${workItemType} 缺少 ${required}。`, { workItemType, required });
  }
}

const fieldContracts = section("fieldContracts");
for (const required of [
  "workItemType: Dorm.RoomSetupConfirm",
  "fieldId: room.basicProfile",
  "sourceFieldId: room.basicProfile",
  "labelCopyKey: dormitory.resourceSaleability.field.roomBasicProfile",
  "displayNameZhForReviewOnly: 房间基础信息",
  "forbiddenSubfields:",
  "- readinessState",
  "- saleabilityState",
  "- 可售状态",
  "workItemType: Dorm.BedSetupConfirm",
  "fieldId: roomId",
  "sourceFieldId: bed.roomId",
  "inputMode: selectedStableRef",
  "rawIdManualInputAllowed: false",
  "workItemType: Dorm.ResourceReadinessConfirm",
  "fieldId: bedId",
  "sourceFieldId: resource.bedId",
  "fieldId: readinessState",
  "sourceFieldId: resource.readinessState"
]) {
  requireValue(fieldContracts.includes(required), "scenario.field_contract_missing", `fieldContracts 缺少 ${required}。`, { required });
}
for (const forbidden of ["route param", "cardId", "sourceCardId", "workspaceCardId", "search label"]) {
  requireValue(section("selectedStableRefRules").includes(`- ${forbidden}`), "scenario.stable_ref_forbidden_source_missing", `selectedStableRefRules 必须禁止 ${forbidden}。`, { forbidden });
}
requireValue(section("objectIdBinding").includes("oldCardIdRenameBlocked: true"), "scenario.old_card_rename_not_blocked", "objectIdBinding 必须阻断旧 cardId 换名伪装。");
requireValue(section("sourceFieldGaps").includes("pending00Decision: true") && section("sourceFieldGaps").includes("compilePreparationAllowed: false_until_00_approval"), "scenario.source_field_gap_policy_missing", "sourceFieldGaps 必须等待 00 裁决且不得放行编译准备。");

const mainFlow = section("mainFlow");
const workItemsInFlow = [...mainFlow.matchAll(/workItemType:\s*([^\n\r]+)/g)].map((match) => match[1].trim());
const definitionIdsInFlow = [...mainFlow.matchAll(/definitionId:\s*([^\n\r]+)/g)].map((match) => match[1].trim());
const commandTypesInFlow = [...mainFlow.matchAll(/commandType:\s*([^\n\r]+)/g)].map((match) => match[1].trim());
requireValue(JSON.stringify(workItemsInFlow) === JSON.stringify(requiredMainFlow.map((item) => item[0])), "scenario.main_flow_order", "主流程必须是 RoomSetupConfirm -> BedSetupConfirm -> ResourceReadinessConfirm。");
for (const [index, [workItemType, definitionId, commandType]] of requiredMainFlow.entries()) {
  requireValue(definitionIdsInFlow[index] === definitionId, "scenario.definition_id_mismatch", `${workItemType} definitionId 不正确。`, { workItemType });
  requireValue(commandTypesInFlow[index] === commandType, "scenario.command_type_mismatch", `${workItemType} commandType 不正确。`, { workItemType });
  const kernelItem = (kernel.workItems ?? []).find((item) => item.workItemType === workItemType);
  requireValue(Boolean(kernelItem), "scenario.kernel_workitem_missing", `${workItemType} 不在宿舍 operating kernel。`, { workItemType });
  if (kernelItem) {
    requireValue(kernelItem.definitionId === definitionId, "scenario.kernel_definition_mismatch", `${workItemType} 与 operating kernel definitionId 不一致。`, { workItemType });
    requireValue(kernelItem.commandType === commandType, "scenario.kernel_command_mismatch", `${workItemType} 与 operating kernel commandType 不一致。`, { workItemType });
    requireValue(kernelItem.ledgerPolicyRef === "ledger.none.v1", "scenario.kernel_ledger_policy_invalid", `${workItemType} 第一金链必须是 ledger.none.v1。`, { workItemType });
    requireValue(isL1InternalPilotRef(kernelItem.admissionPolicyRef), "scenario.kernel_admission_policy_invalid", `${workItemType} 必须绑定 L1 internal pilot admission。`, { workItemType });
    requireValue((kernelItem.allowedHumanRoles ?? []).every((role) => ["宿舍经办人", "宿舍负责人"].includes(role)), "scenario.kernel_role_invalid", `${workItemType} 只能使用宿舍经办人/宿舍负责人。`, { workItemType });
  }
}

requireValue(section("roles").includes("- 宿舍经办人") && section("roles").includes("- 宿舍负责人") && hasLine("thirdRoleAllowed: false"), "scenario.roles", "场景只能包含宿舍经办人和宿舍负责人。");
requireValue(hasLine("admissionPolicyRef: dormitory_l1_internal_pilot_observation"), "scenario.admission_policy_ref", "admissionPolicyRef 必须绑定 L1 internal pilot。");
requireValue(section("admissionPolicy").includes("internalPilotConfirmAllowed: true") && section("admissionPolicy").includes("productionConfirmAllowed: false"), "scenario.admission_policy", "只允许 internal pilot confirm，不能允许 production confirm。");
requireValue(hasLine("ledgerPolicyRef: ledger.none.v1"), "scenario.ledger_policy", "第一金链 ledgerPolicyRef 必须是 ledger.none.v1。");
requireValue(hasLine("evidencePolicyRef: evidence.dormitory.resource-saleability.v1"), "scenario.evidence_policy_ref", "必须声明 evidencePolicyRef。");
for (const evidence of ["room-photo", "room-basic-info", "bed-photo", "room-link-proof", "completion-photo", "verification-check"]) {
  requireValue(text.includes(`- ${evidence}`), "scenario.evidence_missing", `证据要求缺少 ${evidence}。`, { evidence });
}
requireValue(hasLine("surfacePolicyRef: surface.generated.dormitory.resource-saleability.v1"), "scenario.surface_policy_ref", "必须声明 Surface 只消费 generated surface model。");
requireValue(section("surfacePolicy").includes("consumes: generated surface model") && section("surfacePolicy").includes("fallbackAllowed: false"), "scenario.surface_policy", "Surface policy 必须 generated-only 且 fallbackAllowed=false。");
for (const output of ["SearchResult", "Lens", "Projection", "Dashboard"]) {
  requireValue(new RegExp(`\\n\\s{2}${escapeRegExp(output)}:\\s*\\n\\s{4}mode: readonly\\b`).test(text), "scenario.read_model_readonly", `${output} 必须只读。`, { output });
}
for (const condition of ["evidence satisfied", "admission satisfied", "generated contracts compiled", "runtime boundary passed", "negative tests passed", "evidence graph proof DAG passed", "release evidence current"]) {
  requireValue(text.includes(`- ${condition}`), "scenario.go_no_go_condition_missing", `GO / NO_GO 条件缺少 ${condition}。`, { condition });
}
requireValue(hasLine("noGoUntilAllSatisfied: true"), "scenario.no_go_until_all_satisfied", "未满足前必须一律 NO_GO。");

for (const ref of forbiddenSourceRefs) {
  requireValue(!section("sourceReferences").includes(ref), "scenario.generated_view_used_as_source", `${ref} 不得作为 Source 引用。`, { ref });
}

const authorityEntry = (authorityIndex.entries ?? []).find((entry) => entry.path === scenarioPath);
requireValue(Boolean(authorityEntry), "scenario.authority_index_missing", "第一金链场景定稿包必须登记到 current-authority-index。");
if (authorityEntry) {
  requireValue(authorityEntry.layer === "source", "scenario.authority_layer", "authority index 必须登记为 source。");
  requireValue(authorityEntry.authorityRole === "sourceKernel", "scenario.authority_role", "authorityRole 必须是 sourceKernel。");
  requireValue(authorityEntry.manualEditAllowed === true, "scenario.authority_manual_edit", "Source 场景必须 manualEditAllowed=true。");
  requireValue(authorityEntry.generated === false && authorityEntry.doNotEdit === false, "scenario.authority_generated_flags", "Source 场景不得 generated/doNotEdit。");
  requireValue(authorityEntry.currentTruthAllowed === true && authorityEntry.businessFactAuthorityAllowed === true, "scenario.authority_truth", "Source 场景必须允许业务事实权威。");
}
const whitelist = new Set(authorityIndex.classificationModel?.sourceLayerWhitelist ?? []);
const topWhitelist = new Set((authorityIndex.sourceLayerWhitelist ?? []).map((item) => item.path));
requireValue(whitelist.has(scenarioPath) && topWhitelist.has(scenarioPath), "scenario.source_whitelist_missing", "第一金链场景定稿包必须进入 Source Layer 白名单。");

writeReport();
if (violations.length) {
  for (const item of violations) console.error(`${item.id}: ${item.message}`);
  process.exit(1);
}
console.log("Dormitory resource saleability golden chain check: PASS");

function requireList(sectionName, items) {
  const block = section(sectionName);
  for (const item of items) {
    requireValue(block.includes(`- ${item}`) || block.includes(`nameZh: ${item}`) || block.includes(`workItemType: ${item}`), "scenario.required_item_missing", `${sectionName} 缺少 ${item}。`, { sectionName, item });
  }
}

function migrationFenceFor(term) {
  const block = section("migrationFences");
  const marker = `term: ${term}`;
  const index = block.indexOf(marker);
  if (index < 0) return "";
  const next = block.indexOf("\n  - term:", index + marker.length);
  return next < 0 ? block.slice(index) : block.slice(index, next);
}

function section(name) {
  const pattern = new RegExp(`^${escapeRegExp(name)}:\\s*$`, "m");
  const match = pattern.exec(text);
  if (!match) return "";
  const start = match.index + match[0].length;
  const rest = text.slice(start);
  const next = /\n[A-Za-z0-9_.-]+:\s*/.exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}

function between(value, start, end) {
  const startIndex = value.indexOf(start);
  if (startIndex < 0) return "";
  const endIndex = value.indexOf(end, startIndex + start.length);
  return endIndex < 0 ? value.slice(startIndex + start.length) : value.slice(startIndex + start.length, endIndex);
}

function blockFor(value, marker, nextMarker) {
  const start = value.indexOf(marker);
  if (start < 0) return "";
  const next = value.indexOf(nextMarker, start + marker.length);
  return next < 0 ? value.slice(start) : value.slice(start, next);
}

function hasLine(line) {
  return text.split(/\r?\n/).some((item) => item.trim() === line);
}

function isL1InternalPilotRef(value) {
  const normalized = String(value ?? "").toLowerCase().replace(/[-.\s]+/g, "_");
  return normalized.includes("l1") && normalized.includes("internal_pilot");
}

function readText(file) {
  try {
    return fs.readFileSync(path.join(root, file), "utf8");
  } catch (error) {
    violations.push({ id: "file_missing", severity: "P0", message: `${file} 不存在：${error.message}` });
    return "";
  }
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
  } catch (error) {
    violations.push({ id: "json_invalid", severity: "P0", message: `${file} 不是合法 JSON：${error.message}` });
    return {};
  }
}

function requireValue(condition, id, message, extra = {}) {
  if (!condition) violations.push({ id, severity: "P0", message, ...extra });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function writeReport() {
  const full = path.join(root, reportPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify({
    version: "oam.dormitory-resource-saleability-golden-chain-check.v1",
    checkedAtUtc: new Date().toISOString(),
    scenarioPath,
    status: violations.length ? "failed" : "passed",
    violations
  }, null, 2)}\n`);
}
