import {
  failIfViolations,
  indexBy,
  readJson,
  requireValue,
  requiredScenarioIds,
  violation
} from "./lib/oam-business-semantic-lib.mjs";

const checkId = "dormitory-execution-kernel";
const scannedFiles = [
  "docs/business/dormitory/workitem-decision-table.json",
  "docs/business/dormitory/workitem-catalog.yml",
  "docs/business/dormitory/value-streams.yml",
  "docs/business/dormitory/evidence-policy.yml",
  "docs/business/dormitory/evidence-requirements.yml",
  "docs/business/dormitory/ledger-posting-contract.yml",
  "docs/business/dormitory/canonical-scenario-map.json",
  "docs/scenarios/dormitory/golden-pilot.yml",
  "docs/business/dormitory/scenario-field-contract.yml",
  "docs/contracts/definition/workitem-definition-registry.json",
  "docs/contracts/business/oam-workflow-state-registry.json",
  "docs/contracts/database/oam-db-ownership-map.json",
  "docs/business/dormitory/workitem-sla.yml"
];

const decisionTable = readJson(scannedFiles[0]);
const catalog = readJson(scannedFiles[1]);
const valueStreams = readJson(scannedFiles[2]);
const evidencePolicy = readJson(scannedFiles[3]);
const evidenceRequirements = readJson(scannedFiles[4]);
const ledger = readJson(scannedFiles[5]);
const canonical = readJson(scannedFiles[6]);
const scenarios = readJson(scannedFiles[7]);
const fields = readJson(scannedFiles[8]);
const registry = readJson(scannedFiles[9]);
const workflow = readJson(scannedFiles[10]);
const db = readJson(scannedFiles[11]);
const sla = readJson(scannedFiles[12]);
const violations = [];

const decisions = decisionTable.decisions ?? [];
const decisionsByType = indexBy(decisions, "workItemType");
const catalogByType = indexBy(catalog.workItems ?? [], "workItemType");
const definitionsById = indexBy(registry.definitions ?? [], "definitionId");
const definitionsByType = indexBy(registry.definitions ?? [], "workItemType");
const workflowsBySource = indexBy(workflow.workflows ?? [], "sourceCardId");
const policyByRequirement = indexBy(evidencePolicy.requirements ?? [], "requirementId");
const requirementById = indexBy(evidenceRequirements.evidenceRequirements ?? [], "requirementId");
const dbGroups = new Set((db.tableGroups ?? []).map((item) => item.groupId));
const currentCatalogTypes = new Set(decisions.filter((item) => item.keepInDormitoryCatalog).map((item) => item.workItemType));
const definitionRequiredTypes = new Set(decisions.filter((item) => item.definitionRequired).map((item) => item.workItemType));

requireValue(decisionTable.version === "oam.dormitory.workitem-decision-table.v1", violations, "decision.version_invalid", "宿舍裁决表版本不正确。");
requireValue(decisionTable.status === "authoritative", violations, "decision.status_invalid", "宿舍裁决表必须是 authoritative。");
requireValue(decisionTable.productionAllowed === false, violations, "decision.production_allowed", "宿舍裁决表不得允许 production。");
requireValue(decisionTable.sourceInput?.count === 24, violations, "decision.source_count_invalid", "宿舍裁决表必须声明 24 个来源动作。");
requireValue(decisions.length === 24, violations, "decision.count_mismatch", `宿舍裁决表必须逐项裁决 24 个动作，当前 ${decisions.length} 个。`);

const seenDecisions = new Set();
for (const decision of decisions) {
  requireValue(Boolean(decision.workItemType), violations, "decision.workitem_missing", "裁决项缺少 workItemType。");
  if (seenDecisions.has(decision.workItemType)) {
    violations.push(violation("decision.duplicate_workitem", `裁决项重复：${decision.workItemType}`, { workItemType: decision.workItemType }));
  }
  seenDecisions.add(decision.workItemType);
  requireValue(Boolean(decision.decision), violations, "decision.class_missing", `${decision.workItemType} 缺少 decision。`, { workItemType: decision.workItemType });
  requireValue(typeof decision.keepInDormitoryCatalog === "boolean", violations, "decision.catalog_flag_invalid", `${decision.workItemType} keepInDormitoryCatalog 必须是布尔值。`, { workItemType: decision.workItemType });
  requireValue(typeof decision.definitionRequired === "boolean", violations, "decision.definition_flag_invalid", `${decision.workItemType} definitionRequired 必须是布尔值。`, { workItemType: decision.workItemType });
  requireValue(Boolean(decision.reasonZh), violations, "decision.reason_missing", `${decision.workItemType} 缺少中文裁决原因。`, { workItemType: decision.workItemType });
  if (decision.keepInDormitoryCatalog) {
    requireValue(decision.decision === "currentExecutableWorkItem", violations, "decision.catalog_not_current", `${decision.workItemType} 进入 catalog 时必须裁决为 currentExecutableWorkItem。`, { workItemType: decision.workItemType });
    requireValue(decision.definitionRequired === true, violations, "decision.catalog_definition_missing", `${decision.workItemType} 进入 catalog 时必须要求 Definition。`, { workItemType: decision.workItemType });
  }
  if (decision.decision === "externalFinanceGovernance") {
    requireValue(decision.keepInDormitoryCatalog === false, violations, "decision.external_in_catalog", `${decision.workItemType} 是财务治理动作，不得进入宿舍 catalog。`, { workItemType: decision.workItemType });
    requireValue(decision.definitionRequired === true, violations, "decision.external_definition_missing", `${decision.workItemType} 必须保留 Finance Definition。`, { workItemType: decision.workItemType });
  }
}

for (const item of catalog.workItems ?? []) {
  const decision = decisionsByType.get(item.workItemType);
  requireValue(Boolean(decision), violations, "catalog.decision_missing", `${item.workItemType} 在 catalog 中但缺少裁决。`, { workItemType: item.workItemType });
  if (!decision) continue;
  requireValue(decision.keepInDormitoryCatalog === true, violations, "catalog.non_current_present", `${item.workItemType} 裁决不允许进入宿舍 catalog。`, { workItemType: item.workItemType });
  requireValue(item.decisionRef === item.workItemType, violations, "catalog.decision_ref_invalid", `${item.workItemType} decisionRef 必须指向自身裁决。`, { workItemType: item.workItemType });
  for (const field of ["ownerRole", "backupOwner", "escalationOwner", "SLA", "requiredEvidence", "affectedFacts", "confirmationPolicy", "riskLevel", "idempotencyScope", "lensOutputs", "certificationScenario"]) {
    requireValue(Boolean(item[field]) && (!Array.isArray(item[field]) || item[field].length > 0), violations, "catalog.field_missing", `${item.workItemType} 缺少 ${field}。`, { workItemType: item.workItemType, field });
  }
  requireValue(item.factTraceRequired === true, violations, "catalog.fact_trace_missing", `${item.workItemType} 必须要求 fact trace。`, { workItemType: item.workItemType });
}
for (const workItemType of currentCatalogTypes) {
  requireValue(Boolean(catalogByType.get(workItemType)), violations, "catalog.current_missing", `${workItemType} 裁决为当前宿舍动作但不在 catalog。`, { workItemType });
}

for (const stream of valueStreams.valueStreams ?? []) {
  for (const workItemType of stream.workItemTypes ?? []) {
    const decision = decisionsByType.get(workItemType);
    requireValue(Boolean(decision), violations, "value_stream.decision_missing", `${stream.id} 引用未裁决动作 ${workItemType}。`, { streamId: stream.id, workItemType });
    requireValue(decision?.keepInDormitoryCatalog === true, violations, "value_stream.non_current_workitem", `${stream.id} workItemTypes 只能引用当前宿舍 catalog 动作：${workItemType}`, { streamId: stream.id, workItemType });
  }
  for (const workItemType of stream.absorbedActionTypes ?? []) {
    const decision = decisionsByType.get(workItemType);
    requireValue(Boolean(decision), violations, "value_stream.absorbed_decision_missing", `${stream.id} absorbedActionTypes 引用未裁决动作 ${workItemType}。`, { streamId: stream.id, workItemType });
    requireValue(decision?.keepInDormitoryCatalog === false, violations, "value_stream.absorbed_current", `${stream.id} absorbedActionTypes 不得包含当前 catalog 动作：${workItemType}`, { streamId: stream.id, workItemType });
  }
}

for (const requirement of evidencePolicy.requirements ?? []) {
  requireValue(Boolean(requirementById.get(requirement.requirementId)), violations, "evidence.requirement_fields_missing", `${requirement.requirementId} 缺少 evidence-requirements 字段定义。`, { requirementId: requirement.requirementId });
  for (const workItemType of requirement.workItemTypes ?? []) {
    if (workItemType.startsWith("Gate.")) continue;
    const decision = decisionsByType.get(workItemType);
    requireValue(Boolean(decision), violations, "evidence.policy_decision_missing", `${workItemType} 在 evidence-policy 中但缺少裁决。`, { workItemType });
    requireValue(decision?.keepInDormitoryCatalog === true || decision?.decision === "externalFinanceGovernance", violations, "evidence.policy_non_current", `${workItemType} 不是当前执行或财务治理动作，不得挂证据策略。`, { workItemType });
  }
}
for (const item of catalog.workItems ?? []) {
  for (const requirementId of item.requiredEvidence ?? []) {
    const policy = policyByRequirement.get(requirementId);
    requireValue(Boolean(policy), violations, "catalog.evidence_policy_missing", `${item.workItemType} requiredEvidence ${requirementId} 缺少 evidence-policy。`, { workItemType: item.workItemType, requirementId });
    requireValue((policy?.workItemTypes ?? []).includes(item.workItemType), violations, "catalog.evidence_policy_not_bound", `${requirementId} 未绑定 ${item.workItemType}。`, { workItemType: item.workItemType, requirementId });
  }
}

for (const posting of ledger.postings ?? []) {
  for (const workItemType of posting.workItemTypes ?? []) {
    const decision = decisionsByType.get(workItemType);
    requireValue(Boolean(decision), violations, "ledger.posting_decision_missing", `${posting.basisType} 引用未裁决动作 ${workItemType}。`, { basisType: posting.basisType, workItemType });
    requireValue(decision?.keepInDormitoryCatalog === true || decision?.decision === "externalFinanceGovernance", violations, "ledger.posting_non_current", `${posting.basisType} 不得引用非当前动作 ${workItemType}。`, { basisType: posting.basisType, workItemType });
  }
}

const scenarioById = indexBy(scenarios.scenarios ?? [], "scenarioId");
const fieldByScenario = indexBy(fields.fieldSets ?? [], "scenarioId");
const canonicalByScenario = indexBy(canonical.mappings ?? [], "scenarioId");
for (const scenarioId of requiredScenarioIds) {
  const scenario = scenarioById.get(scenarioId);
  const fieldSet = fieldByScenario.get(scenarioId);
  const mapping = canonicalByScenario.get(scenarioId);
  requireValue(Boolean(scenario), violations, "scenario.source_missing", `${scenarioId} 缺少金标场景。`, { scenarioId });
  requireValue(Boolean(fieldSet), violations, "scenario.field_missing", `${scenarioId} 缺少字段合同。`, { scenarioId });
  requireValue(Boolean(mapping), violations, "scenario.canonical_missing", `${scenarioId} 缺少 canonical mapping。`, { scenarioId });
  if (!scenario || !mapping) continue;
  const decision = decisionsByType.get(scenario.workItemType);
  requireValue(Boolean(decision), violations, "scenario.decision_missing", `${scenarioId} workItemType 缺少裁决：${scenario.workItemType}`, { scenarioId, workItemType: scenario.workItemType });
  requireValue(decision?.definitionRequired === true, violations, "scenario.definition_not_required", `${scenarioId} 必须绑定需要 Definition 的当前动作。`, { scenarioId, workItemType: scenario.workItemType });
  requireValue(mapping.definitionId === decision?.definitionId, violations, "scenario.definition_mismatch", `${scenarioId} mapping definitionId 与裁决不一致。`, { scenarioId, expected: decision?.definitionId, actual: mapping.definitionId });
  if (fieldSet) {
    requireValue(fieldSet.workItemType === scenario.workItemType, violations, "scenario.field_workitem_mismatch", `${scenarioId} 字段合同 workItemType 与金标场景不一致。`, { scenarioId });
  }
}

for (const decision of decisions.filter((item) => item.definitionRequired)) {
  const definition = definitionsById.get(decision.definitionId);
  requireValue(Boolean(definition), violations, "definition.missing", `${decision.workItemType} 缺少 Definition：${decision.definitionId}`, { workItemType: decision.workItemType, definitionId: decision.definitionId });
  if (!definition) continue;
  requireValue(definition.workItemType === decision.workItemType, violations, "definition.workitem_mismatch", `${decision.definitionId} workItemType 与裁决不一致。`, { definitionId: decision.definitionId });
  requireValue(definition.commandType === decision.commandType, violations, "definition.command_mismatch", `${decision.definitionId} commandType 与裁决不一致。`, { definitionId: decision.definitionId });
  requireValue(definition.workspaceId === decision.workspaceId, violations, "definition.workspace_mismatch", `${decision.definitionId} workspaceId 与裁决不一致。`, { definitionId: decision.definitionId });
  requireValue(definition.ownerSlice === decision.ownerSlice, violations, "definition.owner_slice_mismatch", `${decision.definitionId} ownerSlice 与裁决不一致。`, { definitionId: decision.definitionId });
  requireValue(definition.definitionMode === "oam-certification-current", violations, "definition.mode_not_current", `${decision.definitionId} 必须声明 oam-certification-current。`, { definitionId: decision.definitionId });
  requireValue(definition.productionConfirmAllowed === false, violations, "definition.production_allowed", `${decision.definitionId} 不得允许 production confirm。`, { definitionId: decision.definitionId });
  requireValue(Boolean(workflowsBySource.get(definition.sourceCardId)), violations, "definition.workflow_missing", `${decision.definitionId} 缺少当前 workflow sourceCardId：${definition.sourceCardId}`, { definitionId: decision.definitionId });
  for (const groupId of decision.dbTableGroups ?? []) {
    requireValue(dbGroups.has(groupId), violations, "definition.db_group_missing", `${decision.workItemType} 引用不存在的数据库表组：${groupId}`, { workItemType: decision.workItemType, groupId });
  }
}
for (const definition of registry.definitions ?? []) {
  const decision = decisionsByType.get(definition.workItemType);
  if (!decision && definition.definitionMode !== "surface-input-adapter") continue;
  if (decision?.definitionRequired === false) {
    requireValue(definition.definitionMode === "surface-input-adapter", violations, "definition.non_current_not_adapter", `${definition.definitionId} 对应非当前动作，必须降为 surface-input-adapter。`, { definitionId: definition.definitionId });
  }
}

for (const workflowItem of workflow.workflows ?? []) {
  const sourceDefinition = (registry.definitions ?? []).find((item) => item.sourceCardId === workflowItem.sourceCardId);
  requireValue(Boolean(sourceDefinition), violations, "workflow.definition_missing", `${workflowItem.workflowId} sourceCardId 不在 Definition Registry。`, { workflowId: workflowItem.workflowId, sourceCardId: workflowItem.sourceCardId });
  if (!sourceDefinition) continue;
  requireValue(definitionRequiredTypes.has(sourceDefinition.workItemType), violations, "workflow.non_current_definition", `${workflowItem.workflowId} 只能绑定当前执行或财务治理 Definition。`, { workflowId: workflowItem.workflowId, workItemType: sourceDefinition.workItemType });
}

const slaTypes = new Set((sla.workItemSlaRefs ?? []).map((item) => item.workItemType));
for (const workItemType of currentCatalogTypes) {
  requireValue(slaTypes.has(workItemType), violations, "sla.current_missing", `${workItemType} 缺少 SLA。`, { workItemType });
}
for (const workItemType of slaTypes) {
  requireValue(currentCatalogTypes.has(workItemType), violations, "sla.non_current_present", `${workItemType} 在 SLA 中但不在当前宿舍 catalog。`, { workItemType });
}

failIfViolations(checkId, violations, scannedFiles);
